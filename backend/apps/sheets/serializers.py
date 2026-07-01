from rest_framework import serializers


class VideoMetadataSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    video_id = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    tipo = serializers.CharField()
    usuario = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    mateo_miguel = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    estilizado = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    prompt_imagen = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    imagen_link = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    prompt_video = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    video_original_link = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    aceptado = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    prompt_final = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    id_video_equipo = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    mapa = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    genero = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    etnia = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    duracion = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    camara = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    especie = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    drive_link = serializers.CharField(allow_blank=True, allow_null=True, required=False)
