from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from apps.users.serializers import UserSerializer
from apps.sheets.models import VideoMetadata


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        email = (request.data.get('username') or request.data.get('email') or '').strip()
        password = request.data.get('password', '')

        user = authenticate(request, username=email, password=password)
        if user is not None:
            login(request, user)
            return Response({
                'message': 'Login exitoso',
                'user': UserSerializer(user).data,
            }, status=status.HTTP_200_OK)

        return Response({'error': 'Correo o contraseña incorrectos'}, status=status.HTTP_401_UNAUTHORIZED)


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

        # Videos stylized by this user (estado_censo=Estilizado, reservado_por=name)
        stylized = VideoMetadata.objects.filter(
            tipo='censo',
            estado_censo='Estilizado',
            reservado_por__iexact=display,
        ).values('id', 'video_id', 'id_video_equipo', 'mapa', 'especie',
                 'duracion', 'drive_link', 'estado_censo', 'reservado_por')

        # Admin: all team reservations
        all_reservations = []
        if user.is_staff:
            all_reservations = list(
                VideoMetadata.objects.filter(tipo='censo', estado_censo='Reservado')
                .values('id', 'video_id', 'id_video_equipo', 'mapa', 'drive_link', 'reservado_por')
            )

        return Response({
            'user': UserSerializer(user).data,
            'reserved': list(reserved),
            'stylized': list(stylized),
            'all_reservations': all_reservations,
        })


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'message': 'Sesión cerrada'})
