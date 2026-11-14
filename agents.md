# AGENTS.md — Directrices de Ingeniería y Arquitectura para AETHER-SI

## 1. Contexto de Misión y Alcance del Sistema
**Proyecto:** AETHER-SI (*Aerospace Environment Thermal Hazard & Experimental Ranking*)  
**Reto:** NASA Space Apps 2026 — *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data*  
**Propósito:** Plataforma web interactiva tipo *Mission Control* impulsada por un motor determinista de Super Inteligencia (SI) que resume, clasifica (ranking FSRS), compara (*Git-Diff Experimental*) e interpola investigaciones de combustión en microgravedad del repositorio **NASA PSI (Physical Sciences Informatics)**.

### Reglas de Oro del Dominio (Inquebrantables)
1. **Arquitectura "Zero-Download" de Medios Pesados:** NUNCA intentes descargar ni procesar archivos crudos `.cine`, `.avi` o `.tiff` en el cliente o servidor. Toda la inferencia opera sobre metadatos estructurados ISA-Tab y matrices experimentales pre-compiladas en `src/data/psi_seed_data.json`.
2. **Motor SI 100% Determinista y Offline-First:** El cálculo del *Fire Safety Relevance Score (FSRS)*, el diferenciador *Git-Diff Experimental* y el interpolador de gravedad parcial (*GravityBridge*) DEBEN ejecutarse mediante funciones matemáticas puras en TypeScript (`src/core/si-engine/`). Si se integra un LLM opcional para síntesis textual, el sistema debe tener un *fallback* determinista instantáneo basado en plantillas físicas para que la demo jamás falle por latencia o falta de API Key.
3. **Rigor Físico en Unidades:** Toda variable numérica en el código y la UI debe especificar su unidad en el identificador y en pantalla:
   - Presión total: `pressure_psia` (libras por pulgada cuadrada absolutas; $1\text{ atm} = 14.7\text{ psia}$).
   - Concentración de oxígeno: `oxygen_pct` ($\%$ molar/volumétrico, rango $15\%\text{ a }100\%$).
   - Gravedad efectiva: `gravity_g` (múltiplos de $g_0 = 9.81\text{ m/s}^2$; ej. ISS $= 0.0\text{g}$, Luna $= 0.165\text{g}$, Marte $= 0.38\text{g}$, Tierra $= 1.0\text{g}$).
   - Velocidad de flujo oxidante: `flow_velocity_cm_s` ($\text{cm/s}$, rango $0\text{ a }50\text{ cm/s}$).

---

## 2. Stack Tecnológico Bloqueado
No instales librerías fuera de esta lista sin autorización explícita:
- **Framework:** Next.js 15+ (App Router, `src/` directory) + React 19 + TypeScript (`strict: true`).
- **Estilos:** Tailwind CSS v3/v4 + `clsx` + `tailwind-merge`. Prohibido usar CSS-in-JS (`styled-components`, `@emotion`) o librerías pesadas de componentes como Material UI o Bootstrap.
- **Estado Global:** `zustand` (única fuente de verdad sincronizada entre los 4 paneles).
- **Grafo de Conocimiento (Propuesta B - PSI-Nexus):** `@xyflow/react` (React Flow) con nodos y aristas personalizados en SVG/Tailwind.
- **Gráficos Científicos y Mapa de Fases 2D (Propuesta A - GravityBridge):** `recharts` o SVG nativo de alta precisión con escalas matemáticas controladas.
- **Iconografía:** `lucide-react`.
- **Testing:** `vitest` para pruebas unitarias obligatorias del motor matemático `src/core/si-engine/`.

---

## 3. Arquitectura de Directorios (Separation of Concerns)
Mantén una separación estricta entre **Datos**, **Física/Motor SI**, **Estado** y **Presentación**:

```text
src/
├── types/
│   └── psi.ts                  # Contratos TypeScript estrictos (Investigations, Runs, Graph, Telemetry)
├── data/
│   ├── psi_seed_data.json      # Dataset maestro con experimentos clave de NASA PSI y corridas reales
│   └── mission_presets.ts      # Presets oficiales: ISS, Artemis Lunar Base, Lunar Rover, EVA Suit (4.3 psia), Earth Mining
├── core/
│   └── si-engine/              # LÓGICA PURA (Cero dependencias de React o DOM)
│       ├── fsrs-ranker.ts      # Algoritmo multicriterio Fire Safety Relevance Score (0-100)
│       ├── git-diff.ts         # Comparador de invariantes C(A,B), variables delta V_ind y delta R_dep
│       ├── gravity-bridge.ts   # Interpolador 0g -> Lunar/Martian g usando E-FIELD y números de Peclet/Grashof
│       ├── knowledge-graph.ts  # Generador de nodos y aristas (Puentes BRE-BASS, SAME-DAFT, CIR-MSG)
│       └── __tests__/          # Pruebas unitarias en Vitest para validar fórmulas físicas
├── store/
│   └── useAetherStore.ts       # Store global en Zustand que conecta Sliders, Grafo, Diff y Modo de Usuario
├── components/
│   ├── layout/
│   │   ├── TopNavbar.tsx       # Selector de Misión, Conmutador Ingeniero/Estudiante y Estado del Sistema
│   │   └── CockpitGrid.tsx     # Contenedor SPA 100vh sin scroll de página (4 paneles sincronizados)
│   ├── sidebar/
│   │   └── RankedDatasetList.tsx # Lista de experimentos ordenada en vivo por FSRS + Chips de filtro (CIR/MSG/Fuel)
│   ├── nexus/
│   │   ├── KnowledgeGraphCanvas.tsx # Grafo interactivo PSI-Nexus con botones de "Puentes Científicos"
│   │   └── ExperimentGitDiff.tsx    # Tabla comparativa lado a lado con código de colores semántico
│   └── simulator/
│       ├── AtmosphereSliders.tsx    # Sliders técnicos (Gravedad, %O2, Presión, Flujo)
│       ├── RegimePhaseDiagram.tsx   # Mapa 2D (Flujo vs %O2) con zonas de Quenching, Llama Fría y Blowoff
│       └── SafetyTriadMatrix.tsx    # Recomendaciones accionables: Prevención, Detección (SAME/DAFT) y Supresión (FLEX)
└── app/
    ├── layout.tsx              # Configuración de fuentes (Inter + JetBrains Mono) y tema oscuro forzado
    └── page.tsx                # Ensamblaje principal del dashboard