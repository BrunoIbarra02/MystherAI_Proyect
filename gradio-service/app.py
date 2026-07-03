
# ════════════════════════════════════════════════════════════════════════════
# MYSTHERIAI STUDIO — AI Video Production Console
# Models: WAN 2.7 · LTX 2-19B · Seedance 2.0 · Kling V2.6
# ════════════════════════════════════════════════════════════════════════════
import os, re, datetime, subprocess, base64, shutil
import requests as req
import cv2
import wavespeed
import gradio as gr
from dotenv import load_dotenv

load_dotenv()

# Logo — encode once at startup
_LOGO_B64  = ""
_logo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo.jpeg")
if os.path.exists(_logo_path):
    with open(_logo_path, "rb") as _f:
        _LOGO_B64 = base64.b64encode(_f.read()).decode()
_LOGO_IMG = (
    f'<img src="data:image/jpeg;base64,{_LOGO_B64}" '
    'style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;" />'
) if _LOGO_B64 else ''

DEFAULT_KEY = os.environ.get("WAVESPEED_API_KEY", "")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
FFMPEG      = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"

OUTPUTS = {k: os.path.join(BASE_DIR, "outputs", v) for k, v in {
    "cap":   "01_CAPTURAS",
    "est":   "02_ESTILIZADOS",
    "vid":   "03_VIDEOS_FINALES",
    "trans": "04_TRANSFORMACIONES",
}.items()}
TEMP_DIR = os.path.join(BASE_DIR, "outputs", "temp_local_bridge")
for _d in [*OUTPUTS.values(), TEMP_DIR]:
    os.makedirs(_d, exist_ok=True)

# ── Catálogos ─────────────────────────────────────────────────────────────────
ESTILOS = {
    "Anime":      "anime style, cel-shaded illustration, vibrant colors, Studio Ghibli quality, detailed backgrounds",
    "Cartoon":    "cartoon style, bold outlines, flat vivid colors, expressive exaggerated character features",
    "Lego":       "LEGO brick construction style, plastic toy aesthetic, bright primary colors, blocky geometry",
    "Ciberpunk":  "cyberpunk aesthetic, neon lights in cyan and magenta, dark rainy atmosphere, holographic displays",
    "Realista":   "photorealistic, cinematic 4K quality, natural soft lighting, sharp fine detail, professional grade",
    "Acuarela":   "watercolor painting style, soft blended wet edges, pastel tones, artistic paper texture",
    "Óleo":       "oil painting on canvas, rich impasto texture, impressionist brushwork, deep saturated colors",
    "Pixel Art":  "retro pixel art, 8-bit style, flat limited palette, crisp pixelated edges",
}

V2V_MODELS = {
    "WAN 2.7 Video Edit — Edición guiada por prompt · 720p/1080p":        "alibaba/wan-2.7/video-edit",
    "LTX 2-19B Control — Pose/Depth/Canny + Audio · hasta 20s":           "wavespeed-ai/ltx-2-19b/control",
    "Seedance 2.0 Edit — Edición cinematográfica · 4K + Audio generativo": "bytedance/seedance-2.0/video-edit",
}

