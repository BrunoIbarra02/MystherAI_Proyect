"""
MYSTHERIAI STUDIO
Pipeline: 01 CARGAR → [02 EDITAR] → 03 IMAGEN → 04 V2V → GUARDAR
"""
import os, re, datetime, subprocess, base64, shutil
import requests as req
import cv2
import wavespeed
import gradio as gr
from dotenv import load_dotenv

load_dotenv()

DEFAULT_KEY = os.environ.get("WAVESPEED_API_KEY", "")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
FFMPEG      = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"

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
    "Z-Image Nano  — Rápido":       "wavespeed-ai/z-image/nano",
    "Z-Image Pro   — Alta calidad": "wavespeed-ai/z-image/pro",
    "Hunyuan Image 3 — Hunyuan":    "tencent/hunyuan-image-3",
}

V2V_MODELS = {
    "Kling V2.6 Std — Motion Transfer": "kwaivgi/kling-v2.6-std/motion-control",
    "Kling V2.6 Pro — Alta Fidelidad":  "kwaivgi/kling-v2.6-pro/motion-control",
    "WAN 2.7 — Estilo Total":           "alibaba/wan-2.7/video-edit",
}

MIEMBROS = ["Katty", "Fabio", "Wilson", "Olenka", "Rodrigo", "Bruno"]

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
    return DEFAULT_KEY, video_url

# ── 01: CARGAR ────────────────────────────────────────────────────────────────
def do_analyze(local, url):
    try:
        src = str(local) if local and os.path.exists(str(local)) else url.strip()
        if not src: raise gr.Error("Sube un video o pega una URL.")
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
def do_stylize(frame_state, estilo, prompt_custom, model_label, key):
    if not key: raise gr.Error("Configura tu API Key.")
    if not frame_state: raise gr.Error("Captura un fotograma en el paso 01 primero.")
    prompt = prompt_custom.strip() or ESTILOS.get(estilo, "")
    if not prompt: raise gr.Error("Selecciona un estilo o escribe un prompt.")
    model  = I2I_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo I2I.")
    try:
        cl    = wavespeed.Client(api_key=key)
        img_u = cl.upload(str(frame_state))
        res   = cl.run(model, {"image": img_u, "prompt": prompt})
        url   = ws_out(res)
        if not url: raise gr.Error("El modelo no devolvió resultado.")
        return url, url, prompt
    except gr.Error: raise
    except Exception as e: raise gr.Error(f"Error I2I ({model_label}): {e}")

# ── 04: V2V ───────────────────────────────────────────────────────────────────
def do_v2v(img_url_state, vid_state, model_label, prompt_vid, key):
    if not key: raise gr.Error("Configura tu API Key.")
    if not img_url_state: raise gr.Error("Genera la imagen estilizada en el paso 03 primero.")
    if not vid_state:     raise gr.Error("Carga el video en el paso 01 primero.")
    model = V2V_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo V2V.")
    try:
        cl        = wavespeed.Client(api_key=key)
        vid_local = dl_temp(vid_state)
        vid_up    = cl.upload(vid_local)

        if "kling" in model:
            params = {
                "image":                img_url_state,
                "video":                vid_up,
                "prompt":               prompt_vid or "",
                "character_orientation": "0",
                "keep_original_sound":  True,
            }
        else:
            params = {
                "video":                   vid_up,
                "prompt":                  prompt_vid or "",
                "negative_prompt":         "",
                "resolution":              "720p",
                "duration":                0,
                "audio_setting":           "auto",
                "enable_prompt_expansion": False,
                "seed":                    -1,
            }

        res    = cl.run(model, params)
        result = ws_out(res)
        if not result: raise gr.Error("El modelo no devolvió resultado.")
        return result, result
    except gr.Error: raise
    except Exception as e: raise gr.Error(f"Error V2V ({model_label}): {e}")

