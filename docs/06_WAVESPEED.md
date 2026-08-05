# 06 — Wavespeed

> **La API key de Wavespeed es responsabilidad exclusiva de Bruno. No es un problema de esta rama ni de cómo el código se conecta a Wavespeed.** Esta investigación está cerrada — no se va a seguir intentando resolver desde aquí.

## Estado

La key actualmente en `.env` es rechazada por el propio servidor de Wavespeed (`401 Invalid API key`), bloqueando toda generación real de imagen/vídeo en Gradio (pasos 03 y 04 del pipeline).

## Evidencia técnica de que no es un problema de conexión del código

Se descartaron, en orden, todas las causas verificables sin acceso a la cuenta de Wavespeed:

1. **Cabecera de autenticación**: `Authorization: Bearer <key>` — verificado contra el código fuente instalado de `wavespeed/api/client.py:69`, no adivinado.
2. **URL base**: `https://api.wavespeed.ai` — coincide exactamente con `wavespeed/config.py`.
3. **Integridad de la key**: `od -c` sobre la línea del `.env` — sin caracteres ocultos, sin `\r`, sin espacios, 52 caracteres, prefijo `wsk_live_`.
4. **Variables de entorno del sistema**: comprobados los ámbitos `User`, `Machine` y `Process` de Windows — ninguno define `WAVESPEED_API_KEY` por fuera del `.env`, así que no hay un valor distinto pisando al esperado.
5. **Dos copias de la key en el repo**: `gradio-service/.env` (desactualizada, de junio) y el `.env` raíz — se probaron **ambas** directamente contra la API real. Ninguna es aceptada.
6. **Confirmado por dos caminos de ejecución completamente independientes**: un `curl` directo a `https://api.wavespeed.ai`, y la llamada real del SDK oficial dentro del pipeline de producción (`do_stylize` → `wavespeed.Client(api_key=key).upload()`). Ambos devuelven exactamente:
   ```json
   {"code":401,"message":"Invalid API key. Verify the key on your dashboard's API Keys page, or contact support@wavespeed.ai."}
   ```

## Conclusión

El rechazo se origina en el servidor de Wavespeed, no en cómo el código construye, carga o transmite la key. Es coherente con una rotación/revocación de la key posterior a la última vez que se confirmó que funcionaba, o con una discrepancia entre el valor probado manualmente y el que hay actualmente en el `.env`.

## Qué necesita hacer Bruno

1. Entrar a su dashboard en wavespeed.ai y verificar el estado de la key actual.
2. Generar una key nueva si la actual está revocada.
3. Actualizar el `.env` de producción (Cloud Run) — y, en local, consolidar `gradio-service/.env` con el `.env` raíz para que no queden dos copias divergentes (ver `01_QA_REPORT.md`).
4. Una vez actualizada, probar una generación real end-to-end antes de anunciarlo al equipo — no hay nada más que verificar desde el código.
