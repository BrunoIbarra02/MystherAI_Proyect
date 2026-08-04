"""
Señales de auditoría para VideoMetadata.

Contexto: los vídeos de Registro generados vía Gradio desaparecen ~1h
después de crearse y no sabemos por qué (ver MYSTHERAI WEB - CONTEXTO
COMPLETO). Revisando sync_sheets, limpiar_reservas, delete_1080p_videos y
las vistas no se encontró ningún `.delete()` que pueda alcanzar una fila de
Registro recién creada — pero eso no descarta que ocurra por otra vía
(shell manual, admin, un comando que aún no se ha revisado, etc.), ni
descarta que lo que ocurra sea una SOBRESCRITURA de contenido en vez de un
borrado real (que de cara al usuario también "hace desaparecer" el vídeo).

Este módulo NO cambia ningún comportamiento. Solo dos señales que escriben
en los logs de despliegue (stdout → Cloud Logging) cuando:

  1. Se borra cualquier VideoMetadata (pre_delete) — con stack trace, para
     saber exactamente qué código lo disparó.
  2. Se sobrescriben campos de contenido de una fila de Registro ya
     existente (pre_save) — para detectar si el "desaparecido" en realidad
     sigue en BD pero con drive_link/imagen_link/prompt vacíos o distintos.

La próxima vez que ocurra el bug en producción, buscar en los logs:
    "VideoMetadata DELETE" o "VideoMetadata REGISTRO CONTENT CHANGE"
con el id o video_id del vídeo afectado, y eso apunta directo al origen.

Una vez identificada la causa real, este módulo se puede simplificar o
retirar — es una herramienta de diagnóstico, no la solución final.
"""
import logging
import traceback

from django.db.models.signals import pre_delete, pre_save
from django.dispatch import receiver

from .models import VideoMetadata

logger = logging.getLogger('apps.sheets.audit')

# Campos cuyo cambio en una fila de Registro ya existente puede hacer que el
# vídeo "desaparezca" para el usuario aunque la fila siga en BD.
REGISTRO_CONTENT_FIELDS = [
    'drive_link', 'imagen_link', 'prompt_video', 'video_original_link',
    'estilizado', 'aceptado',
]


@receiver(pre_delete, sender=VideoMetadata)
def log_video_metadata_delete(sender, instance, **kwargs):
    stack = ''.join(traceback.format_stack(limit=12))
    logger.warning(
        "VideoMetadata DELETE id=%s tipo=%s video_id=%s id_video_equipo=%s "
        "usuario=%s reservado_por=%s estado_revision=%s\n%s",
        instance.pk, instance.tipo, instance.video_id, instance.id_video_equipo,
        instance.usuario, instance.reservado_por, instance.estado_revision,
        stack,
    )


@receiver(pre_save, sender=VideoMetadata)
def log_video_metadata_content_change(sender, instance, **kwargs):
    # Solo nos interesan actualizaciones (pk ya existe) de filas de Registro.
    if instance.tipo != 'registro' or not instance.pk:
        return
    try:
        previous = VideoMetadata.objects.get(pk=instance.pk)
    except VideoMetadata.DoesNotExist:
        return

    cambios = {
        f: (getattr(previous, f), getattr(instance, f))
        for f in REGISTRO_CONTENT_FIELDS
        if getattr(previous, f) != getattr(instance, f)
    }
    if cambios:
        logger.warning(
            "VideoMetadata REGISTRO CONTENT CHANGE id=%s video_id=%s cambios=%s",
            instance.pk, instance.video_id, cambios,
        )
