from rest_framework import serializers
from .models import VideoMetadata

class VideoMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoMetadata
        fields = '__all__'
