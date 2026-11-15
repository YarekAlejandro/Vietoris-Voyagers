# AETHER-SI · Vietoris-Voyagers

![Portada de AETHER-SI con una ilustración de una llama en microgravedad](docs/images/aether-si-cover.png)

AETHER-SI es una consola para explorar experimentos de combustión y seguridad contra incendios en microgravedad. Reúne registros de NASA Physical Sciences Informatics (PSI) y literatura de NASA Technical Reports Server (NTRS) para comparar condiciones y resultados con sus fuentes.

**[🚀 Abrir la demo](https://vietoris-voyagers-delta.vercel.app/)** · **[🧭 Explorar la consola](#explora-la-consola)** · **[💻 Ejecutar en local](#desarrollo-local)**

![Captura de AETHER-SI con el catálogo FSRS a la izquierda, el grafo PSI-Nexus y la comparación A/B en el centro, y la ficha de evidencia a la derecha](docs/images/aether-si-console.jpg)

*Consola de AETHER-SI en modo Ingeniería.*

## Explora la consola

| Herramienta | Qué puedes hacer |
| --- | --- |
| 🔎 **Búsqueda** | Encuentra estudios y corridas en español o inglés. Prueba `llamas frías`, `smoke detection`, `acrílico a baja presión` o `PSI-99`. |
| 🎛️ **Atmósfera y FSRS** | Elige un perfil de misión o ajusta gravedad, oxígeno, presión y flujo. El índice FSRS ordena la evidencia cuantitativa según su pertinencia para el escenario. |
| 🕸️ **PSI-Nexus** | Sigue los vínculos entre instalaciones, estudios, temas y corridas. Abre **Condiciones** para ver la cobertura experimental frente al escenario activo. |
| ↔️ **Comparación A/B** | Usa `+A` y `+B` para contrastar resultados y condiciones con sus fuentes. Los campos ausentes aparecen como «—». |

**⤢ Ampliar paneles.** Usa el botón del encabezado de **PSI-Nexus** o **Comparación experimental**. Pulsa el mismo control o `Esc` para restaurar el panel. Las selecciones A/B se conservan.

La ficha reúne la evidencia seleccionada y su contexto de prevención, detección y supresión cuando está disponible. El modo **Estudiante** añade explicaciones, casos históricos y aplicaciones terrestres.

## Fuentes y respaldo

| Estudios curados | Corridas normalizadas | Perfiles de referencia |
| :---: | :---: | :---: |
| **15** | **23** | **5** |

La consulta a NASA PSI incorpora investigaciones de **Combustion Science** y conserva los registros curados. Activa **Ver todo PSI** para consultar otras disciplinas. Los conteos en vivo provienen de la respuesta del servicio.

Los perfiles incorporados desde PSI indican de dónde salen sus cifras. Las fichas sin perfil cuantitativo aparecen en el catálogo y pueden compararse, con «—» en los campos ausentes. El **Radar NTRS** identifica sus publicaciones como literatura técnica y las enlaza con las fichas cuando corresponde.

Si PSI deja de responder, la aplicación usa un snapshot versionado de Combustion Science. Para regenerarlo, ejecuta `npm run snapshot:psi` con acceso a NASA PSI. La lectura de CSV públicos pequeños es opcional y está desactivada por defecto. [Integración y respaldo de NASA PSI](docs/psi-live.md)

La ficha **Cobertura del escenario** muestra la corrida medida más cercana, las brechas y la cantidad de corridas dentro de tolerancias heurísticas. La comparación A/B avisa cuando cambian varias condiciones a la vez. [Cobertura e interpretación](docs/evidence.md) · [Método FSRS](docs/fsrs.md) · [Auditoría de datos](docs/data-audit.md)

Abre **Escena del experimento** desde una corrida compatible para explorar en 3D el montaje de sólidos de BASS-II o Saffire, las gotas aisladas de FLEX o la pirólisis sin llama de SAME y SAME-R. Cada escena muestra las condiciones registradas para esa corrida. La vista 2D está disponible en el mismo panel y se abre si WebGL falla. Usa `NEXT_PUBLIC_EXPERIMENT_SCENE=false` antes de compilar para ocultar el control. [Alcance del visor y fuentes](docs/evidence.md#escena-del-experimento)

## Desarrollo local

Con Node.js 24 LTS, ejecuta:

```sh
npm ci
npm run dev
```

[Abre la consola local](http://localhost:3000).

**Interpretar** usa un resumen automático por defecto. Para activar la redacción opcional con Claude o Gemini, copia `.env.example` a `.env.local` y configura las variables del proveedor. El motor calcula el FSRS y las diferencias A/B en la aplicación. [Variables de entorno](.env.example)

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Para probar la compilación de producción localmente, ejecuta `npx next start`. La aplicación usa Next.js y React, Zustand para el estado compartido, React Flow para el grafo y Vitest para las pruebas.

## Licencia y atribución

Consulta la [licencia del repositorio](LICENSE). AETHER-SI es un proyecto independiente. Cada ficha enlaza a su fuente y conserva la licencia declarada cuando estos metadatos están disponibles.
