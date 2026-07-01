from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from apps.firestore_db import get_db


USERS = [
    {'id': 1, 'username': 'admin',   'password': 'admin123',   'email': 'admin@hechicer.ia', 'is_staff': True,  'is_superuser': True},
    {'id': 2, 'username': 'mateo',   'password': 'mateo123',   'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 3, 'username': 'dario',   'password': 'dario123',   'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 4, 'username': 'wilson',  'password': 'wilson123',  'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 5, 'username': 'rodrigo', 'password': 'rodrigo123', 'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 6, 'username': 'david',   'password': 'david123',   'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 7, 'username': 'omar',    'password': 'omar123',    'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 8, 'username': 'alvaro',  'password': 'alvaro123',  'email': '', 'is_staff': False, 'is_superuser': False},
    {'id': 9, 'username': 'laura',   'password': 'laura123',   'email': '', 'is_staff': False, 'is_superuser': False},
]


class Command(BaseCommand):
    help = 'Sincroniza usuarios en Firestore'

    def handle(self, *args, **kwargs):
        db = get_db()
        for u in USERS:
            doc_id = str(u['id'])
            ref = db.collection('users').document(doc_id)
            doc = ref.get()
            if doc.exists:
                self.stdout.write(f"Usuario {u['username']} ya existe en Firestore")
            else:
                ref.set({
                    'id': u['id'],
                    'username': u['username'],
                    'password': make_password(u['password']),
                    'email': u['email'],
                    'is_staff': u['is_staff'],
                    'is_superuser': u['is_superuser'],
                })
                self.stdout.write(f"Usuario {u['username']} creado en Firestore")
