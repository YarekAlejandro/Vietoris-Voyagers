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

La compilación genera un sitio estático en `out/`. El ranking, el grafo y la comparación funcionan en el navegador con el catálogo incluido. El catálogo cubre 8 investigaciones y 23 corridas, cada una con su cita a la tabla o sección del informe de NASA:
- **Prevención:** 12 corridas de BASS-II y Saffire.
- **Detección:** 7 corridas de humo de SAME y SAME-R (PSI-102 y PSI-101).
- **Supresión:** 4 corridas de gotas de FLEX (PSI-69).

FLEX-2 (PSI-68) aparece en el grafo sin corridas, porque su tabla en PSI solo reporta rangos. La gravedad orbital se normaliza a 0 g. Cuando una tabla no mide un eje de la atmósfera, la corrida usa un valor nominal documentado y la interfaz lo marca como «Nominal». Es el caso del O₂ y la presión de cabina en SAME, y del flujo en FLEX.

### Estado actual

La plataforma incluye la base operativa de exploración y comparación. Quedan pendientes ampliaciones como GravityBridge, el mapa de fases, la matriz de seguridad y la expansión del catálogo.
