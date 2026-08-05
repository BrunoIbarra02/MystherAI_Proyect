# QA Report — rodrigo/supabase-migration

Fecha: 2026-08-05
Entorno: local (backend `manage.py runserver`, frontend `npm run dev`, Gradio `python app.py`), base de datos SQLite aislada (`backend/db_qa_local.sqlite3`), **nunca contra el Postgres/Supabase real**.
Metodología: pruebas reales (peticiones HTTP, base de datos, logs), no solo lectura de código. Cuando la topología 100% local invalidaba una prueba (ver nota sobre `REMOTE_ADDR`), se repitió con `rest_framework.test.APIClient` forzando una IP externa simulada.

## 1. Entorno

| Componente | Estado |
|---|---|
| Backend (`manage.py runserver`, puerto 8000) | Operativo, `manage.py check` sin issues |
| Frontend (`npm run dev`, puerto 5173/5174) | Operativo, proxy `/api` → `127.0.0.1:8000` |
| Gradio (`python app.py`, puerto 7860) | Operativo, pipeline 01→05 funcional |
| Base de datos QA | SQLite aislado, 22 migraciones aplicadas (incluida `0021`), 0 pendientes |
| Dependencias del venv | Reinstaladas (faltaba `dj_database_url` y otras; `backports.zstd` excluida por incompatibilidad con Python 3.14; `psycopg2-binary` actualizado a 2.9.12 por la misma razón) |

**Problema de entorno preexistente resuelto**: el `runserver` local se conectaba por defecto al Postgres/Supabase real (vía `DATABASE_URL` en el `.env` raíz). Se fuerza `DATABASE_URL` a SQLite explícitamente en cada comando de esta sesión para garantizar aislamiento total de los datos reales del equipo.

## 2. Datos — Fase 2 (validación de base de datos)

Se cargaron los datos reales del censo y registro **ya presentes y trackeados en el repositorio** (`backend/censo.csv`, `backend/registro.csv`) vía `python manage.py sync_sheets`, sobre la base de datos QA aislada. Registro también se sincronizó en vivo desde la hoja de Google Sheets pública (acceso de red disponible en este entorno).

```
Registro sincronizado desde Sheets: 246 filas (806 incompletas omitidas de 1053 totales)
Censo sincronizado: 406 filas
Sincronizacion sin errores.
```

### Hallazgo — IDs duplicados en `censo.csv` (dato real, no del código)

`censo.csv` tiene **406 filas pero solo 392 valores únicos de `ID DE VIDEO EQUIPO`**. Un solo ID (`192`) aparece **15 veces**, correspondiendo a 15 vídeos genuinamente distintos (enlaces de Drive distintos, mapas distintos: Venecia, Ciudad, Oficina, Chabolas — todos de `usuario=MATEO`, ex-empleado).

Como `sync_sheets` hace `update_or_create` por `id_video_equipo`, cada fila nueva con el mismo ID **sobrescribe la anterior** — de las 15, solo sobrevive la última (fila 207, mapa=Chabolas). **14 vídeos reales del censo son invisibles para la aplicación** tal como está la fuente hoy.

- No es un bug de esta rama ni de `sync_sheets.py` (no tocado por los 8 commits).
- Es un error de origen en la hoja/CSV (probablemente una fila copiada sin actualizar el ID).
- Baja urgencia práctica inmediata (los 15 vídeos son de un ex-empleado, ya fuera de `EQUIPO_ACTUAL`), pero debe corregirse en la fuente antes de que se pierdan datos de un vídeo de un miembro activo por el mismo motivo.
- **Acción recomendada**: Bruno o quien mantenga la hoja debe renumerar esas 14 filas con IDs únicos y volver a sincronizar.

### Hallazgo — fila sin enlace de vídeo

`id_video_equipo=2` (usuario MATEO, mapa "Castillo") tiene la columna `LINK` vacía (un espacio en blanco) en el CSV real. El registro se crea igualmente (`drive_link=''`), visible en el catálogo pero sin vídeo reproducible. Mismo origen: dato incompleto en la fuente, no un bug de código.

### Totales finales en la base QA tras el sync

- **397 registros `tipo=censo`** (392 reales del CSV + 5 registros sintéticos de pruebas de sesiones anteriores, sin `id_video_equipo`, fácilmente identificables y no confundibles con datos reales).
- **≈205 registros `tipo=registro`** (246 sincronizados desde Sheets + entradas de prueba).
- **0 duplicados reales** por `video_id` en `tipo=registro`.
- **0 FKs `reservado_por_user` huérfanas** (ninguna apunta a un usuario inexistente).

## 3. Roles y permisos — Fase 3

### Administrador (cuenta real de Rodrigo)

`is_staff=True`, `is_superuser=True` confirmado en base de datos.

| Capacidad | Resultado |
|---|---|
| Aprobar un registro | ✅ `POST /videos/<pk>/aprobar/` → 200 |
| Repartir censo | ✅ `POST /asignar-censo/` → 200, reparto correcto entre el equipo |
| Acceder al panel `/admin/` de Django | ✅ 200 |
| Editar/borrar cualquier registro (no solo el propio) | ✅ 200, confirmado explícitamente |
| Ninguna opción administrativa relevante faltó en las pruebas | — |

### Estilizador (cuenta de prueba **completamente nueva**, creada para esta auditoría)

