import { CockpitGrid } from "../components/layout/CockpitGrid";
import { resolveProvider } from "../lib/llm";

export default function Home() {
  return <CockpitGrid assistantAiEnabled={Boolean(resolveProvider(process.env))} />;
}
