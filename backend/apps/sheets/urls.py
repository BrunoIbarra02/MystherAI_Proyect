from django.urls import path
from .views import (
    VideoListView, FilterOptionsView, VideoDetailView,
    CensoSummaryView, RegistroSummaryView,
    SyncFromSheetsView, ExtractMetadataView,  # Vistas nuevas Fase 2
)

urlpatterns = [
    path('videos/',               VideoListView.as_view(),       name='video-list'),
    path('videos/<int:pk>/',      VideoDetailView.as_view(),     name='video-detail'),
    path('filter-options/',       FilterOptionsView.as_view(),   name='filter-options'),
    path('summary/',              CensoSummaryView.as_view(),    name='censo-summary'),
    path('registro-summary/',     RegistroSummaryView.as_view(), name='registro-summary'),
    # Nuevas rutas para sincronización y extracción de metadatos
    path('sync-from-sheets/',    SyncFromSheetsView.as_view(),   name='sync-from-sheets'),
    path('extract-metadata/',    ExtractMetadataView.as_view(),  name='extract-metadata'),
]
