"""
MYSTHERIAI STUDIO
Pipeline: 01 CARGAR → [02 EDITAR] → 03 IMAGEN → 04 V2V → GUARDAR
"""
import os, re, datetime, subprocess, base64, shutil, uuid, mimetypes
import requests as req
import cv2
import wavespeed
import gradio as gr
from dotenv import load_dotenv

load_dotenv()

DEFAULT_KEY = os.environ.get("WAVESPEED_API_KEY", "")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8080")
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
FFMPEG      = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"

# ── Almacenamiento permanente (Supabase Storage) ────────────────────────────
# Los resultados de Wavespeed (imagen/video estilizados) viven en un bucket
# de S3 DE WAVESPEED con una regla de ciclo de vida que los borra a los 7
# días (header `x-amz-expiration`, confirmado con una generación real el
# 2026-08-10). Antes de guardar en Registro, do_save() descarga ese
# resultado y lo vuelve a subir a Supabase Storage -- el mismo proyecto
# Supabase que ya usa la app como base de datos (ver DATABASE_URL) -- para
# que el enlace guardado en la base de datos no caduque.
#
# Se usa la API REST de Storage directamente con `requests` (no el SDK
# `supabase-py`) para no añadir una dependencia nueva: el proyecto ya usa
# `requests` en todo el pipeline y la API de Storage es un simple
# POST/PUT con dos cabeceras.
#
# Variables de entorno necesarias (ninguna tiene valor por defecto a
# propósito -- sin ellas, do_save() bloquea el guardado con un error claro
# en vez de guardar en silencio una URL que va a caducar):
#   SUPABASE_URL               ej. "https://pmexbywkqnpbtlqemzkw.supabase.co"
#       (mismo proyecto que DATABASE_URL: el ref va después de "postgres."
#       en el usuario de la cadena de conexión)
#   SUPABASE_SERVICE_ROLE_KEY  clave "service_role" (NO la "anon") del
#       proyecto -- Dashboard de Supabase → Settings → API → Project API keys.
#       Server-side only: nunca debe llegar al frontend.
#   SUPABASE_STORAGE_BUCKET    nombre del bucket (ej. "estilizados"). Si no
#       existe, se crea automáticamente como público en el primer guardado.
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET      = os.environ.get("SUPABASE_STORAGE_BUCKET", "estilizados")

_bucket_asegurado = False  # cache: solo intentamos crear el bucket una vez por proceso

def _supabase_configurado():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

def _asegurar_bucket_supabase():
    """Crea el bucket en Supabase Storage si todavía no existe (idempotente).
    Se ejecuta una sola vez por proceso -- si ya existe (caso normal tras la
    primera vez), Supabase responde 400 "already exists" y simplemente se
    ignora."""
    global _bucket_asegurado
    if _bucket_asegurado:
        return
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
    }
    try:
        r = req.post(
            f"{SUPABASE_URL}/storage/v1/bucket",
            headers=headers,
            json={"id": SUPABASE_BUCKET, "name": SUPABASE_BUCKET, "public": True},
            timeout=15,
        )
        if r.status_code not in (200, 201) and "already exists" not in r.text.lower():
            raise RuntimeError(f"No se pudo crear/verificar el bucket '{SUPABASE_BUCKET}': {r.status_code} {r.text[:200]}")
    except req.RequestException as e:
        raise RuntimeError(f"No se pudo contactar Supabase Storage para crear el bucket: {e}")
    _bucket_asegurado = True

def persistir_en_supabase(url_temporal, carpeta, video_id):
    """Descarga un resultado de Wavespeed (URL temporal, caduca a los 7 días)
    y lo sube a Supabase Storage, devolviendo la URL pública permanente.

    Lanza RuntimeError con un mensaje claro si Supabase Storage no está
    configurado o si la subida falla -- nunca devuelve la URL temporal como
    si fuera válida, porque eso es exactamente el bug que esto corrige."""
    if not url_temporal:
        return url_temporal
    if not _supabase_configurado():
        raise RuntimeError(
            "Almacenamiento permanente no configurado (faltan SUPABASE_URL / "
            "SUPABASE_SERVICE_ROLE_KEY en el entorno). No se puede guardar de forma "
            "segura: el resultado de Wavespeed caduca a los 7 días."
        )
    _asegurar_bucket_supabase()

    local_path = dl_temp(url_temporal)
    ext = os.path.splitext(local_path)[1] or ".bin"
    content_type = mimetypes.guess_type(local_path)[0] or "application/octet-stream"
    key = f"estilizados/{video_id or 'sin_id'}/{carpeta}_{uuid.uuid4().hex}{ext}"

    try:
        with open(local_path, "rb") as f:
            r = req.post(
                f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                data=f,
                timeout=120,
            )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Fallo al subir a Supabase Storage ({SUPABASE_BUCKET}/{key}): {r.status_code} {r.text[:300]}")
    except req.RequestException as e:
        raise RuntimeError(f"Fallo de conexión al subir a Supabase Storage ({SUPABASE_BUCKET}/{key}): {e}")
    finally:
        try: os.remove(local_path)
        except OSError: pass

    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{key}"

