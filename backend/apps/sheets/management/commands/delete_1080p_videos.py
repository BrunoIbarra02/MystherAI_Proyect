"""
python manage.py delete_1080p_videos [--dry-run] [--min-height 1080]

Checks every censo VideoMetadata entry's Drive file for video resolution
using the Drive API v3 (videoMediaMetadata). Deletes DB records and removes
rows from censo.csv for any video whose height >= min-height (default 1080).

Requires: pip install google-api-python-client google-auth
Drive API must be enabled and credentials available (service account or ADC).

Usage:
    python manage.py delete_1080p_videos --dry-run      # preview only
    python manage.py delete_1080p_videos                 # actually delete
    python manage.py delete_1080p_videos --min-height 720  # delete 720p+
"""
import csv
import os
import re
import time

from django.core.management.base import BaseCommand
from django.conf import settings

from apps.sheets.models import VideoMetadata


def extract_drive_id(url):
    if not url:
        return None
    m = re.search(r'(?:file/d/|id=|open\?id=)([a-zA-Z0-9_-]{25,})', url)
    return m.group(1) if m else None


def build_drive_service():
    """Build a Drive API service using Application Default Credentials."""
    from googleapiclient.discovery import build
    from google.auth import default as google_auth_default

    scopes = ['https://www.googleapis.com/auth/drive.readonly']
    credentials, _ = google_auth_default(scopes=scopes)
    return build('drive', 'v3', credentials=credentials)


def get_video_height(service, file_id):
    """Return (height, width, size_mb) for a Drive file, or None if unavailable."""
    try:
        meta = service.files().get(
            fileId=file_id,
            fields='id,name,size,videoMediaMetadata',
        ).execute()
        vm = meta.get('videoMediaMetadata', {})
        height = vm.get('height')
        width  = vm.get('width')
        size   = int(meta.get('size', 0))
        return height, width, round(size / 1024 / 1024, 1)
    except Exception as e:
        return None, None, None


class Command(BaseCommand):
    help = 'Detect and delete 1080p (or higher) censo videos using Drive API'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run',    action='store_true', help='Preview without deleting')
        parser.add_argument('--min-height', type=int, default=1080, help='Height threshold (default 1080)')
        parser.add_argument('--delay',      type=float, default=0.1, help='Seconds between Drive API calls')

    def handle(self, *args, **options):
        dry_run    = options['dry_run']
        min_height = options['min_height']
        delay      = options['delay']

        # Build Drive service
        try:
            service = build_drive_service()
            self.stdout.write('Drive API connected.')
        except Exception as e:
            self.stderr.write(f'Could not build Drive service: {e}')
            self.stderr.write('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or ADC is configured.')
            return

        # Load all censo DB entries that have a drive_link
        videos = list(
            VideoMetadata.objects.filter(tipo='censo')
            .values('id', 'id_video_equipo', 'drive_link', 'mapa', 'especie')
        )
        self.stdout.write(f'Checking {len(videos)} censo entries...\n')

        to_delete_ids   = []   # DB pk list
        to_delete_equip = set()  # id_video_equipo set for CSV removal

        for i, v in enumerate(videos, 1):
            fid = extract_drive_id(v['drive_link'] or '')
            if not fid:
                continue

            height, width, size_mb = get_video_height(service, fid)

            if height is None:
                # Could not access file (private, deleted, no permission)
                continue

            label = f"#{v['id_video_equipo']:>4} | {v['mapa'] or '?':20s} | {width}x{height} | {size_mb}MB"

            if height >= min_height:
                self.stdout.write(self.style.WARNING(f'  1080p → {label}'))
                to_delete_ids.append(v['id'])
                to_delete_equip.add(str(v['id_video_equipo']))
            elif i % 50 == 0:
                self.stdout.write(f'  [{i}/{len(videos)}] checked...')

            time.sleep(delay)

        self.stdout.write(f'\nFound {len(to_delete_ids)} videos at {min_height}p or higher.')

        if not to_delete_ids:
            self.stdout.write('Nothing to delete.')
            return

        if dry_run:
            self.stdout.write('(dry-run — no changes written)')
            return

        # ── Delete from DB ──────────────────────────────────────────────────
        deleted_count, _ = VideoMetadata.objects.filter(pk__in=to_delete_ids).delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_count} DB records.'))

        # ── Remove from censo.csv ────────────────────────────────────────────
        csv_path = os.path.join(settings.BASE_DIR, 'censo.csv')
        if os.path.exists(csv_path):
            with open(csv_path, encoding='utf-8-sig') as f:
                reader   = csv.DictReader(f)
                fieldnames = reader.fieldnames
                all_rows = list(reader)

            kept  = [r for r in all_rows if str(r.get('ID DE VIDEO EQUIPO','')).strip() not in to_delete_equip]
            removed = len(all_rows) - len(kept)

            with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(kept)

            self.stdout.write(self.style.SUCCESS(f'Removed {removed} rows from censo.csv.'))

        self.stdout.write(self.style.SUCCESS('Done.'))
