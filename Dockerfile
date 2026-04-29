# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=""
ENV VITE_PS2_API_URL="https://ps2-api.twinverse.org"
RUN npm run build

# Stage 2: Production image
FROM python:3.12-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist /app/static

# Copy docs (for doc viewer API)
COPY docs/ /app/docs/
ENV DOCS_DIR=/app/docs

# 환경변수 — Orbitron 대시보드에서 DATABASE_URL을 반드시 주입할 것
ENV UPLOAD_DIR=/app/uploads
ENV FRONTEND_URL=https://twinverseai.twinverse.org
ENV SECRET_KEY=orbitron-twinverseai-secret-key-2026
ENV DATABASE_URL=postgresql://orbitron_user:orbitron_db_pass@orbitron-twinverseai-db:5432/orbitron_db

# uploads 디렉토리 (갤러리 기본 이미지는 backend/gallery_defaults/에 포함)
RUN mkdir -p /app/uploads

VOLUME ["/app/uploads"]

# Expose port (Orbitron overrides via PORT env at runtime)
EXPOSE 8000

# Health check — respect runtime PORT (Orbitron sets PORT=<assigned>)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request, os; urllib.request.urlopen('http://localhost:' + os.getenv('PORT', '8000') + '/health')" || exit 1

# Run — bind to ${PORT} so Orbitron-assigned port matches actual listener
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"
