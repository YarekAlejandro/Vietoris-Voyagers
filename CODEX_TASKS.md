# Alcance de AETHER-SI para NASA Space Apps 2026

Este resumen del alcance acordado para «Flame in Freefall» tiene prioridad sobre la propuesta de [SPEC.md](SPEC.md). La consola resume, ordena y explica evidencia publicada sobre combustión en microgravedad. Cada cifra presentada como evidencia debe tener una fuente.

| Prioridad | Tarea | Entregable |
| --- | --- | --- |
| P0 | T3 · Comparación A/B | Detectar cambios en varios factores y advertir que el resultado no se puede atribuir a uno solo. Dejar como ausentes los datos de gases sin correspondencia verificable. |
| P0 | T1 · FSRS | Documentar y explicar el puntaje de similitud. Medir la estabilidad del top cinco con pesos perturbados. |
| P0 | T4 · Cobertura | Buscar corridas medidas cercanas y mostrar las brechas. Excluir perfiles nominales. |
| P0 | T2 · Interpretación | Preparar evidencia estructurada, validar la redacción y ofrecer abstención o plantilla local según la cobertura y el resultado de la validación. |
| P1 | T5 · PSI-Nexus | Mejorar la lectura inicial del grafo y centrar el estudio seleccionado. |
| P1 | T6 · Datos | Verificar las accesiones oficiales, documentar equivalencias y marcar la procedencia experimental o nominal. |
| P1 | T8 · Higiene | Documentar fuentes y licencias y revisar la configuración y el estado compartido. |
| P2 | T7 · Escena 3D | Ilustración opcional condicionada a completar las prioridades P0. |
| Condicionada | T9 · Clasificador PSI-69 | Requiere una tabla experimental versionada con columnas documentadas. |

El alcance de análisis termina en la evidencia observada y sus limitaciones. Las propuestas GravityBridge, `predictedLunarSpreadRate`, `predictedLOI` y `coolFlameReignitionRisk` quedan fuera de este alcance. La aplicación es independiente y la evidencia se presenta para exploración, con sus unidades y su procedencia.

Antes de cada commit, ejecuta `npm run lint`, `npm run typecheck` y `npm test`. Para cerrar cambios, ejecuta `npm run build`. Documenta las fuentes y dependencias nuevas en [THIRD_PARTY.md](THIRD_PARTY.md).
