# Vietoris-Voyagers

Plataforma para explorar y comparar experimentos de NASA PSI mediante un grafo de conocimiento, fichas normalizadas y un comparador de condiciones y resultados, con evidencia trazable a sus fuentes originales.

## Demo en producción

La aplicación web ya está desplegada en:

- https://vietoris-voyagers.vercel.app/

## Desarrollo de AETHER-SI

Con Node.js 24 LTS, ejecuta:

```sh
npm ci
npm run dev
```

Abre la consola local en http://localhost:3000. Selecciona un perfil de misión y ajusta su atmósfera para recalcular FSRS. Selecciona una instalación o investigación del grafo para filtrar el ranking, comparar condiciones y revisar la evidencia documental asociada.

### Validación

```sh
npm test
npm run typecheck
npm run build
```

La compilación genera un sitio estático en `out/`. El ranking, el grafo y la comparación funcionan en el navegador con el catálogo incluido. La muestra inicial contiene 12 corridas de BASS-II y SAIC, con fichas normalizadas y trazabilidad a referencias.

### Estado actual

La plataforma incluye la base operativa de exploración y comparación. Quedan pendientes ampliaciones como GravityBridge, el mapa de fases, la matriz de seguridad y la expansión del catálogo.
