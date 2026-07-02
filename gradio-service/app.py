
# ════════════════════════════════════════════════════════════════════════════
# HECHICER.IA STUDIO — AI Video Production Console
# Models: WAN 2.1 V2V 720p · Seedance 2.0 Video Edit · Kling V2.6 Motion
# ════════════════════════════════════════════════════════════════════════════
import os, re, datetime, subprocess
import requests as req
import cv2
import wavespeed
import gradio as gr
from dotenv import load_dotenv

load_dotenv()

DEFAULT_KEY = os.environ.get("WAVESPEED_API_KEY", "")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))

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
    "Kling V2.6 Std — Motion Transfer":      "kwaivgi/kling-v2.6-std/motion-control",
    "Kling V2.6 Pro — Alta Fidelidad":       "kwaivgi/kling-v2.6-pro/motion-control",
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
    """Resolve video source: local path or URL."""
    if local and os.path.exists(str(local)): return str(local)
    if url and url.strip(): return url.strip()
    raise gr.Error("Sube un archivo de video o pega una URL primero.")

def ws_up(cl, src):
    if str(src).startswith("http"): return _drive_dl(src)
    return cl.upload(src)

# ── Funciones principales ─────────────────────────────────────────────────────
def on_load(request: gr.Request):
    return request.query_params.get("api_key", DEFAULT_KEY)

def do_analyze(local, url):
    src  = get_src(local, url)
    path = dl_temp(src)
    cap  = cv2.VideoCapture(path)
    fps   = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    dur   = total / fps
    cap.release()
    return gr.update(maximum=max(0, total - 1), value=0), f"{total} frames · {dur:.1f}s · {fps:.0f} fps"

def do_snap(local, url, frame_idx, save_file, name):
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

def fill_style_prompt(estilo): return ESTILOS.get(estilo, "")

def do_stylize(img, style, prompt, imagination, key):
    if not key: raise gr.Error("Configura tu API Key en ⚙  Config.")
    cl  = wavespeed.Client(api_key=key)
    txt = prompt or ESTILOS.get(style, "")
    if not txt: raise gr.Error("Selecciona un estilo o escribe un prompt.")
    g  = 1.5 + (imagination / 10.0) * 10.5
    fs = 0.20 + (imagination / 10.0) * 0.60
    img_url = cl.upload(img) if img and not str(img).startswith("http") else _drive_dl(str(img or ""))
    res = cl.run("wavespeed-ai/z-image/turbo", {"image": img_url, "prompt": txt, "strength": fs, "guidance_scale": g})
    out = res.get("outputs"); url = out[0] if isinstance(out, list) else out
    return url, url

