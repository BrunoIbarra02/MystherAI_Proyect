FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn whitenoise

COPY . .

CMD ["sh", "-c", "python manage.py migrate && python manage.py fill_estado_censo && python manage.py create_accounts && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2"]
