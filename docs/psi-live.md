# Sincronización con NASA Physical Sciences Informatics

AETHER-SI consulta el catálogo de NASA Physical Sciences Informatics desde el servidor de Next.js. Los registros nuevos de Combustion Science alimentan la búsqueda, PSI-Nexus y el comparador A/B. **Ver todo PSI** amplía la consulta a las demás disciplinas. Los registros que incluyen cifras citables participan en el FSRS; las fichas bibliográficas muestran **sin perfil cuantitativo** y presentan «—» en los campos ausentes del comparador. El Radar NTRS reúne literatura, incluida la de LUCI, FM2 y Saffire IV–VI. Las publicaciones de NTRS llevan su propia insignia y quedan fuera del FSRS.

La aplicación es un proyecto independiente. Las fichas enlazan a NASA Physical Sciences Informatics y conservan los DOI y las licencias declaradas en sus metadatos. PSI publica las fichas verificadas con licencia CC0 1.0.

## Endpoints verificados el 14 de noviembre de 2026

| NASA | Ruta y parámetros | Respuesta observada |
| --- | --- | --- |
| PSI | `GET /geode-py/ws/repo/search?size=200` | JSON de Elasticsearch en `hits.hits[]._source` y total en `hits.total`. La consulta devolvió 133 registros en seis disciplinas, de los cuales 24 tenían `Research Area: "Combustion Science"`. |
| PSI | `GET /geode-py/ws/repo/search?term=combustion&size=2&from=0` | `term` busca en los metadatos. `size` fija el tamaño de página y `from` el desplazamiento. El término `combustion` devolvió 26 coincidencias de texto. |
| PSI | `GET /geode-py/ws/repo/investigations/{accession}` | JSON de ficha, con nombres distintos a los del listado. Se verificaron, entre otras, PSI-25, PSI-69 y PSI-142. |
| PSI | `GET /geode-py/ws/studies/{accession}/download?file=…&version=…&redirect=false` | Para las tablas comprobadas, un cuerpo `text/html` con la URL firmada como texto. El archivo se sirve desde `psi-repo-prod.s3.amazonaws.com`. |
| NTRS | `GET /api/citations/search?q=…&page.size=…` | JSON de literatura en `results[]`. Se comprobaron búsquedas específicas para LUCI, FM2 y Saffire. |

Los valores de la tabla son observaciones de la fecha de verificación. La app calcula los conteos desde las respuestas. Los parámetros `q` y `search` se ignoraron en el listado de PSI y `/repo/investigations` sin accesión devolvió 404. El cliente de AETHER-SI sigue usando `q` en su propia API, que lo traduce a `term`.

- [Ejemplo de búsqueda PSI](https://psi.nasa.gov/geode-py/ws/repo/search?term=combustion&size=2)
- [Ficha oficial PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)
- [Ejemplo de literatura NTRS sobre LUCI](https://ntrs.nasa.gov/citations/20250010653)

## Ejecución y respaldo

```sh
node --env-file-if-exists=.env.local scripts/probe-psi-api.mjs
npm run snapshot:psi
```

El primer comando imprime URL, estado, tipo de contenido, claves y una muestra y guarda ejemplos de JSON en `fixtures/psi/`. Las muestras se proyectan a los campos de investigación necesarios para las pruebas. Se excluyen contactos, identificadores de almacenamiento y URLs firmadas.

`npm run snapshot:psi` regenera `data/psi-snapshot.json` con la fecha de generación y el listado de Combustion Science. Añade DOI, licencia y publicaciones cuando la ficha de detalle responde. Reintenta fichas que agotan su tiempo y conserva el registro del listado si el detalle sigue sin responder. Ejecuta el comando antes de preparar una demo o entrega que requiera un respaldo reciente y revisa el cambio del JSON. La compilación y las pruebas usan el archivo versionado y pueden ejecutarse sin acceso a NASA.

`GET /api/psi/search?q=…&area=combustion` acepta hasta 80 caracteres y usa un máximo de 6 s por fuente y cuatro fichas PSI simultáneas. `area=all` habilita todas las disciplinas. Con ambas fuentes disponibles, responde `live`. Si PSI responde y falla NTRS, responde `partial`. Si falla PSI, responde `snapshot` y conserva la literatura de NTRS cuando esté disponible. El respaldo solo incluye Combustion Science. Con el navegador sin conexión al servidor, el catálogo curado funciona en memoria desde que la app está cargada.

Los listados JSON usan `next.revalidate: 3600`. La ruta pública anuncia `s-maxage=3600, stale-while-revalidate=86400`. El botón de actualizar repite la consulta respetando estas capas de caché. Las fichas de detalle se leen cuando añaden información, y la copia cruda se descarta tras normalizarla porque puede incluir inventarios grandes. Los campos extra pasan la validación de Zod y sus nombres se registran en el servidor. Se usa la copia de Zod incluida en Next.js 16, fijada por el lockfile. Las pruebas del adaptador y la compilación verifican esa importación. [Semántica de caché de Next.js](https://nextjs.org/docs/app/api-reference/functions/fetch)

Los perfiles citan el texto o la columna que aporta sus cifras. Una referencia a la Luna o Marte sin cifras aporta contexto temático. Los rangos conservan sus extremos, y los perfiles que combinan condiciones descritas no pasan a las cotas de corridas medidas. La fusión usa accesiones conocidas y acrónimos normalizados. Una coincidencia con un estudio curado añade su ficha oficial, DOI, licencia y publicaciones sin sustituir el estudio ni sus corridas.

## Configuración y verificación pendiente

- `PSI_API_BASE=https://psi.nasa.gov/geode-py/ws`
- `PSI_SEARCH_PATH=/repo/search`
- `ENABLE_PSI_TABLES=false`. Con `true`, el servidor acepta CSV públicos de hasta 300 KB, valida el host y la ruta de entrega y lee únicamente columnas reconocidas de O₂ y presión ambiental. Algunas tablas CSV se sirven como `application/vnd.ms-excel`. La firma es temporal y no se incluye en las respuestas ni en el snapshot. La tabla se omite si falta, supera el límite o no contiene columnas reconocidas.
- `TODO(verify)`: confirmar si el portal expone un parámetro de filtrado por disciplina. Los candidatos `researchArea` y `research_area` no filtraron; AETHER-SI usa el campo confirmado `Research Area`. Si cambia el listado de PSI, abre [el buscador oficial](https://psi.nasa.gov/physci/repo/search), filtra por Combustion Science y consulta **Network → Fetch/XHR**. Copia únicamente la ruta y los parámetros del request JSON relevante y vuelve a ejecutar el probe antes de cambiar el adaptador.
- `TODO(verify)`: ampliar la lista de columnas CSV únicamente cuando se comprueben nuevos encabezados y unidades en tablas públicas pequeñas. Los CSV comprobados fueron BASS-II, FLEX, Saffire-II y el resumen de PSI-142.
