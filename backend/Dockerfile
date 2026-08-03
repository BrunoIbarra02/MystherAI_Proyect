FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn whitenoise

COPY . .

# setup_users es el único comando de cuentas (create_accounts se eliminó: reseteaba
# las contraseñas de todo el equipo en cada arranque y usaba otra lista de emails).
CMD ["sh", "-c", "python manage.py migrate && python manage.py fill_estado_censo && python manage.py setup_users && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2"]
