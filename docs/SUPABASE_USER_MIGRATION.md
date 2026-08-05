# Migración de usuarios desde la Supabase antigua

**Estado: PENDIENTE.** Bruno no tiene acceso actualmente a la instancia de Supabase antigua que contiene los usuarios legacy. Este documento deja el procedimiento completamente preparado para ejecutar en cuanto ese acceso se recupere y se entregue el export — no se ha ejecutado ni se inventó ningún dato.

## Qué se comprobó (sobre datos de prueba obviamente ficticios, en la base de QA aislada, nunca sobre datos reales)

- `python manage.py import_legacy_users --csv archivo.csv --dry-run` funciona sin errores.
- La primera ejecución real crea las cuentas correctamente, con `set_unusable_password()` — nunca se asigna ni inventa una contraseña.
- **Idempotencia confirmada**: repetir la importación con el mismo CSV no duplica usuarios. Segunda ejecución: `Creados: 0, ya existían: N`. Confirmado también por conteo directo en base de datos (exactamente 1 usuario por email tras dos ejecuciones).
- Insensible a mayúsculas en el email (`USUARIO@X.COM` se reconoce como el mismo usuario que `usuario@x.com`).
- Filas sin email se descartan como inválidas sin interrumpir el resto del CSV.

## Estructura de datos que espera el comando

| Columna | Obligatoria | Notas |
|---|---|---|
| `email` | **Sí** | Se usa como `username`. Fila sin email → descartada, no rompe el resto del CSV. |
| `first_name` | No | Si falta, la cuenta se crea con nombre vacío — pero `resolve_by_display_name` (usado por reservas y el FK `reservado_por_user`) no podrá emparejar esa cuenta con texto histórico si no tiene nombre. |

**Ninguna otra columna es reconocida hoy por el comando** — no importa avatar, contraseña, rol ni permisos. No es un bug: el propio comando documenta que es intencional ("no inventa datos").

## Cómo se relacionan estos usuarios con el resto del sistema

- **Contraseña**: se crean sin contraseña utilizable. Cada persona necesita el flujo de "olvidé mi contraseña" (si existe en producción) o que un admin se la asigne manualmente. **Confirmar con Bruno si ese flujo existe** antes de ejecutar en real.
- **Equipo activo**: no se añaden automáticamente a `EQUIPO_ACTUAL` (lista en `backend/apps/sheets/views.py`) — no aparecerán en "Repartir censo" hasta que alguien los añada ahí a mano.
- **Permisos de administrador**: el comando nunca asigna `is_staff` — todas las cuentas importadas son miembros normales, sin importar lo que diga el CSV (esas columnas ni siquiera se leen).
- **Reservas históricas**: para vincular el texto libre histórico (`reservado_por`) a la FK real (`reservado_por_user`), hay que correr después `backfill_reservado_por_user`, que empareja por `first_name` exacto o por el prefijo del email. Si no hay coincidencia, queda reportado — no falla en silencio.
- **Avatares**: no se importan — cada persona (o un admin en su nombre) los sube después del primer login, vía el perfil.

## Información exacta que debe proporcionar Bruno

Bloqueado hasta recibir:

1. **Acceso restablecido** a la instancia de Supabase antigua (hoy no puede entrar — sin esto no hay ni siquiera un export que generar).
2. **Export real** de la tabla de usuarios, en CSV con cabecera `email,first_name` (o indicar los nombres reales de las columnas si difieren, para ajustar el comando antes de usarlo).
3. Confirmación de si existe un flujo de "olvidé mi contraseña" en producción, o si él mismo asignará contraseñas manualmente desde el admin tras la importación.
4. Lista de qué nombres del export deben entrar también en `EQUIPO_ACTUAL` (decisión manual, no automática).
5. Confirmación de si alguno de esos usuarios debe tener `is_staff` — requiere un paso manual aparte, el comando no lo asigna.

## Instrucciones de ejecución (cuando Bruno entregue el export)

1. Backup de la base de datos de producción antes de cualquier escritura.
2. `python manage.py import_legacy_users --csv export_bruno.csv --dry-run` — revisar el reporte línea por línea con Bruno antes de continuar.
3. `python manage.py import_legacy_users --csv export_bruno.csv` — ejecución real.
4. `python manage.py backfill_reservado_por_user --dry-run`, seguido de la versión real, para vincular reservas históricas a las cuentas nuevas.
5. Añadir manualmente a `EQUIPO_ACTUAL` los nombres que Bruno confirme como equipo activo.
6. Notificar a cada persona importada para que recupere su contraseña o reciba una del admin.

## Validaciones posteriores

- Contar usuarios creados vs. filas del CSV vs. filas inválidas reportadas — deben cuadrar exactamente.
- Revisar el reporte de `backfill_reservado_por_user`: cuántas filas quedaron "sin match" — indica nombres que necesitan revisión manual.
- Pedir a 1-2 personas importadas que prueben login (tras recuperar contraseña) antes de anunciarlo a todo el equipo.

## Rollback

- El comando no es destructivo — no borra ni sobrescribe usuarios existentes (los detecta y salta). Revertir significa desactivar o borrar las cuentas creadas en esa ejecución, identificables por su rango de timestamp de creación.
- Si `backfill_reservado_por_user` asignó FKs incorrectas por coincidencias de nombre erróneas, es reversible sin tocar el texto libre original:
  ```python
  VideoMetadata.objects.filter(reservado_por_user__in=[...]).update(reservado_por_user=None)
  ```

## Plan de recuperación si la importación falla

- Si el CSV está corrupto o se corta la conexión a mitad de proceso: es seguro simplemente volver a ejecutar el comando — la idempotencia ya está probada, no se duplicará nada de lo ya creado.
- Si se importan cuentas con datos incorrectos: corregir el CSV y no volver a incluir esas filas en una nueva pasada evita duplicados; para las ya creadas mal, corregir manualmente vía el admin de Django o borrarlas y re-ejecutar solo esas filas.
