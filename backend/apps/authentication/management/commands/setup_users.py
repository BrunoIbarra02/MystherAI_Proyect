"""
Única fuente de verdad para las cuentas del equipo.

Antes había DOS comandos (`setup_users` y `users.create_accounts`) con listas de
emails distintas, y cada Dockerfile llamaba a uno. Resultado: el email con el que
entrabas dependía de qué imagen estuviera desplegada, y `create_accounts` además
reseteaba la contraseña de TODOS en cada arranque del contenedor.

Reglas de este comando:
  - NUNCA toca la contraseña de un usuario que ya existe (salvo --reset-password).
  - Los emails antiguos siguen funcionando: ver EMAILS_ANTIGUOS en backends.py.
  - Es idempotente: se puede ejecutar en cada despliegue sin efectos sorpresa.

Uso:
    python manage.py setup_users
    python manage.py setup_users --reset-password fabio.ramos.reyes@gmail.com
"""
import os

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


# (email canónico, nombre, is_staff, is_superuser)
# Rodrigo es jefe de equipo desde agosto de 2026: mismos permisos que Bruno.
# A diferencia de Bruno, Rodrigo SÍ estiliza, así que sigue en EQUIPO_ACTUAL y
# sus reservas no se liberan (ver ADMINS_QUE_NO_ESTILIZAN más abajo).
ACCOUNTS = [
    ('brunoibarraadame@gmail.com',  'Bruno',   True,  True),
    ('rodrigo@mystherai.com',       'Rodrigo', True,  True),
    ('fabio.ramos.reyes@gmail.com', 'Fabio',   False, False),
    ('kathysp99@gmail.com',         'Katty',   False, False),
    ('wilson@mystherai.com',        'Wilson',  False, False),
    ('olenka@mystherai.com',        'Olenka',  False, False),
]

# Admins que no producen: se les liberan las reservas automáticamente.
# Rodrigo NO va aquí — es admin y además estiliza.
ADMINS_QUE_NO_ESTILIZAN = ['Bruno']

# Ex-empleados: se desactivan, no se borran, para conservar su histórico.
DEACTIVATED = [
    'chema.lezuza@gmail.com',  # Jose Maria — ya no está en el equipo
]

# Contraseña inicial SOLO para cuentas nuevas. Se puede fijar por entorno.
DEFAULT_PASSWORD = os.getenv('INITIAL_USER_PASSWORD', 'Mystherai2026')


class Command(BaseCommand):
    help = 'Crea/sincroniza las cuentas del equipo sin pisar contraseñas existentes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-password',
            metavar='EMAIL',
            help='Restablece la contraseña inicial de UNA cuenta concreta (acción manual)',
        )

    def handle(self, *args, **options):
        User = get_user_model()

        reset_email = (options.get('reset_password') or '').strip().lower()
        if reset_email:
            user = User.objects.filter(username__iexact=reset_email).first()
            if not user:
                self.stderr.write(f'No existe ninguna cuenta con {reset_email}')
                return
            user.set_password(DEFAULT_PASSWORD)
            user.save(update_fields=['password'])
            self.stdout.write(self.style.SUCCESS(f'Contraseña restablecida para {reset_email}'))
            return

        for email, first_name, is_staff, is_superuser in ACCOUNTS:
            user = User.objects.filter(username__iexact=email).first()

            if user is None:
                user = User.objects.create(
                    username=email, email=email, first_name=first_name,
                    is_staff=is_staff, is_superuser=is_superuser, is_active=True,
                )
                user.set_password(DEFAULT_PASSWORD)   # solo al crear
                user.save()
                self.stdout.write(self.style.SUCCESS(f'Creado: {email}'))
                continue

            # Cuenta existente: sincronizamos metadatos, jamás la contraseña.
            cambios = []
            if user.is_staff != is_staff or user.is_superuser != is_superuser:
                user.is_staff, user.is_superuser = is_staff, is_superuser
                cambios += ['is_staff', 'is_superuser']
            if not user.first_name:
                user.first_name = first_name
                cambios.append('first_name')
            if not user.is_active:
                user.is_active = True
                cambios.append('is_active')
            if cambios:
                user.save(update_fields=cambios)
                self.stdout.write(f'Actualizado: {email} ({", ".join(cambios)})')

        for email in DEACTIVATED:
            n = User.objects.filter(username__iexact=email, is_active=True).update(is_active=False)
            if n:
                self.stdout.write(f'Desactivado: {email}')

        # Aviso de cuentas duplicadas: dos usuarios con el mismo nombre visible
        # se reparten el trabajo de forma impredecible, porque las reservas se
        # guardan por nombre en texto libre (reservado_por).
        nombres = {}
        for u in User.objects.filter(is_active=True):
            clave = (u.first_name or u.username.split('@')[0]).strip().lower()
            nombres.setdefault(clave, []).append(u.username)
        for nombre, cuentas in nombres.items():
            if len(cuentas) > 1:
                self.stdout.write(self.style.WARNING(
                    f'AVISO: "{nombre}" tiene {len(cuentas)} cuentas activas: {", ".join(cuentas)}. '
                    f'Su trabajo puede repartirse entre ambas.'
                ))

        # Liberar reservas de los admins que no producen.
        # Rodrigo es admin pero sí estiliza: sus 81 reservas deben quedarse donde están.
        try:
            from apps.sheets.models import VideoMetadata
            for nombre in ADMINS_QUE_NO_ESTILIZAN:
                freed = VideoMetadata.objects.filter(
                    tipo='censo', estado_censo='Reservado', reservado_por__iexact=nombre
                ).update(estado_censo='Disponible', reservado_por=None, reservado_por_user=None)
                if freed:
                    self.stdout.write(f'Liberadas {freed} reservas de {nombre}')
        except Exception as e:
            self.stdout.write(f'No se pudieron liberar reservas: {e}')
