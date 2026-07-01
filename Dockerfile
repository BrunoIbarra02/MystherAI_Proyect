# Stage 1: Build React
FROM node:20-alpine AS build-stage
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Django + Gradio + FFmpeg
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Install Django backend deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn whitenoise

# Install Gradio service deps
COPY gradio-service/requirements.txt /tmp/gradio-requirements.txt
RUN pip install --no-cache-dir -r /tmp/gradio-requirements.txt

COPY backend/ .
COPY gradio-service/ /app/gradio-service/
COPY --from=build-stage /frontend/dist /app/static_root

RUN python manage.py collectstatic --noinput

EXPOSE 8080
EXPOSE 7860

CMD ["sh", "-c", "python manage.py migrate && python manage.py setup_users && python /app/gradio-service/app.py & gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2"]
