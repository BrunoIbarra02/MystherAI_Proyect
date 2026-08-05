# Manual de operación — Equipo de estilizado

Este documento es para **Fabio, Wilson, Katty y Olenka**. No requiere conocimientos técnicos — solo el uso normal de la web y de Gradio.

## Flujo diario

1. Entra a la web con tu cuenta.
2. Ve a **Catálogo** y busca un vídeo marcado como **Disponible**.
3. Ábrelo y pulsa **Reservar para estilizar**. A partir de ese momento es tuyo — nadie más puede tomarlo mientras esté reservado a tu nombre.
4. Pulsa **Abrir en Gradio**. Se abrirá la herramienta con el vídeo ya cargado.
5. Sigue los 5 pasos de Gradio (ver abajo).
6. Cuando termines, tu trabajo queda **Pendiente** de revisión — Rodrigo (o quien esté de admin) lo aprobará o te pedirá cambios.

## Cómo reservar un vídeo

- Solo reserva un vídeo si vas a empezarlo en las próximas horas. Un vídeo reservado y sin tocar durante días bloquea a los demás.
- Si al final no vas a poder hacerlo, **libera la reserva** (botón "Liberar reserva" en el mismo panel) para que otro compañero pueda tomarlo.
- No reserves varios vídeos a la vez "por si acaso" — reserva uno, termínalo, reserva el siguiente.

## Cómo abrir Gradio

El botón **Abrir en Gradio** ya lleva incorporados el vídeo, tu nombre y el identificador correcto — no necesitas copiar ni pegar nada manualmente. Si el botón no aparece, es que el vídeo no está reservado a tu nombre.

## Cómo estilizar (los 5 pasos)

1. **01 Cargar** — el vídeo ya viene cargado desde el catálogo. Pulsa "Analizar vídeo" y elige el fotograma que mejor representa la escena.
2. **02 Editar** (opcional) — solo si necesitas recortar el segmento a usar.
3. **03 Imagen** — elige el estilo visual y el modelo de generación de imagen. Genera la imagen estilizada del fotograma elegido.
4. **04 V2V** — genera el vídeo estilizado a partir de la imagen. Este paso tarda más — no cierres la pestaña mientras genera.
5. **05 Guardar** — revisa los datos del vídeo (Mapa y Especie son obligatorios) y pulsa "Guardar y finalizar".

## Cuándo guardar

Solo pulsa "Guardar y finalizar" cuando:
- El vídeo estilizado te convence (revisa el resultado antes, no guardes "a ciegas").
- Los campos de Mapa y Especie están rellenos correctamente — la pantalla no te dejará avanzar sin ellos, pero revisa que el contenido sea correcto, no solo que esté relleno.
- Has elegido el estilo correcto para ese vídeo (revisa las indicaciones del reparto semanal si el estilo viene especificado).

## Qué revisar antes de enviar

- Que el vídeo estilizado corresponde realmente al vídeo original (a veces se abren varias pestañas de Gradio a la vez — confirma que no estás guardando el trabajo de otro vídeo).
- Que el prompt y el estilo elegido tienen sentido con lo que pediste generar.
- Que Mapa y Especie coinciden con el vídeo real, no con el último que hiciste (es fácil dejarlos sin actualizar si trabajas varios seguidos).

## Cuándo avisar a Rodrigo

- Si un vídeo lleva reservado por otra persona más de 2-3 días sin que aparezca terminado — puede estar bloqueado sin que esa persona lo sepa.
- Si Gradio da un error al generar (imagen o vídeo) que se repite más de una vez con el mismo vídeo.
- Si ves un vídeo que "desapareció" del catálogo o del registro sin que tú lo hayas movido — es exactamente el tipo de incidencia que el sistema ya está registrando internamente (ver más abajo), pero avisar ayuda a diagnosticarlo más rápido.
- Si necesitas acceso a algo que no tienes (por ejemplo, ver el trabajo de otra persona para coordinar un mapa compartido).

