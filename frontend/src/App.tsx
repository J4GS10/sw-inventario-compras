/**
 * Raiz de la aplicacion: proveedor de sesion (RBAC) + gate de login + shell
 * (sidebar + topbar) + enrutado de vistas + command palette (Ctrl+K) + toasts.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { sincronizarBorradores } from "./core/borradores.js";
import { procesarCola } from "./core/outbox.js";
import { eventBus, AppEvents } from "./core/EventBus.js";
import { AppShell } from "./ui/AppShell.js";
import { CommandPalette, useCommandPalette } from "./ui/CommandPalette.js";
import { visibleLeaves, type NavLeaf } from "./nav.js";
import { AuthProvider, useAuth } from "./core/auth/AuthContext.js";
import { RefProvider } from "./core/RefContext.js";
import { useToast } from "./ui/Toast.js";
import LiveNotifier from "./ui/LiveNotifier.js";
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
        Cargando sesión...
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
  const { hasAnyPerm, sesion } = useAuth();
  const toast = useToast();
  const leaves = useMemo(() => visibleLeaves(hasAnyPerm), [hasAnyPerm]);
  // La pantalla donde iba el usuario se recuerda: tras un reinicio o cierre vuelve a ella, no al inicio.
  const clavePantalla = `erp.pantalla.${sesion?.idUsuario ?? 0}`;
  const [active, setActiveRaw] = useState<NavLeaf>(() => {
    let guardada: string | null = null;
    try {
      guardada = window.localStorage.getItem(clavePantalla);
    } catch {
      /* sin almacenamiento */
    }
    return (
      leaves.find((l) => l.id === guardada) ??
      leaves[0] ?? { id: "none", label: "", kind: "dashboard", icon: "grid" }
    );
  });
  const setActive = (leaf: NavLeaf): void => {
    setActiveRaw(leaf);
    try {
      window.localStorage.setItem(clavePantalla, leaf.id);
    } catch {
      /* sin almacenamiento */
    }
  };
  // Borradores respaldados en el servidor: al entrar, al volver a la pestana y al recuperar la red,
  // el trabajo a medias de este usuario se concilia con el servidor (asi sigue en cualquier equipo).
  const idUsuario = sesion?.idUsuario ?? 0;
  useEffect(() => {
    if (idUsuario === 0) return;
    let ultimo = 0;
    const sync = (): void => {
      if (Date.now() - ultimo < 30_000) return;
      ultimo = Date.now();
      void sincronizarBorradores(idUsuario);
    };
    sync();
    const alVolver = (): void => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", sync);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", sync);
    };
  }, [idUsuario]);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  // Cola de envios sin conexion: se vacia sola al volver la red (y cada 20 s mientras haya algo pendiente).
  useEffect(() => {
    if (idUsuario === 0) return;
    const vaciar = (): void => {
      void procesarCola(idUsuario).then((r) => {
        for (const e of r.enviados) toastRef.current.success(`Se envió tu ${e.item.titulo.toLowerCase()} que estaba pendiente`);
        for (const x of r.rechazados) toastRef.current.error(`No se pudo registrar tu ${x.item.titulo.toLowerCase()} pendiente: ${x.motivo}`);
        if (r.enviados.length > 0) eventBus.emit(AppEvents.EntityCreated, { resource: "cola" });
      });
    };
    vaciar();
    const t = window.setInterval(vaciar, 20_000);
    window.addEventListener("online", vaciar);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", vaciar);
    };
  }, [idUsuario]);
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
      <LiveNotifier />
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
