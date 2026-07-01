import os
import requests
import cv2
import wavespeed
import gradio as gr
import datetime
import subprocess
import re
from pathlib import Path
from dotenv import load_dotenv

# ==========================================
# 1. CONFIGURACIÓN
# ==========================================
load_dotenv()
DEFAULT_KEY = os.environ.get("WAVESPEED_API_KEY", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = "outputs"
RUTAS = {k: os.path.join(BASE_DIR, BASE, v) for k, v in {
    "cap": "01_CAPTURAS",
    "est": "02_ESTILIZADOS",
    "vid": "03_VIDEOS_FINALES",
    "trans": "04_TRANSFORMACIONES"
}.items()}
for c in RUTAS.values(): os.makedirs(c, exist_ok=True)
TEMP_DIR = os.path.join(BASE_DIR, BASE, "temp_local_bridge")
os.makedirs(TEMP_DIR, exist_ok=True)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

# ==========================================
# 2. FUNCIONES DE APOYO
# ==========================================

def clean_drive_url(url):
    if not url or "drive.google.com" not in str(url): return url
    match = re.search(r'(?:file\/d\/|id=|\/d\/)([-\w]{25,})', str(url))
    return f"https://drive.google.com/uc?export=download&id={match.group(1)}" if match else url

def descargar_a_temp_local(url_o_ruta, ext="tmp"):
    if not str(url_o_ruta).startswith("http"): return url_o_ruta
    url = clean_drive_url(url_o_ruta)
    file_extension_match = re.search(r'\.(\w+)$', url.split('?')[0])
    if file_extension_match: ext = file_extension_match.group(1)
    temp_name = os.path.join(TEMP_DIR, f"web_dl_{datetime.datetime.now().strftime('%H%M%S_%f')}.{ext}")
    try:
        r = requests.get(url, stream=True, timeout=30)
        r.raise_for_status()
        with open(temp_name, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192): f.write(chunk)
        return temp_name
    except Exception as e: raise gr.Error(f"❌ Error descarga: {str(e)}")

def preparar_y_subir_imagen_wavespeed(ruta, cl):
    if not str(ruta).startswith("http"):
        ruta_abs = os.path.join(BASE_DIR, ruta) if not os.path.isabs(ruta) else ruta
        if os.path.exists(ruta_abs): return cl.upload(ruta_abs)
    return clean_drive_url(ruta)

# ==========================================
# 3. FUNCIONES PRINCIPALES
# ==========================================

def salvar(url, tipo, prefijo, ext, nombre_usuario=""):
    url_l = str(url).strip().replace("[","").replace("]","").replace("'","").replace('"',"")
    try:
        nombre = f"{nombre_usuario.strip()}.{ext}" if nombre_usuario else f"{prefijo}_{datetime.datetime.now().strftime('%H%M%S')}.{ext}"
        ruta_final = os.path.join(RUTAS[tipo], nombre)
        res = requests.get(url_l, timeout=60)
        if res.status_code == 200:
            with open(ruta_final, 'wb') as f: f.write(res.content)
            return f"✅ Guardado en: {ruta_final}"
        return "❌ Error descarga"
    except Exception as e: return f"❌ Error: {str(e)}"

def analizar(path):
    p_real = descargar_a_temp_local(path, "mp4")
    cap = cv2.VideoCapture(p_real); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); cap.release()
    return gr.update(maximum=max(0, total-1)), f"Frames totales: {total}"

def snap(path, idx, modo, nombre=""):
    p_real = descargar_a_temp_local(path, "mp4")
    cap = cv2.VideoCapture(p_real); cap.set(cv2.CAP_PROP_POS_FRAMES, idx); ret, frame = cap.read(); cap.release()
    if not ret: return None, "Error"
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    if modo == "Ver": return rgb, "Preview lista"
    nombre_f = f"{nombre or 'cap'}_{datetime.datetime.now().strftime('%H%M%S')}.jpg"
    ruta_abs = os.path.join(RUTAS["cap"], nombre_f)
    cv2.imwrite(ruta_abs, frame)
    return rgb, os.path.join("outputs", "01_CAPTURAS", nombre_f)

