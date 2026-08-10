"""
Re-aloja en Supabase Storage los registros que todavía guardan una URL
temporal de Wavespeed en imagen_link/drive_link (las de antes del fix de
persistir_en_supabase() en gradio-service/app.py — ver docs/06_WAVESPEED.md).

Esas URLs caducan a los 7 días (x-amz-expiration en el bucket S3 de
Wavespeed), así que cualquier registro creado antes del fix y que siga con
ese enlace puede estar ya roto o a punto de estarlo.

Heurística de detección: cualquier imagen_link/drive_link no vacío que NO
sea ya una URL de nuestro propio Supabase Storage y que NO sea un enlace de
Google Drive (la otra fuente legítima y permanente de enlaces en este
proyecto) se trata como sospechoso de ser un resultado de Wavespeed sin
re-alojar. No se asume el dominio exacto de Wavespeed porque lo devuelve la
API dinámicamente (bucket propio de Wavespeed, dominio variable).

Nunca borra datos:
  - Si la URL de origen todavía responde -> se descarga, se sube a Supabase
    Storage, y SOLO ENTONCES se sobreescribe el campo con la URL permanente.
  - Si la URL de origen ya no responde (caducada) -> se deja tal cual y se
    reporta en "no disponibles", para revisión manual. No se vacía el campo.

    python manage.py migrate_wavespeed_links --dry-run
    python manage.py migrate_wavespeed_links
"""
import mimetypes
import os
import re
import uuid

import requests
from django.core.management.base import BaseCommand

from apps.sheets.models import VideoMetadata

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "estilizados")


def _es_link_ya_permanente(url):
    if not url:
        return True  # vacío no es candidato
    if SUPABASE_URL and url.startswith(f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/"):
        return True
    if "drive.google.com" in url:
        return True
    return False


def _subir_a_supabase(url_origen, carpeta, video_id):
    """Descarga url_origen y la sube a Supabase Storage. Devuelve la URL
    pública nueva, o lanza RuntimeError/requests.RequestException si la
    fuente ya no está disponible o falla la subida -- el caller decide qué
    hacer con cada caso, nunca se modifica nada aquí."""
    r = requests.get(url_origen, stream=True, timeout=60)
    r.raise_for_status()
    content = r.content
    ext = re.search(r'\.(\w+)$', url_origen.split('?')[0])
    ext = f".{ext.group(1)}" if ext else ".bin"
    content_type = mimetypes.guess_type(url_origen)[0] or "application/octet-stream"
    key = f"estilizados/{video_id or 'sin_id'}/{carpeta}_{uuid.uuid4().hex}{ext}"

    up = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=content,
        timeout=120,
    )
    if up.status_code not in (200, 201):
        raise RuntimeError(f"Supabase Storage respondió {up.status_code}: {up.text[:300]}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{key}"


class Command(BaseCommand):
    help = "Re-aloja en Supabase Storage los enlaces de Wavespeed sin migrar en Registro (no borra nada)"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Solo lista candidatos, no modifica ni sube nada')

    def handle(self, *args, **options):
        dry = options['dry_run']
        marca = '[DRY-RUN] ' if dry else ''

        if not dry and not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
            self.stderr.write(self.style.ERROR(
                "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno -- "
                "no se puede subir nada. Usa --dry-run para solo listar candidatos."
            ))
            return

        # Sin .iterator(): la conexión de producción pasa por el pooler de
        # Supabase en modo transacción (pgbouncer), que no soporta cursores
        # server-side -- probado, revienta con "InvalidCursorName". El
        # volumen de VideoMetadata (cientos de filas) no lo justifica de
        # todas formas.
        candidatos = []
        for video in VideoMetadata.objects.filter(tipo='registro'):
            for campo in ('imagen_link', 'drive_link'):
                valor = getattr(video, campo)
                if not _es_link_ya_permanente(valor):
                    candidatos.append((video, campo, valor))

        if not candidatos:
            self.stdout.write(self.style.SUCCESS(
                f'{marca}0 registros con enlaces pendientes de re-alojar. Nada que hacer.'
            ))
            return

        self.stdout.write(f'{marca}{len(candidatos)} enlaces candidatos a re-alojar:')
        for video, campo, valor in candidatos:
            self.stdout.write(f'  video_id={video.video_id} pk={video.pk} {campo}={valor}')

        if dry:
            return

        migrados, caducados, fallidos = 0, [], []
        for video, campo, valor in candidatos:
            carpeta = 'imagen' if campo == 'imagen_link' else 'video'
            try:
                nueva_url = _subir_a_supabase(valor, carpeta, video.video_id)
                setattr(video, campo, nueva_url)
                video.save(update_fields=[campo])
                migrados += 1
                self.stdout.write(self.style.SUCCESS(f'  OK pk={video.pk} {campo} -> {nueva_url}'))
            except requests.RequestException as e:
                caducados.append((video.pk, campo, valor, str(e)))
                self.stdout.write(self.style.WARNING(f'  NO DISPONIBLE pk={video.pk} {campo}: {e}'))
            except RuntimeError as e:
                fallidos.append((video.pk, campo, valor, str(e)))
                self.stdout.write(self.style.ERROR(f'  FALLO SUBIDA pk={video.pk} {campo}: {e}'))

        self.stdout.write(self.style.SUCCESS(
            f'\nMigrados: {migrados} · Ya no disponibles (sin tocar, revisión manual): {len(caducados)} · '
            f'Fallos de subida (sin tocar): {len(fallidos)}'
        ))
