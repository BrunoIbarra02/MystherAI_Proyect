from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Q
from .models import VideoMetadata
from .serializers import VideoMetadataSerializer

class VideoListView(generics.ListCreateAPIView):
    serializer_class = VideoMetadataSerializer
    
    def get_queryset(self):
        queryset = VideoMetadata.objects.all()
        tipo = self.request.query_params.get('tipo', '').strip()
        search = self.request.query_params.get('search', '').strip()
        
        if tipo: queryset = queryset.filter(tipo__iexact=tipo)
        
        filter_fields = ['usuario', 'mapa', 'genero', 'etnia', 'camara', 'especie', 'estilizado', 'aceptado']
        for field in filter_fields:
            value = self.request.query_params.get(field, '').strip()
            if value:
                queryset = queryset.filter(**{f"{field}__icontains": value})

        if search:
            queryset = queryset.filter(Q(video_id__icontains=search) | Q(usuario__icontains=search))
        
        return queryset.order_by("-id")

# Nueva vista para editar y eliminar (Solo Admin)
class VideoDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = VideoMetadata.objects.all()
    serializer_class = VideoMetadataSerializer
    # La lógica de permisos se manejará en el frontend ocultando botones, 
    # pero aquí blindamos la API
    def get_permissions(self):
        if self.request.method in ['DELETE', 'PUT', 'PATCH']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

class FilterOptionsView(APIView):
    def get(self, request):
        tipo = request.query_params.get('tipo', 'censo').lower()
        fields_to_filter = ["usuario", "mapa", "genero", "etnia", "camara", "especie", "estilizado", "aceptado"]
        options = {}
        
        for field_name in fields_to_filter:
            distinct_values = VideoMetadata.objects.values_list(field_name, flat=True).distinct()
            cleaned_values = [str(v).strip() for v in distinct_values if v and str(v).lower() != 'nan']
            
            # LÓGICA DE USUARIOS DINÁMICA
            if field_name == 'usuario':
                censo_users = set(
                    str(v).strip().lower() 
                    for v in VideoMetadata.objects.filter(tipo='censo').values_list('usuario', flat=True).distinct()
                    if v and str(v).lower() != 'nan'
                )
                if tipo == 'censo':
                    cleaned_values = [v for v in cleaned_values if v.lower() in censo_users]
                else:
                    cleaned_values = [v for v in cleaned_values if v.lower() not in censo_users]
            
            options[field_name] = sorted(list(set(cleaned_values)))
        return Response(options)