def _sec_from_mmss(t):
    if isinstance(t, (int,float)): return float(t)
    if ":" in str(t):
        parts = list(map(float, str(t).split(":")))
        return parts[0]*60 + parts[1]
    return float(t)

def cortar_segmento(ruta, inicio, fin, nombre_salida):
    p_real = descargar_a_temp_local(ruta, "mp4")
    salida = os.path.join(RUTAS["vid"], f"{nombre_salida or 'cut'}_{datetime.datetime.now().strftime('%H%M%S')}.mp4")
    subprocess.run(["ffmpeg", "-y", "-ss", str(_sec_from_mmss(inicio)), "-to", str(_sec_from_mmss(fin)), "-i", p_real, "-c", "copy", salida], check=True)
    return salida

def unir_videos(lista_rutas, nombre_salida):
    tmp_list = os.path.join(TEMP_DIR, "concat_list.txt")
    with open(tmp_list, "w") as f:
        for p in lista_rutas:
            p_real = descargar_a_temp_local(p, "mp4")
            f.write(f"file '{p_real}'\n")
    nombre = (nombre_salida.strip() + ".mp4") if nombre_salida else f"merged_{datetime.datetime.now().strftime('%H%M%S')}.mp4"
    salida = os.path.join(RUTAS["vid"], nombre)
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", tmp_list, "-c", "copy", salida], check=True)
    return salida

def partir_aut(ruta, n_partes, prefijos):
    p_real = descargar_a_temp_local(ruta, "mp4")
    cap = cv2.VideoCapture(p_real); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    dur = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) / fps; cap.release()
    n = int(n_partes); seg_len = dur / n
    prefs_list = [p.strip() for p in prefijos.split(",")] if prefijos else []
    resultados = []
    for i in range(n):
        s = i * seg_len; e = (i + 1) * seg_len
        resultados.append(cortar_segmento(p_real, s, e, prefs_list[i] if i < len(prefs_list) else f"part_{i+1}"))
    return "\n".join(resultados)

def llamar_api(modelo, prompt, entrada, duracion=5, texto_referencias="", imaginacion=5, api_key=""):
    if not api_key:
        raise gr.Error("❌ Introduce tu WaveSpeed API Key en la pestaña 🔑 Configuración")
    cl = wavespeed.Client(api_key=api_key)
    url_input = preparar_y_subir_imagen_wavespeed(entrada, cl)
    g_scale = 1.5 + (float(imaginacion) / 10.0) * (12.0 - 1.5)
    f_strength = 0.20 + (float(imaginacion) / 10.0) * (0.80 - 0.20)
    try:
        if modelo == "estilo_img":
            res = cl.run("wavespeed-ai/z-image/turbo", {"image": url_input, "prompt": prompt, "strength": f_strength, "guidance_scale": g_scale})
        elif modelo == "video_to_video":
            res = cl.run("wavespeed-ai/wan-2.1/v2v-720p", {"video": cl.upload(descargar_a_temp_local(entrada, "mp4")), "prompt": prompt, "strength": f_strength, "duration": int(duracion)})
        else:
            res = cl.run("kwaivgi/kling-v3.0-std/image-to-video", {"image": url_input, "prompt": prompt, "duration": int(duracion), "mode": "high_quality", "guidance_scale": g_scale})
        out = res.get("outputs")
        return out[0] if isinstance(out, list) else out
    except Exception as e: raise gr.Error(f"❌ Fallo WaveSpeed: {e}")

def enviar_a_web(v_id, user, resp, estilo, p_img, l_img, p_vid, l_vid, l_orig):
    payload = {"video_id": v_id, "usuario": user, "mateo_miguel": resp, "estilizado": estilo, "prompt_imagen": p_img, "imagen_link": l_img, "prompt_video": p_vid, "drive_link": l_vid, "video_original_link": l_orig, "tipo": "registro"}
    try:
        r = requests.post(f"{BACKEND_URL}/api/sheets/videos/", json=payload, timeout=10)
        return "✅ REGISTRO GUARDADO EN WEB" if r.status_code == 201 else f"❌ Error DB: {r.text}"
    except Exception as e: return f"❌ Error conexión: {e}"

