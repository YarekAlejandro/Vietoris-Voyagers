# Vietoris-Voyagers

Vietoris-Voyagers es una plataforma para explorar y comparar experimentos de NASA PSI a través de un grafo de conocimiento, fichas normalizadas y un comparador de condiciones y resultados. La idea principal es facilitar la navegación, comparación y trazabilidad de evidencia científica y técnica, conectando cada observación con sus fuentes originales.

Esta herramienta, conocida como AETHER-SI, está orientada a apoyar la investigación, el análisis y la comparación de resultados en condiciones experimentales complejas. Permite buscar por concepto, material, identificador o escenario, y revisar cómo aparecen los resultados en el contexto de estudios y corridas normalizadas.

## Demo en producción

- [Abrir AETHER-SI en Vercel](https://vietoris-voyagers.vercel.app/)

## ¿Qué incluye?

- Búsqueda por concepto, material e identificador
- Grafo de conocimiento para relacionar estudios, corridas y resultados
- Fichas normalizadas con contexto y evidencia
- Comparador de condiciones y resultados
- Trazabilidad hacia fuentes documentadas
- Soporte para vocabulario en español e inglés

## Cómo funciona

1. Realiza una búsqueda por concepto, material o identificador.
2. Explora los resultados conectados en el grafo de conocimiento.
3. Compara condiciones, observaciones y resultados con contexto de evidencia.
4. Revisa por qué aparece cada resultado y desde qué fuente se sustenta.

## Desarrollo local

Requiere Node.js 24 LTS.

```sh
npm ci
npm run dev
```

Abre la aplicación en:

- [Consola local](http://localhost:3000)

Ejemplos de búsquedas útiles:

- `llamas frías`
- `smoke detection`
- `acrílico a baja presión`

La búsqueda local utiliza un vocabulario de conceptos y sinónimos en español e inglés. Combina los conceptos consultados y muestra el motivo por el cual aparece cada resultado. El sistema de ordenamiento prioritiza estudios y corridas según su relevancia y concordancia con la consulta.

## Validación

Ejecuta estas verificaciones antes de entregar cambios:

```sh
npm test
npm run typecheck
npm run build
```

La compilación genera el sitio estático en `out/`.

### Estado actual del catálogo

El proyecto incluye actualmente:

- 15 estudios
- 23 corridas normalizadas
- 5 perfiles nominales PSI
- Observaciones documentadas con cobertura parcial

Este conjunto representa un snapshot inicial del catálogo y puede evolucionar con nuevas fuentes y normalizaciones.

## Entregables previstos

| Prioridad | Entregable | Criterio de aceptación |
| --- | --- | --- |
| 1 | Evidencia trazable y búsqueda evaluada | Normalizar corridas de CFI, FLEX-2, DAFT, BRE y E-FIELD según la disponibilidad de tablas citables. Registrar unidades, localizador de fuente y tipo de evidencia. |
| 2 | GravityBridge y mapa de fases | Incorporar controles de gravedad y referencias comparables. Publicar intervalos y procedencia de las estimaciones y marcar escenarios sin cobertura antes de mostrar resultados. |
| 3 | Matriz de seguridad y exportación | Enlazar prevención, detección y supresión con la evidencia que sustenta cada conclusión. Exportar corridas filtradas con unidades y referencias para facilitar validación. |
| 4 | Publicación reproducible | Conectar el proyecto de Vercel al repositorio y ejecutar pruebas, tipado y compilación en cada actualización de la rama de producción. |

## Contribución

Las contribuciones son bienvenidas. Si quieres mejorar el catálogo, la comparación de datos o la experiencia de búsqueda, abre un PR con una descripción clara del cambio y su impacto.

## Licencia

Consulta el archivo de licencia del repositorio para más información.
