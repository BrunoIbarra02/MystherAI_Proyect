from django.db import models

class VideoMetadata(models.Model):
    video_id = models.CharField(max_length=100, blank=True, null=True)
    tipo = models.CharField(max_length=50, choices=[('censo', 'Censo'), ('registro', 'Registro')])
    usuario = models.CharField(max_length=100, blank=True, null=True)
    
    # --- CAMPOS DE REGISTRO ---
    mateo_miguel = models.CharField(max_length=100, blank=True, null=True)
    estilizado = models.CharField(max_length=100, blank=True, null=True)
    prompt_imagen = models.TextField(blank=True, null=True)
    imagen_link = models.URLField(max_length=1000, blank=True, null=True)
    prompt_video = models.TextField(blank=True, null=True)
    video_original_link = models.URLField(max_length=1000, blank=True, null=True)
    aceptado = models.CharField(max_length=50, blank=True, null=True)
    prompt_final = models.TextField(blank=True, null=True)

    # --- CAMPOS DE CENSO ---
    id_video_equipo = models.CharField(max_length=100, blank=True, null=True)
    mapa = models.CharField(max_length=100, blank=True, null=True)
    genero = models.CharField(max_length=100, blank=True, null=True) # AHORA SÍ ESTÁ
    etnia = models.CharField(max_length=100, blank=True, null=True)
    duracion = models.CharField(max_length=100, blank=True, null=True)
    camara = models.CharField(max_length=100, blank=True, null=True)
    especie = models.CharField(max_length=100, blank=True, null=True)

    # --- ENLACE PRINCIPAL ---
    drive_link = models.URLField(max_length=1000, blank=True, null=True)

    # --- ESTADO DE PRODUCCIÓN (sólo censo) ---
    ESTADO_CENSO = [('Disponible', 'Disponible'), ('Reservado', 'Reservado'), ('Estilizado', 'Estilizado')]
    estado_censo = models.CharField(max_length=20, choices=ESTADO_CENSO, default='Disponible', blank=True, null=True)
    reservado_por = models.CharField(max_length=100, blank=True, null=True)

    # --- REVISIÓN (sólo registro) ---
    ESTADO_REVISION = [('Pendiente', 'Pendiente'), ('Aprobado', 'Aprobado'), ('Rechazado', 'Rechazado')]
    estado_revision    = models.CharField(max_length=20, choices=ESTADO_REVISION, default='Pendiente', blank=True, null=True)
    comentario_revision = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.video_id} - {self.tipo}"


class GradioError(models.Model):
    miembro   = models.CharField(max_length=100, blank=True)
    paso      = models.CharField(max_length=50, blank=True)   # I2I, V2V, CARGAR
    modelo    = models.CharField(max_length=200, blank=True)
    mensaje   = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.miembro} | {self.paso} | {self.timestamp:%Y-%m-%d %H:%M}"