KLING_MODELS = {
    "Kling V2.6 Std — Motion Transfer":  "kwaivgi/kling-v2.6-std/motion-control",
    "Kling V2.6 Pro — Alta Fidelidad":   "kwaivgi/kling-v2.6-pro/motion-control",
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def _drive_id(url):
    if not url: return None
    m = re.search(r'(?:file/d/|id=|/d/)([-\w]{25,})', str(url))
    return m.group(1) if m else None

def _drive_dl(url):
    fid = _drive_id(url)
    return f"https://drive.google.com/uc?export=download&id={fid}" if fid else url

def drive_embed(url, h=280):
    fid = _drive_id(url)
    if not fid: return ""
    return (
        f'<div style="border-radius:8px;overflow:hidden;border:1px solid #222;background:#000;">'
        f'<iframe src="https://drive.google.com/file/d/{fid}/preview" '
        f'width="100%" height="{h}px" frameborder="0" allow="autoplay;fullscreen" '
        f'style="display:block;"></iframe></div>'
    )

def dl_temp(src, ext="mp4"):
    if not str(src).startswith("http"): return src
    url = _drive_dl(src)
    m = re.search(r'\.(\w+)$', url.split('?')[0])
    if m: ext = m.group(1)
    tmp = os.path.join(TEMP_DIR, f"dl_{datetime.datetime.now().strftime('%H%M%S_%f')}.{ext}")
    r = req.get(url, stream=True, timeout=90); r.raise_for_status()
    with open(tmp, 'wb') as f:
        for chunk in r.iter_content(8192): f.write(chunk)
    return tmp

def get_src(local, url):
    if local and os.path.exists(str(local)): return str(local)
    if url and url.strip(): return url.strip()
    raise gr.Error("Sube un archivo o pega una URL primero.")

def ws_up(cl, src):
    if str(src).startswith("http"): return _drive_dl(src)
    return cl.upload(src)

def _ws_out(res):
    """Parse WaveSpeed response — handles both dict and object SDK formats."""
    for attr in ("outputs", "output", "data"):
        val = res.get(attr) if hasattr(res, "get") else getattr(res, attr, None)
        if val is None:
            continue
        if isinstance(val, dict):
            val = val.get("outputs") or val.get("output") or val
        return val[0] if isinstance(val, list) and val else val
    # Fallback: if res itself is a string or list
    if isinstance(res, list) and res:
        return res[0]
    return str(res) if res else None

# ── Funciones principales ─────────────────────────────────────────────────────
def on_load(request: gr.Request):
    return request.query_params.get("api_key", DEFAULT_KEY)

def do_analyze(local, url):
    try:
        src  = get_src(local, url)
        path = dl_temp(src)
        cap  = cv2.VideoCapture(path)
        fps   = cap.get(cv2.CAP_PROP_FPS) or 30
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        dur   = total / fps
        cap.release()
        return gr.update(maximum=max(0, total - 1), value=0), f"{total} frames · {dur:.1f}s · {fps:.0f} fps"
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error al analizar: {e}")

def do_snap(local, url, frame_idx, save_file, name):
    try:
        src  = get_src(local, url)
        path = dl_temp(src)
        cap  = cv2.VideoCapture(path)
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_idx))
        ret, frame = cap.read(); cap.release()
        if not ret: raise gr.Error("No se pudo leer ese frame.")
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        if not save_file: return rgb, ""
        fname = f"{name or 'frame'}_{datetime.datetime.now().strftime('%H%M%S')}.jpg"
        out   = os.path.join(OUTPUTS["cap"], fname)
        cv2.imwrite(out, frame)
        return rgb, out
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error al capturar: {e}")

def fill_style_prompt(estilo): return ESTILOS.get(estilo, "")

def do_stylize(img, style, prompt, imagination, key):
    if not key: raise gr.Error("API Key no configurada. Abre Gradio desde el botón con tu API Key activa.")
    try:
        cl  = wavespeed.Client(api_key=key)
        txt = prompt or ESTILOS.get(style, "")
        if not txt: raise gr.Error("Selecciona un estilo o escribe un prompt.")
        g  = 1.5 + (imagination / 10.0) * 10.5
        fs = 0.20 + (imagination / 10.0) * 0.60
        if img and not str(img).startswith("http"):
            img_url = cl.upload(img)
        else:
            img_url = _drive_dl(str(img or ""))
        res = cl.run(
            "wavespeed-ai/z-image/turbo",
            {"image": img_url, "prompt": txt, "strength": fs, "guidance_scale": g},
        )
        url = _ws_out(res)
        if not url: raise gr.Error("WaveSpeed no devolvió ningún resultado. Verifica modelo y parámetros.")
        return url, url
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error WaveSpeed I2I: {e}")

def do_v2v(local, url, model_label, prompt, neg, strength, guidance, steps,
           resolution, duration, ltx_mode, ltx_audio, key):
    if not key: raise gr.Error("API Key no configurada.")
    model = V2V_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo V2V válido.")
    try:
        cl  = wavespeed.Client(api_key=key)
        src = get_src(local, url)
        vid = _drive_dl(src) if str(src).startswith("http") else cl.upload(src)
        params = {"video": vid, "prompt": prompt or ""}

        if model == "alibaba/wan-2.7/video-edit":
            params.update({
                "negative_prompt":         neg or "",
                "resolution":              resolution if resolution in ("720p","1080p") else "720p",
                "duration":                int(duration) if int(duration) > 0 else 0,
                "audio_setting":           "auto",
                "enable_prompt_expansion": False,
                "seed": -1,
            })
        elif model == "wavespeed-ai/ltx-2-19b/control":
            params.update({
                "mode":       ltx_mode,
                "audio_mode": ltx_audio,
                "resolution": resolution if resolution in ("480p","720p","1080p") else "720p",
                "seed": -1,
            })
        elif model == "bytedance/seedance-2.0/video-edit":
            params.update({
                "resolution":        resolution,
                "duration":          int(duration) if int(duration) > 0 else 5,
                "generate_audio":    True,
                "enable_web_search": False,
            })

        res    = cl.run(model, params)
        result = _ws_out(res)
        if not result: raise gr.Error("WaveSpeed no devolvió resultado. Revisa prompt y modelo.")
        return result, result
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error WaveSpeed V2V: {e}")

