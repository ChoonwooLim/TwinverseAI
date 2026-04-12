# Pixel Streaming GPU Server

> twinverse-ai (192.168.219.117) | RTX 3090 24GB | Ubuntu 24.04

## Architecture Overview

### Role Separation

| Server | Role | IP |
|--------|------|-----|
| PS2 Windows PC | Dev/Packaging Only (UE5 Editor, Linux Cross-Compile) | Local |
| Orbitron | Build Orchestrator (Docker Build -> Remote Deploy) | 192.168.219.101 |
| **twinverse-ai** | **GPU Rendering Worker (Pixel Streaming Production)** | **192.168.219.117** |

### System Diagram

```
Developer PC (Windows)
  UE5 Editor -> Package (Linux) -> build/ -> git push main
                                      |
                                      v
                               [GitHub]
                          TwinversePS2-Deploy
                                      |
                                      v
Orbitron (192.168.219.101)
  git pull -> docker build -> SSH transfer -> remote deploy
  (Existing: TwinverseAI webapp + PostgreSQL hosting)
                                      |
                                      v
twinverse-ai (192.168.219.117)
  Docker Container (--gpus all, RTX 3090):
  +-- UE5 Linux Build (Rendering)
  +-- Wilbur (WebRTC Signaling, 8080/8888)
  +-- PS2 Backend (Spawner API, 9000)
  
  Cloudflare Tunnel:
  +-- ps2-api.twinverse.org -> :9000
  +-- ps2.twinverse.org     -> :8080
  
  Existing Services:
  +-- Ollama (11434)
  +-- AI Image Service (8100)
```

---

## Deployment Pipeline

### Flow

```
[0:00] git push main
[0:05] Orbitron detects -> git pull
[0:30] docker build (first: ~10min, cached: ~2min)
[2:00] docker save | ssh docker load (image transfer ~3min)
[5:00] docker compose down -> up --gpus all
[5:30] Health check passes
[5:30] DEPLOY COMPLETE
```

### Deploy Script (deploy-to-gpu.sh)

Orbitron executes 4 stages:

1. **docker build** - Build GPU container image
2. **docker save | ssh docker load** - Transfer to twinverse-ai
3. **ssh docker compose down && up** - Replace container
4. **Health check** - Wait up to 60s, 5s interval polling `/api/ps2/health`

---

## Repository Structure

```
ChoonwooLim/TwinversePS2-Deploy (Private)
|
+-- build/                    # UE5 Linux Package (Git LFS)
|   +-- TwinverseDesk          # Linux executable
|   +-- TwinverseDesk/         # Content, Config, Assets
|
+-- wilbur/                   # Pixel Streaming 2 Signaling Server
|   +-- package.json
|   +-- dist/
|   +-- www/                   # Player webpage
|
+-- backend/                  # PS2 Dedicated Backend
|   +-- ps2_server.py          # FastAPI (port 9000)
|   +-- services/
|   |   +-- ps2_service.py     # Linux-compatible spawner
|   |   +-- ps2_dedicated_service.py
|   |   +-- ps2_launcher.py
|   +-- models/
|   +-- requirements.txt
|
+-- scripts/
|   +-- deploy-to-gpu.sh       # Orbitron -> twinverse-ai deploy
|   +-- healthcheck.sh
|   +-- entrypoint.sh          # Wilbur + Backend simultaneous start
|
+-- tunnel/
|   +-- config.yml             # Cloudflare Tunnel config
|
+-- Dockerfile                 # CUDA + Node + Python multi-stage
+-- docker-compose.yml         # --gpus all, ports, volumes
+-- Orbitron.yaml              # Deploy configuration
```

---

## Docker Container

### Multi-Stage Build

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| 1 | `node:20-slim` | Wilbur npm ci |
| 2 | `nvidia/cuda:13.0.0-runtime-ubuntu24.04` | CUDA + Vulkan + Python + Node + UE5 |

### Internal Layout

| Path | Content |
|------|---------|
| `/opt/ue5/` | UE5 Linux build (TwinverseDesk binary + assets) |
| `/opt/wilbur/` | Wilbur signaling server |
| `/opt/backend/` | PS2 Backend + Python venv |
| `/entrypoint.sh` | Wilbur (background) + uvicorn (foreground) |

### Ports

| Port | Service | Protocol |
|------|---------|----------|
| 8080 | Wilbur Player | HTTP |
| 8888 | Wilbur Signaling | WebSocket |
| 9000 | PS2 Spawner API | HTTP |
| 7777 | UE5 Dedicated Server | UDP |

---

## Hardware Specs (twinverse-ai)

| Component | Spec |
|-----------|------|
| CPU | AMD Ryzen Threadripper 3970X (32C/64T) |
| RAM | 128 GB DDR4 |
| GPU | NVIDIA RTX 3090 24GB GDDR6X |
| Storage | 913 GB NVMe (817 GB free) |
| OS | Ubuntu 24.04.4 LTS |
| NVIDIA Driver | 580.126.09 |
| CUDA | 13.0 |
| Docker | 29.4.0 + nvidia-container-toolkit 1.19.0 |

