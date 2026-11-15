import type { Citation } from "../../types/psi";

type HistoryKind = "overview" | "launch" | "experiment" | "conclusion" | "publication";

export interface AssistantHistoryFact {
  studyId: string;
  kind: HistoryKind;
  text: string;
  citation: Citation;
  /** Fecha ISO con la precisión publicada, sin completar meses o días desconocidos. */
  date?: string;
  endDate?: string;
}

const saffireViReport = {
  label: "NASA Glenn · cierre de Saffire VI",
  url: "https://www.nasa.gov/centers-and-facilities/glenn/flame-burns-out-on-nasas-long-running-spacecraft-fire-experiment/",
};
const saffireIReport = {
  label: "NASA Glenn · operaciones de Saffire I",
  url: "https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/",
};
const saffireIvVReport = {
  label: "NASA NTRS · resultados de Saffire IV y V",
  url: "https://ntrs.nasa.gov/citations/20210011521",
};
const flexReport = {
  label: "NASA NTRS · primeros resultados de FLEX",
  url: "https://ntrs.nasa.gov/citations/20150023456",
};
const sameRReport = {
  label: "NASA NTRS · resultados de SAME-R",
  url: "https://ntrs.nasa.gov/citations/20130000422",
};
const bassIiReport = {
  label: "NASA NTRS · resumen y matriz de ensayos BASS-II",
  url: "https://ntrs.nasa.gov/citations/20210011385",
};

export const assistantHistory: readonly AssistantHistoryFact[] = [
  {
    studyId: "SAFFIRE-VI", kind: "overview", citation: saffireViReport,
    text: "Saffire VI fue el último experimento de la serie de seguridad contra incendios de la NASA. Estudió la inflamabilidad y la propagación de llamas en microgravedad con mayor concentración de oxígeno y menor presión dentro del equipo de ensayo del carguero no tripulado Cygnus NG-19, después de su salida de la Estación Espacial Internacional (EEI).",
  },
  {
    studyId: "SAFFIRE-VI", kind: "launch", date: "2023-08-01",
    citation: { label: "NASA · lanzamiento de Cygnus NG-19", url: "https://www.nasa.gov/mission/nasas-northrop-grumman-crs-19/" },
    text: "Saffire VI viajó a bordo de Cygnus NG-19, que despegó el 1 de agosto de 2023, fecha local del lanzamiento.",
  },
  {
    studyId: "SAFFIRE-VI", kind: "experiment", date: "2023-12-22", endDate: "2023-12-24",
    citation: { label: "NASA JPL · fechas de operación de Saffire VI, p. 13", url: "https://microdevices.jpl.nasa.gov/interactivepdfs/pdf/2024%20MDL%20Annual%20Report.pdf" },
    text: "Los ensayos de Saffire VI se realizaron del 22 al 24 de diciembre de 2023, con Cygnus NG-19 ya separado de la EEI.",
  },
  {
    studyId: "SAFFIRE-VI", kind: "conclusion", date: "2024-01-09", citation: saffireViReport,
    text: "La misión de Saffire VI concluyó el 9 de enero de 2024 con la reentrada programada de Cygnus NG-19.",
  },
  {
    studyId: "SAFFIRE-VI", kind: "publication", date: "2024-02-14", citation: saffireViReport,
    text: "NASA Glenn publicó su nota sobre el cierre de Saffire VI el 14 de febrero de 2024.",
  },
  {
    studyId: "SAFFIRE-VI", kind: "publication", date: "2024-07",
    citation: { label: "NASA NTRS · resultados preliminares de Saffire VI", url: "https://ntrs.nasa.gov/citations/20240007488" },
    text: "La presentación de resultados preliminares de Saffire VI está asociada a la conferencia ICES de julio de 2024.",
  },
  {
    studyId: "SAFFIRE-I", kind: "overview", citation: saffireIReport,
    text: "Saffire I estudió la propagación de una llama sobre una muestra de algodón y fibra de vidrio a bordo de un carguero Cygnus no tripulado, en microgravedad, tras su salida de la EEI.",
  },
  {
    studyId: "SAFFIRE-I", kind: "launch", date: "2016-03-22", citation: saffireIReport,
    text: "Saffire I se lanzó a bordo de Cygnus el 22 de marzo de 2016.",
  },
  {
    studyId: "SAFFIRE-I", kind: "experiment", date: "2016-06-14", citation: saffireIReport,
    text: "El equipo encendió la muestra de Saffire I el 14 de junio de 2016 tras la separación de Cygnus de la EEI.",
  },
  {
    studyId: "SAFFIRE-I", kind: "conclusion", date: "2016-06-19", citation: saffireIReport,
    text: "Las operaciones del equipo de Saffire I concluyeron el 19 de junio de 2016, tras la transmisión de los datos.",
  },
  {
    studyId: "SAFFIRE-IV-V", kind: "overview", citation: saffireIvVReport,
    text: "Saffire IV y V estudiaron el crecimiento y la propagación de llamas sobre combustibles sólidos en microgravedad, junto con el transporte de calor y humo dentro de los cargueros Cygnus.",
  },
  {
    studyId: "SAFFIRE-IV-V", kind: "experiment", date: "2020-05", citation: saffireIvVReport,
    text: "Los ensayos de Saffire IV se realizaron en mayo de 2020 a bordo de Cygnus NG-13.",
  },
  {
    studyId: "SAFFIRE-IV-V", kind: "experiment", date: "2021-01", citation: saffireIvVReport,
    text: "Los ensayos de Saffire V se realizaron en enero de 2021 a bordo de Cygnus NG-14.",
  },
  {
    studyId: "FLEX", kind: "overview", citation: flexReport,
    text: "FLEX estudió la combustión y la extinción de llamas de gotas de combustible en microgravedad con el equipo MDCA del Combustion Integrated Rack de la EEI.",
  },
  {
    studyId: "FLEX", kind: "experiment", date: "2009-03", endDate: "2011-12", citation: flexReport,
    text: "El informe de NASA sobre los primeros ensayos de FLEX cubre el periodo comprendido entre marzo de 2009 y diciembre de 2011.",
  },
  {
    studyId: "BASS-II", kind: "overview", citation: bassIiReport,
    text: "BASS-II estudió cómo el flujo de aire, la concentración de oxígeno y las propiedades de las muestras afectan al comportamiento de la combustión de sólidos en microgravedad, dentro del Microgravity Science Glovebox de la EEI.",
  },
  {
    studyId: "BASS-II", kind: "experiment", date: "2014", citation: bassIiReport,
    text: "La matriz experimental de NASA documenta ensayos de BASS-II a bordo de la EEI en 2014.",
  },
  {
    studyId: "SAME", kind: "experiment", date: "2007",
    citation: { label: "NASA NTRS · SAME y su repetición en la EEI", url: "https://ntrs.nasa.gov/citations/20130004397" },
    text: "El experimento original SAME caracterizó aerosoles de humo en la EEI durante la Expedición 15, en 2007.",
  },
  {
    studyId: "SAME-R", kind: "overview", citation: sameRReport,
    text: "SAME-R amplió el estudio de los aerosoles liberados al calentar materiales de uso espacial por debajo de su punto de ignición.",
  },
  {
    studyId: "SAME-R", kind: "experiment", date: "2010-07", endDate: "2010-09", citation: sameRReport,
    text: "Los ensayos de SAME-R se realizaron a bordo de la EEI durante la Expedición 24, entre julio y septiembre de 2010.",
  },
];

