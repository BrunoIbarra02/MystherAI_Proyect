from django.apps import AppConfig

class SheetsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.sheets'

    def ready(self):
        # Registra las señales de auditoría de VideoMetadata (ver signals.py).
        # Solo logging, no cambia comportamiento.
        from . import signals  # noqa: F401
