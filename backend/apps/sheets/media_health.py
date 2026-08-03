"""
Health check de los enlaces de video e imagen.

Motivo: cuando un enlace muere, la web no dice nada. El iframe se queda en negro
y la tarjeta en blanco, así que el equipo cree que "faltan videos" cuando en
realidad el dato está en la BD y lo que falla es el enlace. Esto lo hace visible.

Tres modos de fallo reales detectados en producción:

  1. CloudFront de WaveSpeed (d1q70pf5..., d2h7xmz5...) -> 403. Son URLs
     temporales de la API de estilizado; caducan y el registro queda huérfano.
  2. Google Drive sin permiso público -> devuelve 200 pero con content-type
     text/html (la página de "solicitar acceso"). Un simple check de status
     lo daría por bueno: hay que mirar el content-type.
  3. Timeouts, que antes se tragaban en silencio.
"""
import concurrent.futures
import re

import requests

# Umbral propio: por encima de esto damos el enlace por caído aunque el servidor
# acabe respondiendo. Un enlace que tarda 10s no sirve para trabajar.
TIMEOUT_SEGUNDOS = 8
MAX_HILOS = 12

# Estados posibles de un enlace
OK            = 'ok'
SIN_ENLACE    = 'sin_enlace'
CADUCADO      = 'caducado'        # 403 — típico de CloudFront/WaveSpeed
NO_ENCONTRADO = 'no_encontrado'   # 404 / 410
SIN_PERMISO   = 'sin_permiso'     # Drive devuelve HTML en vez del medio
ERROR_SERVIDOR = 'error_servidor'  # 5xx
TIMEOUT       = 'timeout'
ERROR_RED     = 'error_red'

ESTADOS_ROTOS = {CADUCADO, NO_ENCONTRADO, SIN_PERMISO, ERROR_SERVIDOR, TIMEOUT, ERROR_RED}

ETIQUETAS = {
    OK:             'Correcto',
    SIN_ENLACE:     'Sin enlace guardado',
    CADUCADO:       'Caducado (403) — URL temporal de WaveSpeed',
    NO_ENCONTRADO:  'No encontrado (404) — el archivo ya no existe',
    SIN_PERMISO:    'Sin permiso público en Drive',
    ERROR_SERVIDOR: 'Error del servidor que aloja el archivo',
    TIMEOUT:        f'Timeout (>{TIMEOUT_SEGUNDOS}s)',
    ERROR_RED:      'No se pudo conectar',
}

_DRIVE_ID = re.compile(r'(?:file/d/|id=|/folders/|open\?id=|/d/)([a-zA-Z0-9_-]{19,})')


def _url_a_comprobar(url):
    """Para Drive comprobamos la miniatura: es ligera y distingue de verdad
    un archivo accesible (devuelve image/*) de uno privado (devuelve HTML)."""
    m = _DRIVE_ID.search(url)
    if m:
        return f'https://drive.google.com/thumbnail?id={m.group(1)}&sz=w200', True
    return url, False


def comprobar_url(url):
    """Devuelve (estado, detalle) para un enlace."""
    url = (url or '').strip()
    if not url:
        return SIN_ENLACE, ''

    destino, es_drive = _url_a_comprobar(url)

    try:
        r = requests.get(destino, timeout=TIMEOUT_SEGUNDOS, stream=True,
                         allow_redirects=True)
    except requests.exceptions.Timeout:
        return TIMEOUT, f'sin respuesta en {TIMEOUT_SEGUNDOS}s'
    except requests.exceptions.RequestException as e:
        return ERROR_RED, type(e).__name__
    finally:
        try:
            r.close()
        except Exception:
            pass

    code = r.status_code
    ctype = (r.headers.get('content-type') or '').split(';')[0].strip().lower()

    if code == 403:
        return CADUCADO, f'HTTP 403 ({ctype or "sin tipo"})'
    if code in (404, 410):
        return NO_ENCONTRADO, f'HTTP {code}'
    if code >= 500:
        return ERROR_SERVIDOR, f'HTTP {code}'
    if code >= 400:
        return NO_ENCONTRADO, f'HTTP {code}'

    # 2xx. Para Drive, HTML significa que nos ha servido la página de permisos.
    if es_drive and ctype.startswith('text/html'):
        return SIN_PERMISO, 'Drive devolvió HTML en vez del archivo'

    return OK, f'HTTP {code} {ctype}'


def comprobar_lote(items):
    """items: [(clave, url)] -> {clave: (estado, detalle)} en paralelo."""
    resultados = {}
    if not items:
        return resultados
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_HILOS) as pool:
        futuros = {pool.submit(comprobar_url, url): clave for clave, url in items}
        for fut in concurrent.futures.as_completed(futuros):
            clave = futuros[fut]
            try:
                resultados[clave] = fut.result()
            except Exception as e:
                resultados[clave] = (ERROR_RED, type(e).__name__)
    return resultados
