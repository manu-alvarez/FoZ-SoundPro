# Publicación de FoZ SoundPro en GitHub Pages

La distribución estática está en [web](../web/). Incluye la [página de entrada](../web/index.html), el [manifest](../web/manifest.json), el [service worker](../web/sw.js) y un [proyecto de ejemplo](../web/demo_project.foz).

## Cómo se publica

El [workflow de despliegue](../.github/workflows/deploy.yml) se ejecuta al recibir un push en `main` o al lanzarlo manualmente. Carga `web/` como artefacto y lo publica en el entorno `github-pages`. En la configuración de Pages del repositorio, la fuente correspondiente es **GitHub Actions**.

Para comprobar una publicación, abre el último [despliegue del workflow](https://github.com/manu-alvarez/FoZ-SoundPro/actions/workflows/deploy.yml) y sigue la URL del entorno. La dirección prevista es [FoZ SoundPro](https://manu-alvarez.github.io/FoZ-SoundPro/).

## Qué incluye el alojamiento

Pages sirve la interfaz, los recursos de audio del navegador y el generador heurístico. El puente Python y Ollama se ejecutan por separado en el equipo que los aloja. Para trabajar con un modelo local, abre la pestaña de diagnóstico del estudio y comprueba la conexión desde ese navegador.
