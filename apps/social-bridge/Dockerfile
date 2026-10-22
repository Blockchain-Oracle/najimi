# Najimi social bridge: Instagram (instagrapi) for the worker and web server. Internal only, no
# public route. Build from the repository root:   docker build -f apps/social-bridge/Dockerfile .
# Every wheel is hash-checked (requirements.txt, compiled with uv; see overrides.txt for Pillow).
FROM python:3.12.13-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY apps/social-bridge/requirements.txt .
RUN pip install --require-hashes --no-deps --only-binary=:all: -r requirements.txt \
  && useradd --create-home bridge
COPY apps/social-bridge/main.py .
USER bridge
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