def on_load(request: gr.Request):
    return request.query_params.get('api_key', DEFAULT_KEY)

def guardar_key(key):
    if not key or len(key.strip()) < 10:
        return key, "❌ La API Key es demasiado corta"
    return key.strip(), "✅ API Key guardada para esta sesión"

# ==========================================
# 4. INTERFAZ
# ==========================================

with gr.Blocks(title="WaveSpeed Pro", theme=gr.themes.Soft(primary_hue="orange")) as demo:
    api_key_state = gr.State(DEFAULT_KEY)
    m_p_i = gr.State(""); m_l_i = gr.State(""); m_p_v = gr.State(""); m_l_v = gr.State(""); m_o = gr.State("")

    demo.load(on_load, None, [api_key_state])

    gr.Markdown("# 🌊 WaveSpeed Pro Workflow - Lead Console")

    with gr.Tab("🔑 Configuración"):
        gr.Markdown("### API Key de WaveSpeed\nIntroduce tu clave para usar los modelos de IA. Se aplica solo a esta sesión.")
        key_input = gr.Textbox(label="WaveSpeed API Key", type="password", placeholder="ws_xxxxxxxxxxxxxxxxxxxxxxxx", value=DEFAULT_KEY)
        key_btn = gr.Button("💾 Guardar Key", variant="primary")
        key_status = gr.Textbox(label="Estado", interactive=False)
        key_btn.click(guardar_key, [key_input], [api_key_state, key_status])

    with gr.Tab("1. Selector"):
        v_in = gr.Textbox(label="URL Video Original (Google Drive o Ruta Local)")
        v_in.change(lambda x: x, v_in, m_o)
        sli = gr.Slider(0, 100, label="Frame"); n_cap = gr.Textbox(label="Nombre Captura"); info = gr.Markdown()
        v_in.change(analizar, v_in, [sli, info]); pre_f = gr.Image(label="Preview", height=300); res_ruta = gr.Textbox(label="Ruta para Paso 2")
        with gr.Row():
            gr.Button("🔍 Ver").click(snap, [v_in, sli, gr.State("Ver")], [pre_f, info])
            gr.Button("📸 CAPTURAR", variant="primary").click(snap, [v_in, sli, gr.State("G"), n_cap], [pre_f, res_ruta])

    with gr.Tab("2. Estilo Imagen"):
        i_in2 = gr.Textbox(label="URL Imagen Base"); p_est = gr.Textbox(label="Prompt de Estilo")
        imag_est = gr.Slider(0, 10, value=4, step=0.1, label="🧠 Imaginación"); u_res2 = gr.Textbox(label="URL Resultado"); pre_est = gr.Image(height=300)
        with gr.Row():
            btn_gen_img = gr.Button("🎨 GENERAR IMAGEN", variant="primary")
            btn_to_6_img = gr.Button("📥 AÑADIR A PESTAÑA 6", variant="secondary")
        btn_gen_img.click(llamar_api, [gr.State("estilo_img"), p_est, i_in2, gr.State(5), gr.State(""), imag_est, api_key_state], u_res2).then(lambda x: x, u_res2, pre_est)
        btn_to_6_img.click(lambda p, l: (p, l, "✅ Imagen enviada"), [p_est, u_res2], [m_p_i, m_l_i, gr.Textbox(label="Status")])
        with gr.Row():
            n_est = gr.Textbox(label="Nombre Local"); gr.Button("💾 GUARDAR LOCAL").click(salvar, [u_res2, gr.State("est"), gr.State("estilo"), gr.State("png"), n_est], gr.Textbox(label="Status"))

    with gr.Tab("3. Video-to-Video"):
        v_in3 = gr.Textbox(label="URL Video Base"); p_trans = gr.Textbox(label="Prompt"); dur_trans = gr.Slider(5, 10, value=10, label="Duración")
        imag3 = gr.Slider(0, 10, value=4, label="Imaginación"); ref_trans = gr.Textbox(label="URLs Referencia", lines=2)
        u_trans = gr.Textbox(label="URL Video Estilizado"); pre_trans = gr.Video()
        gr.Button("🪄 TRANSFORMAR", variant="primary").click(llamar_api, [gr.State("video_to_video"), p_trans, v_in3, dur_trans, ref_trans, imag3, api_key_state], u_trans).then(lambda x: x, u_trans, pre_trans)

    with gr.Tab("4. Kling v3.0"):
        u_in4 = gr.Textbox(label="URL Imagen"); p_vid = gr.Textbox(label="Prompt Movimiento"); dur4 = gr.Slider(3, 10, value=10, label="Duración")
        imag4 = gr.Slider(0, 10, value=5, step=0.1, label="🧠 Imaginación"); ref_kling = gr.Textbox(label="URLs Referencia", lines=2)
        u_res4 = gr.Textbox(label="URL Video Final"); pre_vid = gr.Video()
        with gr.Row():
            btn_gen_vid = gr.Button("🎥 GENERAR VIDEO", variant="primary")
            btn_to_6_vid = gr.Button("📥 AÑADIR A PESTAÑA 6", variant="secondary")
        btn_gen_vid.click(llamar_api, [gr.State("kling_v3"), p_vid, u_in4, dur4, ref_kling, imag4, api_key_state], u_res4).then(lambda x: x, u_res4, pre_vid)
        btn_to_6_vid.click(lambda p, l: (p, l, "✅ Video enviado"), [p_vid, u_res4], [m_p_v, m_l_v, gr.Textbox(label="Status")])

    with gr.Tab("5. Cortar / Unir"):
        gr.Markdown("### Funciones FFmpeg"); src_v = gr.Textbox(label="URL Video"); pre_v = gr.Video()
        src_v.change(descargar_a_temp_local, src_v, pre_v)
        with gr.Row():
            ini = gr.Textbox(label="Inicio"); fi = gr.Textbox(label="Fin"); n_c = gr.Textbox(label="Nombre")
        gr.Button("✂️ Cortar").click(cortar_segmento, [src_v, ini, fi, n_c], gr.Textbox(label="Ruta"))
        gr.Markdown("---"); p_n = gr.Dropdown(["2","3"], label="Partes"); prf = gr.Textbox(label="Prefijos")
        gr.Button("🔪 Partir").click(partir_aut, [src_v, p_n, prf], gr.Textbox(label="Rutas"))

    with gr.Tab("6. REGISTRO WEB"):
        gr.Markdown("## 📋 Consolidación y Envío a Hechicer.ia")
        with gr.Row():
            miembro = gr.Textbox(label="Miembro", value="Mateo"); v_id = gr.Textbox(label="ID del Video")
            resp = gr.Dropdown(["Mateo", "Miguel"], label="Responsable", value="Mateo"); est_nom = gr.Textbox(label="Estilo", value="Anime")
        with gr.Row():
            e_pi = gr.Textbox(label="Prompt Imagen"); e_li = gr.Textbox(label="Link Imagen")
        with gr.Row():
            e_pv = gr.Textbox(label="Prompt Video"); e_lv = gr.Textbox(label="Link Video")
        e_orig = gr.Textbox(label="Video Original (Censo)")
        btn_rev = gr.Button("🔍 1. REVISAR DATOS", variant="secondary")
        btn_rev.click(lambda pi, li, pv, lv, lo: (pi, li, pv, lv, lo), [m_p_i, m_l_i, m_p_v, m_l_v, m_o], [e_pi, e_li, e_pv, e_lv, e_orig])
        btn_send = gr.Button("🚀 2. CONFIRMAR Y GUARDAR EN WEB", variant="primary")
        btn_send.click(enviar_a_web, [v_id, miembro, resp, est_nom, e_pi, e_li, e_pv, e_lv, e_orig], gr.Textbox(label="Estado"))

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
