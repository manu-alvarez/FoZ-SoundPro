# Fase C — Base Library CC0 / CC-BY (Referencia, no empaquetado en Git)

## CC0 (Dominio Público / CC0 1.0) — Bundleable sin créditos obligatorios
- Free Music Archive (FMA): álbumes CC0 filtrables (ej. "PUBLIC DOMAIN" — Maarten Schellekens, instrumental lo-fi/acústico).
- archive.org / Citizen DJ (Library of Congress): grabaciones de dominio público para remixes y bases.

## CC BY 4.0 — Redistribuible con atribución obligatoria
- Incompetech (Kevin MacLeod): música electrónica, hip hop, groove. Créditos generados por título en `docs/MANUAL_USUARIO.md` (§2.4).
  Copia local permitida para la Base Library con los créditos que Incompetech provee.

Nota de diseño: los archivos MP3/M3U de la Base Library NO se incluyen en el repositorio
ni en el ZIP portable (`.gitignore` cubre `*.mp3`/`*.m3u`). Solo se incluyen los manifiestos
(`manifest.json`) y los créditos, para que el usuario los descargue localmente.
