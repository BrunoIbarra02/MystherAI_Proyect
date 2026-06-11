from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Q
from .models import VideoMetadata
from .serializers import VideoMetadataSerializer

class VideoListView(generics.ListCreateAPIView):
    serializer_class = VideoMetadataSerializer
    
    def get_queryset(self):
        queryset = VideoMetadata.objects.all()
        tipo = self.request.query_params.get('tipo', '').strip()
        search = self.request.query_params.get('search', '').strip()
        
        if tipo: queryset = queryset.filter(tipo__iexact=tipo)
        
        filter_fields = ['usuario', 'mapa', 'genero', 'etnia', 'camara', 'especie', 'estilizado', 'aceptado']
        for field in filter_fields:
            value = self.request.query_params.get(field, '').strip()
            if value:
                queryset = queryset.filter(**{f"{field}__icontains": value})

        if search:
            queryset = queryset.filter(Q(video_id__icontains=search) | Q(usuario__icontains=search))
        
        return queryset.order_by("-id")

# Nueva vista para editar y eliminar (Solo Admin)
class VideoDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = VideoMetadata.objects.all()
    serializer_class = VideoMetadataSerializer
    # La lógica de permisos se manejará en el frontend ocultando botones, 
    # pero aquí blindamos la API
    def get_permissions(self):
        if self.request.method in ['DELETE', 'PUT', 'PATCH']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

class FilterOptionsView(APIView):
    def get(self, request):
        tipo = request.query_params.get('tipo', 'censo').lower()
        fields_to_filter = ["usuario", "mapa", "genero", "etnia", "camara", "especie", "estilizado", "aceptado"]
        options = {}
        
        for field_name in fields_to_filter:
            distinct_values = VideoMetadata.objects.values_list(field_name, flat=True).distinct()
            cleaned_values = [str(v).strip() for v in distinct_values if v and str(v).lower() != 'nan']
            
            # LÓGICA DE USUARIOS SOLICITADA
            if field_name == 'usuario':
                if tipo == 'censo':
                    cleaned_values = [v for v in cleaned_values if v.lower() in ['miguel', 'mateo']]
                else:
                    cleaned_values = [v for v in cleaned_values if v.lower() not in ['miguel', 'mateo']]
            
            options[field_name] = sorted(list(set(cleaned_values)))
        return Response(options)
