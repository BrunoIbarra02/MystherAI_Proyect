from django.contrib.auth.hashers import check_password
from .firestore_db import get_db


class FirestoreAuthBackend:
    """Authenticates users against Firestore 'users' collection."""

    def authenticate(self, request, username=None, password=None):
        db = get_db()
        docs = list(db.collection('users').where('username', '==', username).limit(1).stream())
        if not docs:
            return None
        data = docs[0].to_dict()
        if not check_password(password, data.get('password', '')):
            return None
        return self._build_user(data)

    def get_user(self, user_id):
        db = get_db()
        doc = db.collection('users').document(str(user_id)).get()
        if doc.exists:
            return self._build_user(doc.to_dict())
        return None

    def _build_user(self, data):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.__new__(User)
        User.__init__(
            user,
            username=data.get('username', ''),
            email=data.get('email', ''),
            is_active=True,
            is_staff=data.get('is_staff', False),
            is_superuser=data.get('is_superuser', False),
        )
        # Use integer IDs so Django's BigAutoField session key conversion works
        user.id = int(data.get('id', 0))
        user.pk = user.id
        user._state.adding = False
        user._state.db = None
        return user