OUT_CAP = os.path.join(BASE_DIR, "outputs", "capturas")
OUT_VID = os.path.join(BASE_DIR, "outputs", "videos")
TEMP    = os.path.join(BASE_DIR, "outputs", "temp")
for d in [OUT_CAP, OUT_VID, TEMP]:
    os.makedirs(d, exist_ok=True)

# ── Logo ──────────────────────────────────────────────────────────────────────
_logo_b64 = ""
_logo_path = os.path.join(BASE_DIR, "logo.jpeg")
if os.path.exists(_logo_path):
    with open(_logo_path, "rb") as _f:
        _logo_b64 = base64.b64encode(_f.read()).decode()
LOGO_HTML = (
    f'<img src="data:image/jpeg;base64,{_logo_b64}" '
    'style="width:36px;height:36px;border-radius:8px;object-fit:cover;" />'
) if _logo_b64 else ""

# ── Catálogos ─────────────────────────────────────────────────────────────────
ESTILOS = {
    "Anime":     "anime style, cel-shaded illustration, vibrant colors, Studio Ghibli quality",
    "Cartoon":   "cartoon style, bold outlines, flat vivid colors, expressive exaggerated features",
    "Lego":      "LEGO brick construction style, plastic toy aesthetic, bright primary colors",
    "Ciberpunk": "cyberpunk aesthetic, neon lights in cyan and magenta, dark rainy atmosphere",
    "Realista":  "photorealistic, cinematic 4K quality, natural soft lighting, sharp fine detail",
    "Acuarela":  "watercolor painting style, soft blended wet edges, pastel tones, paper texture",
    "Óleo":      "oil painting on canvas, rich impasto texture, impressionist brushwork",
    "Pixel Art": "retro pixel art, 8-bit style, flat limited palette, crisp pixelated edges",
}

I2I_MODELS = {
    "Nano Banana Lite — Rápido":    "google/nano-banana-2-lite/edit",
    "Nano Banana 2   — Estándar":   "google/nano-banana-2/edit",
    "Hunyuan Image 3 — Premium":    "wavespeed-ai/hunyuan-image-3-instruct/edit",
}