export function findAssistantHistory(studyId: string): AssistantHistoryFact[] {
  return assistantHistory.filter((fact) => fact.studyId === studyId);
}

const historyTerms = /\b(?:cuando|fecha|fechas|cronologia|historia|inicio|ano|mes|dia|ocurr\w*|termin\w*|lanz\w*|despeg\w*|reentr\w*|reingres\w*|public\w*|when|date|timeline|launch\w*|publish\w*)\b/;
const milestoneTerms: readonly { kind: HistoryKind; pattern: RegExp }[] = [
  { kind: "launch", pattern: /\b(?:lanz\w*|despeg\w*|launch\w*)\b/ },
  { kind: "experiment", pattern: /\b(?:ensayos|pruebas|operaciones|tests|se realiz\w*)\b/ },
  { kind: "conclusion", pattern: /\b(?:termin\w*|conclu\w*|fin|finalizo|reentr\w*|reingres\w*|end\w*)\b/ },
  { kind: "publication", pattern: /\b(?:public\w*|publish\w*|reporte|article)\b/ },
];

function normalizeHistoryQuestion(question: string): string {
  return question.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "");
}

export function isAssistantHistoryQuestion(question: string): boolean {
  return historyTerms.test(normalizeHistoryQuestion(question));
}

/** La fecha de publicación se muestra cuando se pregunta por ella. */
export function formatAssistantHistory(facts: readonly AssistantHistoryFact[], question = "") {
  const normalized = normalizeHistoryQuestion(question);
  const requested = milestoneTerms.filter(({ pattern }) => pattern.test(normalized));
  const selected = requested.length ? facts.filter(({ kind }) => requested.some((entry) => entry.kind === kind))
    : facts.filter(({ kind }) => kind !== "overview" && kind !== "publication");
  if (!selected.length) return null;

  const overview = facts.find(({ kind }) => kind === "overview");
  const withOverview = overview && (!requested.length || /\b(?:explic\w*|que fue|que era|what was)\b/.test(normalized))
    ? [overview, ...selected] : selected;
  return {
    text: withOverview.map(({ text }) => text).join(" "),
    citations: [...new Map(withOverview.map(({ citation }) => [citation.url, citation])).values()],
  };
}
