# Vietoris-Voyagers
Plataforma para explorar y comparar experimentos de NASA PSI mediante un grafo de conocimiento, fichas normalizadas y un comparador de condiciones y resultados, con evidencia trazable a sus fuentes originales.

## Desarrollo de AETHER-SI

Con Node.js 24 LTS, ejecuta:

```sh
npm ci
npm run dev
```

Abre [la consola local](http://localhost:3000). Selecciona un perfil de misión y ajusta su atmósfera para recalcular FSRS. Selecciona una instalación o investigación del grafo para filtrar el ranking, y usa los botones A y B para comparar corridas.

```sh
npm test
npm run typecheck
npm run build
```

La compilación genera un sitio estático en `out/`. El ranking, el grafo y la comparación funcionan en el navegador con el catálogo incluido. La muestra inicial contiene 12 corridas de BASS-II y Saffire, con citas a las tablas o secciones de los informes de NASA. La gravedad orbital se normaliza a 0 g en esta muestra. FSRS puntúa relevancia experimental y usa escalas iniciales de similitud. Cada cota describe una sola variable del catálogo.

GravityBridge, el mapa de fases, la matriz de seguridad y la ampliación del catálogo quedan pendientes.
