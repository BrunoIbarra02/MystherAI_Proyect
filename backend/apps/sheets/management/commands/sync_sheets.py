import csv, os, io
import requests as req
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from apps.sheets.models import VideoMetadata

SHEETS_ID = '1Ga5zMekIlVjHKhxkfGBIhAiCh0H3zGYf0TOoMkoctj4'
REGISTRO_URL = f'https://docs.google.com/spreadsheets/d/{SHEETS_ID}/gviz/tq?tqx=out:csv&sheet=Registro'

class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        VideoMetadata.objects.all().delete()
        self.stdout.write("Limpiando y Re-importando datos...")

        def get_v(row, *keys):
            for k in keys:
                for rk, rv in row.items():
                    if rk and rk.lower().strip() == k.lower().strip():
                        v = rv.strip()
                        # Skip values that look like filenames (Smart Chip export artifact)
                        if v and not v.startswith('http') and '.' in v and '/' not in v:
                            return ''
                        return v
            return ""

        def safe_create(obj):
            try:
                obj.save()
            except IntegrityError:
                pass

        # --- IMPORTAR REGISTRO (desde Google Sheets en vivo) ---
        count = 0
        try:
            self.stdout.write(f"Descargando Registro desde Google Sheets...")
            resp = req.get(REGISTRO_URL, timeout=30)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))
            for row in reader:
                v_id = get_v(row, 'Id')
                if not v_id: continue
                obj = VideoMetadata(
                    video_id=v_id, tipo='registro',
                    usuario=get_v(row, 'Miembro'),
                    mateo_miguel=get_v(row, 'Mateo/Miguel'),
                    estilizado=get_v(row, 'Estilizado'),
                    prompt_imagen=get_v(row, 'Prompt imagen'),
                    imagen_link=get_v(row, 'imagen'),
                    prompt_video=get_v(row, 'prompt video'),
                    drive_link=get_v(row, 'video'),
                    video_original_link=get_v(row, 'video orginal', 'video original'),
                    aceptado=get_v(row, 'ACEPTADO'),
                    prompt_final=get_v(row, 'Prompt Final'),
                )
                safe_create(obj)
                count += 1
            self.stdout.write(f"✅ Registro importado desde Sheets: {count} filas.")
        except Exception as e:
            self.stdout.write(f"⚠️  Sheets no disponible ({e}), usando registro.csv local...")
            registro_path = 'registro.csv'
            if os.path.exists(registro_path):
                with open(registro_path, mode='r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        v_id = get_v(row, 'Id')
                        if not v_id: continue
                        obj = VideoMetadata(
                            video_id=v_id, tipo='registro',
                            usuario=get_v(row, 'Miembro'),
                            mateo_miguel=get_v(row, 'Mateo/Miguel'),
                            estilizado=get_v(row, 'Estilizado'),
                            prompt_imagen=get_v(row, 'Prompt imagen'),
                            imagen_link=get_v(row, 'imagen'),
                            prompt_video=get_v(row, 'prompt video'),
                            drive_link=get_v(row, 'video'),
                            video_original_link=get_v(row, 'video orginal', 'video original'),
                            aceptado=get_v(row, 'ACEPTADO'),
                            prompt_final=get_v(row, 'Prompt Final'),
                        )
                        safe_create(obj)
                        count += 1
                self.stdout.write(f"✅ Registro importado desde CSV local: {count} filas.")
            else:
                self.stdout.write("❌ No se encontró registro.csv")

        # --- IMPORTAR CENSO (CSV local) ---
        censo_path = 'censo.csv'
        if os.path.exists(censo_path):
            count = 0
            with open(censo_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    v_id = get_v(row, 'ID DE VIDEO')
                    if not v_id: continue
                    obj = VideoMetadata(
                        video_id=v_id, tipo='censo',
                        usuario=row.get('usuario', '').strip(),
                        id_video_equipo=row.get('ID DE VIDEO EQUIPO', '').strip(),
                        drive_link=row.get('LINK', '').strip(),
                        mapa=row.get('MAPA', '').strip(),
                        genero=row.get('GENERO', '').strip(),
                        etnia=row.get('ETNIA', '').strip(),
                        duracion=row.get('DURACION', '').strip(),
                        camara=row.get('CAMARA', '').strip(),
                        especie=row.get('ESPECIE', '').strip(),
                    )
                    safe_create(obj)
                    count += 1
            self.stdout.write(f"✅ Censo importado: {count} filas.")
        else:
            self.stdout.write("❌ No se encontró censo.csv")
