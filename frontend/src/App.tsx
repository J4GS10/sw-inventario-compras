/**
 * Raiz de la aplicacion: proveedor de sesion (RBAC) + gate de login + shell
 * (sidebar + topbar) + enrutado de vistas + command palette (Ctrl+K) + toasts.
 */

import { useMemo, useState } from "react";
import { AppShell } from "./ui/AppShell.js";
import { CommandPalette, useCommandPalette } from "./ui/CommandPalette.js";
import { visibleLeaves, type NavLeaf } from "./nav.js";
import { AuthProvider, useAuth } from "./core/auth/AuthContext.js";
import { RefProvider } from "./core/RefContext.js";
import { useToast } from "./ui/Toast.js";
import LoginScreen from "./modules/LoginScreen.js";
import Dashboard from "./modules/Dashboard.js";
import { CatalogScreen } from "./modules/compras/catalogPages.js";
import DocumentoList from "./modules/compras/DocumentoList.js";
import ComparativoView from "./modules/compras/ComparativoView.js";
import HistorialProveedorView from "./modules/compras/HistorialProveedorView.js";
import ReportesView from "./modules/compras/ReportesView.js";
import LiquidacionCxP from "./modules/compras/LiquidacionCxP.js";

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate(): React.ReactElement {
  const { ready, sesion } = useAuth();

  if (!ready) {
    return (
      <div
        className="grid min-h-[100dvh] place-items-center"
        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-faint)" }}
      >
        Cargando sesion...
      </div>
    );
  }
  if (sesion === null) return <LoginScreen />;
  return (
    <RefProvider>
      <Suite key={sesion.idUsuario} />
    </RefProvider>
  );
}

function Suite(): React.ReactElement {
  const { hasAnyPerm } = useAuth();
  const toast = useToast();
  const leaves = useMemo(() => visibleLeaves(hasAnyPerm), [hasAnyPerm]);
  const [active, setActive] = useState<NavLeaf>(() => leaves[0] ?? { id: "none", label: "", kind: "dashboard", icon: "grid" });
  const [comparativoTick, setComparativoTick] = useState(0);
  const palette = useCommandPalette();

  function navigate(leaf: NavLeaf): void {
    setActive(leaf);
  }

  /**
   * Solo navega dentro de `leaves` (lo que el rol puede ver). Antes caia a
   * `ALL_LEAVES` y dejaba llegar a pantallas fuera del menu (FlowStepper, KPIs
   * del Dashboard) que luego el backend rechazaba con 403.
   */
  function navigateById(leafId: string): void {
    const leaf = leaves.find((l) => l.id === leafId);
    if (leaf !== undefined) {
      setActive(leaf);
    } else {
      toast.info("No tienes acceso a esa pantalla");
    }
  }

  function abrirComparativo(idSolicitud: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set("solicitud", String(idSolicitud));
    window.history.replaceState(null, "", url.toString());
    setComparativoTick((t) => t + 1);
    const comp = leaves.find((l) => l.id === "com-an-comparativo");
    if (comp !== undefined) setActive(comp);
  }

  return (
    <>
      <AppShell
        activeId={active.id}
        onNavigate={navigate}
        onNavigateById={navigateById}
        onOpenSearch={() => palette.setOpen(true)}
      >
        {active.kind === "dashboard" && <Dashboard onNavigateById={navigateById} />}
        {active.kind === "catalogo" && <CatalogScreen key={active.key} configKey={active.key ?? ""} />}
        {active.kind === "documento" && (
          <DocumentoList
            key={active.key}
            configKey={active.key ?? ""}
            onAbrirComparativo={abrirComparativo}
            onFlowStep={navigateById}
          />
        )}
        {active.kind === "comparativo" && (
          <ComparativoView key={comparativoTick} onNavigateById={navigateById} />
        )}
        {active.kind === "historial" && <HistorialProveedorView />}
        {active.kind === "reportes" && <ReportesView />}
        {active.kind === "liquidacion" && <LiquidacionCxP />}
      </AppShell>

      <CommandPalette
        open={palette.open}
        onClose={() => palette.setOpen(false)}
        onPick={navigate}
        leaves={leaves}
      />
    </>
  );
}