def do_motion(img, vid_url, model_label, prompt, orientation, keep_audio, key):
    if not key: raise gr.Error("API Key no configurada.")
    model = KLING_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo Kling válido.")
    try:
        cl = wavespeed.Client(api_key=key)
        if img and not str(img).startswith("http"):
            img_url = cl.upload(img)
        else:
            img_url = str(img or "")
        real   = dl_temp(vid_url) if vid_url and vid_url.startswith("http") else vid_url
        vid_up = cl.upload(real)
        res    = cl.run(model, {
            "image": img_url, "video": vid_up,
            "prompt": prompt or "",
            "character_orientation": orientation,
            "keep_original_sound":   keep_audio,
        })
        result = _ws_out(res)
        if not result: raise gr.Error("Kling no devolvió resultado.")
        return result, result
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error WaveSpeed I2V: {e}")

def do_cut(local, url, start, end, name):
    try:
        src  = get_src(local, url)
        path = dl_temp(src)
        out  = os.path.join(OUTPUTS["vid"], f"{name or 'corte'}_{datetime.datetime.now().strftime('%H%M%S')}.mp4")
        subprocess.run(
            [FFMPEG, "-y", "-ss", str(start), "-to", str(end), "-i", path,
             "-c:v", "libx264", "-c:a", "aac", out],
            check=True, capture_output=True, text=True,
        )
        return out
    except subprocess.CalledProcessError as e:
        raise gr.Error(f"ffmpeg error: {e.stderr[-400:] if e.stderr else 'sin detalle'}")
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error al cortar: {e}")

def do_split(local, url, n_parts, prefixes):
    try:
        src  = get_src(local, url)
        path = dl_temp(src)
        cap  = cv2.VideoCapture(path)
        fps  = cap.get(cv2.CAP_PROP_FPS) or 30
        dur  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) / fps; cap.release()
        n    = int(n_parts); seg = dur / n
        prefs = [p.strip() for p in prefixes.split(",")] if prefixes else []
        paths = []
        for i in range(n):
            nm  = prefs[i] if i < len(prefs) else f"parte_{i+1}"
            out = os.path.join(OUTPUTS["vid"], f"{nm}_{datetime.datetime.now().strftime('%H%M%S_%f')}.mp4")
            subprocess.run(
                [FFMPEG, "-y", "-ss", str(i*seg), "-to", str((i+1)*seg),
                 "-i", path, "-c:v", "libx264", "-c:a", "aac", out],
                check=True, capture_output=True, text=True,
            )
            paths.append(out)
        return "\n".join(paths)
    except subprocess.CalledProcessError as e:
        raise gr.Error(f"ffmpeg error: {e.stderr[-400:] if e.stderr else 'sin detalle'}")
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error al partir: {e}")

