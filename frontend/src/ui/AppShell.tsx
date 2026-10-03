/**
 * Shell de la suite. Layout de dashboard robusto:
 *   [shell = alto de viewport, sin scroll de pagina]
 *     [sidebar fijo, su <nav> hace scroll si es largo]
 *     [columna de contenido]
 *       [topbar fija]
 *       [<main> = UNICO contenedor con scroll]
 * Asi la barra de navegacion y la topbar NO se mueven al bajar en el contenido.
 * skills/patron-diseno.md seccion 5.
 */

import { useState } from "react";
import Icon from "./Icon.js";
import { NotificacionesMenu } from "./NotificacionesMenu.js";
import { MODULES, visibleSections, type NavLeaf, type SystemModule } from "../nav.js";
import { applyTheme, getTheme, type ThemeMode } from "./theme.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { useEmpresaConfig } from "../core/useEmpresaConfig.js";
import { Button } from "./primitives.js";

const ROL_LABEL: Record<string, string> = {
  SOLICITANTE: "Solicitante",
  JEFE_INMEDIATO: "Jefe inmediato",
  GERENTE_AREA: "Gerente de area",
  COMPRADOR: "Depto. de Compras",
  GERENTE_FINANCIERO: "Gerente financiero",
  BODEGA: "Bodega",
  AUDITOR: "Auditor",
  ADMIN_COMPRAS: "Administrador",
};