V2V_MODELS = {
    "WAN 2.1 480p — Rápido (~1 min)":   "wavespeed-ai/wan-2.1/v2v-480p",
    # Kling Video O3 Pro retirado (2026-08-11): exige video de alto >=700px y los
    # del censo son más chicos, así que fallaba el 100% de las veces ("The video
    # height should not be less than 700px"). Re-añadir solo si se sube la
    # resolución de origen. Ver Issue #29.
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _drive_id(url):
    m = re.search(r'(?:file/d/|id=|/d/)([-\w]{25,})', str(url or ''))
    return m.group(1) if m else None

def _drive_dl(url):
    fid = _drive_id(url)
    return f"https://drive.google.com/uc?export=download&id={fid}" if fid else url

def dl_temp(url):
    if not str(url).startswith("http"):
        return str(url)
    real = _drive_dl(url)
    ext  = re.search(r'\.(\w+)$', real.split('?')[0])
    ext  = ext.group(1) if ext else 'mp4'
    tmp  = os.path.join(TEMP, f"dl_{datetime.datetime.now().strftime('%H%M%S_%f')}.{ext}")
    r    = req.get(real, stream=True, timeout=90); r.raise_for_status()
    with open(tmp, 'wb') as f:
        for chunk in r.iter_content(8192): f.write(chunk)
    return tmp

def ws_out(res):
    for attr in ("outputs", "output", "data"):
        val = res.get(attr) if hasattr(res, "get") else getattr(res, attr, None)
        if val is None: continue
        if isinstance(val, dict):
            val = val.get("outputs") or val.get("output") or val
        return val[0] if isinstance(val, list) and val else val
    return str(res) if res else None

def on_load(request: gr.Request):
    video_url = request.query_params.get("video_url", "")
    usuario   = request.query_params.get("usuario", "")
    video_id  = request.query_params.get("video_id", "")
    return DEFAULT_KEY, video_url, usuario, video_id

# ── Cola de reservados del miembro (interconexión web ↔ Gradio) ──────────────
def fetch_reservas(usuario):
    """Videos de censo que este miembro tiene reservados y aún no ha estilizado.
    Gradio corre en el mismo contenedor que Django, así que llama a localhost
    (servicio interno, sin sesión)."""
    if not usuario:
        return []
    try:
        r = req.get(f"{BACKEND_URL}/api/sheets/videos/",
                    params={"tipo": "censo", "estado_censo": "Reservado", "reservado_por": usuario},
                    timeout=8)
        return r.json() if r.status_code == 200 else []
    except Exception:
        return []

def _reserva_choices(usuario):
    """[(label, value)] para el Dropdown. value = 'pk\\tvideo_id\\tmapa\\tdrive_link'."""
    choices = []
    for v in fetch_reservas(usuario):
        vid  = str(v.get("video_id") or v.get("id") or "")
        mapa = str(v.get("mapa") or "")
        label = vid + (f"  ·  {mapa}" if mapa else "")
        value = f"{v.get('id')}\t{vid}\t{mapa}\t{v.get('drive_link') or ''}"
        choices.append((label, value))
    return choices

def _thumb_html(url, caption=""):
    fid = _drive_id(url)
    if fid:
        src = f"https://drive.google.com/thumbnail?id={fid}&sz=w640"
        return (f'<div style="text-align:center;padding:6px">'
                f'<img src="{src}" style="max-width:100%;max-height:300px;border-radius:10px;'
                f'border:1px solid #1c1c1c" onerror="this.style.display=\'none\'"/>'
                f'<div style="color:#666;font-size:12px;margin-top:8px;letter-spacing:1px">{caption}</div></div>')
    if url:
        return (f'<div style="text-align:center;color:#888;padding:40px;border:1px solid #1c1c1c;'
                f'border-radius:10px">Video seleccionado<div style="font-size:11px;color:#555;margin-top:6px">{caption}</div></div>')
    return ('<div style="text-align:center;color:#444;padding:60px 20px;border:1px dashed #2a2a2a;'
            'border-radius:10px;font-size:13px">Elige uno de tus videos reservados abajo  ↓</div>')

def cargar_reservas(usuario):
    """Rellena el dropdown con la cola del miembro. Se llama al entrar y al refrescar."""
    choices = _reserva_choices(usuario)
    if choices:
        info = f"**{len(choices)}** video(s) reservado(s) pendientes de estilizar."
    else:
        info = "No tienes videos reservados pendientes. Resérvalos desde el catálogo de la web."
    return gr.update(choices=choices, value=None), info

def seleccionar_reserva(value):
    """Al elegir del dropdown: muestra la miniatura y prepara el video para el pipeline.
    Devuelve: thumbnail HTML, s_vid, s_video_id, s_censo_pk."""
    if not value:
        return _thumb_html(""), "", "", ""
    pk, vid, mapa, link = (str(value).split("\t") + ["", "", "", ""])[:4]
    cap = (f"{vid}  ·  {mapa}" if mapa else vid).strip()
    return _thumb_html(link, cap), link, vid, pk

def log_error(miembro, paso, mensaje, modelo=""):
    """Fire-and-forget: log a Gradio pipeline error to the backend."""
    try:
        req.post(f"{BACKEND_URL}/api/sheets/gradio-errors/", json={
            "miembro": miembro or "Desconocido",
            "paso":    paso,
            "modelo":  modelo,
            "mensaje": str(mensaje)[:2000],
        }, timeout=4)
    except Exception:
        pass

# ── 01: CARGAR ────────────────────────────────────────────────────────────────
def do_analyze(src):
    try:
        src = str(src or "").strip()
        if not src: raise gr.Error("Selecciona un video reservado primero (paso 01).")
        path  = dl_temp(src)
        cap   = cv2.VideoCapture(path)
        fps   = cap.get(cv2.CAP_PROP_FPS) or 30
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        dur   = total / fps; cap.release()
        return (
            gr.update(maximum=max(0, total - 1), value=0),
            f"✓ {total} frames · {dur:.1f}s · {fps:.0f} fps",
            src,
        )
    except gr.Error: raise
    except Exception as e: raise gr.Error(f"Error al analizar: {e}")

def do_snap(vid_state, frame_idx):
    if not vid_state: raise gr.Error("Analiza el video primero.")
    try:
        path = dl_temp(vid_state)
        cap  = cv2.VideoCapture(path)
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_idx))
        ret, frame = cap.read(); cap.release()
        if not ret: raise gr.Error("No se pudo leer ese frame.")
        fname = f"frame_{datetime.datetime.now().strftime('%H%M%S')}.jpg"
        saved = os.path.join(OUT_CAP, fname)
        cv2.imwrite(saved, frame)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return rgb, saved
    except gr.Error: raise
    except Exception as e: raise gr.Error(f"Error al capturar: {e}")

