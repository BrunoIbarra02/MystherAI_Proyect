# Guía del jefe de equipo — para Rodrigo

Manual práctico para gestionar al equipo de estilizado (Fabio, Wilson, Katty, Olenka) en el día a día, una vez esta rama esté publicada.

## Cómo organizar al equipo

- El equipo activo (`EQUIPO_ACTUAL`) está definido en `backend/apps/sheets/views.py`. Si alguien entra o sale del equipo, pide que se actualice ahí — no es algo que cambie solo.
- Tú eres admin y también estilizas — tus reservas no se liberan automáticamente como las de un admin que no produce (Bruno).

## Cómo repartir el trabajo

Sigue `TEAM_OPERATIONS.md` §Organización semanal: cada persona te comunica sus horas disponibles, tú las introduces en la plantilla, y el reparto proporcional sale solo. El reparto real en la aplicación se hace desde tu panel de admin con el botón **"Repartir censo"** (round-robin automático entre el equipo activo); ajusta manualmente reservando/liberando si el reparto automático no refleja bien la disponibilidad real de esa semana.

## Cómo revisar las entregas

1. Panel de admin → pestaña **Pendientes**.
2. Compara el vídeo original y el estilizado lado a lado.
3. Repasa el checklist de control de calidad de `TEAM_OPERATIONS.md` desde tu lado: vídeo correcto, mapa/especie correctos, estilo acorde, metadatos completos.

## Cómo aprobar o devolver trabajos

- **Aprobar** cuando el resultado cumple el checklist de calidad.
- **Devolver (denegar) con un comentario claro** cuando no lo cumple — di exactamente qué falta o qué está mal, no solo "rechazado". La persona necesita saber qué corregir.
- No dejes trabajos pendientes de revisión más de 1-2 días — el estilizador queda bloqueado esperando feedback antes de poder tomar el siguiente vídeo con tranquilidad.

## Cómo gestionar incidencias

### Incidencias funcionales (problemas de uso de la plataforma)

Ejemplos: login, reservas, Gradio, guardado, registros.

**Protocolo**: el equipo te las comunica directamente a ti (nunca a Bruno primero). Tú:
1. Confirmas si es un problema puntual (reintenta, revisa que no sea un error de uso) o repetido.
2. Si es repetido o afecta a varias personas, documéntalo: qué falla, con qué vídeo/usuario, desde cuándo.
3. Decide si es algo que puedes resolver tú directamente (p. ej. liberar una reserva atascada) o si necesita revisión técnica.

### Incidencias técnicas (problemas de infraestructura)

Ejemplos: Wavespeed, Supabase, Cloud Run, Vercel, despliegues.

**Protocolo**: estas se escalan a Bruno, pero **solo después de que tú las documentes** — no reenvíes el reporte crudo del equipo. Documenta: qué exactamente falla, desde cuándo, a cuántas personas afecta, y qué ya intentaste. Esto evita que Bruno reciba ruido y le permite actuar directamente.

## Cómo reorganizar reservas cuando alguien no esté disponible

- Si alguien te avisa a mitad de semana que no va a poder completar su carga: pídele que libere sus reservas pendientes (o libéralas tú desde el admin si no puede).
- Recalcula el reparto proporcional del resto del equipo con las horas actualizadas — mismo cálculo de `TEAM_OPERATIONS.md`, no una cifra nueva inventada.
- Si es una ausencia larga (vacaciones, baja), ajusta su disponibilidad a 0 esa semana en la plantilla — el sistema no necesita ningún otro cambio.

## Cómo planificar la semana según los horarios recibidos

1. Recoge las horas disponibles de cada persona (por el canal que uséis habitualmente).
2. Rellena la tabla de `TEAM_OPERATIONS.md` §Organización semanal.
3. Calcula el % de cada persona sobre el total.
4. Comunica el reparto orientativo antes de que empiece la semana, no a mitad.

## Cómo comunicar cambios al equipo

- Cambios que afecten su flujo de trabajo (como los campos obligatorios de Mapa/Especie de esta rama): avisa antes de que lo encuentren solos, un mensaje corto basta.
- Cambios de reparto o disponibilidad: comunícalos individualmente, no solo en un canal general que alguien pueda no ver a tiempo.

## Cómo mantener el seguimiento del progreso

- Revisión diaria rápida de la pestaña Pendientes y de vídeos reservados hace más de 2-3 días sin avanzar.
- Revisión semanal de si el reparto proporcional se cumplió razonablemente, para ajustar la comunicación (no el sistema) la semana siguiente.

## Planificación futura — incorporar nuevos estilizadores

El sistema está preparado para añadir gente sin tocar el flujo de trabajo:

1. La cuenta se crea como usuario normal (`is_staff=False`) — nunca con privilegios de administrador salvo decisión explícita.
2. Se añade su nombre a `EQUIPO_ACTUAL` en el código para que entre en el reparto automático de "Repartir censo".
3. Se le entrega `TEAM_OPERATIONS.md` — no necesita nada más para empezar a trabajar.
4. En la siguiente planificación semanal, simplemente se añade su fila a la tabla de horas — el cálculo proporcional ya la incluye automáticamente, sin rediseñar nada.

No hay límite de equipo definido por el sistema — el reparto proporcional funciona igual con 4 personas que con más.
