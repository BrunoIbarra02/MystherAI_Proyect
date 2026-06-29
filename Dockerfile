# Stage 1: Build React
FROM node:20-alpine AS build-stage
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Django + FFmpeg
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn whitenoise

COPY backend/ .
COPY --from=build-stage /frontend/dist /app/static_root

RUN python manage.py collectstatic --noinput

CMD ["sh", "-c", "python manage.py migrate && python manage.py setup_users && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2"]
