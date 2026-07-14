from django.urls import path
from .views import (
    VideoListView, VideoDetailView, FilterOptionsView, AutoRegisterVideoView,
    CensoSummaryView, RegistroSummaryView, SyncFromSheetsView, ExtractMetadataView,
    ReservarVideoView, LiberarVideoView, MarcarEstilizadoView,
    AprobarVideoView, DenegarVideoView, GradioErrorView,
)

urlpatterns = [
    path('videos/', VideoListView.as_view(), name='video-list-create'),
    path('videos/<int:pk>/', VideoDetailView.as_view(), name='video-detail'),
    path('videos/<int:pk>/reservar/', ReservarVideoView.as_view(), name='video-reservar'),
    path('videos/<int:pk>/liberar/', LiberarVideoView.as_view(), name='video-liberar'),
    path('videos/<int:pk>/estilizado/', MarcarEstilizadoView.as_view(), name='video-estilizado'),
    path('videos/<int:pk>/aprobar/', AprobarVideoView.as_view(), name='video-aprobar'),
    path('videos/<int:pk>/denegar/', DenegarVideoView.as_view(), name='video-denegar'),
    path('filter-options/', FilterOptionsView.as_view(), name='filter-options'),
    path('auto-register/', AutoRegisterVideoView.as_view(), name='auto-register'),
    path('summary/', CensoSummaryView.as_view(), name='censo-summary'),
    path('registro-summary/', RegistroSummaryView.as_view(), name='registro-summary'),
    path('sync-from-sheets/', SyncFromSheetsView.as_view(), name='sync-from-sheets'),
    path('extract-metadata/', ExtractMetadataView.as_view(), name='extract-metadata'),
    path('gradio-errors/', GradioErrorView.as_view(), name='gradio-errors'),
]