class CensoSummaryView(APIView):
    permission_classes = []
    
    def get(self, request):
        import csv
        import os
        from django.conf import settings
        
        csv_path = os.path.join(settings.BASE_DIR, 'censo.csv')
        
        if not os.path.exists(csv_path):
            return Response({
                "kpis": {
                    "totalVideos": 0,
                    "humanos": 0,
                    "animales": 0,
                    "sinClasificar": 0,
                    "duracionMedia": "0s",
                    "totalMapas": 0,
                    "videosMateo": 0,
                    "videosMiguel": 0,
                    "totalSegundos": 0
                },
                "especiesData": [],
                "inicialMapas": [],
                "exclusivasMateo": [],
                "exclusivasMiguel": [],
                "generoData": [],
                "etniaData": [],
                "cruceGenEtnia": [],
                "mapasSoloHombres": [],
                "camaraData": [],
                "duracionData": [],
                "actionPlan": []
            })
            
        normalized_rows = []
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                c_row = {str(k).strip().lower(): str(v).strip() for k, v in row.items() if k}
                # Se verifica si hay al menos algunos campos de identificación para ignorar filas vacías
                if not any(c_row.values()):
                    continue
                normalized_rows.append(c_row)
                
        total_videos = len(normalized_rows)
        humanos = sum(1 for r in normalized_rows if r.get("especie", "").lower() == "humano")
        animales = sum(1 for r in normalized_rows if r.get("especie", "").lower() == "animal")
        sin_clasificar = total_videos - humanos - animales

        durations = []
        for r in normalized_rows:
            d_val = r.get("duracion", "")
            if d_val:
                try:
                    durations.append(float(d_val))
                except ValueError:
                    pass

        total_segundos = sum(durations)
        duracion_media = f"{total_segundos / len(durations):.1f}s" if durations else "0.0s"

        unique_maps = sorted(list(set(r.get("mapa", "") for r in normalized_rows if r.get("mapa", ""))))
        total_mapas = len(unique_maps)

        # Obtener todos los usuarios únicos dinámicamente
        unique_users = sorted(list(set(r.get("usuario", "").strip().upper() for r in normalized_rows if r.get("usuario", ""))))
        
        videos_por_usuario = {}
        for u in unique_users:
            videos_por_usuario[u] = sum(1 for r in normalized_rows if r.get("usuario", "").strip().upper() == u)

        kpis = {
            "totalVideos": total_videos,
            "humanos": humanos,
            "animales": animales,
            "sinClasificar": sin_clasificar,
            "duracionMedia": duracion_media,
            "totalMapas": total_mapas,
            "videosMateo": videos_por_usuario.get("MATEO", 0),  # Para compatibilidad legacy
            "videosMiguel": videos_por_usuario.get("MIGUEL", 0),  # Para compatibilidad legacy
            "videosPorUsuario": videos_por_usuario,  # Estructura 100% dinámica
            "totalSegundos": int(total_segundos)
        }

        # Estadísticas de especies
        total_for_pct = total_videos if total_videos > 0 else 1
        especies_data = [
            { "label": "Humano", "value": humanos, "percent": round((humanos / total_for_pct) * 100, 1), "color": "var(--neon-cyan)" },
            { "label": "Animal", "value": animales, "percent": round((animales / total_for_pct) * 100, 1), "color": "#2ecc71" },
            { "label": "Sin Clasificar", "value": sin_clasificar, "percent": round((sin_clasificar / total_for_pct) * 100, 1), "color": "#ff4b2b" }
        ]

        # Estadísticas de Mapas dinámicas
        map_stats = {}
        for m in unique_maps:
            map_stats[m] = {
                "name": m,
                "total": 0,
                "human": 0,
                "animal": 0,
                "unclassified": 0,
                "usuarios": { u: 0 for u in unique_users },
                "genders": set(),
                "ethnicities": set()
            }

        for r in normalized_rows:
            m = r.get("mapa", "")
            if not m:
                continue
            stats = map_stats[m]
            stats["total"] += 1
            
            esp = r.get("especie", "").lower()
            if esp == "humano":
                stats["human"] += 1
            elif esp == "animal":
                stats["animal"] += 1
            else:
                stats["unclassified"] += 1
                
            u = r.get("usuario", "").strip().upper()
            if u in stats["usuarios"]:
                stats["usuarios"][u] += 1
                
            gen = r.get("genero", "").lower()
            if gen in ["hombre", "mujer"]:
                stats["genders"].add(gen)
                
            etn = r.get("etnia", "").lower()
            if etn in ["blanco", "moreno"]:
                stats["ethnicities"].add(etn)

        # Ordenar mapas por total descendente
        inicial_mapas = []
        for m in unique_maps:
            s = map_stats[m]
            inicial_mapas.append({
                "name": s["name"],
                "total": s["total"],
                "human": s["human"],
                "animal": s["animal"],
                "unclassified": s["unclassified"],
                "mateo": s["usuarios"].get("MATEO", 0),
                "miguel": s["usuarios"].get("MIGUEL", 0),
                "usuarios": s["usuarios"]
            })
        inicial_mapas.sort(key=lambda x: x["total"], reverse=True)

        # Exclusivas por usuario dinámico
        exclusivas_por_usuario = { u: [] for u in unique_users }
        for m in unique_maps:
            s = map_stats[m]
            active_users = [u for u, count in s["usuarios"].items() if count > 0]
            if len(active_users) == 1:
                exclusive_user = active_users[0]
                exclusivas_por_usuario[exclusive_user].append({ "name": m, "total": s["total"] })
                
        for u in unique_users:
            exclusivas_por_usuario[u].sort(key=lambda x: x["name"])

        exclusivas_mateo = exclusivas_por_usuario.get("MATEO", [])
        exclusivas_miguel = exclusivas_por_usuario.get("MIGUEL", [])

        # Estadisticas de genero
        gender_counts = {"Hombre": 0, "Mujer": 0}
        for r in normalized_rows:
            gen = r.get("genero", "").strip().capitalize()
            if gen in gender_counts:
                gender_counts[gen] += 1
                
        total_gender = sum(gender_counts.values())
        total_gender_pct = total_gender if total_gender > 0 else 1
        genero_data = [
            { "label": "Hombre", "value": gender_counts["Hombre"], "percent": round((gender_counts["Hombre"] / total_gender_pct) * 100, 1), "color": "var(--neon-cyan)" },
            { "label": "Mujer", "value": gender_counts["Mujer"], "percent": round((gender_counts["Mujer"] / total_gender_pct) * 100, 1), "color": "var(--neon-purple)" }
        ]

        # Estadisticas de etnia
        etnia_counts = {"Blanco": 0, "Moreno": 0}
        for r in normalized_rows:
            etn = r.get("etnia", "").strip().capitalize()
            if etn in etnia_counts:
                etnia_counts[etn] += 1
                
        total_etnia = sum(etnia_counts.values())
        total_etnia_pct = total_etnia if total_etnia > 0 else 1
        etnia_data = [
            { "label": "Blanco", "value": etnia_counts["Blanco"], "percent": round((etnia_counts["Blanco"] / total_etnia_pct) * 100, 1), "color": "#f39c12" },
            { "label": "Moreno", "value": etnia_counts["Moreno"], "percent": round((etnia_counts["Moreno"] / total_etnia_pct) * 100, 1), "color": "#9b59b6" }
        ]

        # Cruce de Genero y Etnia
        cruce_counts = {
            "Hombre Blanco": 0,
            "Hombre Moreno": 0,
            "Mujer Blanco": 0,
            "Mujer Moreno": 0
        }
        for r in normalized_rows:
            gen = r.get("genero", "").strip().capitalize()
            etn = r.get("etnia", "").strip().capitalize()
            key = f"{gen} {etn}"
            if key in cruce_counts:
                cruce_counts[key] += 1

        cruce_gen_etnia = [
            { "label": "Hombre Blanco", "value": cruce_counts["Hombre Blanco"], "color": "#ff7f50" },
            { "label": "Hombre Moreno", "value": cruce_counts["Hombre Moreno"], "color": "var(--neon-cyan)" },
            { "label": "Mujer Blanco", "value": cruce_counts["Mujer Blanco"], "color": "#e0115f" },
            { "label": "Mujer Moreno", "value": cruce_counts["Mujer Moreno"], "color": "#8e44ad" }
        ]

        # Mapas solo hombres
        mapas_solo_hombres = []
        for m in unique_maps:
            s = map_stats[m]
            if "hombre" in s["genders"] and "mujer" not in s["genders"]:
                mapas_solo_hombres.append(m)
        mapas_solo_hombres.sort()

        # Estadisticas de camara
        camera_counts = {}
        for r in normalized_rows:
            cam = r.get("camara", "").strip()
            if cam:
                camera_counts[cam] = camera_counts.get(cam, 0) + 1

        camera_label_mapping = {
            "Primera Persona": "1ra Persona"
        }
        camera_colors = {
            "Realizadora": "#ff5722",
            "Libre": "#00bcd4",
            "Rail": "#9c27b0",
            "Fija": "#e91e63",
            "1ra Persona": "#4caf50",
            "Primera Persona": "#4caf50"
        }

        camara_data_list = []
        for cam, count in camera_counts.items():
            lbl = camera_label_mapping.get(cam, cam)
            color = camera_colors.get(lbl, "#7f8c8d")
            camara_data_list.append({ "label": lbl, "value": count, "color": color })
        camara_data_list.sort(key=lambda x: x["value"], reverse=True)

        # Estadisticas de duración
        duration_counts = {}
        for r in normalized_rows:
            d_val = r.get("duracion", "")
            if d_val:
                try:
                    dur = int(float(d_val))
                    duration_counts[dur] = duration_counts.get(dur, 0) + 1
                except ValueError:
                    pass

        duracion_data = []
        for dur in sorted(duration_counts.keys()):
            duracion_data.append({ "label": f"{dur}s", "value": duration_counts[dur] })

        # Action plan metrics
        mapas_solo_una_etnia = [m for m in unique_maps if len(map_stats[m]["ethnicities"]) == 1]
        fija_count = camera_counts.get("Fija", 0)

        # Plan de acción 100% dinámico
        action_plan = [
            { "id": 1, "cat": "Especie", "title": "Clasificar videos en especie", "desc": f"Clasificar los {sin_clasificar} videos marcados como 'Nan' en especie (revisión manual urgente).", "priority": "critica", "deficit": f"{sin_clasificar} videos", "status": "Pendiente", "checked": False },
            { "id": 2, "cat": "Género x Mapa", "title": "Añadir mujeres en mapas masculinos", "desc": f"Añadir personajes femeninos en los {len(mapas_solo_hombres)} mapas que solo contienen hombres (Biblioteca, Desierto, etc.).", "priority": "alta", "deficit": f"{len(mapas_solo_hombres)} mapas", "status": "Pendiente", "checked": False },
            { "id": 3, "cat": "Etnia x Mapa", "title": "Diversificar etnias en mapas exclusivos", "desc": f"Introducir variedad étnica en los {len(mapas_solo_una_etnia)} mapas que solo cuentan con un solo tipo étnico.", "priority": "alta", "deficit": f"{len(mapas_solo_una_etnia)} mapas", "status": "Pendiente", "checked": False }
        ]
        
        # Agregar tareas de cobertura dinámica para cada usuario
        act_id = 4
        for u in unique_users:
            excl_maps = exclusivas_por_usuario[u]
            if excl_maps:
                action_plan.append({
                    "id": act_id,
                    "cat": "Cobertura",
                    "title": f"Videos de otros usuarios en mapas de {u}",
                    "desc": f"Otros miembros del equipo deben grabar en los {len(excl_maps)} mapas exclusivos de {u} para completar la cobertura cruzada y evitar sesgos de captura.",
                    "priority": "media",
                    "deficit": f"{len(excl_maps)} mapas",
                    "status": "Pendiente",
                    "checked": False
                })
                act_id += 1

        action_plan.extend([
            { "id": act_id, "cat": "Cámara", "title": "Aumentar cámara Fija", "desc": f"Grabar más videos utilizando el tipo de cámara 'Fija' para nivelar el déficit (actualmente {fija_count}).", "priority": "baja", "deficit": f"{fija_count} videos", "status": "Pendiente", "checked": False },
            { "id": act_id + 1, "cat": "Cámara", "title": "Equilibrar duración del censo", "desc": "Apuntar a una mayor cantidad de grabaciones en el rango ideal de 7 a 10 segundos.", "priority": "baja", "deficit": "Varios", "status": "Pendiente", "checked": False }
        ])

        # Convertir conjuntos a listas/diccionarios para poder serializarlos a JSON
        usuarios_data = []
        for u in unique_users:
            val = videos_por_usuario[u]
            usuarios_data.append({
                "usuario": u,
                "value": val,
                "percent": round((val / total_for_pct) * 100, 1) if total_videos > 0 else 0
            })

        data = {
            "kpis": kpis,
            "especiesData": especies_data,
            "inicialMapas": inicial_mapas,
            "exclusivasMateo": exclusivas_mateo,
            "exclusivasMiguel": exclusivas_miguel,
            "exclusivasPorUsuario": exclusivas_por_usuario,
            "usuariosData": usuarios_data,
            "generoData": genero_data,
            "etniaData": etnia_data,
            "cruceGenEtnia": cruce_gen_etnia,
            "mapasSoloHombres": mapas_solo_hombres,
            "camaraData": camara_data_list,
            "duracionData": duracion_data,
            "actionPlan": action_plan
        }
        return Response(data)

