"""
Issue 24 — paso 2 de 2 (expand/contract).

El modelo ya tiene reservado_por_user (FK) escribiéndose en paralelo a
reservado_por (texto) para todo lo NUEVO. Este comando rellena la FK para
las filas que ya existían en BD antes de ese cambio, resolviendo el nombre
guardado en texto contra los Users reales con el mismo criterio que usa el
resto de la app (first_name o prefijo del email).

Idempotente: solo toca filas con reservado_por_user vacío, así que se puede
correr varias veces sin efectos raros.

    python manage.py backfill_reservado_por_user --dry-run
    python manage.py backfill_reservado_por_user

Cuando esto haya corrido en producción y se haya confirmado que el FK
coincide con el texto para todo el equipo actual, es el momento de migrar
las lecturas (limpiar_reservas, filtros, etc.) a la FK y, más adelante,
retirar el campo de texto. No se hace en este cambio — primero hay que
verlo poblado y correcto con datos reales.
"""
from django.core.management.base import BaseCommand

from apps.sheets.models import VideoMetadata
from apps.users.utils import resolve_by_display_name


class Command(BaseCommand):
    help = 'Rellena VideoMetadata.reservado_por_user a partir del texto libre reservado_por existente'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Muestra qué cambiaría sin escribir nada')

    def handle(self, *args, **options):
        dry = options['dry_run']

        pendientes = VideoMetadata.objects.filter(
            reservado_por_user__isnull=True,
        ).exclude(reservado_por__isnull=True).exclude(reservado_por='')

        resueltos, sin_match = 0, {}
        for video in pendientes.iterator():
            user = resolve_by_display_name(video.reservado_por)
            if user:
                resueltos += 1
                if not dry:
                    video.reservado_por_user = user
                    video.save(update_fields=['reservado_por_user'])
            else:
                sin_match[video.reservado_por] = sin_match.get(video.reservado_por, 0) + 1

        marca = '[DRY-RUN] ' if dry else ''
        self.stdout.write(self.style.SUCCESS(f'{marca}Resueltos: {resueltos}'))
        if sin_match:
            self.stdout.write(self.style.WARNING(
                f'Sin usuario correspondiente ({sum(sin_match.values())} filas — '
                f'probablemente ex-empleados, ver limpiar_reservas.py):'))
            for nombre, n in sorted(sin_match.items(), key=lambda x: -x[1]):
                self.stdout.write(f'  {nombre}: {n}')
