# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=""
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

# Default environment variables (Orbitron 대시보드에서 override 가능)
ENV DATABASE_URL=postgresql://orbitron_user:orbitron_db_pass@orbitron-twinverseai-db:3718/orbitron_db
ENV SECRET_KEY=twinverse-ai-jwt-secret-key-2026
ENV FRONTEND_URL=https://twinverseai.twinverse.org
ENV UPLOAD_DIR=/app/uploads

# uploads 디렉토리 (갤러리 기본 이미지는 backend/gallery_defaults/에 포함)
RUN mkdir -p /app/uploads

VOLUME ["/app/uploads"]

# Expose port
EXPOSE 8000

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
