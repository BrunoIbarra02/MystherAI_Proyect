from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.db import OperationalError, DatabaseError, connection
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator
from apps.users.serializers import UserSerializer
from apps.sheets.models import VideoMetadata

# Mensaje único para cuando la base de datos no responde. Nunca debe confundirse
# con un fallo de credenciales: si la BD está caída no sabemos si la contraseña
# era correcta, y decir "contraseña incorrecta" manda al equipo a buscar donde no es.
DB_CAIDA = ('No se puede contactar con la base de datos. No es tu contraseña: '
            'el servicio está caído. Avisa al administrador.')


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        email = (request.data.get('username') or request.data.get('email') or '').strip()
        password = request.data.get('password', '')

        try:
            user = authenticate(request, username=email, password=password)
        except (OperationalError, DatabaseError):
            return Response({'error': DB_CAIDA, 'causa': 'db'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if user is not None:
            login(request, user)
            return Response({
                'message': 'Login exitoso',
                'user': UserSerializer(user).data,
            }, status=status.HTTP_200_OK)

        return Response({'error': 'Correo o contraseña incorrectos', 'causa': 'credenciales'},
                        status=status.HTTP_401_UNAUTHORIZED)


class HealthView(APIView):
    """Estado del servicio. Sirve para saber en 1 segundo si el problema es la BD."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute('SELECT 1')
            return Response({'ok': True, 'db': 'ok'})
        except Exception as e:
            return Response(
                {'ok': False, 'db': 'caida', 'detalle': str(e)[:300]},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    """Emite la cookie csrftoken. Sin esto el SPA nunca la recibe y todo POST/PUT/DELETE
    autenticado se rechaza con 403 CSRF."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        return Response({'ok': True})


class MeView(APIView):
    """Returns the currently logged-in user's info."""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'No autenticado'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(UserSerializer(request.user).data)


class ProfileDataView(APIView):
    """Returns the logged-in user's reserved and stylized videos."""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'No autenticado'}, status=status.HTTP_401_UNAUTHORIZED)

        user = request.user
        display = user.first_name or user.username.split('@')[0]

        # Videos this user currently has reserved
        reserved = VideoMetadata.objects.filter(
            tipo='censo',
            estado_censo='Reservado',
            reservado_por__iexact=display,
        ).values('id', 'video_id', 'id_video_equipo', 'mapa', 'especie',
                 'duracion', 'drive_link', 'estado_censo', 'reservado_por')

        # Stylized submissions by this user (registro entries with revision status)
        stylized = VideoMetadata.objects.filter(
            tipo='registro',
            usuario__iexact=display,
        ).values('id', 'video_id', 'id_video_equipo', 'mapa', 'especie',
                 'drive_link', 'imagen_link', 'estilizado', 'estado_revision',
                 'comentario_revision', 'prompt_imagen', 'prompt_video',
                 'video_original_link').order_by('-id')

        # Admin: all team reservations + all registro entries
        all_reservations = []
        all_registro = []
        if user.is_staff:
            all_reservations = list(
                VideoMetadata.objects.filter(tipo='censo', estado_censo='Reservado')
                .values('id', 'video_id', 'id_video_equipo', 'mapa', 'drive_link', 'reservado_por')
            )
            all_registro = list(
                VideoMetadata.objects.filter(tipo='registro')
                .values('id', 'video_id', 'id_video_equipo', 'usuario', 'mapa',
                        'drive_link', 'imagen_link', 'estilizado',
                        'estado_revision', 'comentario_revision',
                        'prompt_imagen', 'prompt_video', 'video_original_link')
                .order_by('-id')
            )

        return Response({
            'user': UserSerializer(user).data,
            'reserved': list(reserved),
            'stylized': list(stylized),
            'all_reservations': all_reservations,
            'all_registro': all_registro,
        })


class UpdateAvatarView(APIView):
    """Save base64 avatar for the logged-in user.

    OJO: no vaciar authentication_classes. Al hacerlo, request.user pasa a ser
    siempre AnonymousUser y este endpoint devolvía 401 a todo el mundo.
    """

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'No autenticado'}, status=status.HTTP_401_UNAUTHORIZED)
        avatar = (request.data.get('avatar') or '').strip()
        if not avatar:
            return Response({'error': 'No avatar provided'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.avatar = avatar
        request.user.save(update_fields=['avatar'])
        return Response({'ok': True, 'avatar': avatar})


class AvatarsMapView(APIView):
    """Returns {display_name: avatar_url} for all users with an avatar."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        result = {}
        for u in User.objects.exclude(avatar__isnull=True).exclude(avatar=''):
            name = u.first_name or u.username.split('@')[0]
            result[name] = u.avatar
        return Response(result)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'message': 'Sesión cerrada'})