# ── 02: EDITAR ────────────────────────────────────────────────────────────────
def do_cut(vid_state, start, end):
    if not vid_state: raise gr.Error("Carga y analiza el video en el paso 01 primero.")
    try:
        src = dl_temp(vid_state)
        out = os.path.join(OUT_VID, f"corte_{datetime.datetime.now().strftime('%H%M%S')}.mp4")
        subprocess.run(
            [FFMPEG, "-y", "-ss", str(start), "-to", str(end),
             "-i", src, "-c:v", "libx264", "-c:a", "aac", out],
            check=True, capture_output=True
        )
        return out, out
    except subprocess.CalledProcessError as e:
        raise gr.Error(f"ffmpeg: {e.stderr.decode()[-300:] if e.stderr else 'sin detalle'}")
    except gr.Error: raise
    except Exception as e: raise gr.Error(f"Error al cortar: {e}")

# ── 03: IMAGEN ────────────────────────────────────────────────────────────────
def do_stylize(frame_state, estilo, prompt_custom, model_label, key, miembro):
    if not key: raise gr.Error("Configura tu API Key.")
    if not frame_state: raise gr.Error("Captura un fotograma en el paso 01 primero.")
    prompt = prompt_custom.strip() or ESTILOS.get(estilo, "")
    if not prompt: raise gr.Error("Selecciona un estilo o escribe un prompt.")
    model  = I2I_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo I2I.")
    try:
        cl    = wavespeed.Client(api_key=key)
        img_u = cl.upload(str(frame_state))
        # Google Imagen models expect "images" (array); others expect "image" (string)
        if model.startswith("google/"):
            params = {"images": [img_u], "prompt": prompt}
        else:
            params = {"image": img_u, "prompt": prompt}
        res   = cl.run(model, params)
        url   = ws_out(res)
        if not url: raise gr.Error("El modelo no devolvió resultado.")
        return url, url, prompt
    except gr.Error: raise
    except Exception as e:
        log_error(miembro, "I2I", e, model)
        raise gr.Error(f"Error I2I ({model_label}): {e}")

# ── 04: V2V ───────────────────────────────────────────────────────────────────
def do_v2v(img_url_state, vid_state, model_label, prompt_vid, key, miembro):
    if not key: raise gr.Error("Configura tu API Key.")
    if not img_url_state: raise gr.Error("Genera la imagen estilizada en el paso 03 primero.")
    if not vid_state:     raise gr.Error("Carga el video en el paso 01 primero.")
    model = V2V_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo V2V.")
    try:
        cl = wavespeed.Client(api_key=key)

        if str(vid_state).startswith("http"):
            vid_input = _drive_dl(vid_state)
        else:
            vid_input = cl.upload(str(vid_state))

        params = {
            "video":           vid_input,
            "prompt":          prompt_vid or "",
            "negative_prompt": "",
        }

        res    = cl.run(model, params)
        result = ws_out(res)
        if not result: raise gr.Error("El modelo no devolvió resultado.")
        return result, result
    except gr.Error: raise
    except Exception as e:
        log_error(miembro, "V2V", e, model)
        raise gr.Error(f"Error V2V ({model_label}): {e}")

# ── 05: DATOS DEL CENSO (para la pantalla de revisión previa al guardado) ─────
CENSO_FIELDS = ["mapa", "especie", "genero", "etnia", "duracion", "camara", "plano", "interior", "accion"]

def do_fetch_censo(video_id):
    """Trae los metadatos del censo original para pre-rellenar la pantalla de
    revisión. video_id es el PK de VideoMetadata (lo manda React, ver
    VideoGalleryLayout.jsx / Profile.jsx), así que se puede pedir directo por
    /videos/<pk>/. Si falla (red, video_id vacío, etc.) se devuelven campos
    vacíos y el usuario los rellena a mano — nunca bloquea el flujo."""
    vacios = tuple("" for _ in CENSO_FIELDS)
    if not video_id:
        return vacios
    try:
        r = req.get(f"{BACKEND_URL}/api/sheets/videos/{video_id}/", timeout=8)
        if r.status_code != 200:
            return vacios
        d = r.json()
        return tuple(d.get(f) or "" for f in CENSO_FIELDS)
    except Exception:
        return vacios

