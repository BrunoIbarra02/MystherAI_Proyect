import os
import dj_database_url
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-key")
# Por defecto False: con DEBUG=True en producción se publican trazas completas y
# Django acumula todas las queries en memoria (el contenedor acaba reiniciándose).
DEBUG = os.getenv("DEBUG", "False") == "True"
ALLOWED_HOSTS = ["*"]

# Issue 21: si en producción (DEBUG=False) no hay SECRET_KEY en el entorno,
# Django arranca igual con la clave insegura de arriba — que es pública,
# está en este mismo archivo en GitHub. Con ella cualquiera puede falsificar
# sesiones y tokens firmados. No se hace fallar el arranque aquí: si la
# variable no está puesta hoy en el entorno real y nadie lo sabe, un fallo
# duro tumbaría el servicio sin aviso. En su lugar, esto deja un aviso
# imposible de no ver en los logs de despliegue (Cloud Logging), para
# corregirlo a propósito. Una vez confirmado que SECRET_KEY siempre está
# puesta en producción, cambiar esto por un `raise ImproperlyConfigured`.
if not DEBUG and SECRET_KEY == "django-insecure-key":
    import logging
    logging.getLogger("django").critical(
        "SECRET_KEY no está configurada como variable de entorno — usando la "
        "clave insegura por defecto, pública en el repositorio. Configúrala "
        "en el entorno de producción cuanto antes (Issue 21)."
    )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.authentication",
    "apps.users",
    "apps.sheets",
    "apps.gradio_integration",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "static_root"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: Supabase PostgreSQL in production, SQLite for local dev
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

LANGUAGE_CODE = "es-es"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
WHITENOISE_ROOT = BASE_DIR / "static_root"

AUTH_USER_MODEL = "users.User"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ========== CORS ==========
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://127.0.0.1",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^https://.*\.amazonaws\.com$",
    r"^https://.*\.awsapprunner\.com$",
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "https://*.vercel.app",
    "https://*.amazonaws.com",
    "https://*.awsapprunner.com",
    "https://*.mystherai.com",
    "http://*.mystherai.com",
    # El comodín *.mystherai.com NO cubre el dominio raíz en Django: sin estas dos
    # entradas, toda petición mutante desde mystherai.com se rechazaba por origen.
    "https://mystherai.com",
    "http://mystherai.com",
]

CORS_ALLOWED_ORIGINS += [
    "https://gradio.mystherai.com",
    "https://mystherai.com",
    "https://www.mystherai.com",
]

# --- DESARROLLO LOCAL POR HTTP (opt-in, no cambia el comportamiento por defecto) ---
# En HTTP plano (localhost sin TLS) el navegador descarta cookies Secure/SameSite=None.
# Ademas, el proxy de Vite (changeOrigin: true) reescribe el Host hacia 127.0.0.1:8000,
# asi que el Origin real del navegador (http://localhost:5173) nunca coincide con el
# origen que Django calcula para si mismo -> todo POST autenticado da 403 CSRF salvo
# que el origen local este en CSRF_TRUSTED_ORIGINS. Sin QA_LOCAL_HTTP=1 el comportamiento
# es exactamente el mismo que antes (produccion no se ve afectada).
_QA_LOCAL_HTTP = os.getenv("QA_LOCAL_HTTP") == "1"
SESSION_COOKIE_SAMESITE = "Lax" if _QA_LOCAL_HTTP else "None"
SESSION_COOKIE_SECURE = not _QA_LOCAL_HTTP
CSRF_COOKIE_SAMESITE = "Lax" if _QA_LOCAL_HTTP else "None"
CSRF_COOKIE_SECURE = not _QA_LOCAL_HTTP
if _QA_LOCAL_HTTP:
    CSRF_TRUSTED_ORIGINS += [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:8000", "http://127.0.0.1:8000",
    ]
# --- FIN AJUSTE TEMPORAL ---

# Issue 14: detrás de un proxy (Cloud Run, ALB, nginx) Django no sabe por sí
# solo que la conexión real del navegador es HTTPS — solo ve la conexión
# interna proxy->contenedor, que suele ser HTTP simple. Sin este header,
# request.is_secure() da False, y con SESSION_COOKIE_SECURE / CSRF_COOKIE_SECURE
# en True el navegador ni siquiera reenvía esas cookies porque él sí sabe que
# está en HTTPS. Resultado: la sesión "se pierde" de forma intermitente según
# qué instancia/ruta atienda la petición — exactamente el síntoma del Issue.
# El proxy de Cloud Run añade X-Forwarded-Proto de forma fiable (no lo puede
# falsear un cliente externo, lo sobrescribe el propio proxy de borde).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

AUTHENTICATION_BACKENDS = [
    "apps.authentication.backends.EmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ========== REST FRAMEWORK ==========
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}
