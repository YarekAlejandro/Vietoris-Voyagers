"use client";

import { LayoutDashboard, Orbit, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation() {
  const path = usePathname();
  return <nav className="workspace-navigation" aria-label="Navegación principal">
    <div>
      <span className="workspace-name"><Orbit size={19} aria-hidden /> AETHER<span>-SI</span></span>
      <Link href="/" aria-current={path === "/" ? "page" : undefined}><Sparkles size={15} aria-hidden /> Asistente IA</Link>
      <Link href="/consola" aria-current={path === "/consola" ? "page" : undefined}><LayoutDashboard size={15} aria-hidden /> Consola de evidencia</Link>
    </div>
  </nav>;
}