# ── GUARDAR ───────────────────────────────────────────────────────────────────
def do_save(video_id, miembro, estilo, prompt_img, img_url, prompt_vid, vid_url, orig_url,
            mapa, especie, genero, etnia, duracion, camara, plano, interior, accion, censo_pk=""):
    if not video_id or not vid_url:
        return "⚠ Selecciona un video reservado y genera el video en el paso 04."
    # Mínimo exigido por el flujo de trabajo: sin mapa/especie el registro
    # queda incompleto y no sirve para las estadísticas del equipo.
    faltantes = [n for n, v in [("MAPA", mapa), ("ESPECIE", especie)] if not str(v or "").strip()]
    if faltantes:
        return f"⚠ Faltan campos obligatorios: {', '.join(faltantes)}. Complétalos arriba antes de guardar."

    # El resultado de Wavespeed caduca a los 7 días -- se re-aloja en
    # Supabase Storage ANTES de guardar en Registro, para que el enlace
    # persistido no muera. Se hace aquí (al guardar), no en do_stylize/do_v2v,
    # para no gastar almacenamiento en generaciones que el usuario acaba
    # descartando.
    try:
        img_url_permanente = persistir_en_supabase(img_url, "imagen", video_id)
        vid_url_permanente = persistir_en_supabase(vid_url, "video", video_id)
    except RuntimeError as e:
        return f"⚠ No se pudo guardar de forma permanente: {e}"

    try:
        r = req.post(f"{BACKEND_URL}/api/sheets/videos/", json={
            "video_id":            str(video_id).strip(),
            "tipo":                "registro",
            "usuario":             miembro,
            "estilizado":          estilo,
            "prompt_imagen":       prompt_img,
            "imagen_link":         img_url_permanente,
            "prompt_video":        prompt_vid,
            "drive_link":          vid_url_permanente,
            "video_original_link": orig_url,
            "estado_revision":     "Pendiente",
            "mapa":                mapa,
            "especie":             especie,
            "genero":              genero,
            "etnia":               etnia,
            "duracion":            duracion,
            "camara":              camara,
            "plano":               plano,
            "interior":            interior,
            "accion":              accion,
        }, timeout=15)
        if r.status_code == 201:
            # Sacar el video de la cola del miembro: marcar el censo como Estilizado.
            if censo_pk:
                try:
                    req.post(f"{BACKEND_URL}/api/sheets/videos/{censo_pk}/estilizado/", timeout=8)
                except Exception:
                    pass
            return "✓ GUARDADO — Pendiente de revisión. Video quitado de tu cola de reservados."
        return f"Error {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return f"Error de conexión: {e}"

# ── CSS ───────────────────────────────────────────────────────────────────────
CSS = """
footer { display:none !important; }
body, html { background:#0a0a0a !important; margin:0 !important; padding:0 !important; }
.gradio-container, .main {
    background:#0a0a0a !important; max-width:100% !important; width:100% !important;
    margin:0 !important; padding-left:40px !important; padding-right:40px !important;
    box-sizing:border-box !important;
}
.tab-nav { background:#0a0a0a !important; border-bottom:1px solid #1c1c1c !important; }
.tab-nav button {
    color:#3a3a3a !important; font-size:11px !important; letter-spacing:2px !important;
    text-transform:uppercase !important; padding:12px 20px !important;
    border-radius:0 !important; border-bottom:2px solid transparent !important;
    background:transparent !important; font-weight:600 !important;
}
.tab-nav button.selected { color:#ffffff !important; border-bottom:2px solid #ffffff !important; }
.tab-nav button:hover   { color:#888 !important; }
.block, .gr-group { background:#111 !important; border:1px solid #1c1c1c !important; border-radius:8px !important; }
label > span {
    color:#666 !important; font-size:11px !important; text-transform:uppercase !important;
    letter-spacing:1.5px !important; font-weight:600 !important;
}
input, textarea {
    background:#161616 !important; border:1px solid #222 !important;
    color:#d4d4d4 !important; border-radius:6px !important; font-size:14px !important;
}
input:focus, textarea:focus { border-color:#555 !important; }
input::placeholder, textarea::placeholder { color:#333 !important; }
select { background:#161616 !important; border:1px solid #222 !important; color:#d4d4d4 !important; }
button.primary {
    background:#ffffff !important; color:#000 !important; font-weight:700 !important;
    border:none !important; border-radius:6px !important; font-size:12px !important;
    letter-spacing:1.5px !important; text-transform:uppercase !important;
}
button.primary:hover { background:#d4d4d4 !important; }
button.secondary {
    background:#161616 !important; color:#555 !important; border:1px solid #222 !important;
    border-radius:6px !important; font-size:12px !important; letter-spacing:1px !important;
}
button.secondary:hover { border-color:#888 !important; color:#aaa !important; }
video, img { border-radius:8px !important; }
.pipe-label {
    font-size:10px; color:#333; letter-spacing:2px; text-transform:uppercase;
    text-align:center; padding:6px 0;
}
.step-divider { border:none; border-top:1px solid #1a1a1a; margin:16px 0; }
"""