# ── GUARDAR ───────────────────────────────────────────────────────────────────
def do_save(video_id, miembro, estilo, prompt_img, img_url, prompt_vid, vid_url, orig_url):
    if not video_id or not vid_url:
        return "⚠ Completa el ID de video y genera el video en el paso 04."
    try:
        r = req.post(f"{BACKEND_URL}/api/sheets/videos/", json={
            "video_id":            str(video_id).strip(),
            "tipo":                "registro",
            "usuario":             miembro,
            "estilizado":          estilo,
            "prompt_imagen":       prompt_img,
            "imagen_link":         img_url,
            "prompt_video":        prompt_vid,
            "drive_link":          vid_url,
            "video_original_link": orig_url,
            "estado_revision":     "Pendiente",
        }, timeout=15)
        if r.status_code == 201:
            return "✓ GUARDADO EN REGISTRO — Pendiente de revisión"
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
with gr.Blocks(title="MystherAI Studio", css=CSS, theme=gr.themes.Base()) as demo:

    # Pipeline State
    api_key_st = gr.State(DEFAULT_KEY)
    s_vid      = gr.State("")   # source video (url or local path); updated on cut
    s_frame    = gr.State("")   # captured frame local path
    s_img_url  = gr.State("")   # styled image url (result of I2I)
    s_vid_out  = gr.State("")   # v2v result video url
    s_prompt_i = gr.State("")   # prompt used in I2I step

    demo.load(on_load, None, [api_key_st, s_vid])

    gr.HTML(f"""
    <div style="display:flex;align-items:center;gap:14px;padding:14px 0 12px;
                border-bottom:1px solid #1c1c1c;margin-bottom:4px;">
      {LOGO_HTML}
      <div>
        <div style="font-size:15px;font-weight:800;letter-spacing:2px;color:#fff;">
          MYSTHERIAI STUDIO
        </div>
        <div style="font-size:10px;color:#333;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">
          01 CARGAR · 02 EDITAR · 03 IMAGEN · 04 V2V
        </div>
      </div>
    </div>
    """)

    with gr.Tabs() as tabs:

        # ══════════════════════════════════════════════════════════════════════
        # 01  CARGAR
        # ══════════════════════════════════════════════════════════════════════
        with gr.Tab("01  CARGAR", id=0):
            gr.HTML('<div class="pipe-label">Carga el video y captura el fotograma inicial</div>')

            with gr.Row():
                local_vid = gr.Video(label="Subir Video", sources=["upload"], scale=2, height=240)
                url_vid   = gr.Textbox(
                    label="URL del Video (Google Drive / HTTP)", scale=2, lines=2,
                    placeholder="https://drive.google.com/..."
                )

            btn_analyze = gr.Button("ANALIZAR VIDEO", variant="primary")
            vid_info    = gr.Textbox(label="Info", interactive=False, lines=1)
            frame_sl    = gr.Slider(0, 999, value=0, step=1, label="Fotograma")
            btn_snap    = gr.Button("CAPTURAR FOTOGRAMA", variant="primary")
            frame_prev  = gr.Image(label="Fotograma Capturado", height=260)

            gr.HTML('<hr class="step-divider">')
            with gr.Row():
                btn_to_editar = gr.Button("✂  EDITAR PRIMERO  →", variant="secondary", scale=1)
                btn_to_imagen = gr.Button("→  CONTINUAR A IMAGEN  (saltar edición)", variant="primary", scale=2)

            # Pre-fill URL from query param
            demo.load(lambda u: gr.update(value=u) if u else gr.update(), s_vid, url_vid)

            btn_analyze.click(
                do_analyze, [local_vid, url_vid], [frame_sl, vid_info, s_vid]
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

            estilo_dd.change(lambda s: ESTILOS.get(s, ""), estilo_dd, prompt_i)

            btn_stylize.click(
                do_stylize,
                [s_frame, estilo_dd, prompt_i, i2i_model, api_key_st],
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
                label="Prompt de movimiento (opcional Kling · obligatorio WAN 2.7)",
                lines=2,
                placeholder="Ej: smooth natural motion, realistic movement"
            )

            btn_v2v      = gr.Button("GENERAR VIDEO ESTILIZADO", variant="primary")
            vid_out      = gr.Video(label="Video Estilizado", height=340)
            vid_url_show = gr.Textbox(label="URL del resultado", interactive=False, lines=2)

            gr.HTML('<hr class="step-divider"><div class="pipe-label">Cuando estés conforme · guarda en el registro</div>')

            with gr.Group():
                gr.HTML('<div style="font-size:10px;color:#444;letter-spacing:2px;text-transform:uppercase;padding:8px 0 4px;">GUARDAR EN REGISTRO</div>')
                with gr.Row():
                    save_vid_id  = gr.Textbox(label="ID Video Original", scale=2)
                    save_miembro = gr.Dropdown(MIEMBROS, value=MIEMBROS[0], label="Miembro", scale=1)
                    save_estilo  = gr.Dropdown(list(ESTILOS.keys()), label="Estilo", scale=1)
                btn_save = gr.Button("✓  GUARDAR Y FINALIZAR", variant="primary")
                save_st  = gr.Textbox(label="Estado", interactive=False, lines=1)

            btn_v2v.click(
                do_v2v,
                [s_img_url, s_vid, v2v_model, prompt_v, api_key_st],
                [vid_out, s_vid_out],
            ).then(lambda u: u, s_vid_out, vid_url_show)

            btn_save.click(
                do_save,
                [save_vid_id, save_miembro, save_estilo,
                 s_prompt_i, s_img_url, prompt_v, s_vid_out, s_vid],
                save_st,
            )

    # ── Cross-tab navigation wiring (must be after all tabs are defined) ──────

    def _go_imagen(frame):
        img = gr.update(value=frame) if frame else gr.update()
        return gr.update(selected=2), img

    def _go_v2v(img_url, vid):
        img = gr.update(value=img_url) if img_url else gr.update()
        txt = gr.update(value=str(vid)) if vid else gr.update()
        return gr.update(selected=3), img, txt

    btn_to_imagen.click(_go_imagen, s_frame, [tabs, frame_disp])
    btn_to_imagen2.click(_go_imagen, s_frame, [tabs, frame_disp])
    btn_to_v2v.click(_go_v2v, [s_img_url, s_vid], [tabs, v2v_img_show, v2v_vid_show])

    # Also refresh frame_disp whenever a new frame is snapped (user may stay on tab 01)
    btn_snap.click(
        lambda f: gr.update(value=f) if f else gr.update(),
        s_frame, frame_disp,
    )



if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, allowed_paths=[BASE_DIR])
