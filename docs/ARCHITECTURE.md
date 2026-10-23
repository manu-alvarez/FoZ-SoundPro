# Arquitectura inicial

## Capas

1. DAW y herramientas de audio existentes.
2. Integraciones y automatizaciones propias.
3. Generación MIDI y procesamiento de audio.
4. Proveedores de IA: Ollama local y servicios externos opcionales.
5. Documentación, configuración y pruebas.

## Restricciones

- La aplicación de destino debe ser viable con 8 GB de RAM.
- Los modelos de IA no son dependencias obligatorias del núcleo.
- La generación de texto, MIDI y audio se trata como capacidades distintas.
- No se asume compatibilidad de aceleración GPU sin verificarla.
- Las rutas y dependencias deben funcionar en macOS y Windows
  o documentar explícitamente sus diferencias.

## Estrategia

Implementar por fases, validando cada componente de forma independiente.
No construir un DAW desde cero.
