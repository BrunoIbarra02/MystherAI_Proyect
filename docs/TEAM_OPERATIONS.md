# Manual de operación — Equipo de estilizado

Para **Fabio, Wilson, Katty y Olenka**. No requiere conocimientos técnicos.

## Flujo de trabajo diario

```
Iniciar sesión
      ↓
Revisar vídeos asignados
      ↓
Reservar nuevos vídeos si corresponde
      ↓
Abrir Gradio
      ↓
Realizar el estilizado
      ↓
Completar correctamente los metadatos
      ↓
Guardar el trabajo
      ↓
Comprobar que aparece en Registro
      ↓
Esperar revisión
      ↓
Corregir únicamente si Rodrigo lo solicita
```

1. **Iniciar sesión** con tu cuenta en la web.
2. **Revisar vídeos asignados** — entra al Catálogo y filtra por tu nombre (filtro "Usuario") para ver qué tienes ya reservado o repartido esa semana.
3. **Reservar nuevos vídeos si corresponde** — si no tienes nada pendiente y hay disponibilidad, reserva según lo acordado esa semana (ver "Organización semanal" más abajo).
4. **Abrir Gradio** desde el botón del vídeo reservado — ya lleva el vídeo, tu nombre y el identificador correctos.
5. **Realizar el estilizado** — los pasos 01 a 04 de Gradio (cargar, editar si hace falta, imagen, vídeo).
6. **Completar correctamente los metadatos** — Mapa y Especie son obligatorios; revisa que el resto de campos correspondan al vídeo real.
7. **Guardar el trabajo** — solo cuando el resultado te convence.
8. **Comprobar que aparece en Registro** — entra a la pestaña Registro y confirma que tu vídeo está ahí con estado "Pendiente".
9. **Esperar revisión** — Rodrigo (o quien esté de admin) lo aprobará o pedirá cambios.
10. **Corregir únicamente si Rodrigo lo solicita** — no reabras ni modifiques un trabajo ya aprobado por tu cuenta; si Rodrigo pide un cambio, edítalo y vuelve a esperar revisión.

## Proceso de reservas

- **Cuándo reservar**: solo cuando vayas a empezar el vídeo en las próximas horas, no "por si acaso" o para varios días después.
- **Cuándo liberar una reserva**: en cuanto sepas que no vas a poder terminarlo (cambio de planes, el vídeo da problemas, te quedas sin horas esa semana) — usa el botón "Liberar reserva" para que otro compañero pueda tomarlo.
- **Cuándo no reservar más vídeos**: si ya tienes uno reservado sin terminar, no reserves otro. Un vídeo, termínalo, el siguiente.
- **Si un vídeo presenta problemas** (enlace roto, vídeo corrupto, sin contenido reproducible): libera la reserva y avisa a Rodrigo con el ID del vídeo — no lo dejes reservado indefinidamente ni intentes forzarlo.

## Uso de Gradio

- **Cómo abrirlo**: desde el botón "Abrir en Gradio" del vídeo que tienes reservado. No necesitas copiar ni pegar ningún enlace ni identificador a mano.
- **Cómo cargar el vídeo**: el vídeo ya viene precargado al abrir Gradio desde el catálogo; pulsa "Analizar vídeo" y elige el fotograma que mejor representa la escena.
- **Cómo generar el estilizado**: paso 03 (imagen) elige estilo y modelo, genera la imagen; paso 04 (V2V) genera el vídeo estilizado a partir de esa imagen. El paso 04 tarda más — no cierres la pestaña mientras genera.
- **Qué revisar antes de guardar**: que el resultado corresponde realmente al vídeo original (fácil confundirse si tienes varias pestañas de Gradio abiertas), que el estilo aplicado es el correcto, y que el vídeo generado se ve bien (sin artefactos raros, cortes o errores visuales evidentes).
- **Errores habituales que pueden aparecer**:
  - La generación falla con un mensaje de error de la IA — puedes reintentar una vez; si vuelve a fallar, repórtalo a Rodrigo con el ID del vídeo, no sigas reintentando indefinidamente.
  - El botón de guardar da un aviso de "faltan campos obligatorios" — revisa que Mapa y Especie estén rellenos.
  - El vídeo estilizado tarda mucho o parece congelado — espera un poco más antes de asumir que falló; si tras varios minutos no cambia nada, repórtalo.

