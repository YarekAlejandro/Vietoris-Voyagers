# Rediseño visual del Asistente IA

El rediseño se limita a la pantalla inicial. La ficha conserva sus campos, validación, búsqueda y sesión. La consola de evidencia mantiene su propia apariencia.

- La cámara muestra las cuatro lecturas del perfil. La llama es ilustrativa y se mantiene como contorno sin color mientras faltan lecturas o no se conoce el sentido de un flujo distinto de cero.
- El mapa coloca el perfil actual y las corridas recomendadas con oxígeno y flujo documentados. Si el usuario no había especificado uno de esos parámetros, la interfaz consulta la misma corrida curada por su ID y aplica la misma regla de exclusión de valores nominales. Los números son posiciones del ranking, no umbrales. Las líneas cortas llevan al punto medido cuando se separan etiquetas superpuestas.
- Bricolage Grotesque e IBM Plex Sans se sirven localmente; las licencias están en [THIRD_PARTY.md](../THIRD_PARTY.md).

La comparación visual se realizó con Playwright y Edge usando la compilación de producción, a 1920, 1440, 1280 y 390 píxeles. El estado inicial sirve de referencia antes y después. La vista de resultados se comprueba con el espécimen SIBAL. Se verificó que el ancho del documento no supera el de la ventana, incluso en móvil con resultados desplegados.
