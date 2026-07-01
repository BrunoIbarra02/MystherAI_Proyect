from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Configura usuarios con permisos'

    def handle(self, *args, **kwargs):
        User = get_user_model()

        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@hechicer.ia', 'admin123')
            self.stdout.write("Admin creado: admin / admin123")

        for u in ['mateo', 'dario', 'wilson', 'rodrigo', 'david', 'omar', 'alvaro', 'laura']:
            if not User.objects.filter(username=u).exists():
                User.objects.create_user(username=u, password=f'{u}123', is_staff=False)
                self.stdout.write(f"Usuario {u} creado")