## Control de calidad — antes de guardar, comprueba

- [ ] Vídeo correcto (es el que querías estilizar, no otro que tenías abierto en otra pestaña).
- [ ] Mapa correcto.
- [ ] Especie correcta.
- [ ] Estilo correcto (el que corresponde a ese vídeo/mapa según lo acordado).
- [ ] Metadatos completos (no solo los obligatorios — revisa género, cámara, etc. si aplica).
- [ ] Vista previa revisada — has visto el resultado completo, no solo el primer fotograma.

## Comunicación con Rodrigo

Contacta con Rodrigo cuando:
- No puedes iniciar sesión.
- No aparecen tus reservas.
- Falta un vídeo que deberías tener asignado.
- Gradio falla repetidamente con el mismo vídeo.
- No puedes guardar tu trabajo.
- El estilizado sale corrupto o visiblemente mal generado.
- Aparece cualquier error inesperado que no sepas interpretar.

**No contactéis directamente con Bruno salvo que Rodrigo os lo indique expresamente.** Rodrigo es quien filtra y escala las incidencias técnicas que de verdad necesitan a Bruno.

## Buenas prácticas

- No reserves más vídeos de los que puedas completar en el tiempo que tienes disponible.
- Revisa siempre el resultado antes de guardar.
- Libera los vídeos que no puedas terminar — no los dejes "aparcados".
- Informa las incidencias cuanto antes, no al final del día o de la semana.
- Un vídeo, una reserva, un estilo — no dupliques trabajo probando varios estilos sin coordinarlo antes.

---

## Organización semanal

No hay cifras ni objetivos fijos — el reparto se calcula **únicamente a partir de la disponibilidad real** que cada persona comunique esa semana.

```
Disponibilidad semanal
      ↓
Calcular horas disponibles
      ↓
Asignar carga proporcional
      ↓
Enviar planificación semanal
      ↓
Seguimiento durante la semana
      ↓
Reasignar si alguien no puede completar su carga
```

1. **Disponibilidad semanal**: cada estilizador comunica a Rodrigo cuántas horas tiene disponibles esa semana.
2. **Calcular horas disponibles**: Rodrigo suma el total de horas del equipo esa semana.
3. **Asignar carga proporcional**: `carga_persona = (horas_persona ÷ horas_totales_del_equipo) × vídeos_disponibles_esa_semana`. Ni la cantidad de horas ni la cantidad de vídeos son fijas — cambian cada semana según lo que se comunique y lo que haya disponible en el censo.
4. **Enviar planificación semanal**: Rodrigo comunica a cada persona su reparto orientativo para la semana.
5. **Seguimiento durante la semana**: cada uno reserva y trabaja según lo acordado; Rodrigo revisa avances (ver `TEAM_LEAD_GUIDE.md`).
6. **Reasignar si alguien no puede completar su carga**: si a mitad de semana alguien no va a poder terminar lo suyo, libera esas reservas y Rodrigo redistribuye entre el resto según la disponibilidad restante — no cifras nuevas inventadas, el mismo cálculo proporcional con los datos actualizados.

Esta plantilla queda lista para que Rodrigo **solo tenga que introducir las horas de cada persona** cada semana — el resto del cálculo es siempre el mismo.

| Persona | Horas disponibles esta semana | % del total del equipo |
|---|---:|---:|
| Fabio | _(Rodrigo rellena)_ | — |
| Wilson | _(Rodrigo rellena)_ | — |
| Katty | _(Rodrigo rellena)_ | — |
| Olenka | _(Rodrigo rellena)_ | — |
| Rodrigo (si estiliza esa semana) | _(Rodrigo rellena)_ | — |
| **Total equipo** | **suma** | **100%** |
