import { CockpitGrid } from "../components/layout/CockpitGrid";

export default function Home() {
  return <CockpitGrid assistantAiEnabled={process.env.ENABLE_ASSISTANT_AI === "true"} />;
}
