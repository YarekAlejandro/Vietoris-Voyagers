# AETHER-SI · Vietoris-Voyagers

AETHER-SI es una consola para explorar experimentos de combustión y seguridad contra incendios en microgravedad. Reúne registros de NASA Physical Sciences Informatics (PSI) y literatura de NASA Technical Reports Server (NTRS) para comparar condiciones y resultados con sus fuentes.

[Demo en Vercel](https://vietoris-voyagers-delta.vercel.app/)

## Explora la consola

1. **Busca evidencia.** Prueba `llamas frías`, `smoke detection`, `acrílico a baja presión` o una accesión como `PSI-99`. El buscador admite términos en español e inglés.
2. **Elige un escenario.** Selecciona un perfil de misión o ajusta gravedad, oxígeno, presión y flujo en **Atmósfera**. El índice FSRS reordena la evidencia cuantitativa según su pertinencia para el escenario.
3. **Recorre PSI-Nexus.** Explora los vínculos entre instalaciones, estudios, temas y corridas. Abre **Condiciones** para ver la cobertura experimental frente al escenario activo.
4. **Compara en A/B.** Usa `+A` y `+B` para cargar evidencias en **Comparación experimental**. La tabla muestra los resultados, los cambios de condiciones y los campos sin dato con sus fuentes.
5. **Amplía el panel.** El botón del encabezado de **PSI-Nexus** y **Comparación experimental** amplía cada panel a casi toda la pantalla. Usa el mismo control o `Esc` para restaurarlo. La comparación conserva las selecciones A/B.

La ficha reúne la evidencia seleccionada y su contexto de prevención, detección y supresión cuando está disponible. El modo **Estudiante** añade explicaciones, casos históricos y aplicaciones terrestres.

## Fuentes y respaldo

La base curada contiene **15 estudios, 23 corridas normalizadas y 5 perfiles de referencia**. La consulta a NASA PSI incorpora investigaciones de **Combustion Science** y conserva los registros curados. Activa **Ver todo PSI** para consultar otras disciplinas. Los conteos de la interfaz provienen de la respuesta del servicio.

Los perfiles incorporados desde PSI indican de dónde salen sus cifras. Las fichas sin perfil cuantitativo aparecen en el catálogo y pueden compararse, con «—» en los campos ausentes. El **Radar NTRS** identifica sus publicaciones como literatura técnica y las enlaza con las fichas cuando corresponde.

Si PSI deja de responder, la aplicación usa un snapshot versionado de Combustion Science. Para regenerarlo, ejecuta `npm run snapshot:psi` con acceso a NASA PSI. La lectura de CSV públicos pequeños es opcional y está desactivada por defecto. [Integración y respaldo de NASA PSI](docs/psi-live.md)

## Desarrollo local

Con Node.js 24 LTS, ejecuta:

```sh
npm ci
npm run dev
```

[Abre la consola local](http://localhost:3000).

**Interpretar** usa un resumen automático por defecto. Para activar la redacción opcional con Claude o Gemini, copia `.env.example` a `.env.local` y configura las variables del proveedor. El motor calcula el FSRS y las diferencias A/B en la aplicación. [Variables de entorno](.env.example)

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Para probar la compilación de producción localmente, ejecuta `npx next start`. La aplicación usa Next.js y React, Zustand para el estado compartido, React Flow para el grafo y Vitest para las pruebas.

## Licencia y atribución

Consulta la [licencia del repositorio](LICENSE). AETHER-SI es un proyecto independiente. Cada ficha enlaza a su fuente y conserva la licencia declarada cuando estos metadatos están disponibles.
