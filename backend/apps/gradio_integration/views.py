from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


@method_decorator(csrf_exempt, name='dispatch')
class ValidateWaveSpeedKeyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        api_key = (request.data.get("api_key") or "").strip()
        if not api_key:
            return Response({"valid": False, "error": "Falta api_key"}, status=status.HTTP_400_BAD_REQUEST)
        if len(api_key) < 20:
            return Response({"valid": False, "error": "Formato de API key no válido"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"valid": True}, status=status.HTTP_200_OK)
