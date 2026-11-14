import type { Citation } from "../types/psi";

export const evidenceSources = {
  bass: { label: "NASA · BASS-II", url: "https://ntrs.nasa.gov/citations/20210011385" },
  saffire: { label: "NASA · Resultados de Saffire", url: "https://ntrs.nasa.gov/citations/20250002675" },
  smoke: { label: "NASA · SAME y DAFT", url: "https://ntrs.nasa.gov/citations/20070031686" },
  flex: { label: "NASA · FLEX", url: "https://doi.org/10.60555/mbq8-0451" },
  coolFlames: { label: "NASA · FLEX y CFI-G", url: "https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/" },
  coolFlameTemperatures: { label: "NASA · CFI", url: "https://gipoc.grc.nasa.gov/wp/fcf-cir/mdca/cfi/" },
  efield: { label: "NASA · E-FIELD", url: "https://science.nasa.gov/biological-physical/investigations/e-field-flames/" },
  artemis: { label: "NASA · Conferencia de Artemis II", url: "https://www.youtube.com/watch?v=_43Ei9eQVww" },
} satisfies Record<string, Citation>;

export const studentDescriptions: Record<string, string> = {
  "BASS-II": "Un ventilador pequeño mueve aire sobre una muestra. Los ensayos muestran cuándo la llama avanza y cuándo se apaga al cambiar el flujo.",
  "SAFFIRE-I": "Se encendió una muestra grande de tela dentro de una nave de carga vacía para observar cómo crece y se propaga un fuego.",
  "SAFFIRE-IV-V": "Estos ensayos usan tela y acrílico para seguir cuánto calor llega a la cabina y qué gases se producen.",
  "SAFFIRE-VI": "En una nave de carga vacía se probaron muestras de tela y acrílico. Así se puede estudiar cómo cambia el fuego a menor presión.",
  BRE: "Un quemador de gas imita algunos aspectos de un material que arde. Permite explorar por qué una llama pequeña puede mantenerse incluso con aire quieto.",
  SAME: "Calentar un material antes de que prenda puede generar partículas. SAME estudió qué tamaños produce y cómo responden los detectores.",
  "SAME-R": "Una segunda serie de pruebas cambió el material y el movimiento del aire para observar cómo cambian las partículas del humo.",
  DAFT: "En una cabina flotan partículas incluso en condiciones normales. DAFT midió ese fondo para ayudar a interpretar las señales de un detector.",
  FLEX: "Los investigadores encienden gotas y observan cómo disminuyen. A veces la luz desaparece y el combustible sigue reaccionando a menor temperatura.",
  "FLEX-2": "La segunda campaña estudia qué cambia cuando la gota se mueve o combina varios combustibles.",
  CFI: "Una gota puede parecer apagada y seguir consumiéndose despacio. Este estudio investiga esa etapa de combustión fría.",
  "CFI-G": "Una llama fría también puede aparecer al quemar gases. Una cámara sensible ayuda a ver las reacciones tras el apagado visible.",
  "E-FIELD": "Un campo eléctrico empuja partículas con carga dentro de la llama. Ese movimiento cambia su forma y permite estudiar cómo se transportan gases y calor.",
  SPICE: "Un flujo de aire alrededor de un chorro de gas permite estudiar cuándo la llama forma hollín.",
  SLICE: "Se observa cuándo la llama se separa de la boquilla al cambiar el movimiento del gas y del aire.",
};

export const historicalLessons = [
  { label: "Apollo 1", note: "En tierra, la cabina con oxígeno puro presurizado favoreció la rápida propagación del fuego.", url: "https://www.nasa.gov/history/55-years-ago-the-apollo-1-fire-and-its-aftermath/" },
  { label: "Apollo 13", note: "Una falla en un tanque de oxígeno del módulo de servicio cambió el rumbo de la misión.", url: "https://www.nasa.gov/missions/apollo/apollo-13-mission-details/" },
  { label: "Mir · 1997", note: "El incendio de un generador de oxígeno puso a prueba la respuesta de la tripulación.", url: "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/" },
  { label: "Artemis II", note: "La tripulación relató una alarma de humo. Es un caso para discutir cómo verificar una alerta en vuelo.", url: evidenceSources.artemis.url },
];

export const terrestrialApplications = [
  { label: "Detección en minería", note: "La detección temprana en minas y SAME/DAFT plantean un problema común: distinguir partículas de fondo de señales de incendio.", url: "https://ntrs.nasa.gov/citations/20070018916" },
  { label: "Niebla fina de agua", note: "Un proyecto de NASA estudió la supresión con niebla fina en espacios confinados.", url: "https://techport.nasa.gov/projects/8685" },
  { label: "Protección respiratoria", note: "La investigación de NASA sobre máscaras de emergencia inspiró equipos de protección contra humo en la Tierra.", url: "https://spinoff.nasa.gov/Spinoff2020/ps_4.html" },
];
