# MystherAI / Hechicer.ia – WaveSpeed Tool

Proyecto interno de Hechicer.ia para una herramienta de texturizado y edición de video basada en WaveSpeed, con:

- Backend seguro en Django (login, API).
- Interfaz web en React + Vite.
- Herramienta visual en Gradio (5 pestañas de workflow, similar al Colab original).
- Soporte para manejo de API Key de WaveSpeed y acceso rápido a Google Sheets (Censo, Registro).

--------------------------------------------------
1. Arquitectura

Repositorio monorepo con 3 partes principales:

hechicer-web/
  backend/         -> Django (API, login, validación de API keys, etc.)
  frontend/        -> React + Vite (login, dashboard, integración con herramienta)
  gradio-service/  -> Gradio + WaveSpeed (herramienta de texturizado/edición)

--------------------------------------------------
2. Backend (Django)

Versiones:
- Django 4.2.11
- Python 3.11

Funciones principales:
- Autenticación de usuarios con POST /api/auth/login/
- Validación de formato de API key de WaveSpeed con POST /api/tool/validate-key/
- Preparado para:
  - apps/users               (modelo de usuario extendido, campo api_key_wavespeed)
  - apps/sheets              (Google Sheets)
  - apps/gradio_integration  (conexión con lógica de IA)

Estructura general:

backend/
  apps/
    authentication/
    users/
    sheets/
    gradio_integration/
  config/
    settings.py
    urls.py
  manage.py

Arranque local (ejemplo en PowerShell):

cd backend
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
python -m venv venv
..\venv\Scripts\Activate.ps1
pip install -r requirements.txt


python manage.py migrate
python manage.py createsuperuser

python manage.py runserver
# Servidor: http://127.0.0.1:8000

--------------------------------------------------
3. Frontend (React + Vite)

Interfaz de usuario:

- Login profesional:
  - Usa POST /api/auth/login/ contra Django.
  - Muestra error si las credenciales no son válidas.

- Dashboard:
  - Tarjetas principales:
    - Censo         -> abre Google Sheet de Censo en pestaña nueva.
    - Registro Mateo-> abre Google Sheet de Registro en pestaña nueva.
    - Herramienta   -> navega a la pantalla de la herramienta IA.

- Pantalla Herramienta:
  - Muestra un modal que pide API key de WaveSpeed al usuario.
  - Llama a /api/tool/validate-key/ para validar el formato de la API key.
  - Si la validación pasa, se muestra un iframe que embebe el servicio de Gradio (http://localhost:7860).

Arranque local:

cd frontend
python -m venv venv
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
..\venv\Scripts\Activate.ps1
rm -r -force node_modules, package-lock.json
npm config set strict-ssl false
npm install      (solo la primera vez)
npm run dev      (servidor en http://localhost:5173)

--------------------------------------------------
4. Gradio Service (WaveSpeed Tool)

Servicio independiente con Gradio. Reproduce el workflow del Colab original:

Pestañas principales:

1) Selector de Frames:
   - Cargar un video por ruta local.
   - Analizar total de frames.
   - Ver frames con un slider.
   - Capturar frames como imágenes y guardarlas en outputs/01_CAPTURAS/.

2) Estilo de Imagen (z-image/turbo):
   - Tomar una imagen (ruta local o salida del selector).
   - Aplicar un prompt de estilo (lego, ghibli, cinematic, etc.).
   - Slider de Imaginación (bajo = más fiel, alto = más creativo).
   - Guardar imágenes estilizadas en outputs/02_ESTILIZADOS/.

3) Video-to-Video (WAN 2.1 v2v-720p):
   - Cargar video base (ruta local).
   - Prompt de transformación.
   - Duración del video y nivel de imaginación.
   - Imágenes de referencia opcionales.
   - Guardar videos transformados en outputs/04_TRANSFORMACIONES/.

4) Kling v3.0 (image-to-video):
   - Imagen original (ruta local o URL).
   - Prompt de movimiento.
   - Duración del video y referencias opcionales.
   - Guardar videos finales en outputs/03_VIDEOS_FINALES/.

5) Cortar / Unir Video:
   - Cortar segmentos de video con ffmpeg.
   - Unir hasta 3 videos en uno solo.
   - Guardar resultados en outputs/03_VIDEOS_FINALES/.

API key de WaveSpeed:

- El servicio Gradio usa una API key de empresa leída desde gradio-service/.env:

  WAVESPEED_API_KEY=TU_API_KEY_REAL_AQUI

- En app.py se crea el cliente wavespeed.Client(api_key=MY_KEY) y se usan los modelos:
  - wavespeed-ai/z-image/turbo
  - wavespeed-ai/wan-2.1/v2v-720p
  - kwaivgi/kling-v3.0-std/image-to-video

Arranque local:

cd gradio-service
python app.py   (servidor Gradio en http://127.0.0.1:7860)

El frontend embebe este servicio dentro de la ruta /herramienta.

--------------------------------------------------
5. Flujo de uso (local)

1) Backend (Django):

   cd backend
   ..\venv\Scripts\Activate.ps1
   python manage.py runserver
   # http://127.0.0.1:8000

2) Frontend (React):

   cd frontend
   ..\venv\Scripts\Activate.ps1   (opcional)
   npm run dev                   # http://localhost:5173

3) Gradio / Herramienta:

   cd gradio-service
   ..\venv\Scripts\Activate.ps1   (opcional)
   python app.py                 # http://127.0.0.1:7860

4) En el navegador:
   - Ir a http://localhost:5173
   - Login (por ejemplo: admin / admin123).
   - Usar Dashboard:
     - Censo / Registro -> abren Google Sheets específicas.
     - Herramienta -> pide API key de WaveSpeed, valida formato y abre Gradio.

--------------------------------------------------
6. Outputs locales

Los resultados de la herramienta se guardan en:

gradio-service/outputs/
  01_CAPTURAS/         -> Frames capturados
  02_ESTILIZADOS/      -> Imágenes estilizadas
  03_VIDEOS_FINALES/   -> Videos finales, cortes, uniones, kling
  04_TRANSFORMACIONES/ -> Videos transformados (v2v)
  temp/                -> Archivos temporales

En producción, estos outputs pueden migrarse a:
- Google Cloud Storage (recomendado), o
- Google Drive (vía API), según la arquitectura final.

--------------------------------------------------
7. Roadmap

Fase 2 – API key por usuario (real):
- Django debe usar user.api_key_wavespeed para crear wavespeed.Client(...) por usuario.
- Mover los cl.run(...) al backend y exponer endpoints REST para el frontend.

Fase 3 – Despliegue en la nube:
- Dockerizar backend y gradio-service.
- Subir imágenes a Google Artifact Registry.
- Desplegar en Cloud Run.
- Configurar subdominio (por ejemplo tool.hechicer.ia) y HTTPS automático.

Fase 4 – Integración Sheets:
- apps/sheets conectado a Censo y Registro Mateo:
  - Lectura de filas.
  - Escritura/actualización desde la web.

--------------------------------------------------
8. Requisitos

- Python 3.11
- Node.js 18+
- Git
- ffmpeg instalado y disponible en el PATH del sistema
- Cuenta y API key de WaveSpeed
