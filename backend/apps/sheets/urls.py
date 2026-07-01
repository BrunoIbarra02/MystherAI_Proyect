from django.urls import path
from .views import (
    VideoListView, VideoDetailView, FilterOptionsView, AutoRegisterVideoView,
    CensoSummaryView, RegistroSummaryView, SyncFromSheetsView, ExtractMetadataView
)

urlpatterns = [
    # --- TUS RUTAS ORIGINALES ---
    path('videos/', VideoListView.as_view(), name='video-list-create'),
    path('videos/<int:pk>/', VideoDetailView.as_view(), name='video-detail'),
    path('filter-options/', FilterOptionsView.as_view(), name='filter-options'),
    path('auto-register/', AutoRegisterVideoView.as_view(), name='auto-register'),
    
    # --- SECCIONES NUEVAS DE BRUNO ---
    path('summary/', CensoSummaryView.as_view(), name='censo-summary'),
    path('registro-summary/', RegistroSummaryView.as_view(), name='registro-summary'),
    path('sync-from-sheets/', SyncFromSheetsView.as_view(), name='sync-from-sheets'),
    path('extract-metadata/', ExtractMetadataView.as_view(), name='extract-metadata'),
]