# ── UI ────────────────────────────────────────────────────────────────────────
with gr.Blocks(title="MystherAI Studio") as demo:

    # Pipeline State
    api_key_st = gr.State(DEFAULT_KEY)
    s_vid      = gr.State("")   # source video (url or local path); updated on cut
    s_frame    = gr.State("")   # captured frame local path
    s_img_url  = gr.State("")   # styled image url (result of I2I)
    s_vid_out  = gr.State("")   # v2v result video url
    s_prompt_i = gr.State("")   # prompt used in I2I step
    s_miembro  = gr.State("")   # team member name (set in tab 01)
    s_video_id = gr.State("")   # video id from query param / reserva elegida
    s_estilo   = gr.State("")   # estilo selected in step 03
    s_censo_pk = gr.State("")   # pk del video de censo (para marcarlo Estilizado al guardar)

    demo.load(on_load, None, [api_key_st, s_vid, s_miembro, s_video_id])

    gr.HTML(f"""
    <div style="display:flex;align-items:center;gap:14px;padding:14px 0 12px;
                border-bottom:1px solid #1c1c1c;margin-bottom:4px;">
      {LOGO_HTML}
      <div>
        <div style="font-size:15px;font-weight:800;letter-spacing:2px;color:#fff;">
          MYSTHERIAI STUDIO
        </div>
        <div style="font-size:10px;color:#333;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">
          01 CARGAR · 02 EDITAR · 03 IMAGEN · 04 V2V · 05 GUARDAR
        </div>
      </div>
    </div>
    """)

    with gr.Tabs() as tabs:

        # ══════════════════════════════════════════════════════════════════════
        # 01  CARGAR
        # ══════════════════════════════════════════════════════════════════════
        with gr.Tab("01  CARGAR", id=0):
            gr.HTML('<div class="pipe-label">Elige uno de tus videos reservados y captura el fotograma inicial</div>')

            miembro_txt = gr.Textbox(label="Miembro del equipo", interactive=False, lines=1)

            # Miniatura del video seleccionado (arriba) + dropdown de reservados (abajo)
            thumb_html = gr.HTML(_thumb_html(""))
            with gr.Row():
                reservas_dd   = gr.Dropdown(label="🎬 Mis videos reservados (pendientes)", choices=[], value=None, interactive=True, scale=5)
                btn_refrescar = gr.Button("🔄 Actualizar", variant="secondary", scale=1)
            reservas_info = gr.Markdown("")

            btn_analyze = gr.Button("ANALIZAR VIDEO", variant="primary")
            vid_info    = gr.Textbox(label="Info", interactive=False, lines=1)
            frame_sl    = gr.Slider(0, 999, value=0, step=1, label="Fotograma")
            btn_snap    = gr.Button("CAPTURAR FOTOGRAMA", variant="primary")
            frame_prev  = gr.Image(label="Fotograma Capturado", height=260)

            gr.HTML('<hr class="step-divider">')
            with gr.Row():
                btn_to_editar = gr.Button("✂  EDITAR PRIMERO  →", variant="secondary", scale=1)
                btn_to_imagen = gr.Button("→  CONTINUAR A IMAGEN  (saltar edición)", variant="primary", scale=2)

            # Miembro + cola de reservados desde los query params (usuario)
            demo.load(lambda m: gr.update(value=m) if m else gr.update(), s_miembro, miembro_txt)
            demo.load(cargar_reservas, s_miembro, [reservas_dd, reservas_info])
            # Si se llegó con un video concreto (?video_url), mostrar su miniatura
            demo.load(lambda u: _thumb_html(u, "Video abierto desde la web") if u else _thumb_html(""), s_vid, thumb_html)

            # Elegir del dropdown: miniatura + preparar video/id/pk para el pipeline
            reservas_dd.change(seleccionar_reserva, reservas_dd, [thumb_html, s_vid, s_video_id, s_censo_pk])
            btn_refrescar.click(cargar_reservas, s_miembro, [reservas_dd, reservas_info])

            btn_analyze.click(
                do_analyze, s_vid, [frame_sl, vid_info, s_vid]
            )
            btn_snap.click(do_snap, [s_vid, frame_sl], [frame_prev, s_frame])

            btn_to_editar.click(lambda: gr.update(selected=1), None, tabs)
            # btn_to_imagen wired after tab 03 is defined (see bottom)

        # ══════════════════════════════════════════════════════════════════════
        # 02  EDITAR  (opcional)
        # ══════════════════════════════════════════════════════════════════════
        with gr.Tab("02  EDITAR  (opcional)", id=1):
            gr.HTML('<div class="pipe-label">Recorta el segmento que necesitas · opcional</div>')

            with gr.Row():
                cut_start = gr.Slider(0, 600, value=0,  step=0.5, label="Inicio (segundos)")
                cut_end   = gr.Slider(0, 600, value=10, step=0.5, label="Fin (segundos)")

            btn_cut  = gr.Button("RECORTAR", variant="primary")
            cut_prev = gr.Video(label="Segmento Recortado", height=240)

            gr.HTML('<hr class="step-divider">')
            btn_to_imagen2 = gr.Button("→  CONTINUAR A IMAGEN", variant="primary")

            btn_cut.click(do_cut, [s_vid, cut_start, cut_end], [cut_prev, s_vid])
            # btn_to_imagen2 wired after tab 03 is defined

        # ══════════════════════════════════════════════════════════════════════
        # 03  IMAGEN — I2I
        # ══════════════════════════════════════════════════════════════════════
        with gr.Tab("03  IMAGEN", id=2):
            gr.HTML('<div class="pipe-label">Estiliza el fotograma con un modelo de imagen</div>')

            frame_disp = gr.Image(label="Fotograma de Referencia (capturado en paso 01)", height=220, interactive=False)

            with gr.Row():
                estilo_dd = gr.Dropdown(list(ESTILOS.keys()), value="Anime", label="Estilo Visual", scale=1)
                i2i_model = gr.Dropdown(list(I2I_MODELS.keys()), value=list(I2I_MODELS.keys())[0], label="Modelo I2I", scale=1)

            prompt_i = gr.Textbox(label="Prompt de estilo", lines=2, value=ESTILOS["Anime"])

            btn_stylize  = gr.Button("GENERAR IMAGEN ESTILIZADA", variant="primary")
            img_out      = gr.Image(label="Imagen Estilizada", height=300)
            img_url_show = gr.Textbox(label="URL resultado (auto-cargado en V2V)", interactive=False, lines=2)

            gr.HTML('<hr class="step-divider">')
            btn_to_v2v = gr.Button("→  CONTINUAR A V2V", variant="primary")

            estilo_dd.change(lambda s: (ESTILOS.get(s, ""), s), estilo_dd, [prompt_i, s_estilo])

            btn_stylize.click(
                do_stylize,
                [s_frame, estilo_dd, prompt_i, i2i_model, api_key_st, s_miembro],
                [img_out, s_img_url, s_prompt_i],
            ).then(lambda u: u, s_img_url, img_url_show)

            # btn_to_v2v wired after tab 04 is defined

        # ══════════════════════════════════════════════════════════════════════
        # 04  V2V
        # ══════════════════════════════════════════════════════════════════════
        with gr.Tab("04  V2V", id=3):
            gr.HTML('<div class="pipe-label">Imagen estilizada + video de referencia → video estilizado</div>')

            with gr.Row():
                v2v_img_show = gr.Image(label="Imagen Estilizada (auto-cargada del paso 03)", height=200, interactive=False, scale=1)
                v2v_vid_show = gr.Textbox(label="Video de referencia (auto-cargado del paso 01/02)", interactive=False, lines=4, scale=1)

            v2v_model = gr.Dropdown(list(V2V_MODELS.keys()), value=list(V2V_MODELS.keys())[0], label="Modelo V2V")
            prompt_v  = gr.Textbox(
                label="Prompt de estilo (auto-cargado del paso 03 — editable)",
                lines=2,
                placeholder="Se rellena automáticamente al llegar desde el paso 03"
            )

            btn_v2v      = gr.Button("GENERAR VIDEO ESTILIZADO", variant="primary")
            vid_out      = gr.Video(label="Video Estilizado", height=340)
            vid_url_show = gr.Textbox(label="URL del resultado", interactive=False, lines=2)

            gr.HTML('<hr class="step-divider"><div class="pipe-label">Cuando estés conforme · revisa los datos antes de guardar</div>')

            btn_to_revisar = gr.Button("→  REVISAR Y GUARDAR", variant="primary")
            # btn_to_revisar wired after tab 05 is defined

            btn_v2v.click(
                do_v2v,
                [s_img_url, s_vid, v2v_model, prompt_v, api_key_st, s_miembro],
                [vid_out, s_vid_out],
            ).then(lambda u: u, s_vid_out, vid_url_show)

        # ══════════════════════════════════════════════════════════════════════
        # 05  REVISAR Y GUARDAR
        # ══════════════════════════════════════════════════════════════════════
        with gr.Tab("05  GUARDAR", id=4) as tab_revisar:
            gr.HTML('<div class="pipe-label">Completa los datos del vídeo · obligatorio antes de guardar</div>')

            with gr.Row():
                v_mapa     = gr.Textbox(label="Mapa *")
                v_especie  = gr.Textbox(label="Especie *")
            with gr.Row():
                v_genero   = gr.Textbox(label="Género")
                v_etnia    = gr.Textbox(label="Etnia")
            with gr.Row():
                v_duracion = gr.Textbox(label="Duración")
                v_camara   = gr.Textbox(label="Cámara")
            with gr.Row():
                v_plano    = gr.Textbox(label="Plano")
                v_interior = gr.Textbox(label="Interior")
            v_accion = gr.Textbox(label="Acción")

            gr.HTML('<hr class="step-divider">')
            gr.HTML('<div class="pipe-label">Resumen del vídeo generado</div>')
            resumen_out = gr.Textbox(label="Enlaces / prompts que se guardarán", interactive=False, lines=4)

            btn_save = gr.Button("✓  GUARDAR Y FINALIZAR", variant="primary")
            save_st  = gr.Textbox(label="Estado", interactive=False, lines=1)

            btn_save.click(
                do_save,
                [s_video_id, s_miembro, s_estilo,
                 s_prompt_i, s_img_url, prompt_v, s_vid_out, s_vid,
                 v_mapa, v_especie, v_genero, v_etnia, v_duracion, v_camara, v_plano, v_interior, v_accion,
                 s_censo_pk],
                save_st,
            ).then(cargar_reservas, s_miembro, [reservas_dd, reservas_info])



    def _go_imagen(frame):
        img = gr.update(value=frame) if frame else gr.update()
        return gr.update(selected=2), img

    def _go_v2v(img_url, vid, prompt_i):
        img = gr.update(value=img_url) if img_url else gr.update()
        txt = gr.update(value=str(vid)) if vid else gr.update()
        pmt = gr.update(value=prompt_i) if prompt_i else gr.update()
        return gr.update(selected=3), img, txt, pmt

    btn_to_imagen.click(_go_imagen, s_frame, [tabs, frame_disp])
    btn_to_imagen2.click(_go_imagen, s_frame, [tabs, frame_disp])
    btn_to_v2v.click(_go_v2v, [s_img_url, s_vid, s_prompt_i], [tabs, v2v_img_show, v2v_vid_show, prompt_v])

    def _go_revisar(video_id, miembro, estilo, prompt_i, img_url, prompt_vid, vid_out, vid_orig):
        censo = do_fetch_censo(video_id)
        resumen = (
            f"Miembro: {miembro}\nEstilo: {estilo}\n"
            f"Imagen: {img_url}\nVideo original: {vid_orig}\nVideo estilizado: {vid_out}"
        )
        return (gr.update(selected=4), *censo, resumen)

    btn_to_revisar.click(
        _go_revisar,
        [s_video_id, s_miembro, s_estilo, s_prompt_i, s_img_url, prompt_v, s_vid_out, s_vid],
        [tabs, v_mapa, v_especie, v_genero, v_etnia, v_duracion, v_camara, v_plano, v_interior, v_accion, resumen_out],
    )

    # Also refresh frame_disp whenever a new frame is snapped (user may stay on tab 01)
    btn_snap.click(
        lambda f: gr.update(value=f) if f else gr.update(),
        s_frame, frame_disp,
    )



if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        allowed_paths=[BASE_DIR],
        css=CSS,
        theme=gr.themes.Base(),
    )
