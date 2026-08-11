"""
Problema 3 (docs del proyecto): migrar usuarios antiguos.

Este comando NO inventa usuarios ni contraseñas — solo sabemos los nombres
que aparecen en registro.csv (Alvaro, Dario, David, Laura, Rodrigo, Wilson),
pero no sus emails reales ni sus credenciales, así que fabricar cuentas con
datos inventados sería peor que no hacer nada (cuentas fantasma con emails
falsos). Lo que sí se puede dejar listo es la herramienta: en cuanto exista
un export real de la Supabase vieja (aunque sea solo email + nombre), este
comando lo importa de forma idempotente y segura.

Formato esperado del CSV (cabecera obligatoria):
    email,first_name
    laura@ejemplo.com,Laura
    dario@ejemplo.com,Dario

Las cuentas se crean SIN contraseña utilizable (set_unusable_password) —
nunca se inventa ni se asigna una contraseña por defecto. Cada persona debe
pasar por el flujo de "olvidé mi contraseña" (si existe) o un admin debe
asignarle una desde el panel, nunca hardcodeada aquí.

Uso:
    python manage.py import_legacy_users --csv ruta/usuarios_antiguos.csv --dry-run
    python manage.py import_legacy_users --csv ruta/usuarios_antiguos.csv
"""
import csv

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Importa usuarios antiguos desde un CSV real (email,first_name). No inventa datos.'

    def add_arguments(self, parser):
        parser.add_argument('--csv', required=True, help='Ruta al CSV con columnas email,first_name')
        parser.add_argument('--dry-run', action='store_true', help='Muestra qué haría sin escribir nada')

    def handle(self, *args, **options):
        path = options['csv']
        dry = options['dry_run']
        User = get_user_model()

        try:
            f = open(path, encoding='utf-8-sig')
        except OSError as e:
            raise CommandError(f'No se pudo abrir {path}: {e}')

        creados, existentes, invalidos = 0, 0, 0
        with f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or 'email' not in reader.fieldnames:
                raise CommandError('El CSV debe tener cabecera con al menos la columna "email".')

            for row in reader:
                email = (row.get('email') or '').strip().lower()
                nombre = (row.get('first_name') or '').strip()
                if not email or '@' not in email:
                    invalidos += 1
                    self.stdout.write(self.style.WARNING(f'  fila inválida (sin email): {row}'))
                    continue

                if User.objects.filter(username__iexact=email).exists():
                    existentes += 1
                    continue

                self.stdout.write(f'  crear -> {email} ({nombre or "sin nombre"})')
                if not dry:
                    user = User(username=email, email=email, first_name=nombre, is_active=True)
                    user.set_unusable_password()
                    user.save()
                creados += 1

        marca = '[DRY-RUN] ' if dry else ''
        self.stdout.write(self.style.SUCCESS(
            f'{marca}Creados: {creados}, ya existían: {existentes}, filas inválidas: {invalidos}.'
        ))
        if creados and not dry:
            self.stdout.write(self.style.WARNING(
                'Cuentas creadas SIN contraseña utilizable. Cada persona necesita '
                'restablecer su contraseña o que un admin se la asigne manualmente.'
            ))