def do_merge(files, name):
    try:
        tmp = os.path.join(TEMP_DIR, "concat.txt")
        with open(tmp, "w") as f:
            for fi in (files or []):
                p = fi.name if hasattr(fi, "name") else str(fi)
                f.write(f"file '{p}'\n")
        out = os.path.join(OUTPUTS["vid"], f"{name or 'merged'}_{datetime.datetime.now().strftime('%H%M%S')}.mp4")
        subprocess.run(
            [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", tmp, "-c", "copy", out],
            check=True, capture_output=True, text=True,
        )
        return out
    except subprocess.CalledProcessError as e:
        raise gr.Error(f"ffmpeg error: {e.stderr[-400:] if e.stderr else 'sin detalle'}")
    except gr.Error:
        raise
    except Exception as e:
        raise gr.Error(f"Error al unir: {e}")

def send_registro(v_id, usuario, mm, estilo, p_img, l_img, p_vid, l_vid, l_orig):
    if not v_id or not l_vid:
        return "⚠  ID y URL del video generado son obligatorios."
    try:
        r = req.post(f"{BACKEND_URL}/api/sheets/videos/", json={
            "video_id": str(v_id), "usuario": usuario, "mateo_miguel": mm,
            "estilizado": estilo, "prompt_imagen": p_img, "imagen_link": l_img,
            "prompt_video": p_vid, "drive_link": l_vid, "video_original_link": l_orig,
            "tipo": "registro",
        }, timeout=10)
        return "✓ GUARDADO EN REGISTRO" if r.status_code == 201 else f"Error {r.status_code}: {r.text}"
    except Exception as e:
        return f"Error de conexión: {e}"

# ── CSS ───────────────────────────────────────────────────────────────────────
CSS = """
footer { display:none !important; }

body, html { background:#0a0a0a !important; margin:0 !important; padding:0 !important; }
.gradio-container, .gradio-container > div, .main {
    background:#0a0a0a !important;
    max-width:100% !important;
    width:100% !important;
    margin:0 !important;
    padding-left:40px !important;
    padding-right:40px !important;
    box-sizing:border-box !important;
}
.hidden, [style*="display: none"], [style*="display:none"] {
    display:none !important; height:0 !important; overflow:hidden !important;
}

.tab-nav { background:#0a0a0a !important; border-bottom:1px solid #1c1c1c !important; }
.tab-nav button {
    color:#3a3a3a !important; font-size:11px !important; letter-spacing:2px !important;
    text-transform:uppercase !important; padding:12px 18px !important;
    border-radius:0 !important; border-bottom:2px solid transparent !important;
    background:transparent !important; font-weight:600 !important;
}
.tab-nav button.selected { color:#ffffff !important; border-bottom:2px solid #ffffff !important; }
.tab-nav button:hover   { color:#888 !important; }

.block, .gr-group, .gr-form {
    background:#111 !important; border:1px solid #1c1c1c !important; border-radius:8px !important;
}

label > span, .label-wrap > span {
    color:#666 !important; font-size:12px !important;
    text-transform:uppercase !important; letter-spacing:1.5px !important; font-weight:600 !important;
}

input, textarea, .gr-input {
    background:#161616 !important; border:1px solid #222 !important;
    color:#d4d4d4 !important; border-radius:6px !important; font-size:14px !important;
}
input:focus, textarea:focus { border-color:#555 !important; box-shadow:0 0 0 2px rgba(255,255,255,0.05) !important; }
input::placeholder, textarea::placeholder { color:#333 !important; }

select, .gr-dropdown { background:#161616 !important; border:1px solid #222 !important; color:#d4d4d4 !important; }

button.primary {
    background:#ffffff !important; color:#000 !important; font-weight:700 !important;
    border:none !important; border-radius:6px !important;
    font-size:12px !important; letter-spacing:1.5px !important; text-transform:uppercase !important;
}
button.primary:hover { background:#d4d4d4 !important; }
button.secondary {
    background:#161616 !important; color:#555 !important;
    border:1px solid #222 !important; border-radius:6px !important;
    font-size:12px !important; letter-spacing:1px !important;
}
button.secondary:hover { border-color:#888 !important; color:#aaa !important; }

input[type=range] { accent-color:#ffffff !important; }
input[type=radio], input[type=checkbox] { accent-color:#ffffff !important; }

.gr-accordion { background:#0d0d0d !important; border:1px solid #1c1c1c !important; border-radius:8px !important; }

.upload-container { border:1px dashed #222 !important; background:#111 !important; border-radius:8px !important; }
.upload-container:hover { border-color:#555 !important; }

.result-url textarea {
    background:#0c0c0c !important; border:1px solid #222 !important;
    color:#888 !important; font-family:monospace !important; font-size:12px !important;
}

video, img { border-radius:8px !important; }
hr { border:none; border-top:1px solid #1c1c1c; margin:18px 0; }
"""

# ── UI ────────────────────────────────────────────────────────────────────────
with gr.Blocks(title="MystherAI Studio", css=CSS, theme=gr.themes.Base(), fill_height=True) as demo:
    api_key_st = gr.State(DEFAULT_KEY)
    demo.load(on_load, None, api_key_st)

    gr.HTML(f"""
    <div style="display:flex;align-items:center;gap:14px;padding:16px 0 14px;border-bottom:1px solid #1c1c1c;margin-bottom:4px;">
      {_LOGO_IMG}
      <div>
        <div style="font-size:16px;font-weight:800;letter-spacing:2px;color:#fff;line-height:1.1;">MYSTHERIAI</div>
        <div style="font-size:10px;color:#444;letter-spacing:3px;text-transform:uppercase;margin-top:3px;">AI Video Production Studio — WaveSpeed</div>
      </div>
    </div>
    """)

    with gr.Tabs():

        # ── 01  CARGAR + CAPTURA ──────────────────────────────────────────────
        with gr.Tab("01  CARGAR"):
            src_radio = gr.Radio(
                ["Archivo Local", "URL de Drive / Web"],
                value="URL de Drive / Web", label="Fuente del Video",
            )
            local_vid = gr.Video(label="Subir Video", sources=["upload"], visible=False, height=220)
            url_vid   = gr.Textbox(label="URL del Video (Google Drive o HTTP)", visible=True, lines=1)

            btn_analyze = gr.Button("ANALIZAR VIDEO", variant="primary")
            info_out    = gr.Textbox(label="Información del Video", interactive=False, lines=1)

            with gr.Row():
                frame_sl   = gr.Slider(0, 999, value=0, step=1, label="Fotograma", scale=3)
                frame_name = gr.Textbox(label="Nombre de la Captura", scale=2)

            with gr.Row():
                btn_prev = gr.Button("VER FOTOGRAMA", variant="secondary", scale=1)
                btn_snap = gr.Button("CAPTURAR Y GUARDAR", variant="primary", scale=2)

            with gr.Row():
                frame_out  = gr.Image(label="Fotograma Capturado", height=300, scale=2)
                frame_path = gr.Textbox(label="Ruta guardada", interactive=False, lines=5, scale=1)

            src_radio.change(
                lambda t: (gr.update(visible=t == "Archivo Local"),
                           gr.update(visible=t == "URL de Drive / Web")),
                src_radio, [local_vid, url_vid],
            )
            btn_analyze.click(do_analyze, [local_vid, url_vid], [frame_sl, info_out])
            btn_prev.click(do_snap, [local_vid, url_vid, frame_sl, gr.State(False), frame_name], [frame_out, frame_path])
            btn_snap.click(do_snap, [local_vid, url_vid, frame_sl, gr.State(True),  frame_name], [frame_out, frame_path])

        # ── 02  I2I — IMAGEN A IMAGEN ─────────────────────────────────────────
        with gr.Tab("02  I2I"):
            gr.HTML('<div style="font-size:10px;color:#555;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">IMAGEN → IMAGEN — Estilizado con WaveSpeed Z-Image</div>')

            i2i_src_r = gr.Radio(
                ["Archivo Local", "URL de Drive / Web"],
                value="URL de Drive / Web", label="Fuente de la Imagen",
            )
            img_base_local = gr.Image(label="Subir Imagen", type="filepath", visible=False, height=240)
            img_base_url   = gr.Textbox(label="URL de la Imagen (Google Drive o HTTP)", visible=True, lines=1)

            with gr.Row():
                style_dd    = gr.Dropdown(list(ESTILOS.keys()), value="Anime", label="Estilo Visual")
                imagination = gr.Slider(0, 10, value=4, step=0.1,
                                        label="Creatividad — 0 = fiel al original · 10 = libre", scale=2)

            style_prompt = gr.Textbox(label="Descripción del Estilo (editable)", lines=3, value=ESTILOS["Anime"])

            btn_stylize = gr.Button("GENERAR IMAGEN ESTILIZADA", variant="primary")

            with gr.Row():
                est_img = gr.Image(label="Resultado", height=310, scale=2)
                est_url = gr.Textbox(label="URL del Resultado", interactive=False,
                                     lines=3, elem_classes=["result-url"], scale=1)

            with gr.Accordion("GUARDAR EN REGISTRO", open=False):
                gr.HTML('<p style="color:#555;font-size:11px;letter-spacing:1.5px;margin:0 0 10px;">URL e imagen se auto-completan al generar.</p>')
                with gr.Row():
                    i2i_reg_id   = gr.Textbox(label="ID Video de Origen")
                    i2i_reg_user = gr.Textbox(label="Miembro", value="Mateo")
                    i2i_reg_mm   = gr.Dropdown(["Mateo","Miguel"], label="Mateo / Miguel", value="Mateo")
                    i2i_reg_est  = gr.Dropdown(list(ESTILOS.keys()), label="Estilo")
                i2i_reg_pv  = gr.Textbox(label="Prompt Imagen (auto)", lines=2)
                i2i_reg_li  = gr.Textbox(label="URL Imagen Generada (auto)", elem_classes=["result-url"])
                i2i_reg_lo  = gr.Textbox(label="URL Imagen Original (auto)")
                btn_i2i_reg = gr.Button("GUARDAR EN REGISTRO", variant="primary")
                i2i_reg_st  = gr.Textbox(label="Estado", interactive=False)

            i2i_src_r.change(
                lambda t: (gr.update(visible=t == "Archivo Local"),
                           gr.update(visible=t == "URL de Drive / Web")),
                i2i_src_r, [img_base_local, img_base_url],
            )
            style_dd.change(fill_style_prompt, style_dd, style_prompt)

            def _stylize_wrap(local, url, style, prompt, imagination, key):
                img = local if local else (url.strip() if url and url.strip() else None)
                if not img: raise gr.Error("Sube una imagen o pega una URL primero.")
                return do_stylize(img, style, prompt, imagination, key)

            btn_stylize.click(
                _stylize_wrap,
                [img_base_local, img_base_url, style_dd, style_prompt, imagination, api_key_st],
                [est_img, est_url],
            ).then(
                lambda out_url, prompt, orig_url: (out_url, prompt, orig_url),
                [est_url, style_prompt, img_base_url],
                [i2i_reg_li, i2i_reg_pv, i2i_reg_lo],
            )

            btn_i2i_reg.click(
                lambda v_id, user, mm, est, pv, li, lo: send_registro(v_id, user, mm, est, pv, li, pv, li, lo),
                [i2i_reg_id, i2i_reg_user, i2i_reg_mm, i2i_reg_est,
                 i2i_reg_pv, i2i_reg_li, i2i_reg_lo],
                i2i_reg_st,
            )

        # ── 03  I2V — IMAGEN A VIDEO ──────────────────────────────────────────
        with gr.Tab("03  I2V"):
            gr.HTML('<div style="font-size:10px;color:#555;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">IMAGEN → VIDEO — Motion Transfer con Kling V2.6</div>')

            i2v_src_r = gr.Radio(
                ["Archivo Local", "URL de Drive / Web"],
                value="URL de Drive / Web", label="Imagen de Referencia",
            )
            img_i2v_local = gr.Image(label="Subir Imagen", type="filepath", visible=False, height=220)
            img_i2v_url   = gr.Textbox(label="URL de la Imagen (Google Drive o HTTP)", visible=True, lines=1)

            i2v_vid_url = gr.Textbox(label="URL del Video de Movimiento (referencia de pose/movimiento)", lines=1)

            with gr.Row():
                i2v_model  = gr.Dropdown(list(KLING_MODELS.keys()), value=list(KLING_MODELS.keys())[0], label="Modelo Kling")
                i2v_orient = gr.Dropdown(["0","90","180","270"], value="0", label="Orientación del personaje")

            i2v_prompt = gr.Textbox(label="Prompt (opcional — describe el movimiento)", lines=2,
                                    placeholder="Ej: smooth natural walking motion, wildlife documentary style")
            i2v_audio  = gr.Checkbox(label="Mantener Audio Original del video de referencia", value=True)

            btn_i2v = gr.Button("▶  GENERAR VIDEO", variant="primary")

            with gr.Row():
                i2v_result     = gr.Video(label="Video Generado", scale=2)
                i2v_result_url = gr.Textbox(label="URL del Video", interactive=False,
                                            lines=3, elem_classes=["result-url"], scale=1)

            with gr.Accordion("GUARDAR EN REGISTRO", open=False):
                gr.HTML('<p style="color:#555;font-size:11px;letter-spacing:1.5px;margin:0 0 10px;">URL del video se auto-completa al generar.</p>')
                with gr.Row():
                    i2v_reg_id   = gr.Textbox(label="ID Video")
                    i2v_reg_user = gr.Textbox(label="Miembro", value="Mateo")
                    i2v_reg_mm   = gr.Dropdown(["Mateo","Miguel"], label="Mateo / Miguel", value="Mateo")
                    i2v_reg_est  = gr.Dropdown(list(ESTILOS.keys()), label="Estilo")
                i2v_reg_pv  = gr.Textbox(label="Prompt (auto)", lines=2)
                i2v_reg_lv  = gr.Textbox(label="URL Video Generado (auto)", elem_classes=["result-url"])
                i2v_reg_lo  = gr.Textbox(label="URL Imagen de Origen (auto)")
                i2v_reg_pi  = gr.Textbox(label="Prompt Imagen (opcional)", lines=2)
                i2v_reg_li  = gr.Textbox(label="URL Imagen Referencia (auto)")
                btn_i2v_reg = gr.Button("GUARDAR EN REGISTRO", variant="primary")
                i2v_reg_st  = gr.Textbox(label="Estado", interactive=False)

            i2v_src_r.change(
                lambda t: (gr.update(visible=t == "Archivo Local"),
                           gr.update(visible=t == "URL de Drive / Web")),
                i2v_src_r, [img_i2v_local, img_i2v_url],
            )

            def _motion_wrap(local, url, vid_url, model, prompt, orient, audio, key):
                img = local if local else (url.strip() if url and url.strip() else None)
                if not img: raise gr.Error("Sube una imagen o pega una URL primero.")
                if not vid_url or not vid_url.strip(): raise gr.Error("Pega la URL del video de movimiento.")
                return do_motion(img, vid_url.strip(), model, prompt, orient, audio, key)

            btn_i2v.click(
                _motion_wrap,
                [img_i2v_local, img_i2v_url, i2v_vid_url, i2v_model,
                 i2v_prompt, i2v_orient, i2v_audio, api_key_st],
                [i2v_result, i2v_result_url],
            ).then(
                lambda out_url, prompt, img_url: (out_url, prompt, img_url),
                [i2v_result_url, i2v_prompt, img_i2v_url],
                [i2v_reg_lv, i2v_reg_pv, i2v_reg_li],
            )

            btn_i2v_reg.click(
                send_registro,
                [i2v_reg_id, i2v_reg_user, i2v_reg_mm, i2v_reg_est,
                 i2v_reg_pi, i2v_reg_li, i2v_reg_pv, i2v_reg_lv, i2v_reg_lo],
                i2v_reg_st,
            )

        # ── 04  V2V TRANSFORM ─────────────────────────────────────────────────
        with gr.Tab("04  V2V"):
            gr.HTML('<div style="font-size:10px;color:#555;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">VIDEO → VIDEO — Transformación completa de estilo</div>')

            v2v_src_r = gr.Radio(
                ["Archivo Local", "URL de Drive / Web"],
                value="URL de Drive / Web", label="Fuente del Video",
            )
            with gr.Row():
                v2v_local = gr.Video(label="Video a Transformar", sources=["upload"], visible=False, scale=2)
                v2v_url   = gr.Textbox(label="URL del Video Original", scale=2)
            v2v_embed = gr.HTML("")

            with gr.Row():
                v2v_model = gr.Dropdown(list(V2V_MODELS.keys()), value=list(V2V_MODELS.keys())[0], label="Modelo V2V")
                v2v_res   = gr.Dropdown(["480p","720p","1080p","4k"], value="720p", label="Resolución")
                v2v_dur   = gr.Slider(0, 10, value=5, step=1, label="Duración (seg · 0 = automático)")

            v2v_prompt = gr.Textbox(label="Prompt — Describe la transformación", lines=3,
                                    placeholder="Ej: cyberpunk aesthetic, neon lights cyan and magenta, dark rainy streets...")
            v2v_neg    = gr.Textbox(label="Prompt Negativo (WAN 2.7) — Qué evitar", lines=1,
                                    placeholder="Ej: blurry, distorted, low quality, watermark")

            with gr.Row():
                ltx_mode  = gr.Dropdown(["pose","depth","canny"], value="pose",
                                         label="LTX · Modo de Control")
                ltx_audio = gr.Dropdown(["preserve","generate","none"], value="preserve",
                                         label="LTX · Audio")

            with gr.Row():
                v2v_strength = gr.Slider(0.1, 1.0, value=0.85, step=0.05,
                                         label="Intensidad (Seedance)")
                v2v_guidance = gr.Slider(1.0, 15.0, value=5.0, step=0.5,
                                         label="Adherencia al Prompt")
                v2v_steps    = gr.Slider(10, 50, value=30, step=5,
                                         label="Pasos de Inferencia")

            btn_v2v = gr.Button("▶  TRANSFORMAR VIDEO", variant="primary")

            with gr.Row():
                v2v_result     = gr.Video(label="Video Transformado", scale=2)
                v2v_result_url = gr.Textbox(label="URL del Video Generado", interactive=False,
                                            lines=3, elem_classes=["result-url"], scale=1)

            with gr.Accordion("GUARDAR EN REGISTRO", open=False):
                gr.HTML('<p style="color:#555;font-size:11px;letter-spacing:1.5px;margin:0 0 10px;">URL y prompt se auto-completan al generar.</p>')
                with gr.Row():
                    v2v_reg_id   = gr.Textbox(label="ID Video")
                    v2v_reg_user = gr.Textbox(label="Miembro", value="Mateo")
                    v2v_reg_mm   = gr.Dropdown(["Mateo","Miguel"], label="Mateo / Miguel", value="Mateo")
                    v2v_reg_est  = gr.Dropdown(list(ESTILOS.keys()), label="Estilo")
                v2v_reg_pv  = gr.Textbox(label="Prompt Video (auto)", lines=2)
                v2v_reg_lv  = gr.Textbox(label="URL Video Generado (auto)", elem_classes=["result-url"])
                v2v_reg_lo  = gr.Textbox(label="URL Video Original (auto)")
                v2v_reg_pi  = gr.Textbox(label="Prompt Imagen (opcional)", lines=2)
                v2v_reg_li  = gr.Textbox(label="URL Imagen Referencia (opcional)")
                btn_v2v_reg = gr.Button("GUARDAR EN REGISTRO", variant="primary")
                v2v_reg_st  = gr.Textbox(label="Estado", interactive=False)

            v2v_src_r.change(
                lambda t: (gr.update(visible=t == "Archivo Local"),
                           gr.update(visible=t == "URL de Drive / Web")),
                v2v_src_r, [v2v_local, v2v_url],
            )
            v2v_url.change(lambda u: drive_embed(u, 220), v2v_url, v2v_embed)

            btn_v2v.click(
                do_v2v,
                [v2v_local, v2v_url, v2v_model, v2v_prompt, v2v_neg,
                 v2v_strength, v2v_guidance, v2v_steps, v2v_res, v2v_dur,
                 ltx_mode, ltx_audio, api_key_st],
                [v2v_result, v2v_result_url],
            ).then(
                lambda out_url, prompt, orig: (out_url, prompt, orig),
                [v2v_result_url, v2v_prompt, v2v_url],
                [v2v_reg_lv, v2v_reg_pv, v2v_reg_lo],
            )

            btn_v2v_reg.click(
                send_registro,
                [v2v_reg_id, v2v_reg_user, v2v_reg_mm, v2v_reg_est,
                 v2v_reg_pi, v2v_reg_li, v2v_reg_pv, v2v_reg_lv, v2v_reg_lo],
                v2v_reg_st,
            )

        # ── 05  EDITAR ────────────────────────────────────────────────────────
        with gr.Tab("05  EDITAR"):
            ed_src_r = gr.Radio(
                ["Archivo Local", "URL de Drive / Web"],
                value="URL de Drive / Web", label="Fuente",
            )
            with gr.Row():
                ed_local = gr.Video(label="Video", sources=["upload"], visible=False, scale=2)
                ed_url   = gr.Textbox(label="URL del Video", scale=2)
            ed_embed = gr.HTML("")
            ed_url.change(lambda u: drive_embed(u, 200), ed_url, ed_embed)
            ed_src_r.change(
                lambda t: (gr.update(visible=t == "Archivo Local"),
                           gr.update(visible=t == "URL de Drive / Web")),
                ed_src_r, [ed_local, ed_url],
            )

            gr.HTML('<hr><p style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">RECORTAR SEGMENTO</p>')
            with gr.Row():
                cut_start = gr.Slider(0, 600, value=0,  step=0.5, label="Inicio (segundos)")
                cut_end   = gr.Slider(0, 600, value=30, step=0.5, label="Fin (segundos)")
                cut_name  = gr.Textbox(label="Nombre del corte", scale=1)
            btn_cut    = gr.Button("CORTAR", variant="primary")
            cut_result = gr.Video(label="Segmento Cortado")
            btn_cut.click(do_cut, [ed_local, ed_url, cut_start, cut_end, cut_name], cut_result)

            gr.HTML('<hr><p style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">PARTIR EN PARTES IGUALES</p>')
            with gr.Row():
                split_n   = gr.Dropdown(["2","3","4","5"], value="2", label="Número de Partes")
                split_pfx = gr.Textbox(label="Prefijos (separados por coma)", placeholder="intro, cuerpo, cierre")
            btn_split    = gr.Button("PARTIR", variant="primary")
            split_result = gr.Textbox(label="Rutas generadas", interactive=False, lines=5)
            btn_split.click(do_split, [ed_local, ed_url, split_n, split_pfx], split_result)

            gr.HTML('<hr><p style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">UNIR VIDEOS</p>')
            merge_files  = gr.File(label="Selecciona los videos a unir", file_count="multiple", file_types=["video"])
            merge_name   = gr.Textbox(label="Nombre del resultado")
            btn_merge    = gr.Button("UNIR", variant="primary")
            merge_result = gr.Video(label="Video Unido")
            btn_merge.click(do_merge, [merge_files, merge_name], merge_result)


if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        allowed_paths=[BASE_DIR],
    )
