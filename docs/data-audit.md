# Auditoría de datos de AETHER-SI

## Accesiones PSI

Se consultó la API oficial de la aplicación en `/geode-py/ws/repo/investigations/{accession}`. La auditoría compara la ficha con las accesiones explícitas y las coincidencias por acrónimo del [adaptador del catálogo](../src/core/si-engine/merge-psi-catalog.ts). Los estudios IV–VI de Saffire se citan como literatura NTRS en el [catálogo curado](../src/data/psi_seed_data.json).

| Registro | Accesión oficial | Comparación con AETHER-SI |
| --- | --- | --- |
| BASS | [PSI-26](https://psi.nasa.gov/physci/repo/data/investigations/PSI-26) | Coincide con la accesión explícita del adaptador. |
| BASS-II | [PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25) | Coincide con el adaptador y con el DOI del catálogo curado. El ejemplo PSI-26 de la especificación aspiracional corresponde a BASS. |
| FLEX | [PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69) | Coincide con la accesión explícita. |
| FLEX-2 | [PSI-68](https://psi.nasa.gov/physci/repo/data/investigations/PSI-68) | Coincide con la accesión explícita. |
| CFI | [PSI-39](https://psi.nasa.gov/physci/repo/data/investigations/PSI-39) | Coincide por acrónimo. |
| SAME | [PSI-102](https://psi.nasa.gov/physci/repo/data/investigations/PSI-102) | Coincide por acrónimo y con el DOI del catálogo curado. |
| SAME-R | [PSI-101](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101) | Coincide con la accesión explícita. |
| SAFFIRE-II | [PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99) | Coincide con la accesión explícita. |
| ACME BRE | [PSI-20](https://psi.nasa.gov/physci/repo/data/investigations/PSI-20) | Coincide con BRE tras normalizar el acrónimo. |
| ACME CFI-G | [PSI-159](https://psi.nasa.gov/physci/repo/data/investigations/PSI-159) | Coincide con la accesión explícita para CFI-G. |
| ACME E-FIELD | [PSI-22](https://psi.nasa.gov/physci/repo/data/investigations/PSI-22) | Coincide con la accesión explícita para E-FIELD. |
| ACME Flame Design | [PSI-10](https://psi.nasa.gov/physci/repo/data/investigations/PSI-10) | Coincide con la accesión explícita. |
| SAFFIRE-I | [PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98) | Coincide con la accesión explícita. |
| SAFFIRE-III | [PSI-100](https://psi.nasa.gov/physci/repo/data/investigations/PSI-100) | Coincide con la accesión explícita. |
| DAFT / DAFT-2 | [PSI-47](https://psi.nasa.gov/physci/repo/data/investigations/PSI-47) | Coincide con DAFT al separar los dos acrónimos. |
| SPICE | [PSI-107](https://psi.nasa.gov/physci/repo/data/investigations/PSI-107) | Coincide por acrónimo y con el enlace del catálogo curado. |
| SLICE | [PSI-106](https://psi.nasa.gov/physci/repo/data/investigations/PSI-106) | Coincide por acrónimo en el listado oficial guardado en el snapshot. La consulta de detalle agotó su tiempo durante la auditoría. |

## Saffire VI

La figura 2 de ICES-2024-365 identifica las cuatro muestras. Su tabla 1 da condiciones iniciales comparables para las tres que encendieron. Las descripciones, la configuración y las condiciones coinciden con la tabla 1 de ICES-2025-156. La anchura difiere entre informes (41 cm en la descripción general de 2024 y 40 cm en la tabla de eventos de 2025). La base conserva la fuente de cada dato. [ICES-2024-365](https://ntrs.nasa.gov/citations/20240002981) · [ICES-2025-156](https://ntrs.nasa.gov/citations/20250002675)

| Evento · ICES-2025-156 | Muestra · ICES-2024-365 | Identificación cruzada | Registro local |
| --- | --- | --- | --- |
| 4 | VI-1 | Tela Nomex. La figura 2 identifica el ensayo 1 y ambos informes indican que no encendió. | — |
| 5 | VI-2 | SIBAL, 31,0 % O₂ y 54,1 kPa. | `SAFFIRE-VI-E5` |
| 6 | VI-3 | PMMA en dos caras, 30,3 % O₂ y 54,6 kPa. | `SAFFIRE-VI-E6` |
| 8 | VI-4 | PMMA en una cara, 28,8 % O₂ y 55,2 kPa. | `SAFFIRE-VI-E8` |

**TODO · CO y CO₂ de cabina.** La base curada carece de valores normalizados de gases para el comparador de Saffire IV–VI. La tabla 2 de ICES-2024-365 titula los incrementos de CO y CO₂ en ppm como mediciones en la entrada de FFD. ICES-2025-156 también presenta series y agregados de otros sensores. Para llenar las filas, registrar por corrida especie, unidad, ubicación del sensor, base temporal y tipo de agregado y comprobar que la pareja A/B use la misma métrica. `co2_pct` en FLEX es la fracción del diluyente, una variable experimental distinta. [ICES-2024-365](https://ntrs.nasa.gov/citations/20240002981) · [ICES-2025-156](https://ntrs.nasa.gov/citations/20250002675)

## Procedencia de corridas y perfiles

- `reference: false` identifica una corrida experimental en la base curada. Si una corrida tiene `nominal.fields`, esos campos son supuestos de referencia.
- `reference: true` identifica un perfil nominal curado. `psiProfile` identifica un perfil construido a partir de cifras citadas de PSI. La cobertura experimental excluye ambos tipos de perfil y excluye los campos nominales.
- El snapshot conserva el identificador y la versión de la ficha cuando están disponibles. La consulta de tablas durante la auditoría se limitó a los metadatos de investigaciones y a los informes publicados.
