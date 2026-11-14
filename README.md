# Vietoris-Voyagers

Plataforma para explorar y comparar experimentos de NASA PSI mediante un grafo de conocimiento, fichas normalizadas y un comparador de condiciones y resultados, con evidencia trazable a sus fuentes originales.

## Demo en producción

[Abrir AETHER-SI en Vercel](https://vietoris-voyagers.vercel.app/)

## Desarrollo de AETHER-SI

Con Node.js 24 LTS, ejecuta:

```sh
npm ci
npm run dev
```

Abre [la consola local](http://localhost:3000). Busca por concepto, material o identificador. Prueba `llamas frías`, `smoke detection` o `acrílico a baja presión`. Los resultados se conectan con PSI-Nexus y con la ficha de cada estudio o corrida. Usa **Condiciones** para ver el oxígeno y flujo de las corridas recuperadas junto al escenario de misión, y **Comparar en A/B** para contrastar corridas con sus fuentes.

### Validación

```sh
npm test
npm run typecheck
npm run build
```

La compilación genera el sitio estático en `out/` para Vercel. El catálogo incluye 13 estudios y 23 corridas normalizadas de BASS-II, Saffire, SAME, SAME-R y FLEX. FLEX-2 se incluye como ficha bibliográfica. Prueba `PTFE humo` o `heptano CO₂` para encontrar corridas de detección y supresión.

La búsqueda local usa un vocabulario de conceptos y sinónimos en español e inglés. Combina los conceptos de la consulta y muestra por qué aparece cada resultado. El FSRS estima la pertinencia para el escenario elegido y pondera la similitud atmosférica según los campos reportados. Las fichas y el comparador identifican el O₂ y la presión nominales de SAME y SAME-R y el flujo nominal de FLEX. La vista **Condiciones** requiere O₂ y flujo reportados para dibujar una corrida. La gravedad orbital se representa como 0 g en el catálogo inicial.

## Próximos entregables

| Prioridad | Entregable | Criterio de aceptación |
| --- | --- | --- |
| 1 | Evidencia trazable y búsqueda evaluada | Normalizar corridas de CFI, FLEX-2, DAFT, BRE y E-FIELD según la disponibilidad de tablas citables. Registrar unidades, localizador de fuente y tipo de resultado por variable. Mantener un conjunto bilingüe de consultas con coincidencias esperadas y consultas fuera de cobertura. |
| 2 | GravityBridge y mapa de fases | Incorporar controles de gravedad y referencias comparables. Publicar intervalos y procedencia de las estimaciones y marcar escenarios sin cobertura antes de mostrar transiciones de régimen. |
| 3 | Matriz de seguridad y exportación | Enlazar prevención, detección y supresión con la evidencia que sustenta cada conclusión. Exportar corridas filtradas con unidades y referencias para que otra persona pueda reproducir la comparación. |
| 4 | Publicación reproducible | Conectar el proyecto de Vercel al repositorio y ejecutar pruebas, tipado y compilación en cada actualización de la rama de producción. |
