# Dependencias y fuentes de terceros

El código de AETHER-SI se distribuye bajo [MIT](LICENSE). Las dependencias y el material citado conservan sus propios términos.

## Dependencias directas

Las licencias se comprobaron en los manifiestos de los paquetes instalados o en el lockfile. El [lockfile](package-lock.json) fija las versiones e inventaría también las dependencias transitivas.

| Dependencia | Licencia | Fuente |
| --- | --- | --- |
| Next.js | MIT | [vercel/next.js](https://github.com/vercel/next.js) |
| React y React DOM | MIT | [facebook/react](https://github.com/facebook/react) |
| Zustand | MIT | [pmndrs/zustand](https://github.com/pmndrs/zustand) |
| React Flow (`@xyflow/react`) | MIT | [xyflow/xyflow](https://github.com/xyflow/xyflow) |
| React Three Fiber (`@react-three/fiber`) | MIT | [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) |
| Three.js (`three`) | MIT | [mrdoob/three.js](https://github.com/mrdoob/three.js) |
| Tipos de Three.js (`@types/three`) | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/three) |
| Lucide (`lucide-react`) | ISC | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) |
| Tailwind CSS y `@tailwindcss/postcss` | MIT | [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) |
| TypeScript | Apache-2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| Tipos de Node.js, React y React DOM | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| Vitest | MIT | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| Zod, incluido en Next.js | MIT | [Licencia del paquete Zod en el repositorio oficial](https://github.com/colinhacks/zod/blob/main/LICENSE) |

## Fuentes y licencias por registro

El [snapshot de PSI](data/psi-snapshot.json) conserva `license` por ficha. El valor `null` indica que el snapshot carece de una declaración. En las consultas de detalle de la [auditoría](docs/data-audit.md), la API declaró CC0 1.0 para los siguientes registros:

| Grupo | Fichas con declaración CC0 1.0 |
| --- | --- |
| Combustión de sólidos | [PSI-25 BASS-II](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25), [PSI-26 BASS](https://psi.nasa.gov/physci/repo/data/investigations/PSI-26), [PSI-62](https://psi.nasa.gov/physci/repo/data/investigations/PSI-62) |
| Gotas y llamas frías | [PSI-39 CFI](https://psi.nasa.gov/physci/repo/data/investigations/PSI-39), [PSI-68 FLEX-2](https://psi.nasa.gov/physci/repo/data/investigations/PSI-68), [PSI-69 FLEX](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69), [PSI-117](https://psi.nasa.gov/physci/repo/data/investigations/PSI-117), [PSI-142](https://psi.nasa.gov/physci/repo/data/investigations/PSI-142), [PSI-159 CFI-G](https://psi.nasa.gov/physci/repo/data/investigations/PSI-159) |
| Aerosoles y humo | [PSI-47 DAFT](https://psi.nasa.gov/physci/repo/data/investigations/PSI-47), [PSI-101 SAME-R](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101), [PSI-102 SAME](https://psi.nasa.gov/physci/repo/data/investigations/PSI-102), [PSI-115](https://psi.nasa.gov/physci/repo/data/investigations/PSI-115) |
| Saffire I–III | [PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98), [PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99), [PSI-100](https://psi.nasa.gov/physci/repo/data/investigations/PSI-100) |
| Llamas gaseosas | [PSI-20 BRE](https://psi.nasa.gov/physci/repo/data/investigations/PSI-20), [PSI-21](https://psi.nasa.gov/physci/repo/data/investigations/PSI-21), [PSI-22 E-FIELD](https://psi.nasa.gov/physci/repo/data/investigations/PSI-22), [PSI-23](https://psi.nasa.gov/physci/repo/data/investigations/PSI-23), [PSI-60](https://psi.nasa.gov/physci/repo/data/investigations/PSI-60), [PSI-107 SPICE](https://psi.nasa.gov/physci/repo/data/investigations/PSI-107) |

La respuesta de detalle de [PSI-10](https://psi.nasa.gov/physci/repo/data/investigations/PSI-10) carecía de licencia declarada. La consulta de detalle de [PSI-106](https://psi.nasa.gov/physci/repo/data/investigations/PSI-106) agotó su tiempo. [Texto legal de CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

El catálogo normaliza valores puntuales y enlaza las fichas de NASA PSI, artículos, documentación de NASA y literatura de NTRS. Las citas y condiciones de distribución se consultan en cada registro. Las publicaciones NTRS conservan los derechos y avisos de su registro bibliográfico, entre ellas los informes sin una declaración CC0 verificada. [Catálogo curado y sus citas](src/data/psi_seed_data.json) · [NTRS](https://ntrs.nasa.gov/)

### Fuentes de la cronología del asistente

La base histórica incorpora hechos resumidos y enlaza los documentos originales.

| Publicación | Condiciones declaradas |
| --- | --- |
| NASA. [Operaciones de Saffire I](https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/), [misión Cygnus NG-19](https://www.nasa.gov/mission/nasas-northrop-grumman-crs-19/) y [cierre de Saffire VI](https://www.nasa.gov/centers-and-facilities/glenn/flame-burns-out-on-nasas-long-running-spacecraft-fire-experiment/) | NASA permite el uso factual con atribución sujeto a sus pautas. [Pautas de NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/) |
| NASA JPL. [Informe anual de Microdevices Laboratory 2024, p. 13](https://microdevices.jpl.nasa.gov/interactivepdfs/pdf/2024%20MDL%20Annual%20Report.pdf) | El informe declara © 2024 California Institute of Technology. |
| NASA NTRS. [Resultados preliminares de Saffire VI](https://ntrs.nasa.gov/citations/20240007488) | Distribución pública. El registro advierte que partes del documento pueden estar protegidas por derechos de autor. |
| NASA NTRS. [SAME en la EEI](https://ntrs.nasa.gov/citations/20130004397) y [resultados de SAME-R](https://ntrs.nasa.gov/citations/20130000422) | Ambos registros declaran que el uso público está permitido. El primero se identifica como obra del Gobierno de Estados Unidos. |

Claude y Gemini son servicios opcionales de redacción. Su uso se rige por los términos del proveedor que se configure. [Anthropic](https://www.anthropic.com/legal) · [Google](https://ai.google.dev/gemini-api/terms)
