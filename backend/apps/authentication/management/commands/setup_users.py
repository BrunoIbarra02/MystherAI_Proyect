from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


ACCOUNTS = [
    # (email, first_name, password, is_staff, is_superuser)
    ('brunoibarraadame@gmail.com', 'Bruno',  'Mystherai2026', True,  True),
    ('fabio.ramos.reyes@gmail.com', 'Fabio', 'Mystherai2026', False, False),
    ('kathysp99@gmail.com',        'Katty',  'Mystherai2026', False, False),
    ('wilson@mystherai.com',       'Wilson', 'Mystherai2026', False, False),
    ('olenka@mystherai.com',       'Olenka', 'Mystherai2026', False, False),
    ('rodrigo@mystherai.com',      'Rodrigo','Mystherai2026', False, False),
]


class Command(BaseCommand):
    help = 'Crea / sincroniza cuentas de usuario y libera reservas de admin'

    def handle(self, *args, **kwargs):
        User = get_user_model()

        for email, first_name, password, is_staff, is_superuser in ACCOUNTS:
            user, created = User.objects.get_or_create(username=email, defaults={
                'email':        email,
                'first_name':   first_name,
                'is_staff':     is_staff,
                'is_superuser': is_superuser,
            })
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(f'✓ Creado: {email}')
            else:
                # Ensure staff/superuser flags are up to date
                changed = False
                if user.is_staff != is_staff or user.is_superuser != is_superuser:
                    user.is_staff, user.is_superuser = is_staff, is_superuser
                    changed = True
                if not user.first_name:
                    user.first_name = first_name
                    changed = True
                if changed:
                    user.save()

        # Liberar todas las reservas de Bruno (admin no estiliza)
        try:
            from apps.sheets.models import VideoMetadata
            freed = VideoMetadata.objects.filter(
                tipo='censo', estado_censo='Reservado', reservado_por__iexact='Bruno'
            ).update(estado_censo='Disponible', reservado_por=None)
            if freed:
                self.stdout.write(f'✓ Liberadas {freed} reservas de Bruno')
        except Exception as e:
            self.stdout.write(f'⚠ No se pudieron liberar reservas: {e}')
