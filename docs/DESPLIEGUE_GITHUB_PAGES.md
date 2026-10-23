# FoZ SoundPro — Guía de Despliegue en GitHub Pages

Este documento explica cómo publicar la aplicación web de **FoZ SoundPro Beatmaker AI Studio** en **GitHub Pages** a coste cero (0 €), sin backend obligatorio y de forma totalmente autónoma.

---

## 1. Arquitectura de la Versión Web

La carpeta [`web/`](file:///Users/manu/Desktop/FoZ_SoundPro/web) contiene todos los recursos de la estación musical empaquetados de forma autocontenida:
- `index.html`: Estructura semántica completa y accesible.
- `css/style.css`: Sistema de diseño profesional oscuro sin dependencias externas de CDN.
- `js/`: Motores de audio Web Audio API, sintetizadores de 7 instrumentos, generador binario MIDI SMF1, secuenciador con lookahead, asistente musical heurístico y gestor de proyectos.
- `manifest.json` y `sw.js`: Soporte de Progressive Web App (PWA) e instalación en escritorio o móvil con caché offline.
- `demo_project.foz`: Proyecto de demostración cargable de inmediato.

Todas las rutas son **relativas**, lo que garantiza que la aplicación funcione tanto en la raíz de un dominio (`https://usuario.github.io/`) como en un subdirectorio de repositorio (`https://usuario.github.io/FoZ_SoundPro/`).

---

## 2. Estado de Despliegue en Vivo

El despliegue está activo y automatizado mediante GitHub Actions:

- **Repositorio:** [https://github.com/manu-alvarez/FoZ-SoundPro](https://github.com/manu-alvarez/FoZ-SoundPro)
- **URL Pública:** [https://manu-alvarez.github.io/FoZ-SoundPro/](https://manu-alvarez.github.io/FoZ-SoundPro/)
- **Workflow:** `.github/workflows/deploy.yml` (se ejecuta automáticamente con cada push a `main`).
- **Certificado SSL / HTTPS:** Activo y forzado automáticamente por GitHub.

---

## 3. Despliegue Automatizado mediante GitHub Actions

Si prefieres compilar y publicar automáticamente en cada `git push` a `main`, puedes utilizar la acción estándar de GitHub Pages creando el archivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy FoZ SoundPro to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'web'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 4. Consideraciones de Seguridad y Modo Offline

1. **Contexto Seguro (HTTPS):**
   - GitHub Pages proporciona automáticamente cifrado TLS/HTTPS.
   - El contexto HTTPS es un requisito indispensable para que los navegadores habiliten la instalación como PWA (`manifest.json`), el registro del `ServiceWorker` y los permisos del micrófono en el grabador de voz.
2. **Conexión con Ollama Local desde GitHub Pages (Mixed Content):**
   - Por motivos de seguridad, los navegadores modernos restringen que una página servida por HTTPS (`https://*.github.io`) realice llamadas directas a HTTP no seguro en `http://localhost:*` (Mixed Content).
   - FoZ SoundPro está preparado para esta situación: si abres la aplicación desde GitHub Pages sin un túnel HTTPS local hacia el puente, el **Motor Heurístico de Reglas Musicales se activa de inmediato**, permitiéndote componer ritmos, sintetizar audio y exportar MIDI y WAV con total normalidad y a coste cero.
