# MystherAI

Herramienta interna para transformar los videos del Censo en versiones estilizadas (anime, cartoon, cyberpunk, etc.) usando WaveSpeed, con flujo de reserva/revisión de trabajo en equipo.

## Arquitectura

Monorepo con 3 partes, empaquetadas en **un solo contenedor Docker**:

```
WEB/
  backend/          Django (API REST, login, modelos, admin)
  frontend/         React + Vite (dashboard, censo, registro, estadísticas)
  gradio-service/    Gradio (pipeline de estilizado con WaveSpeed)
```

En producción, un único contenedor ECS corre **dos procesos**:
- `gunicorn` sirviendo Django (API + el build de React como estáticos) en el puerto `8080`
- `gradio-service/app.py` corriendo Gradio en el puerto `7860`

Ver `Dockerfile` — el build compila el frontend, copia backend + gradio-service, y el `CMD` arranca ambos procesos con `&`.

## Flujo de trabajo (producto)

1. **Censo**: catálogo de videos originales disponibles para estilizar (`estado_censo`: Disponible / Reservado / Estilizado).
2. Un miembro del equipo **reserva** un video del censo (o el admin reparte el censo restante entre el equipo desde `/profile` → "Reservas Equipo" → **Repartir censo**).
3. El miembro abre el video reservado en **Gradio** (botón "Abrir en Gradio" — pasa `video_url`, `usuario` y `video_id` por query params).
4. Pipeline en Gradio (`gradio-service/app.py`), 4 pasos:
   - **01 CARGAR** — sube o pega la URL del video, analiza frames, captura un fotograma.
   - **02 EDITAR** (opcional) — recorta el segmento a usar.
   - **03 IMAGEN** — estiliza el fotograma con un modelo I2I (Nano Banana, Hunyuan). El prompt de estilo elegido aquí se usa también en el paso 04.
   - **04 V2V** — genera el video estilizado (WAN 2.1 480p rápido, o Kling O3 Pro alta calidad) y lo guarda en el **Registro** con un solo botón (usa automáticamente el `video_id`, estilo y prompts del pipeline).
5. El registro queda **Pendiente** de revisión. El admin lo aprueba o deniega desde `/profile` → "Estilizados Equipo", donde ve el video original y el estilizado lado a lado.
   - Si se deniega el trabajo de un ex-empleado (ver `FORMER_EMPLOYEES` en `backend/apps/sheets/views.py`), el registro se borra automáticamente y el video de censo vuelve a estar Disponible.

## Desarrollo local

**Backend:**
```powershell
cd backend
python -m venv venv
..\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py setup_users     # crea las cuentas del equipo (ver ACCOUNTS en el comando)
python manage.py runserver       # http://127.0.0.1:8000
```

**Frontend:**
```powershell
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

**Gradio:**
```powershell
cd gradio-service
pip install -r requirements.txt
python app.py                    # http://127.0.0.1:7860
```

Variables de entorno: copiar `.env.template` a `.env` y rellenar los valores reales (nunca commitear `.env`, ya está en `.gitignore`).

## Seguridad — API Key de WaveSpeed

**Regla estricta, no negociable:**
- La API key de WaveSpeed **solo** existe como variable de entorno en ECS (`WAVESPEED_API_KEY`). Nunca se hardcodea en código, nunca se commitea.
- `gradio-service/app.py` la lee así: `DEFAULT_KEY = os.environ.get("WAVESPEED_API_KEY", "")`.
- La key **nunca** se expone al frontend/navegador — todas las llamadas a WaveSpeed ocurren server-side en Gradio.
- Si alguna vez ves una key hardcodeada en un `.py`, es un bug de seguridad — repórtalo y quítala inmediatamente.

## Despliegue (ECS)

**Regla crítica**: nunca usar el tag `:latest` + `--force-new-deployment` para desplegar. ECS puede reutilizar la imagen en caché y los cambios no se reflejan en producción.

Flujo correcto:
```powershell
$TAG = (git rev-parse --short HEAD)
docker build -t mysther-ai .
docker tag mysther-ai:latest 806116532041.dkr.ecr.eu-central-1.amazonaws.com/mysther-ai:$TAG
docker push 806116532041.dkr.ecr.eu-central-1.amazonaws.com/mysther-ai:$TAG
# Luego: registrar nueva task definition con esa imagen + update-service (ver historial de despliegues)
```

Siempre un **tag único** (hash de git) + **nueva revisión de task definition**. Esto garantiza que ECS descargue la imagen nueva.

## Equipo y roles

- **Admin (staff)**: aprueba/deniega registros, reparte el censo, gestiona cuentas — actualmente Bruno.
- **Miembros del equipo**: reservan videos del censo, los estilizan en Gradio, ven su propio historial en "Estilizados". Solo pueden editar/borrar sus propias entradas de registro (no las de otros).
- Cuentas de ex-empleados se desactivan (`is_active=False`) en `backend/apps/authentication/management/commands/setup_users.py`, no se borran — así se conserva el histórico de su trabajo.

## Problemas conocidos / en validación

- **Miniaturas rotas en registros antiguos**: algunos registros muestran el video/imagen en blanco. Hipótesis: las URLs de salida de WaveSpeed (CloudFront) pueden ser temporales y expirar — no hay re-subida a almacenamiento permanente (S3/Drive) al momento de guardar. Usar el filtro **"⚠ SIN VIDEO"** en "Estilizados Equipo" (`/profile`) para ubicar estos registros.
- Ver Issues del repositorio para el resto de tareas activas.

## Stack

- Backend: Django 4.2, Python 3.12
- Frontend: React + Vite
- Gradio: pipeline de estilizado (WaveSpeed API)
- Infra: Docker, AWS ECR + ECS (`eu-central-1`), cluster `mysther-ai-cluster`