def do_v2v(local, url, model_label, prompt, neg, strength, guidance, steps,
           resolution, duration, ltx_mode, ltx_audio, key):
    if not key: raise gr.Error("Configura tu API Key en ⚙  Config.")
    model = V2V_MODELS.get(model_label)
    if not model: raise gr.Error("Selecciona un modelo V2V válido.")
    cl  = wavespeed.Client(api_key=key)
    src = get_src(local, url)
    vid = ws_up(cl, src) if not str(src).startswith("http") else _drive_dl(src)
    params = {"video": vid, "prompt": prompt or ""}

    if model == "alibaba/wan-2.7/video-edit":
        params.update({
            "negative_prompt":          neg or "",
            "resolution":               resolution if resolution in ("720p","1080p") else "720p",
            "duration":                 int(duration) if int(duration) > 0 else 0,
            "audio_setting":            "auto",
            "enable_prompt_expansion":  False,
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

    res = cl.run(model, params)
    out = res.get("outputs"); result = out[0] if isinstance(out, list) else out
    return result, result

def do_motion(img, vid_url, model_label, prompt, orientation, keep_audio, key):
    if not key: raise gr.Error("Configura tu API Key en ⚙  Config.")
    model   = KLING_MODELS.get(model_label)
    cl      = wavespeed.Client(api_key=key)
    img_url = cl.upload(img) if img and not str(img).startswith("http") else str(img)
    real    = dl_temp(vid_url) if vid_url and vid_url.startswith("http") else vid_url
    vid_up  = cl.upload(real)
    res = cl.run(model, {
        "image": img_url, "video": vid_up,
        "prompt": prompt or "",
        "character_orientation": orientation,
        "keep_original_sound":   keep_audio,
    })
    out = res.get("outputs"); return out[0] if isinstance(out, list) else out

def do_cut(local, url, start, end, name):
    src  = get_src(local, url); path = dl_temp(src)
    out  = os.path.join(OUTPUTS["vid"], f"{name or 'corte'}_{datetime.datetime.now().strftime('%H%M%S')}.mp4")
    subprocess.run(["ffmpeg", "-y", "-ss", str(start), "-to", str(end), "-i", path, "-c", "copy", out], check=True)
    return out

def do_split(local, url, n_parts, prefixes):
    src  = get_src(local, url); path = dl_temp(src)
    cap  = cv2.VideoCapture(path)
    fps  = cap.get(cv2.CAP_PROP_FPS) or 30
    dur  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) / fps; cap.release()
    n    = int(n_parts); seg = dur / n
    prefs = [p.strip() for p in prefixes.split(",")] if prefixes else []
    paths = []
    for i in range(n):
        nm  = prefs[i] if i < len(prefs) else f"parte_{i+1}"
        out = os.path.join(OUTPUTS["vid"], f"{nm}_{datetime.datetime.now().strftime('%H%M%S_%f')}.mp4")
        subprocess.run(["ffmpeg", "-y", "-ss", str(i*seg), "-to", str((i+1)*seg),
                        "-i", path, "-c", "copy", out], check=True)
        paths.append(out)
    return "\n".join(paths)

def do_merge(files, name):
    tmp = os.path.join(TEMP_DIR, "concat.txt")
    with open(tmp, "w") as f:
        for fi in (files or []):
            p = fi.name if hasattr(fi, "name") else str(fi)
            f.write(f"file '{p}'\n")
    out = os.path.join(OUTPUTS["vid"], f"{name or 'merged'}_{datetime.datetime.now().strftime('%H%M%S')}.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", tmp, "-c", "copy", out], check=True)
    return out

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
.gradio-container { background:#0a0a0a !important; max-width:1080px !important; margin:auto; }

/* tabs */
.tab-nav { background:#0a0a0a !important; border-bottom:1px solid #1c1c1c !important; }
.tab-nav button {
    color:#3a3a3a !important; font-size:11px !important; letter-spacing:2px !important;
    text-transform:uppercase !important; padding:12px 14px !important;
    border-radius:0 !important; border-bottom:2px solid transparent !important;
    background:transparent !important; font-weight:600 !important;
}
.tab-nav button.selected { color:#ffffff !important; border-bottom:2px solid #ffffff !important; }
.tab-nav button:hover   { color:#888 !important; }

/* blocks */
.block, .gr-group, .gr-form {
    background:#111 !important; border:1px solid #1c1c1c !important; border-radius:8px !important;
}

/* labels */
label > span, .label-wrap > span {
    color:#666 !important; font-size:12px !important;
    text-transform:uppercase !important; letter-spacing:1.5px !important; font-weight:600 !important;
}

/* inputs */
input, textarea, .gr-input {
    background:#161616 !important; border:1px solid #222 !important;
    color:#d4d4d4 !important; border-radius:6px !important; font-size:14px !important;
}
input:focus, textarea:focus { border-color:#555 !important; box-shadow:0 0 0 2px rgba(255,255,255,0.05) !important; }
input::placeholder, textarea::placeholder { color:#333 !important; }

/* select / dropdown */
select, .gr-dropdown { background:#161616 !important; border:1px solid #222 !important; color:#d4d4d4 !important; }

/* buttons */
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

/* sliders */
input[type=range] { accent-color:#ffffff !important; }

/* radio / checkbox */
input[type=radio], input[type=checkbox] { accent-color:#ffffff !important; }

/* accordion */
.gr-accordion { background:#0d0d0d !important; border:1px solid #1c1c1c !important; border-radius:8px !important; }

/* file upload */
.upload-container { border:1px dashed #222 !important; background:#111 !important; border-radius:8px !important; }
.upload-container:hover { border-color:#555 !important; }

/* result URL box */
.result-url textarea {
    background:#0c0c0c !important; border:1px solid #222 !important;
    color:#888 !important; font-family:monospace !important; font-size:12px !important;
}

video, img { border-radius:8px !important; }
hr { border:none; border-top:1px solid #1c1c1c; margin:18px 0; }
"""

# ── UI ────────────────────────────────────────────────────────────────────────
with gr.Blocks(title="Hechicer.ia Studio", css=CSS, theme=gr.themes.Base()) as demo:
    api_key_st = gr.State(DEFAULT_KEY)
    demo.load(on_load, None, api_key_st)

    gr.HTML("""
    <div style="padding:20px 0 10px;border-bottom:1px solid #1c1c1c;margin-bottom:2px;">
      <div style="font-size:17px;font-weight:800;letter-spacing:3px;color:#fff;">
        HECHICER<span style="color:#fff;">.IA</span> STUDIO
      </div>
      <div style="font-size:10px;color:#444;letter-spacing:3px;text-transform:uppercase;margin-top:3px;">
        AI Video Production Console — WaveSpeed
      </div>
    </div>
    """)

    with gr.Tabs():

        # ── 01  CARGAR + CAPTURA ──────────────────────────────────────────────
        with gr.Tab("01  CARGAR"):
            src_radio = gr.Radio(
                ["Archivo Local", "URL de Drive / Web"],
                value="Archivo Local", label="Fuente de Video",
            )
            with gr.Row():
                local_vid = gr.Video(label="Subir Video", sources=["upload"], scale=2)
                url_vid   = gr.Textbox(label="URL del Video (Google Drive, HTTP...)", scale=2, visible=False)
            url_preview = gr.HTML("")

            with gr.Row():
                btn_analyze = gr.Button("ANALIZAR VIDEO", variant="primary", scale=1)
                info_out    = gr.Textbox(label="Info", interactive=False, scale=3, lines=1)

            frame_sl = gr.Slider(0, 999, value=0, step=1, label="Frame")

            with gr.Row():
                frame_name = gr.Textbox(label="Nombre de la Captura", scale=2)
                btn_prev   = gr.Button("VER FRAME", variant="secondary", scale=1)
                btn_snap   = gr.Button("CAPTURAR Y GUARDAR", variant="primary", scale=1)

            with gr.Row():
                frame_out  = gr.Image(label="Frame", height=300, scale=2)
                frame_path = gr.Textbox(label="Ruta guardada", interactive=False, lines=3, scale=1)

            src_radio.change(
                lambda t: (gr.update(visible=t == "Archivo Local"),
                           gr.update(visible=t == "URL de Drive / Web")),
                src_radio, [local_vid, url_vid],
            )
            url_vid.change(lambda u: drive_embed(u, 260), url_vid, url_preview)
            btn_analyze.click(do_analyze, [local_vid, url_vid], [frame_sl, info_out])
            btn_prev.click(do_snap, [local_vid, url_vid, frame_sl, gr.State(False), frame_name], [frame_out, frame_path])
            btn_snap.click(do_snap, [local_vid, url_vid, frame_sl, gr.State(True),  frame_name], [frame_out, frame_path])

        # ── 02  ESTILIZAR IMAGEN ──────────────────────────────────────────────
        with gr.Tab("02  ESTILIZAR"):
            with gr.Row():
                with gr.Column(scale=1):
                    img_base    = gr.Image(label="Imagen Base", type="filepath", height=280)
                with gr.Column(scale=1):
                    style_dd    = gr.Dropdown(list(ESTILOS.keys()), value="Anime", label="Estilo Visual")
                    style_prompt= gr.Textbox(label="Prompt (editable)", lines=4, value=ESTILOS["Anime"])
                    imagination = gr.Slider(0, 10, value=4, step=0.1,
                                           label="Creatividad — 0 = fiel al original · 10 = libre")
                    btn_stylize = gr.Button("GENERAR IMAGEN ESTILIZADA", variant="primary")
            with gr.Row():
                est_img = gr.Image(label="Resultado", height=310, scale=2)
                est_url = gr.Textbox(label="URL del resultado", interactive=False,
                                     lines=3, elem_classes=["result-url"], scale=1)

            style_dd.change(fill_style_prompt, style_dd, style_prompt)
            btn_stylize.click(
                do_stylize, [img_base, style_dd, style_prompt, imagination, api_key_st],
                [est_img, est_url],
            )

        # ── 03  V2V TRANSFORM ────────────────────────────────────────────────
        with gr.Tab("03  V2V"):
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

            # LTX-specific controls (only relevant for LTX model)
            with gr.Row():
                ltx_mode  = gr.Dropdown(["pose","depth","canny"], value="pose",
                                         label="LTX · Modo de Control (pose = movimiento, depth = escena, canny = contornos)")
                ltx_audio = gr.Dropdown(["preserve","generate","none"], value="preserve",
                                         label="LTX · Audio (preserve = mantener, generate = generar nuevo, none = sin audio)")

            with gr.Row():
                v2v_strength = gr.Slider(0.1, 1.0, value=0.85, step=0.05,
                                         label="Intensidad (Seedance) — 0 sutil · 1 total")
                v2v_guidance = gr.Slider(1.0, 15.0, value=5.0, step=0.5,
                                         label="Adherencia al Prompt")
                v2v_steps    = gr.Slider(10, 50, value=30, step=5,
                                         label="Pasos de Inferencia")

            # registro inline — definido ANTES del botón para que .then() pueda referenciarlos
            with gr.Accordion("GUARDAR EN REGISTRO", open=False):
                gr.HTML('<p style="color:#555;font-size:11px;letter-spacing:1.5px;margin:0 0 10px;">Los campos URL y prompt se auto-completan al generar.</p>')
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

            btn_v2v = gr.Button("▶  TRANSFORMAR VIDEO", variant="primary")

            with gr.Row():
                v2v_result     = gr.Video(label="Video Transformado", scale=2)
                v2v_result_url = gr.Textbox(label="URL del Video Generado", interactive=False,
                                            lines=3, elem_classes=["result-url"], scale=1)

            # wiring
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

        # ── 04  MOTION CONTROL ───────────────────────────────────────────────
        with gr.Tab("04  MOTION"):
            gr.HTML('<div style="font-size:10px;color:#555;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">IMAGEN + VIDEO → Transferencia de movimiento — Kling V2.6</div>')

            with gr.Row():
                with gr.Column(scale=1):
                    mc_img = gr.Image(label="Imagen del Personaje (quien se animará)",
                                      type="filepath", height=260)
                with gr.Column(scale=1):
                    mc_url   = gr.Textbox(label="URL Video de Movimiento (referencia de poses)")
                    mc_embed = gr.HTML("")
                    mc_url.change(lambda u: drive_embed(u, 180), mc_url, mc_embed)

            with gr.Row():
                mc_model  = gr.Dropdown(list(KLING_MODELS.keys()), value=list(KLING_MODELS.keys())[0], label="Modelo")
                mc_orient = gr.Dropdown(
                    ["Frente","Perfil Izquierdo","Perfil Derecho","Espalda"],
                    value="Frente", label="Orientación del Personaje",
                )
                mc_audio  = gr.Checkbox(label="Conservar audio del video de referencia", value=False)

            mc_prompt = gr.Textbox(label="Prompt (opcional)", lines=2,
                                   placeholder="Ej: natural walking motion, smooth movement, cinematic")
            btn_motion = gr.Button("▶  ANIMAR PERSONAJE", variant="primary")
            mc_result  = gr.Video(label="Video Animado")

            with gr.Accordion("GUARDAR EN REGISTRO", open=False):
                with gr.Row():
                    mc_reg_id   = gr.Textbox(label="ID Video")
                    mc_reg_user = gr.Textbox(label="Miembro", value="Mateo")
                    mc_reg_mm   = gr.Dropdown(["Mateo","Miguel"], label="Mateo / Miguel", value="Mateo")
                    mc_reg_est  = gr.Dropdown(list(ESTILOS.keys()), label="Estilo")
                mc_reg_pv  = gr.Textbox(label="Prompt Video (auto)", lines=2)
                mc_reg_lv  = gr.Textbox(label="URL Video Generado (auto)", elem_classes=["result-url"])
                mc_reg_lo  = gr.Textbox(label="URL Video de Movimiento (auto)")
                mc_reg_pi  = gr.Textbox(label="Prompt Imagen (opcional)", lines=2)
                mc_reg_li  = gr.Textbox(label="URL Imagen del Personaje (opcional)")
                btn_mc_reg = gr.Button("GUARDAR EN REGISTRO", variant="primary")
                mc_reg_st  = gr.Textbox(label="Estado", interactive=False)

            def _motion_wrap(img, url, model, prompt, orient, audio, key):
                result = do_motion(img, url, model, prompt, orient, audio, key)
                return result, result

            btn_motion.click(
                _motion_wrap,
                [mc_img, mc_url, mc_model, mc_prompt, mc_orient, mc_audio, api_key_st],
                [mc_result, mc_reg_lv],
            ).then(
                lambda p, u: (p, u),
                [mc_prompt, mc_url],
                [mc_reg_pv, mc_reg_lo],
            )

            btn_mc_reg.click(
                send_registro,
                [mc_reg_id, mc_reg_user, mc_reg_mm, mc_reg_est,
                 mc_reg_pi, mc_reg_li, mc_reg_pv, mc_reg_lv, mc_reg_lo],
                mc_reg_st,
            )

        # ── 05  EDITAR ───────────────────────────────────────────────────────
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

        # ── ⚙  CONFIG ─────────────────────────────────────────────────────────
        with gr.Tab("⚙  CONFIG"):
            gr.HTML('<p style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">Configuración de la Sesión</p>')
            api_in   = gr.Textbox(label="WaveSpeed API Key", type="password",
                                  placeholder="ws-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
            api_stat = gr.Textbox(label="Estado", interactive=False)
            btn_key  = gr.Button("GUARDAR API KEY", variant="primary")

            def _save_key(k):
                k = (k or "").strip()
                return (k, "✓ API Key guardada.") if k else ("", "⚠  Ingresa una key válida.")

            btn_key.click(_save_key, api_in, [api_key_st, api_stat])

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
