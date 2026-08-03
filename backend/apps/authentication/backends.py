from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


# El equipo se creó en dos momentos con dos listas de emails distintas, así que
# hay gente acostumbrada a entrar con el email antiguo. Se mantienen como alias
# para no bloquear a nadie: alias -> email canónico (ver setup_users.ACCOUNTS).
EMAILS_ANTIGUOS = {
    'manuelchavesta@gmail.com':     'wilson@mystherai.com',
    'landeo18cristobalr@gmail.com': 'olenka@mystherai.com',
    'dg.rodrigo.1503@gmail.com':    'rodrigo@mystherai.com',
}


class EmailBackend(ModelBackend):
    """Permite iniciar sesión con el email (guardado como username)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        email = (username or kwargs.get('email') or '').strip().lower()
        if not email:
            return None

        user = (User.objects.filter(username__iexact=email).first()
                or User.objects.filter(email__iexact=email).first())

        # Si no existe, probar el email canónico por si usó uno antiguo
        if user is None:
            canonico = EMAILS_ANTIGUOS.get(email)
            if canonico:
                user = User.objects.filter(username__iexact=canonico).first()

        if user is None:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
