# Evaluación local

Conjunto bilingüe de comprobación del catálogo curado. Las preguntas fijan un perfil de misión y los registros esperados cuando corresponde. El acierto de búsqueda exige que aparezca al menos una corrida esperada entre las cinco primeras coincidencias, ordenadas por FSRS.

- Acierto en top-5 · 14/14 (100.0 %).
- Cifras documentadas aceptadas · 12/12 (100.0 %).
- Cifras alteradas rechazadas · 12/12 (100.0 %).
- Acierto de abstención de interpretación · 18/18 (100.0 %).
- Acierto al declarar si hay evidencia directa · 2/2 (100.0 %).

La prueba de cifras usa textos reproducibles con valores originales y alterados, sin llamar a Claude ni Gemini. Los dos casos sobre evidencia directa de Artemis están etiquetados de antemano: comprueban que la cobertura parcial no se presente como directa. Los demás casos miden la abstención completa de interpretación al faltar cobertura. El informe evalúa estas decisiones de escenario, sin inferir la intención de la pregunta.

| Pregunta | Acierto top-5 | Cobertura | Decisión | Acierto |
| --- | --- | --- | --- | --- |
| ¿Qué evidencia hay para PMMA a presión reducida? | Sí | directa | Interpretación | Sí |
| acrylic at reduced pressure | Sí | directa | Interpretación | Sí |
| extinción con poca ventilación | Sí | directa | Interpretación | Sí |
| flame extinction with weak ventilation | Sí | directa | Interpretación | Sí |
| PTFE humo | Sí | directa | Interpretación | Sí |
| Teflon smoke | Sí | directa | Interpretación | Sí |
| heptano CO₂ | Sí | directa | Interpretación | Sí |
| heptane carbon dioxide | Sí | directa | Interpretación | Sí |
| GMT175-T10 | Sí | directa | Interpretación | Sí |
| GMT100-T13 | Sí | directa | Interpretación | Sí |
| ¿Qué reporta SAFFIRE-VI-E6? | Sí | directa | Interpretación | Sí |
| What does SAFFIRE-V-E6 report? | Sí | directa | Interpretación | Sí |
| What was recorded in FLEX-C10H101? | Sí | directa | Interpretación | Sí |
| FLEX 40CAL01 | Sí | directa | Interpretación | Sí |
| Traje EVA a 100 % O₂ | — | ninguna | Interpretación | Sí |
| EVA suit at 100 percent oxygen | — | ninguna | Interpretación | Sí |
| ¿Hay evidencia directa para un hábitat lunar? | — | parcial | Evidencia directa | Sí |
| Can these tests directly cover the Artemis habitat? | — | parcial | Evidencia directa | Sí |
| Comparar con el perfil de minería en Tierra | — | parcial | Interpretación | Sí |
| Compare the lunar rover with the catalogue | — | parcial | Interpretación | Sí |
