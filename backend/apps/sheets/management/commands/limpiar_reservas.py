"""
Limpia las reservas del censo que pertenecen a gente que ya no está en el equipo.

Estado que había en producción (agosto 2026), heredado de un reparto antiguo:

    Olenka 54, Wilson 49, Rodrigo 45, Fabio 24, Katty 24   <- equipo actual, correcto
    laura 23, alvaro 23, omar 23, david 23, dario 23, mateo 23, Jose Maria 3
                                                            <- EX-EMPLEADOS: 141 videos bloqueados
    rodrigo 23, wilson 23                                   <- DUPLICADOS en minúscula

Los duplicados en minúscula son trabajo real de Rodrigo y Wilson: el filtro del
perfil compara por nombre exacto, así que esas 46 reservas no les aparecían.
Se consolidan con su dueño, no se liberan — si no, se les borra trabajo hecho.

Las de ex-empleados se liberan y se reparten en round-robin entre el equipo actual.

Idempotente: si no hay nada que limpiar no toca nada, así que puede correr en
cada arranque del contenedor sin efectos sorpresa.

    python manage.py limpiar_reservas --dry-run
    python manage.py limpiar_reservas
    python manage.py limpiar_reservas --no-repartir   # solo liberar, sin reparto
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.sheets.models import VideoMetadata
from apps.users.utils import resolve_by_display_name


# Se importa de views para no duplicar la fuente de verdad del equipo.
def _equipo_actual():
    from apps.sheets.views import EQUIPO_ACTUAL
    return list(EQUIPO_ACTUAL)


class Command(BaseCommand):
    help = 'Libera reservas de ex-empleados y consolida duplicados de mayúsculas'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Muestra qué cambiaría sin escribir nada')
        parser.add_argument('--no-repartir', action='store_true',
                            help='Libera pero no reparte entre el equipo actual')

    def handle(self, *args, **options):
        dry      = options['dry_run']
        repartir = not options['no_repartir']
        equipo   = _equipo_actual()

        reservados = VideoMetadata.objects.filter(tipo='censo', estado_censo='Reservado')

        # ── 1. Consolidar variantes de mayúsculas/minúsculas ────────────────
        # 'rodrigo' y 'Rodrigo' son la misma persona; se unifica al nombre canónico.
        consolidados = 0
        for nombre_canonico in equipo:
            variantes = (reservados
                         .filter(reservado_por__iexact=nombre_canonico)
                         .exclude(reservado_por=nombre_canonico))
            n = variantes.count()
            if n:
                self.stdout.write(f'  consolidar -> {nombre_canonico}: {n} reservas')
                if not dry:
                    variantes.update(reservado_por=nombre_canonico,
                                      reservado_por_user=resolve_by_display_name(nombre_canonico))
                consolidados += n

        # ── 2. Liberar lo que no pertenece a nadie del equipo actual ────────
        q_equipo = Q()
        for m in equipo:
            q_equipo |= Q(reservado_por__iexact=m)

        ajenos = VideoMetadata.objects.filter(
            tipo='censo', estado_censo='Reservado').exclude(q_equipo)

        detalle_ajenos = {}
        for nombre in ajenos.values_list('reservado_por', flat=True):
            clave = nombre or '(sin dueño)'
            detalle_ajenos[clave] = detalle_ajenos.get(clave, 0) + 1

        liberados = ajenos.count()
        for nombre, n in sorted(detalle_ajenos.items(), key=lambda x: -x[1]):
            self.stdout.write(f'  liberar <- {nombre}: {n} reservas')
        if liberados and not dry:
            ajenos.update(estado_censo='Disponible', reservado_por=None, reservado_por_user=None)

        # ── 3. Repartir lo disponible entre el equipo actual ────────────────
        repartidos = {}
        if repartir and equipo:
            equipo_users = {m: resolve_by_display_name(m) for m in equipo}
            disponibles = list(
                VideoMetadata.objects.filter(tipo='censo', estado_censo='Disponible')
                .order_by('id').values_list('id', flat=True)
            )
            # Se reparte continuando desde quien menos tiene, para no desequilibrar
            # a quien ya llevaba carga.
            carga = {
                m: VideoMetadata.objects.filter(
                    tipo='censo', estado_censo='Reservado', reservado_por=m).count()
                for m in equipo
            }
            for vid_pk in disponibles:
                destino = min(equipo, key=lambda m: (carga[m], m))
                carga[destino] += 1
                repartidos[destino] = repartidos.get(destino, 0) + 1
                if not dry:
                    VideoMetadata.objects.filter(pk=vid_pk).update(
                        estado_censo='Reservado', reservado_por=destino,
                        reservado_por_user=equipo_users[destino])
            for m in equipo:
                self.stdout.write(f'  repartir -> {m}: +{repartidos.get(m, 0)} '
                                  f'(total {carga[m]})')

        marca = '[DRY-RUN] ' if dry else ''
        self.stdout.write(self.style.SUCCESS(
            f'{marca}Consolidadas {consolidados}, liberadas {liberados}, '
            f'repartidas {sum(repartidos.values())}.'
        ))
        if dry:
            self.stdout.write('Nada escrito. Ejecuta sin --dry-run para aplicar.')
