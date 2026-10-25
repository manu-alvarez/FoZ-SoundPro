# Fase D — Magenta.js (DrumsRNN / GrooVAE) en el Navegador
Estado hoy (verificado con precisión):

## Código (verificado)
- Paquete npm: `@magenta/music` v1.23.1
- Licencia código: **Apache-2.0** (MIT-equivalente, muy permisiva)
- Fuente: https://github.com/magenta/magenta-js
- Uso en la app: posible como módulo opcional en el navegador (sin servidor, sin coste).

## Modelos / Checkpoints (verificación pendiente — NO empaquetados hoy)
- Modelos disponibles en `magenta-js/music`:
  - DrumsRNN: generación de patrones de batería (2-4 compases).
  - GrooVAE: control de groove expresivo (humano vs. mecánico).
  - MusicVAE (drums 2-bar): generación de patrones cortos.
- Licencia probable de los pesos/checkpoints: **CC BY 4.0** (misma que el dataset Groove MIDI de Google Magenta), pero NO hay un archivo `LICENSE` explícito en los pesos descargados por `magenta-js`.
- Regla del proyecto: solo recursos con licencia verificada pueden empaquetarse. Por tanto:
  - El código `@magenta/music` puede incluirse (Apache-2.0 verificado).
  - Los checkpoints NO se incluyen hoy en el repositorio ni en el ZIP.
  - El usuario puede descargar los pesos a runtime (descarga opcional, no incluida por defecto) una vez verificada la licencia explícita del archivo de pesos.

## Estado de la Fase D hoy
- `docs/MAGENTA_JS.md`: este archivo (verificación documentada).
- `docs/ROADMAP.md`: línea 9.4 pendiente de verificación de pesos.
- No se modifica `index.html` ni `app.js` para cargar Magenta hoy (sin aprobación de pesos verificados).
- No se instala ningún paquete nuevo globalmente (sin `npm install` global ni cambios de configuración).

## Próximos pasos para completar Fase D (futuro, no hoy)
1. Descargar los checkpoints de `magenta-js` (`drums_rnn`, `groovae`, `music_vae_drums_2bar`) y verificar que contengan archivo `LICENSE` con texto explícito (CC BY 4.0 o Apache-2.0).
2. Si la licencia se confirma: crear `scripts/resources/download_magenta_weights.py` (solo stdlib) y `workspace/magenta-weights/` (ignorado por `.gitignore` como audio/modelos pesados).
3. Añadir botón experimental en la UI (opcional) que cargue los pesos en memoria del navegador y genere un patrón con DrumsRNN.
4. Documentar los créditos CC BY 4.0 si aplica.

Nota de honestidad técnica: en el objetivo (Intel i5, 8 GB RAM, gráfica Intel integrada), la inferencia con TF.js de modelos como DrumsRNN (~MB, no GB) es razonable para patrones cortos (2-4 compases) en CPU, pero requiere prueba de rendimiento antes de incluirse como función activa. Esta fase queda como experimento documentado, no como función principal.
