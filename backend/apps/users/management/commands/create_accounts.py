from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

ACCOUNTS = [
    {
        'email': 'brunoibarraadame@gmail.com',
        'first_name': 'Bruno',
        'last_name': 'Ibarra',
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'email': 'dg.rodrigo.1503@gmail.com',
        'first_name': 'Rodrigo',
        'last_name': '',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'email': 'manuelchavesta@gmail.com',
        'first_name': 'Wilson',
        'last_name': '',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'email': 'landeo18cristobalr@gmail.com',
        'first_name': 'Olenka',
        'last_name': '',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'email': 'fabio.ramos.reyes@gmail.com',
        'first_name': 'Fabio',
        'last_name': '',
        'is_staff': False,
        'is_superuser': False,
    },
]

PASSWORD = 'Mystherai2026'


class Command(BaseCommand):
    help = 'Create or update the 4 MystherAI employee accounts'

    def handle(self, *args, **options):
        for acc in ACCOUNTS:
            email = acc['email']
            username = email  # we use email as username
            user, created = User.objects.get_or_create(username=username)
            user.email = email
            user.first_name = acc['first_name']
            user.last_name = acc['last_name']
            user.is_staff = acc['is_staff']
            user.is_superuser = acc['is_superuser']
            user.is_active = True
            user.set_password(PASSWORD)
            user.save()
            action = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(f'{action}: {acc["first_name"]} ({email})'))
