from django.urls import path
from .views import VideoListView, FilterOptionsView, VideoDetailView

urlpatterns = [
    path('videos/', VideoListView.as_view(), name='video-list'),
    path('videos/<int:pk>/', VideoDetailView.as_view(), name='video-detail'),
    path('filter-options/', FilterOptionsView.as_view(), name='filter-options'),
]
