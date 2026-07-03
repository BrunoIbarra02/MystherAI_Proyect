from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    api_key_wavespeed = models.CharField(max_length=255, blank=True, null=True)
    avatar = models.TextField(blank=True, null=True)

    class Meta:
        app_label = 'users'

    # Evitar conflicto con el modelo por defecto de Django
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_set',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )
