# 09 — Manual del administrador (referencia rápida)

Para Rodrigo. Guía completa de gestión de equipo en [`TEAM_LEAD_GUIDE.md`](./TEAM_LEAD_GUIDE.md) — este documento es el resumen de bolsillo de las acciones administrativas del sistema.

## Aprobar

Panel de admin → Pendientes → comparar original/estilizado → Aprobar si cumple calidad.

## Denegar

Mismo panel → Denegar, siempre con un comentario que explique qué corregir.

## Gestionar usuarios

Vía `/admin/` de Django (acceso solo para `is_staff=True`). Ahí se crean cuentas, se desactivan, y se ajustan permisos manualmente.

## Gestionar reservas

Desde el detalle de un vídeo puedes liberar una reserva ajena si hace falta reorganizar. El comando `limpiar_reservas --dry-run` (técnico, pídeselo a quien mantenga el código si lo necesitas) libera y reparte automáticamente las reservas de gente que ya no está en `EQUIPO_ACTUAL`.

## Gestionar censos

Botón **"Repartir censo"** en tu perfil de admin — reparte automáticamente en round-robin todo lo Disponible entre el equipo activo. Combínalo con la planificación semanal de `TEAM_OPERATIONS.md` para que la proporción real de horas se refleje, no solo un reparto igualitario.

Detalle completo de incidencias, reorganización de reservas y planificación en `TEAM_LEAD_GUIDE.md`.
