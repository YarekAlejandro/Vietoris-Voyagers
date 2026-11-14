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

La aplicación se ejecuta como servidor de Next.js (`npm run build` y `npm start`, o Vercel), porque el botón **Interpretar** usa la ruta `/api/interpret`. Ya no se genera `out/`. El catálogo incluye 15 estudios, 23 corridas normalizadas y 5 perfiles nominales PSI con observaciones documentadas y cobertura parcial. Prueba `PTFE humo` o `heptano CO₂` para encontrar corridas de detección y supresión. Los atajos de búsqueda también recuperan los registros de cada estudio coincidente.

La búsqueda local usa un vocabulario de conceptos y sinónimos en español e inglés. Combina los conceptos de la consulta y muestra por qué aparece cada resultado. El FSRS ordena estudios y corridas con el escenario activo. Pondera oxígeno (35 %), presión (25 %), gravedad y flujo (25 %) e instrumentación, puente y pilar de misión (15 %), con bonificaciones por escenario y un máximo de 100 puntos. Los campos ausentes o nominales aportan cero a la similitud. La vista **Condiciones** dibuja corridas con O₂ y flujo reportados. La gravedad orbital se representa como 0 g.

### Interpretación con IA

El comparador y cada corrida del ranking tienen un botón **Interpretar** que redacta un párrafo sobre la comparación A/B o sobre el puntaje FSRS. El modelo solo redacta: el motor local arma los datos y cada número del texto se comprueba contra ellos. Si falta la clave, la llamada falla, tarda más de 10 s o aparece un número que no está en los datos, se muestra un **Resumen automático** generado con plantillas.

Copia `.env.example` a `.env.local` y define:

| Variable | Uso |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic. Sin ella, la app funciona con el resumen automático. |
| `AI_MODEL` | Modelo opcional. Por defecto, `claude-haiku-5-5`. |

En Vercel, define las mismas variables en *Settings → Environment Variables*.

## Próximos entregables

| Prioridad | Entregable | Criterio de aceptación |
| --- | --- | --- |
| 1 | Evidencia trazable y búsqueda evaluada | Normalizar corridas de CFI, FLEX-2, DAFT, BRE y E-FIELD según la disponibilidad de tablas citables. Registrar unidades, localizador de fuente y tipo de resultado por variable. Mantener un conjunto bilingüe de consultas con coincidencias esperadas y consultas fuera de cobertura. |
| 2 | GravityBridge y mapa de fases | Incorporar controles de gravedad y referencias comparables. Publicar intervalos y procedencia de las estimaciones y marcar escenarios sin cobertura antes de mostrar transiciones de régimen. |
| 3 | Matriz de seguridad y exportación | Enlazar prevención, detección y supresión con la evidencia que sustenta cada conclusión. Exportar corridas filtradas con unidades y referencias para que otra persona pueda reproducir la comparación. |
| 4 | Publicación reproducible | Conectar el proyecto de Vercel al repositorio y ejecutar pruebas, tipado y compilación en cada actualización de la rama de producción. |
