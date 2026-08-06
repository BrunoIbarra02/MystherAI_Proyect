"""
Backup y verificación de los datos para migrar de proyecto Supabase.

    python manage.py backup_datos --conteo              # inventario, no escribe nada
    python manage.py backup_datos -o backup.json        # genera el backup
    python manage.py backup_datos --verificar backup.json  # compara backup vs BD actual

Por qué dumpdata y no pg_dump:
  - La BD es pequeña (~700 filas) y todas las migraciones están en el repo, así
    que el esquema se recrea con `migrate` en el destino: no hay que trasladar
    tipos, roles ni extensiones propias de Supabase.
  - pg_dump exige que la versión del cliente coincida con la del servidor y una
    conexión directa (puerto 5432). El pooler de Supabase no lo soporta bien y
    con la retirada de IPv4 hace falta el add-on de IPv4. Es el camino que más
    se rompe en la práctica.
  - dumpdata conserva los hashes de contraseña, así que nadie tiene que
    volver a registrarse tras la migración.

Se excluyen contenttypes y auth.Permission: los recrea `migrate` en el destino
y, si se importan, chocan por clave única y la carga entera falla.
"""
from django.apps import apps
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection


# Tablas que NO se migran: las regenera Django en el destino.
EXCLUIR = [
    'contenttypes',
    'auth.Permission',
    'sessions',          # las sesiones abiertas se pierden: hay que volver a entrar
    'admin.logentry',
]

# Modelos cuyo recuento importa de verdad para dar la migración por buena.
MODELOS_CLAVE = [
    ('sheets', 'VideoMetadata'),
    ('users',  'User'),
    ('sheets', 'GradioError'),
]


def _inventario():
    """Devuelve [(etiqueta, filas)] de todo lo que se va a migrar."""
    filas = []
    for app_label, modelo in MODELOS_CLAVE:
        try:
            m = apps.get_model(app_label, modelo)
            filas.append((f'{app_label}.{modelo}', m.objects.count()))
        except Exception as e:
            filas.append((f'{app_label}.{modelo}', f'ERROR: {e}'))
    return filas


def _desglose_censo():
    """Detalle que hay que conservar sí o sí: reservas por persona."""
    from apps.sheets.models import VideoMetadata
    detalle = {}
    for tipo in ('censo', 'registro'):
        detalle[tipo] = VideoMetadata.objects.filter(tipo=tipo).count()
    reservas = {}
    qs = (VideoMetadata.objects.filter(tipo='censo', estado_censo='Reservado')
          .values_list('reservado_por', flat=True))
    for nombre in qs:
        clave = nombre or '(sin dueño)'
        reservas[clave] = reservas.get(clave, 0) + 1
    return detalle, reservas


class Command(BaseCommand):
    help = 'Backup de datos para migrar de proyecto Supabase, con verificación'

    def add_arguments(self, parser):
        parser.add_argument('-o', '--output', default='backup_mystherai.json',
                            help='Fichero de salida del backup')
        parser.add_argument('--conteo', action='store_true',
                            help='Solo mostrar el inventario, sin escribir nada')
        parser.add_argument('--verificar', metavar='FICHERO',
                            help='Comparar un backup contra la BD actual')

    def handle(self, *args, **opts):
        # Qué BD estamos tocando: evita hacer el backup del proyecto equivocado.
        db = connection.settings_dict
        self.stdout.write(self.style.WARNING(
            f"BD actual: {db.get('NAME')} @ {db.get('HOST') or 'local'}:{db.get('PORT') or ''}"))
        self.stdout.write('')

        inventario = _inventario()
        detalle, reservas = _desglose_censo()

        self.stdout.write('INVENTARIO')
        for etiqueta, n in inventario:
            self.stdout.write(f'  {etiqueta:28s} {n}')
        self.stdout.write('')
        self.stdout.write(f"  censo: {detalle.get('censo')}   registro: {detalle.get('registro')}")
        self.stdout.write('  reservas por persona:')
        for nombre, n in sorted(reservas.items(), key=lambda x: -x[1]):
            self.stdout.write(f'     {n:5d}  {nombre}')
        self.stdout.write('')

        if opts['verificar']:
            return self._verificar(opts['verificar'], inventario)

        if opts['conteo']:
            self.stdout.write('(--conteo: no se ha escrito ningún fichero)')
            return

        destino = opts['output']
        self.stdout.write(f'Generando backup en {destino} ...')
        with open(destino, 'w', encoding='utf-8') as f:
            call_command(
                'dumpdata',
                *[f'-e{x}' for x in EXCLUIR],
                natural_foreign=True,
                natural_primary=True,
                indent=2,
                stdout=f,
            )

        import os
        tam = os.path.getsize(destino) / 1024
        self.stdout.write(self.style.SUCCESS(f'Backup escrito: {destino} ({tam:.0f} KB)'))
        self.stdout.write('')
        self.stdout.write('Siguiente paso, ya contra la BD NUEVA:')
        self.stdout.write('  export DATABASE_URL="<cadena del proyecto nuevo>"')
        self.stdout.write('  python manage.py migrate')
        self.stdout.write(f'  python manage.py loaddata {destino}')
        self.stdout.write(f'  python manage.py backup_datos --verificar {destino}')

    def _verificar(self, fichero, inventario):
        """Compara lo que hay en el backup con lo que hay en la BD actual."""
        import json
        from collections import Counter

        try:
            with open(fichero, encoding='utf-8') as f:
                objetos = json.load(f)
        except Exception as e:
            self.stderr.write(f'No se pudo leer {fichero}: {e}')
            return

        en_backup = Counter(o['model'] for o in objetos)
        actual = {etiqueta.lower(): n for etiqueta, n in inventario}

        self.stdout.write('VERIFICACIÓN  (backup  vs  BD actual)')
        ok = True
        for app_label, modelo in MODELOS_CLAVE:
            clave = f'{app_label}.{modelo}'.lower()
            n_backup = en_backup.get(clave, 0)
            n_actual = actual.get(clave, 0)
            igual = n_backup == n_actual
            ok = ok and igual
            marca = 'OK ' if igual else '!! '
            self.stdout.write(f'  {marca}{clave:28s} backup={n_backup:6d}  bd={n_actual:6d}')

        self.stdout.write('')
        if ok:
            self.stdout.write(self.style.SUCCESS(
                'Coinciden todos los recuentos: la migración está completa.'))
        else:
            self.stdout.write(self.style.ERROR(
                'HAY DIFERENCIAS. No apagues el proyecto viejo hasta resolverlas.'))
