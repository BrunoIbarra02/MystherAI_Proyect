from django.urls import path
from .views import LoginView, MeView, ProfileDataView, LogoutView

urlpatterns = [
    path('login/',        LoginView.as_view(),      name='login'),
    path('logout/',       LogoutView.as_view(),     name='logout'),
    path('me/',           MeView.as_view(),          name='me'),
    path('profile-data/', ProfileDataView.as_view(), name='profile-data'),
]