export function AppShell(props: {
  activeId: string;
  onNavigate: (leaf: NavLeaf) => void;
  onNavigateById: (leafId: string) => void;
  onOpenSearch: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { sesion, hasAnyPerm, logout } = useAuth();
  const empresa = useEmpresaConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [openModule, setOpenModule] = useState<string>("compras");
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const m of MODULES)
      for (const sec of m.sections ?? [])
        if (sec.openByDefault) s.add(`${m.id}:${sec.label}`);
    return s;
  });
  const [theme, setTheme] = useState<ThemeMode>(getTheme());

  const width = collapsed ? 76 : 268;

  function cycleTheme(): void {
    const next: ThemeMode = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
  }

  function onModuleClick(mod: SystemModule): void {
    if (!mod.available) return;
    if (collapsed) {
      setCollapsed(false);
      setOpenModule(mod.id);
      return;
    }
    setOpenModule((cur) => (cur === mod.id ? "" : mod.id));
  }

  function toggleSection(key: string): void {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Overlay movil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: alto completo del shell; solo el <nav> hace scroll */}
      <aside
        className={
          "fixed left-0 top-0 z-40 flex h-[100dvh] flex-col transition-transform duration-200 md:static md:z-auto md:translate-x-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
        style={{ width, background: "var(--color-navy)", color: "var(--color-navy-ink)" }}
      >
        <div
          className="flex shrink-0 items-center gap-2.5 px-4"
          style={{ height: 60, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span
            className="grid place-items-center shrink-0"
            style={{ width: 32, height: 32, borderRadius: 9, background: "var(--color-brand)", color: "#fff" }}
          >
            <Icon name="grid" size={18} />
          </span>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-bold text-white text-[0.95rem]">{empresa.nombre}</div>
              <div className="text-[0.68rem]" style={{ color: "var(--color-navy-ink-soft)" }}>
                Gestion de Compras
              </div>
            </div>
          )}
          <button
            type="button"
            className="ml-auto md:hidden"
            style={{ color: "var(--color-navy-ink-soft)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menu"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {!collapsed && (
            <div className="px-2 pb-1.5 text-[0.62rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-navy-ink-faint)" }}>
              Modulos del sistema
            </div>
          )}

          {MODULES.map((mod) => {
            const modOpen = openModule === mod.id && !collapsed;
            return (
              <div key={mod.id} className="mb-0.5">
                <button
                  type="button"
                  title={collapsed ? mod.label : undefined}
                  onClick={() => onModuleClick(mod)}
                  disabled={!mod.available}
                  aria-expanded={mod.available ? modOpen : undefined}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[0.85rem] transition-fluent"
                  style={{
                    background: modOpen ? "var(--color-sidebar-hover)" : "transparent",
                    color: mod.available ? "var(--color-navy-ink)" : "var(--color-navy-ink-faint)",
                    fontWeight: 600,
                    cursor: mod.available ? "pointer" : "default",
                  }}
                >
                  <Icon name={mod.icon} size={18} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{mod.label}</span>
                      {mod.available ? (
                        <Icon name={modOpen ? "chevron-down" : "chevron-right"} size={15} />
                      ) : (
                        <span
                          className="text-[0.58rem] font-medium"
                          style={{ color: "var(--color-navy-ink-faint)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "1px 7px" }}
                        >
                          Proximo
                        </span>
                      )}
                    </>
                  )}
                </button>

                {modOpen &&
                  visibleSections(mod.sections ?? [], hasAnyPerm).map((section) => {
                    const secKey = `${mod.id}:${section.label}`;
                    const secOpen = openSections.has(secKey);
                    return (
                      <div key={section.label} className="mb-0.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSection(secKey)}
                          aria-expanded={secOpen}
                          className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-wider transition-fluent"
                          style={{ color: "var(--color-navy-ink-soft)" }}
                        >
                          <Icon name={section.icon} size={13} />
                          <span className="flex-1 text-left">{section.label}</span>
                          <Icon name={secOpen ? "chevron-down" : "chevron-right"} size={12} />
                        </button>

                        {secOpen && (
                          <div className="grid gap-0.5 pb-1">
                            {section.items.map((item) => {
                              const on = item.id === props.activeId;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    props.onNavigate(item);
                                    setMobileOpen(false);
                                  }}
                                  className="flex items-center gap-2.5 rounded-lg py-1.5 pl-6 pr-2.5 text-left text-[0.8rem] transition-fluent"
                                  style={{
                                    background: on ? "var(--color-brand)" : "transparent",
                                    color: on ? "#fff" : "var(--color-navy-ink-soft)",
                                    fontWeight: on ? 600 : 400,
                                  }}
                                >
                                  <Icon name={item.icon} size={15} />
                                  <span className="truncate">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((cval) => !cval)}
          className="hidden shrink-0 items-center gap-2 px-4 py-3 text-[0.78rem] md:flex"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "#8fa2c8" }}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
          {!collapsed && "Contraer"}
        </button>
      </aside>

      {/* Columna de contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-2 px-3 md:gap-3 md:px-6"
          style={{ height: 60, background: "var(--color-surface)", borderBottom: "1px solid var(--color-line)" }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            icon="menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          />

          <div className="flex items-center gap-2">
            <div
              className="grid place-items-center"
              style={{ width: 30, height: 30, borderRadius: 8, background: "var(--color-brand-050)", color: "var(--color-brand-ink)" }}
            >
              <Icon name="building" size={16} />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-[0.82rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                Grupo Corporativo
              </div>
              <div className="text-[0.68rem]" style={{ color: "var(--color-ink-faint)" }}>
                Sucursal: Casa Matriz
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={props.onOpenSearch}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8rem] md:px-3"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink-soft)" }}
          >
            <Icon name="search" size={15} />
            <span className="hidden md:inline">Buscar</span>
            <kbd className="chip hidden lg:inline-flex" style={{ background: "var(--color-surface)", color: "var(--color-ink-faint)" }}>
              Ctrl K
            </kbd>
          </button>

          <Button
            variant="ghost"
            size="sm"
            icon={theme === "dark" ? "moon" : "sun"}
            onClick={cycleTheme}
            title={`Tema: ${theme}`}
          />
          <NotificacionesMenu onNavigate={props.onNavigateById} />

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenu((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1"
              style={{ background: userMenu ? "var(--color-surface-2)" : "transparent" }}
              aria-haspopup="menu"
              aria-expanded={userMenu}
            >
              <span
                className="grid place-items-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 999, background: "var(--color-brand-050)", color: "var(--color-brand-ink)" }}
              >
                <Icon name="user" size={16} />
              </span>
              <span className="hidden leading-tight text-left md:block">
                <span className="block text-[0.78rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                  {sesion?.nombre ?? "Invitado"}
                </span>
                <span className="block text-[0.66rem]" style={{ color: "var(--color-ink-faint)" }}>
                  {ROL_LABEL[sesion?.roles[0] ?? ""] ?? sesion?.roles[0] ?? "Sin rol"}
                </span>
              </span>
              <Icon name="chevron-down" size={14} />
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-1 w-60 rounded-xl p-2"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    boxShadow: "var(--shadow-lg)",
                  }}
                >
                  <div className="px-2 py-1.5">
                    <div className="text-[0.82rem] font-semibold" style={{ color: "var(--color-heading)" }}>
                      {sesion?.nombre}
                    </div>
                    <div className="text-[0.7rem]" style={{ color: "var(--color-ink-faint)" }}>
                      @{sesion?.username} · {(sesion?.roles ?? []).map((r) => ROL_LABEL[r] ?? r).join(", ") || "sin rol"}
                    </div>
                  </div>
                  <div className="my-1" style={{ borderTop: "1px solid var(--color-line)" }} />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenu(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.82rem]"
                    style={{ color: "var(--color-danger)" }}
                  >
                    <Icon name="lock" size={15} />
                    Cerrar sesion
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* UNICO scroller. `min-w-0` (igual que `min-h-0` para el eje vertical):
            un hijo flex con `flex-1` por defecto tiene min-width:auto, es
            decir, NUNCA se encoge por debajo del ancho natural de su
            contenido. Sin esto, una fila de acciones ancha (p. ej. el
            Comparativo con 3 botones) empuja <main> mas alla del viewport en
            vez de envolver — como `html{overflow-x:hidden}` no da scroll,
            el contenido que se sale queda inalcanzable. */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] p-3 sm:p-4 md:p-6">{props.children}</div>
        </main>
      </div>
    </div>
  );
}