### Capacity

| Resolution | Max Concurrent Users | VRAM per Instance |
|------------|---------------------|-------------------|
| 720p | 3-4 | ~6 GB |
| 1080p | 2-3 | ~8 GB |

---

## Cloudflare Tunnel

| Hostname | Target | Purpose |
|----------|--------|---------|
| `ps2-api.twinverse.org` | `localhost:9000` | PS2 Spawner API |
| `ps2.twinverse.org` | `localhost:8080` | Wilbur Player (WebRTC) |

Tunnel runs as **systemd service** (survives reboot).

---

## Developer Workflow

### One-Time Setup (Done by Claude)

- TwinversePS2-Deploy repo creation
- Dockerfile, docker-compose.yml, deploy scripts
- twinverse-ai server setup (Node.js, cloudflared, UFW)
- Cloudflare Tunnel configuration

### Per-Update Workflow

**Steven does 1 thing: UE5 Linux Packaging**

```
Step 1: UE5 Editor -> File -> Package -> Linux
Step 2: Copy to TwinversePS2-Deploy/build/
Step 3: git add . && git commit && git push main
Step 4: (Automatic) Orbitron -> Build -> Deploy -> Health Check
```

---

## Existing Services (Co-located)

These services continue running on twinverse-ai alongside Pixel Streaming:

| Service | Port | Purpose |
|---------|------|---------|
| Ollama | 11434 | Local LLM (qwen2.5, mistral, llava, gemma3) |
| AI Image Service | 8100 | Image generation API |

No resource conflicts - Ollama unloads models when GPU memory is needed for UE5.

---

## Rollback Plan

If deployment fails, restore in under 5 minutes:

1. Stop twinverse-ai container: `docker compose down`
2. Restart PS2 Windows: `start_gpu_server.bat`
3. Revert Cloudflare tunnel to PS2

---

## Scaling Roadmap

```
Current:  Orbitron -> twinverse-ai x1 (RTX 3090, 3 concurrent users)
    |
Mid-term: Orbitron -> twinverse-ai + Cloud GPU x N (add targets in Orbitron.yaml)
    |
Long-term: Orbitron -> K8s Cluster (auto-scaling, hundreds of users)
```

### Strategy: Horizontal Scaling with Moderate GPUs

- Each user gets dedicated GPU rendering pipeline
- Auto-scaling: spin up/down based on demand (zero cost at zero users)
- Same Docker image across all targets - no code changes for scaling
- Cloud burst: add AWS/GCP GPU instances as `deploy_targets` in Orbitron.yaml

### Cost Estimate (Cloud, per user per month)

| Usage Pattern | Hours/Month | Cost (T4) |
|---------------|-------------|-----------|
| 24/7 Always-On | 720h | ~190,000 KRW |
| Business Hours (8h x 22d) | 176h | ~46,000 KRW |
| Light Use (2h/day) | 44h | ~11,500 KRW |
| On-Demand (5h/week) | 20h | ~5,200 KRW |

With spot instances: **60-70% additional discount**.

---

## Future: Orbitron Platform Integration

Current pipeline is Steven-only (CLI + git push). The goal is to evolve this into an **Orbitron platform feature** that any developer can use.

### Target UX (Orbitron Dashboard)

```
[Orbitron Dashboard] -> New Project -> Deploy Type: Pixel Streaming

Step 1: Interactive guide for UE5 Linux packaging
        (including Linux toolchain install instructions)

Step 2: Build upload via web UI (drag & drop or folder select)
        Orbitron auto-creates: Git repo + LFS + Dockerfile + Orbitron.yaml

Step 3: Automatic pipeline
        Docker build -> GPU server deploy -> health check

Step 4: Streaming URL issued
        https://{app-name}.twinverse.org
```

### Automation Scope

| Step | Developer | Orbitron (Auto) |
|------|-----------|-----------------|
| Repo creation | - | gh repo create + LFS + Dockerfile + Orbitron.yaml |
| Build upload | Select folder only | git add + commit + push (web UI or CLI) |
| Docker build | - | Image build + GPU server transfer |
| Tunnel setup | - | Auto subdomain assignment (xxx.twinverse.org) |
| Deploy | - | docker compose up --gpus all |
| Monitoring | View dashboard | Health check, logs, GPU usage |

### Developer Knowledge Required

- How to package UE5 for Linux (guided by Orbitron dashboard)
- Everything else is automated

### Implementation Order

1. **Now**: Steven-only CLI pipeline (validate infrastructure)
2. **Next**: Orbitron CLI tool (`orbitron deploy --type pixel-streaming`)
3. **Later**: Orbitron web dashboard UI with interactive guide
