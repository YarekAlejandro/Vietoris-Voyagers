# Vietoris-Voyagers

Vietoris-Voyagers es una plataforma para explorar y comparar experimentos de NASA PSI mediante un grafo de conocimiento, fichas normalizadas y un comparador de condiciones y resultados.

Conocida como **AETHER-SI**, la herramienta está orientada a apoyar la investigación y el análisis de resultados en condiciones experimentales complejas. Permite buscar por concepto, material o identificador, y consultar la evidencia que sustenta cada resultado.

## Demo en producción

[Abrir AETHER-SI en Vercel](https://vietoris-voyagers-delta.vercel.app/)

## Funcionalidades

- Búsqueda por concepto, material e identificador.
- Grafo de conocimiento que relaciona estudios, corridas y resultados.
- Fichas normalizadas con contexto y evidencia.
- Comparación de condiciones y resultados.
- Trazabilidad hacia las fuentes documentadas.
- Vocabulario de conceptos y sinónimos en español e inglés.

## Cómo funciona

1. Busca por concepto, material o identificador.
2. Explora los resultados relacionados en el grafo de conocimiento.
3. Compara condiciones, observaciones y resultados con su contexto y evidencia.
4. Consulta por qué aparece cada resultado y qué fuente lo respalda.

## Desarrollo local

Se requiere Node.js 24 LTS.

```sh
npm ci
npm run dev
```

Abre la aplicación en [http://localhost:3000](http://localhost:3000).

Algunas búsquedas de ejemplo:

- `llamas frías`
- `smoke detection`
- `acrílico a baja presión`

La búsqueda local combina los conceptos consultados y muestra por qué aparece cada resultado.

## Validación

Ejecuta estas verificaciones antes de entregar cambios:

```sh
npm test
npm run typecheck
npm run build
```

La aplicación se ejecuta como servidor de Next.js (`npm run build` y `npm start`, o mediante Vercel). El botón **Interpretar** utiliza la ruta `/api/interpret`; por eso, el proyecto no genera el directorio estático `out/`.

### Estado del catálogo

El catálogo incluye actualmente:

- 15 estudios.
- 23 corridas normalizadas.
- 5 perfiles nominales PSI.
- Observaciones documentadas con cobertura parcial.

Este conjunto es una versión inicial del catálogo y puede evolucionar con nuevas fuentes y normalizaciones.

### Interpretación con IA

El comparador y cada corrida del ranking ofrecen un botón **Interpretar**. Este redacta un párrafo sobre la comparación A/B o el puntaje FSRS. El modelo se limita a redactar; el análisis y los datos se preparan localmente.

El texto puede generarse con Anthropic (Claude) o Google (Gemini). Copia `.env.example` a `.env.local` y configura las variables que necesites:

- `AI_PROVIDER`: `anthropic` o `gemini`. Si se deja vacío, se elige Anthropic cuando hay `ANTHROPIC_API_KEY`; de lo contrario, se usa Gemini si está definida `GEMINI_API_KEY`.
- `ANTHROPIC_API_KEY`: clave de la API de Anthropic, disponible en [console.anthropic.com](https://console.anthropic.com).
- `GEMINI_API_KEY`: clave de Gemini, disponible en [Google AI Studio](https://aistudio.google.com). Funciona con el nivel gratuito.
- `AI_MODEL`: modelo opcional del proveedor elegido. Por defecto, `claude-haiku-5-5` o `gemini-3.5-flash-lite`.

Sin una clave de API, la aplicación utiliza el resumen automático. En Vercel, configura estas variables en **Settings → Environment Variables**.

Sobre el nivel gratuito de Gemini:

- **Uso de datos:** Google puede usar el contenido para mejorar sus productos. La aplicación solo envía datos públicos de NASA PSI (CC0), no datos de usuarios.
- **Límites:** hay límites por minuto y por día, que se reinician a medianoche, hora del Pacífico. Si se agotan, Gemini puede responder con un error 429 y se muestra el resumen automático. La caché reduce las solicitudes repetidas.

## Entregables previstos

1. **Evidencia trazable y búsqueda evaluada** — Normalizar corridas de CFI, FLEX-2, DAFT, BRE y E-FIELD según la disponibilidad de tablas citables. Registrar unidades, localizadores de fuente y tipos de evidencia.
2. **GravityBridge y mapa de fases** — Incorporar controles de gravedad y referencias comparables. Publicar intervalos y procedencia de las estimaciones, e identificar escenarios sin cobertura antes de mostrarlos.
3. **Matriz de seguridad y exportación** — Vincular prevención, detección y supresión con la evidencia que sustenta cada conclusión. Permitir exportar corridas filtradas con unidades y referencias.
4. **Publicación reproducible** — Conectar el proyecto de Vercel al repositorio y ejecutar pruebas, verificación de tipos y compilación en cada actualización de la rama de producción.

## Contribución

Las contribuciones son bienvenidas. Si quieres mejorar el catálogo, la comparación de datos o la experiencia de búsqueda, abre un pull request con una descripción clara del cambio y su impacto.

## Licencia

Consulta el archivo de licencia del repositorio para más información.
