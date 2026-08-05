# Manual práctico para Rodrigo — gestión del equipo de estilizado

Este documento es para ti, no para Bruno ni para el equipo de estilizado. Es el manual de "cómo llevar esto en el día a día" una vez la rama esté publicada y el equipo empiece a trabajar.

## Cómo gestionar el equipo

- El equipo activo (`EQUIPO_ACTUAL`) hoy es Fabio, Katty, Wilson, Olenka y tú. Está definido en `backend/apps/sheets/views.py` — si alguien entra o sale del equipo, es ahí donde se actualiza (pídele a quien lleve el código que lo cambie, no es algo que tú edites directamente salvo que también toques código).
- Bruno es admin pero no estiliza — sus reservas antiguas se liberan automáticamente si quedan huérfanas.
- Tú eres admin **y** estilizas — tus reservas no se tocan automáticamente.

## Cómo repartir el trabajo

Usa `docs/TEAM_OPERATIONS.md` §Reparto semanal — es la plantilla que rellenas cada semana con las horas que cada persona te comunique. El reparto real en la aplicación se hace desde tu perfil de admin, botón **"Repartir censo"**, que reparte automáticamente en round-robin entre el equipo. Si el reparto automático (a partes iguales) no refleja bien la disponibilidad real de esa semana, ajusta manualmente reservando/liberando vídeos para acercarte a las proporciones de la plantilla.

## Qué revisar diariamente

1. Panel de admin → pestaña **Pendientes** — cuántos registros esperan tu revisión.
2. Vídeos reservados hace más de 2-3 días sin avanzar — señal de que alguien puede estar bloqueado sin decirlo.
3. Pestaña **Errores** del panel — los fallos de Gradio se registran automáticamente ahí; si ves el mismo error repetido, puede ser un problema de fondo (ej. Wavespeed) y no algo que la persona esté haciendo mal.

## Cómo aprobar trabajos

1. Abre el registro pendiente — se ve el vídeo original y el estilizado lado a lado.
2. Compara que el resultado corresponde realmente al vídeo original (a veces alguien guarda con la pestaña de Gradio equivocada abierta).
3. Revisa Mapa y Especie — son obligatorios desde esta rama, pero revisa que el *contenido* sea correcto, no solo que estén rellenos.
4. Aprobar o rechazar con un comentario claro si rechazas — la persona necesita saber qué corregir, no solo que se rechazó.

## Cómo detectar incidencias

- **Vídeo "desaparecido"**: desde esta rama, cada borrado y cada cambio de contenido de una fila de Registro queda registrado en los logs del servidor (commit `03417c5`, pensado exactamente para este problema). Si el equipo de infraestructura tiene acceso a Cloud Logging, busca `"VideoMetadata DELETE"` o `"VideoMetadata REGISTRO CONTENT CHANGE"` con el ID del vídeo afectado — apunta directo al origen.
- **Reservas fantasma**: si ves censo reservado por alguien que ya no está en el equipo, el comando `limpiar_reservas` las libera y reparte automáticamente — es seguro correrlo con `--dry-run` primero para ver qué cambiaría.
- **Vídeos que faltan en el catálogo**: revisa que no sea el mismo problema que documentamos en `docs/QA_REPORT.md` §2 (IDs duplicados en la fuente) — si un vídeo activo "no aparece nunca", puede estar colapsado bajo el mismo ID que otro.

## Qué comprobar antes de aceptar un estilizado

- El estilo aplicado corresponde a lo pedido/coordinado para ese vídeo (si estáis trabajando por mapas o temáticas específicas).
- La calidad del resultado es consistente con el resto del catálogo ya aprobado — si algo se ve claramente peor, mejor pedir que se regenere antes de aprobar que aprobarlo y tener que revisarlo después.
- Que no sea un duplicado de un vídeo ya estilizado por otra persona (puede pasar si dos personas reservan por error casi a la vez, aunque el sistema lo impide normalmente).

## Cómo organizar revisiones

- Revisar en bloques (por ejemplo, una vez al día) es más eficiente que revisar cada envío al momento — pero no dejes que se acumulen más de 1-2 días de pendientes, o el equipo empieza a esperar sin saber si va bien.
- Si tienes mucho volumen pendiente, prioriza por antigüedad de la reserva, no por orden de llegada del guardado — así evitas que alguien tenga un vídeo reservado indefinidamente esperando feedback de un envío anterior.

## Cómo preparar futuras entregas

- Antes de anunciar una nueva funcionalidad al equipo, pruébala tú primero con tu propia cuenta y, si puedes, con una cuenta de prueba no-admin — es exactamente lo que se hizo en esta rama y así se encontró el fallo de seguridad de `docs/QA_REPORT.md` §4.
- Usa `docs/DEPLOY_CHECKLIST.md` como plantilla para cualquier despliegue futuro, no solo para esta rama.
- Cuando haya cambios que afecten el flujo de trabajo del equipo (como los campos obligatorios de Mapa/Especie de esta rama), avisa antes de que lo encuentren solos — un mensaje corto explicando qué cambió es suficiente, no hace falta más.
