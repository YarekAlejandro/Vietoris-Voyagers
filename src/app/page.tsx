import { CockpitGrid } from "../components/layout/CockpitGrid";
import { resolveProvider } from "../lib/llm";

export default function Home() {
  const speechEnabled = Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim());
  return <CockpitGrid assistantAiEnabled={Boolean(resolveProvider(process.env))} speechEnabled={speechEnabled} />;
}
