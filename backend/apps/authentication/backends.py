from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailBackend(ModelBackend):
    """Allow login with email address (stored as username)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        email = (username or kwargs.get('email') or '').strip().lower()
        try:
            user = User.objects.get(username__iexact=email)
        except User.DoesNotExist:
            # Also try matching on email field directly
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
