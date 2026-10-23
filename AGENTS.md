# Instrucciones para agentes de desarrollo

## Objetivo

Desarrollar FoZ SoundPro / Beatmaker AI Studio como un conjunto
modular de herramientas gratuitas para producción musical asistida por IA.

## Reglas obligatorias

1. Inspeccionar antes de modificar.
2. Explicar el plan antes de realizar cambios importantes.
3. No instalar paquetes, descargar modelos ni modificar configuraciones
   globales sin aprobación explícita.
4. No ejecutar comandos destructivos ni sobrescribir archivos sin permiso.
5. No inventar APIs, plugins, modelos, licencias o capacidades.
6. Diferenciar hechos verificados de hipótesis.
7. Priorizar software existente y soluciones deterministas.
8. Mantener compatibilidad con macOS y Windows cuando sea viable.
9. Diseñar para el equipo de destino: Intel i5, 8 GB RAM,
   gráfica Intel integrada.
10. Mantener el código, las pruebas, la documentación y los recursos
    musicales separados.
11. No incluir credenciales, modelos ni archivos de audio pesados en Git.
12. Ejecutar pruebas pertinentes y comunicar sus resultados reales.

## Arquitectura

- DAW existente para grabación y mezcla.
- Herramientas independientes para beats y MIDI cuando sean necesarias.
- Ollama como proveedor local opcional.
- Proveedores externos opcionales, sin dependencia obligatoria.
- Generación de texto, MIDI y audio mediante componentes diferenciados.

## Forma de trabajo

Auditar -> planificar -> implementar -> probar -> documentar.

No iniciar una nueva fase si la actual no tiene criterios de aceptación
definidos o quedan errores críticos sin resolver.
