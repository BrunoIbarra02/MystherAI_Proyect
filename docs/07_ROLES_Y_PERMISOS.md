# 07 — Roles y permisos

Documentación completa de los permisos del sistema, verificados con pruebas reales (ver `01_QA_REPORT.md` para la evidencia).

## Roles existentes

| Rol | Cómo se define | Ejemplo real |
|---|---|---|
| **Administrador** | `is_staff=True` en el modelo de usuario | Bruno, Rodrigo |
| **Estilizador (miembro del equipo)** | Usuario autenticado normal, `is_staff=False` | Fabio, Wilson, Katty, Olenka |
| **Servicio interno** | No es un usuario — se identifica porque la petición llega desde `REMOTE_ADDR` local (127.0.0.1/::1/localhost) | El propio Gradio, que corre en el mismo contenedor que el backend en producción |
| **Anónimo** | Sin sesión iniciada | Nadie con acceso legítimo — el sistema no es una web pública |

## Matriz de capacidades

| Acción | Admin | Estilizador | Anónimo |
|---|:---:|:---:|:---:|
| Iniciar sesión | ✅ | ✅ | — |
| Ver el catálogo / Biblioteca compartida | ✅ | ✅ | ❌ (401/403) |
| Reservar un vídeo del censo | ✅ | ✅ | ❌ |
| Liberar su propia reserva | ✅ | ✅ | ❌ |
| Abrir Gradio y generar un estilizado | ✅ | ✅ | ❌ |
| Guardar su propio trabajo en Registro | ✅ | ✅ | ❌ |
| Editar/borrar **su propio** registro | ✅ | ✅ | ❌ |
| Editar/borrar el registro **de otro** | ✅ | ❌ (403 — fix `4b438b1`) | ❌ |
| Subir su propio avatar | ✅ | ✅ | ❌ |
| Aprobar un registro | ✅ | ❌ (403) | ❌ |
| Denegar un registro | ✅ | ❌ (403) | ❌ |
| Repartir el censo (`Repartir censo`) | ✅ | ❌ (403) | ❌ |
| Acceder al panel `/admin/` de Django | ✅ | ❌ (redirect a login) | ❌ |
| Gestionar usuarios (crear, desactivar, cambiar permisos) | ✅ (vía `/admin/`) | ❌ — no existe ningún endpoint de API para esto | ❌ |
| Ver resúmenes/estadísticas agregadas | ✅ | ✅ (no es información administrativa, es del equipo) | ❌ |

## Clases de permiso en el código (`backend/apps/sheets/views.py`)

| Clase | Qué exige | Dónde se usa |
|---|---|---|
| `PuedeEscribirVideos` | Sesión iniciada, o servicio interno | Listar/crear vídeos, catálogo |
| `PuedeEscribirSuPropioRegistro` | Sesión iniciada **y** (dueño del registro, o staff); lectura abierta a cualquier autenticado; servicio interno exento | `VideoDetailView` — editar/borrar un vídeo/registro concreto |
| `EsAdmin` | `is_staff=True` | Aprobar, denegar, repartir censo |
| `permissions.IsAuthenticated` (DRF puro) | Sesión iniciada, **sin** excepción de servicio interno | Resúmenes, opciones de filtro |

## Nota importante para futuras pruebas de permisos

En un entorno donde backend, frontend y quien prueba corren en la misma máquina (desarrollo local con `npm run dev` + `manage.py runserver` a través del proxy de Vite), **toda petición llega a Django con `REMOTE_ADDR=127.0.0.1`**, coincidiendo con la excepción de "servicio interno" pensada para Gradio. Cualquier permiso que dependa de esa excepción (`PuedeEscribirVideos` y `PuedeEscribirSuPropioRegistro`) **no se puede probar de forma fiable por navegador en local** — parecerá que todo está permitido aunque no lo esté. La forma correcta de probarlo es con `rest_framework.test.APIClient`, forzando `REMOTE_ADDR` a una IP externa simulada, o contra un despliegue real. Así se descubrió y confirmó el fix de seguridad de esta rama.