`qa-estilizador-test@mystherai.local` — `is_staff=False`, `is_superuser=False`, sin ningún privilegio especial otorgado manualmente. Representa exactamente a un miembro nuevo del equipo.

| Prueba | Resultado |
|---|---|
| Login | ✅ 200 |
| Reservar un vídeo real del censo | ✅ 200, `reservado_por` y `reservado_por_user` correctos |
| Liberar su propia reserva | ✅ 200 |
| Editar su propia entrada de Registro | ✅ 200 |
| Ver la Biblioteca compartida (lectura de registros ajenos) | ✅ 200 — intencional, es una galería de equipo |
| **Editar el registro de otro miembro (Wilson)** | 🔴 **200 la primera vez — fuga de permisos real y explotada, ver §4** |
| Aprobar un registro | ✅ bloqueado, 403 |
| Denegar un registro | ✅ bloqueado, 403 |
| Repartir censo (`asignar-censo`) | ✅ bloqueado, 403 |
| Acceder a `/admin/` de Django | ✅ bloqueado, redirect 302 a login |

**Nota metodológica importante**: las primeras pruebas de "editar/borrar ajeno" hechas vía navegador (a través del proxy de Vite) dieron un falso negativo — Django ve toda petición proxiada como originada en `127.0.0.1`, que coincide con la excepción de "servicio interno" pensada para Gradio, y por tanto **bypassea cualquier permiso que dependa de esa excepción**, incluida la corrección aplicada. La prueba concluyente se hizo con `APIClient` de Django forzando `REMOTE_ADDR` a una IP externa simulada (`203.0.113.50`), que sí ejercita el permiso real. Cualquier prueba de permisos futura en este entorno debe tener esto en cuenta.

## 4. Fuga de permisos encontrada y corregida

**Antes de esta sesión**: `VideoDetailView` (`PUT`/`PATCH`/`DELETE` en `/api/sheets/videos/<pk>/`) usaba `PuedeEscribirVideos`, que solo exige sesión iniciada — **sin ningún chequeo de propiedad**. Se demostró en vivo: la cuenta de prueba (no-staff, recién creada) modificó con éxito (`HTTP 200`) el `prompt_video` de un registro real de **Wilson**, ya en estado `Aprobado`.

El frontend (`VideoGalleryLayout.jsx:41`) ya asumía la regla correcta — `canEditVideo = isAdmin || (tipo === 'registro' && v.usuario === user.display_name)` — pero solo ocultaba los botones; la API nunca la aplicaba, así que era trivialmente evitable con una petición directa.

**Fix aplicado** (commit `4b438b1`): nueva clase `PuedeEscribirSuPropioRegistro`, usada en `VideoDetailView`, que exige propiedad para escritura sobre filas `tipo='registro'` (mismo criterio que el frontend), mantiene la lectura compartida (Biblioteca) y conserva sin cambios las excepciones de staff y del servicio interno de Gradio.

Verificado con 4 escenarios vía `APIClient` + `REMOTE_ADDR` externo:
1. Dueño edita lo suyo → 200
2. Staff edita cualquiera → 200
3. Lectura de un registro ajeno → 200 (comportamiento correcto, no es un fallo)
4. Servicio interno de Gradio (localhost real) escribe sin sesión → 200 (sin regresión en el guardado automático)

## 5. Recorrido de producto completo (rol estilizador)

Validado de punta a punta en sesión anterior con evidencia de navegador real (network requests, DOM, logs de servidor):

1. Abrir frontend → login → catálogo carga con datos reales.
2. Seleccionar y reservar un vídeo de censo → `reservado_por`/`reservado_por_user` correctos.
3. Botón "Abrir en Gradio" → navega correctamente pasando `video_id`, `usuario`, `video_url` exactos.
4. Carga y análisis de un **vídeo real de Google Drive** (URL proporcionada por el usuario) → 174 fotogramas detectados correctamente.
5. Pantalla de metadatos (patch `d22fa4c`) → bloquea sin Mapa/Especie, guarda correctamente al completarlos.
6. El registro aparece en `/registro` y en el panel de aprobación de admin.
7. Aprobación desde la cuenta de Rodrigo → 200.

**Único punto no ejercitable de extremo a extremo**: generación real de imagen/vídeo (pasos 03/04 de Gradio) — bloqueada por la API key de Wavespeed, ver `TECHNICAL_REPORT.md` para la evidencia técnica completa de por qué esto no es un problema de conexión del código.

## 6. Resumen de hallazgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Editar/borrar registro ajeno sin restricción | 🔴 Alta | **Corregido** (`4b438b1`) |
| 2 | 15 filas con `ID DE VIDEO EQUIPO=192` duplicado en `censo.csv` (14 vídeos reales invisibles) | 🟡 Media | Documentado, requiere corrección en la fuente por Bruno/equipo |
| 3 | 1 fila de censo sin `LINK` (vídeo sin reproducir) | 🟢 Baja | Documentado, dato de origen incompleto |
| 4 | Wavespeed API key rechazada (401) | 🔴 Alta | Bloqueo externo — Bruno |
| 5 | `GOOGLE_SHEETS_CREDENTIALS_PATH`/`GOOGLE_DRIVE_FOLDER_ID` declaradas pero sin uso en el código | 🟢 Baja | Configuración muerta, candidata a limpieza |
| 6 | Migración `users/0002_add_avatar` con SQL específico de Postgres, rompe en SQLite | 🟡 Media | Documentado, preexistente |
