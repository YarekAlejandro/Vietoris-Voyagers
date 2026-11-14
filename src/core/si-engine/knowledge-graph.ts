import type { Investigation } from "../../types/psi";

export const facilities = {
  MSG: "Microgravity Science Glovebox",
  CYGNUS: "Vehículo Cygnus",
  CIR: "Combustion Integrated Rack",
} as const;

export function buildKnowledgeGraph(investigations: readonly Investigation[]) {
  const facilityIds = [...new Set(investigations.map((study) => study.facility))];
  return {
    facilities: facilityIds.map((id) => ({ id, label: facilities[id] })),
    investigations,
    edges: investigations.map((study) => ({
      id: `${study.facility}-${study.id}`, source: study.facility, target: study.id,
    })),
  };
}
