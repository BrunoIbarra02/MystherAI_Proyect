"""
python manage.py sync_censo_csv

Reads censo.csv and updates every matching VideoMetadata (tipo='censo') record
with the corrected/new field values: especie, genero, etnia, camara,
plano, interior, accion.

Matching key: id_video_equipo (the #NNN shown in the catalog).
"""
import csv
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.sheets.models import VideoMetadata


class Command(BaseCommand):
    help = 'Sync especie/genero/etnia/camara/plano/interior/accion from censo.csv to the DB'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Print changes without saving')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        csv_path = os.path.join(settings.BASE_DIR, 'censo.csv')

        if not os.path.exists(csv_path):
            self.stderr.write(f'censo.csv not found at {csv_path}')
            return

        with open(csv_path, encoding='utf-8-sig') as f:
            rows = list(csv.DictReader(f))

        updated = skipped = not_found = 0

        for row in rows:
            equipo_id = str(row.get('ID DE VIDEO EQUIPO', '')).strip()
            if not equipo_id or equipo_id.lower() in ('nan', ''):
                skipped += 1
                continue

            # Normalize float IDs like '1.0' → '1'
            try:
                equipo_id = str(int(float(equipo_id)))
            except (ValueError, TypeError):
                pass

            new_especie  = row.get('ESPECIE',  '').strip()
            new_genero   = row.get('GENERO',   '').strip()
            new_etnia    = row.get('ETNIA',    '').strip()
            new_camara   = row.get('CAMARA',   '').strip()
            new_plano    = row.get('PLANO',    '').strip()
            new_interior = row.get('INTERIOR', '').strip()
            new_accion   = row.get('ACCION',   '').strip()

            try:
                video = VideoMetadata.objects.get(tipo='censo', id_video_equipo=equipo_id)
            except VideoMetadata.DoesNotExist:
                not_found += 1
                if dry_run:
                    self.stdout.write(f'  NOT FOUND: id_video_equipo={equipo_id}')
                continue
            except VideoMetadata.MultipleObjectsReturned:
                # Take the first one
                video = VideoMetadata.objects.filter(tipo='censo', id_video_equipo=equipo_id).first()

            changed_fields = []
            for field, new_val in [
                ('especie',  new_especie),
                ('genero',   new_genero),
                ('etnia',    new_etnia),
                ('camara',   new_camara),
                ('plano',    new_plano),
                ('interior', new_interior),
                ('accion',   new_accion),
            ]:
                old_val = getattr(video, field, '') or ''
                if old_val.strip() != new_val:
                    if dry_run:
                        self.stdout.write(f'  #{equipo_id} {field}: {old_val!r} → {new_val!r}')
                    setattr(video, field, new_val)
                    changed_fields.append(field)

            if changed_fields and not dry_run:
                video.save(update_fields=changed_fields)
                updated += 1
            elif changed_fields:
                updated += 1  # count for dry-run report

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Updated: {updated}  Not found: {not_found}  Skipped: {skipped}'
        ))
        if dry_run:
            self.stdout.write('(dry-run — no changes written)')
