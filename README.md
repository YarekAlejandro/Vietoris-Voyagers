1| # Vietoris-Voyagers
2| 
3| Vietoris-Voyagers es una plataforma para explorar y comparar experimentos de NASA PSI a través de un grafo de conocimiento, fichas normalizadas y un comparador de condiciones y resultados. La idea[...]
4| 
5| Esta herramienta, conocida como AETHER-SI, está orientada a apoyar la investigación, el análisis y la comparación de resultados en condiciones experimentales complejas. Permite buscar por conce[...]
6| 
7| ## Demo en producción
8| 
9| - [Abrir AETHER-SI en Vercel](https://vietoris-voyagers-delta.vercel.app/)
10| 
11| ## ¿Qué incluye?
12| 
13| - Búsqueda por concepto, material e identificador
14| - Grafo de conocimiento para relacionar estudios, corridas y resultados
15| - Fichas normalizadas con contexto y evidencia
16| - Comparador de condiciones y resultados
17| - Trazabilidad hacia fuentes documentadas
18| - Soporte para vocabulario en español e inglés
19| 
20| ## Cómo funciona
21| 
22| 1. Realiza una búsqueda por concepto, material o identificador.
23| 2. Explora los resultados conectados en el grafo de conocimiento.
23| 3. Compara condiciones, observaciones y resultados con contexto de evidencia.
24| 4. Revisa por qué aparece cada resultado y desde qué fuente se sustenta.
25| 
26| ## Desarrollo local
27| 
28| Requiere Node.js 24 LTS.
29| 
30| ```sh
31| npm ci
32| npm run dev
33| ```
34| 
35| Abre la aplicación en:
36| 
37| - [Consola local](http://localhost:3000)
38| 
39| Ejemplos de búsquedas útiles:
40| 
41| - `llamas frías`
42| - `smoke detection`
43| - `acrílico a baja presión`
44| 
45| La búsqueda local utiliza un vocabulario de conceptos y sinónimos en español e inglés. Combina los conceptos consultados y muestra el motivo por el cual aparece cada resultado. El sistema de o[...]
46| 
47| ## Validación
48| 
49| Ejecuta estas verificaciones antes de entregar cambios:
50| 
51| ```sh
52| npm test
53| npm run typecheck
54| npm run build
55| ```
56| 
57| La aplicación se ejecuta como servidor de Next.js (`npm run build` y `npm start`, o Vercel), porque el botón **Interpretar** usa la ruta `/api/interpret`. Ya no se genera `out/`. El catálogo in[...]
58| La compilación genera el sitio estático en `out/`.
59| 
60| ### Estado actual del catálogo
61| 
62| El proyecto incluye actualmente:
63| 
64| - 15 estudios
65| - 23 corridas normalizadas
66| - 5 perfiles nominales PSI
67| - Observaciones documentadas con cobertura parcial
68| 
69| Este conjunto representa un snapshot inicial del catálogo y puede evolucionar con nuevas fuentes y normalizaciones.
70| 
71| ### Interpretación con IA
72| 
73| El comparador y cada corrida del ranking tienen un botón **Interpretar** que redacta un párrafo sobre la comparación A/B o sobre el puntaje FSRS. El modelo solo redacta: el motor local arma los[...]
74| 
75| El texto puede venir de Anthropic (Claude) o de Google (Gemini). Copia `.env.example` a `.env.local` y define:
76| 
77| | Variable | Uso |
78| | --- | --- |
79| | `AI_PROVIDER` | `anthropic` o `gemini`. Si se deja vacío, se usa Anthropic cuando hay `ANTHROPIC_API_KEY`, y si no, Gemini cuando hay `GEMINI_API_KEY`. |
80| | `ANTHROPIC_API_KEY` | Clave de la API de Anthropic, en [console.anthropic.com](https://console.anthropic.com). |
81| | `GEMINI_API_KEY` | Clave de la API de Gemini, en [Google AI Studio](https://aistudio.google.com). Funciona con el tier gratuito. |
82| | `AI_MODEL` | Modelo opcional del proveedor elegido. Por defecto, `claude-haiku-5-5` o `gemini-3.5-flash-lite`. |
83| 
84| Sin ninguna clave, la app funciona con el resumen automático. En Vercel, define las mismas variables en *Settings → Environment Variables*.
85| 
86| Sobre el tier gratuito de Gemini:
87| - **Uso de datos:** Google puede usar el contenido para mejorar sus productos. La app solo manda datos públicos de NASA PSI (CC0), sin datos de usuarios.
88| - **Límites:** tiene límites por minuto y por día, que se reinician a medianoche, hora del Pacífico. Si se agotan, Gemini responde 429 y se muestra el resumen automático. La caché evita repe[...]
89| 
90| ## Próximos entregables
91| ## Entregables previstos
92| 
93| | Prioridad | Entregable | Criterio de aceptación |
94| | --- | --- | --- |
95| | 1 | Evidencia trazable y búsqueda evaluada | Normalizar corridas de CFI, FLEX-2, DAFT, BRE y E-FIELD según la disponibilidad de tablas citables. Registrar unidades, localizador de fuente y tip[...]
96| | 2 | GravityBridge y mapa de fases | Incorporar controles de gravedad y referencias comparables. Publicar intervalos y procedencia de las estimaciones y marcar escenarios sin cobertura antes de m[...]
97| | 3 | Matriz de seguridad y exportación | Enlazar prevención, detección y supresión con la evidencia que sustenta cada conclusión. Exportar corridas filtradas con unidades y referencias para [...]
98| | 4 | Publicación reproducible | Conectar el proyecto de Vercel al repositorio y ejecutar pruebas, tipado y compilación en cada actualización de la rama de producción. |
99| 
100| ## Contribución
101| 
102| Las contribuciones son bienvenidas. Si quieres mejorar el catálogo, la comparación de datos o la experiencia de búsqueda, abre un PR con una descripción clara del cambio y su impacto.
103| 
104| ## Licencia
105| 
106| Consulta el archivo de licencia del repositorio para más información.
107| 
