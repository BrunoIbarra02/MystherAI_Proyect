"""
Cross-references censo.csv and registro.csv to set estado_censo on VideoMetadata.

Match key: (Mateo/Miguel in registro) + (Id in registro)
         = (usuario in censo) + (ID DE VIDEO in censo)

Videos that appear in registro → Estilizado (reservado_por = who did it)
Videos that don't appear → Disponible
"""
import csv
import os
from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.sheets.models import VideoMetadata


class Command(BaseCommand):
    help = 'Fill estado_censo from censo.csv/registro.csv cross-reference'

    def handle(self, *args, **options):
        base = os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
        censo_path   = os.path.join(base, 'censo.csv')
        registro_path = os.path.join(base, 'registro.csv')

        if not os.path.exists(censo_path):
            self.stderr.write(f'censo.csv not found at {censo_path}'); return
        if not os.path.exists(registro_path):
            self.stderr.write(f'registro.csv not found at {registro_path}'); return

        # ── 1. Build stylized set from registro ──────────────────────────────
        # Key: (member_upper, video_id_str)  Value: first miembro who did it
        stylized = {}  # (member, vid_id) -> miembro_name
        with open(registro_path, encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                member = (row.get('Mateo/Miguel') or '').strip().upper()
                vid_id = (row.get('Id') or '').strip()
                miembro = (row.get('Miembro') or member or '').strip()
                if member and vid_id:
                    key = (member, vid_id)
                    if key not in stylized:
                        stylized[key] = miembro

        self.stdout.write(f'Registro: {len(stylized)} video/member combos stylized')

        # ── 2. Process censo rows ─────────────────────────────────────────────
        updated_est = 0
        updated_disp = 0
        not_found = 0

        with open(censo_path, encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                usuario   = (row.get('usuario') or '').strip().upper()
                vid_id    = (row.get('ID DE VIDEO') or '').strip()
                equipo_id = (row.get('ID DE VIDEO EQUIPO') or '').strip()

                if not usuario or not equipo_id:
                    continue

                # Find the DB record — match by id_video_equipo
                qs = VideoMetadata.objects.filter(
                    tipo='censo',
                    id_video_equipo=equipo_id,
                )
                if not qs.exists():
                    # Fallback: match by video_id
                    qs = VideoMetadata.objects.filter(
                        tipo='censo',
                        video_id=equipo_id,
                    )
                if not qs.exists():
                    not_found += 1
                    continue

                key = (usuario, vid_id)
                if key in stylized:
                    miembro_name = stylized[key]
                    qs.filter(
                        Q(estado_censo__isnull=True) | Q(estado_censo='') | Q(estado_censo='Disponible')
                    ).update(estado_censo='Estilizado', reservado_por=miembro_name)
                    updated_est += qs.count()
                else:
                    # Only set to Disponible if not already Reservado/Estilizado
                    qs.filter(
                        Q(estado_censo__isnull=True) | Q(estado_censo='')
                    ).update(estado_censo='Disponible')
                    updated_disp += qs.count()

        self.stdout.write(self.style.SUCCESS(
            f'Done — Estilizado: {updated_est}, Disponible: {updated_disp}, Not found in DB: {not_found}'
        ))