## Cómo reportar errores

1. Anota el **ID del vídeo** (aparece como `#NNN` en el catálogo o registro) y qué estabas haciendo exactamente.
2. Haz una captura de pantalla del error si es posible.
3. Repórtalo directamente a Rodrigo con esos dos datos — sin ellos es mucho más difícil rastrear qué pasó.
4. Si el error ocurrió guardando o generando en Gradio, el sistema ya guarda un registro interno del error automáticamente — no necesitas hacer nada más técnico, solo avisar.

## Buenas prácticas

- Un vídeo, una reserva, un estilo — no dupliques trabajo probando varios estilos "para ver cuál queda mejor" sin coordinarlo antes si el tiempo apremia.
- Revisa el resultado antes de guardar — deshacer un guardado ya aprobado es más trabajo para todos que revisar 30 segundos antes.
- Si terminas antes de lo previsto, mejor tomar el siguiente vídeo disponible que dejarlo para "luego" — reservas abandonadas ralentizan a todo el equipo.
- Comunica cambios de disponibilidad (vacaciones, menos horas esa semana) cuanto antes, para que el reparto de la semana siguiente sea realista.

---

## Reparto semanal del trabajo

El reparto **no usa cifras fijas** — se calcula proporcionalmente a las horas que cada persona tiene disponibles esa semana. Rodrigo solo necesita rellenar la columna de horas; el resto es una fórmula fija.

### Cómo funciona

1. Cada estilizador comunica sus horas disponibles para la semana (a Rodrigo, por el canal que uséis habitualmente).
2. Rodrigo rellena la tabla de abajo con esas horas.
3. La carga de cada persona esa semana es proporcional a su parte del total de horas del equipo:

```
carga_persona = (horas_persona / horas_totales_del_equipo) × vídeos_disponibles_esa_semana
```

4. El reparto real en la aplicación se hace con el botón **"Repartir censo"** del panel de admin (`AsignarCensoView`), que reparte automáticamente en round-robin entre el equipo activo (`EQUIPO_ACTUAL` en el código) — la proporción de horas se usa para decidir **cuántas veces seguidas** repetir a alguien en ese reparto, o para ajustar manualmente si el reparto automático (que por defecto es a partes iguales) no refleja bien la disponibilidad real de la semana.

### Plantilla — completar cada semana

| Persona | Horas disponibles esta semana | % del total del equipo | Vídeos orientativos (si hay N disponibles) |
|---|---:|---:|---:|
| Fabio | _(Rodrigo rellena)_ | — | — |
| Wilson | _(Rodrigo rellena)_ | — | — |
| Katty | _(Rodrigo rellena)_ | — | — |
| Olenka | _(Rodrigo rellena)_ | — | — |
| Rodrigo (si estiliza esa semana) | _(Rodrigo rellena)_ | — | — |
| **Total equipo** | **suma** | **100%** | — |

**% del total del equipo** = horas de la persona ÷ total de horas del equipo × 100.
**Vídeos orientativos** = ese % aplicado sobre cuántos vídeos del censo estén Disponibles esa semana (consultar el filtro "Estado: Disponible" del Catálogo).

### Ejemplo (con cifras inventadas solo para ilustrar el cálculo, no para usar)

Si Fabio comunica 20h, Wilson 10h, Katty 15h y Olenka 15h (total 60h), y hay 30 vídeos disponibles esa semana:
- Fabio: 20/60 = 33% → ~10 vídeos
- Wilson: 10/60 = 17% → ~5 vídeos
- Katty: 15/60 = 25% → ~8 vídeos
- Olenka: 15/60 = 25% → ~8 vídeos

Esto es orientativo, no una cuota rígida — sirve para que el reparto manual (o los ajustes tras el "Repartir censo" automático) reflejen la disponibilidad real de cada semana, no una división igualitaria que no tiene en cuenta que alguien tiene menos horas esa semana.
