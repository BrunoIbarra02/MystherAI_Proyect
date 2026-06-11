import csv
import os
from django.core.management.base import BaseCommand
from apps.sheets.models import VideoMetadata

class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        VideoMetadata.objects.all().delete()
        self.stdout.write("Importando datos con mapeo estricto...")

        if os.path.exists('registro.csv'):
            with open('registro.csv', mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    # Convertimos las llaves del CSV a minúsculas y sin espacios para que NUNCA falle la búsqueda
                    c_row = {str(k).strip().lower(): str(v).strip() for k, v in row.items() if k}
                    
                    v_id = c_row.get('id', '')
                    if not v_id: continue
                    
                    VideoMetadata.objects.create(
                        video_id=v_id,
                        tipo='registro',
                        usuario=c_row.get('miembro', ''),
                        mateo_miguel=c_row.get('mateo/miguel', ''),
                        estilizado=c_row.get('estilizado', ''),
                        prompt_imagen=c_row.get('prompt imagen', ''),
                        imagen_link=c_row.get('imagen', ''),
                        prompt_video=c_row.get('prompt video', ''),
                        drive_link=c_row.get('video', ''),
                        video_original_link=c_row.get('video orginal', c_row.get('video original', '')),
                        aceptado=c_row.get('aceptado', ''),
                        prompt_final=c_row.get('prompt final', ''),
                        prompt_imagen_arreglo=c_row.get('prompt imagen arreglo', ''),
                        imagen_arreglo=c_row.get('imagen arreglo', ''),
                        prompt_video_arreglo=c_row.get('prompt video arreglo', ''),
                        video_arreglo=c_row.get('video arreglo', '')
                    )
                    count += 1
            self.stdout.write(self.style.SUCCESS(f"OK: {count} videos de Registro importados (Con Prompts Completos)."))

        if os.path.exists('censo.csv'):
            with open('censo.csv', mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    c_row = {str(k).strip().lower(): str(v).strip() for k, v in row.items() if k}
                    
                    v_id = c_row.get('id de video', c_row.get('video_id', ''))
                    if not v_id: continue
                    
                    VideoMetadata.objects.create(
                        video_id=v_id,
                        tipo='censo',
                        usuario=c_row.get('usuario', ''),
                        id_video_equipo=c_row.get('id de video equipo', ''),
                        drive_link=c_row.get('link', ''),
                        mapa=c_row.get('mapa', ''),
                        genero=c_row.get('genero', ''),
                        etnia=c_row.get('etnia', ''),
                        duracion=c_row.get('duracion', ''),
                        camara=c_row.get('camara', ''),
                        especie=c_row.get('especie', '')
                    )
                    count += 1
            self.stdout.write(self.style.SUCCESS(f"OK: {count} videos de Censo importados."))
