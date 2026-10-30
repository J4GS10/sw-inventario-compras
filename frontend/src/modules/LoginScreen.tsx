/**
 * Pantalla de acceso. El login valida usuario + contrasena contra /api/auth
 * (hash scrypt en el backend, bloqueo por intentos fallidos). Los perfiles de
 * demostracion (uno por rol) entran con la contrasena de demo comun para
 * comprobar que cada departamento ve solo lo que le corresponde.
 *
 * Diseno: skills/patron-diseno.md — labels visibles, foco visible, el estado de
 * error cambia borde y texto (no solo color), boton primario, retroalimentacion
 * inmediata (toast + mensaje inline), navegacion por teclado.
 */

import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon.js";
import { Button } from "../ui/primitives.js";
import { useToast } from "../ui/Toast.js";
import { http } from "../core/HttpClient.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { useEmpresaConfig } from "../core/useEmpresaConfig.js";
import { messageOf } from "../core/errors.js";

interface UsuarioDemo {
  readonly username: string;
  readonly nombre: string;
  readonly roles: readonly string[];
}

/** Contrasena compartida por los usuarios de demostracion (ver 02_seg_rbac.sql). */
const DEMO_PASSWORD = "compras.demo";

const ROL_LABEL: Record<string, string> = {
  SOLICITANTE: "Solicitante",
  JEFE_INMEDIATO: "Jefe inmediato",
  GERENTE_AREA: "Gerente de área",
  COMPRADOR: "Depto. de Compras",
  GERENTE_FINANCIERO: "Gerente financiero",
  BODEGA: "Bodega",
  AUDITOR: "Auditor",
  ADMIN_COMPRAS: "Administrador",
};

export default function LoginScreen(): React.ReactElement {
  const { login, notice, clearNotice } = useAuth();
  const empresa = useEmpresaConfig();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioDemo[]>([]);
  const [manual, setManual] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Acceso rápido por perfil: siempre se consulta. Si el servidor lo desactiva
    // (APP_LOGIN_DEMO=0) responde 404 y queda solo el formulario de usuario y contraseña.
    let vivo = true;
    http
      .get<UsuarioDemo[]>("/api/auth/usuarios-demo")
      .then((list) => {
        if (vivo) setUsuarios(list);
      })
      .catch(() => {
        /* el picker es opcional; se puede escribir el usuario */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const demo = useMemo(
    () => usuarios.filter((u) => u.username !== "sistema"),
    [usuarios],
  );

  async function entrar(username: string, pass: string): Promise<void> {
    const u = username.trim();
    if (u === "" || pass === "") {
      setError("Ingrese usuario y contraseña.");
      return;
    }
    setBusy(u);
    setError(null);
    clearNotice();
    try {
      await login(u, pass);
    } catch (e: unknown) {
      const msg = messageOf(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;

  return (
    <div
      className="grid min-h-[100dvh] place-items-center p-4"
      style={{ background: "var(--color-surface-2)" }}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl p-6 sm:p-8"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span
            className="grid place-items-center shrink-0"
            style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-brand)", color: "#fff" }}
          >
            <Icon name="grid" size={22} />
          </span>
          <div className="leading-tight">
            <div className="text-[1.05rem] font-bold" style={{ color: "var(--color-heading)" }}>
              {empresa.nombre}
            </div>
            <div className="text-[0.75rem]" style={{ color: "var(--color-ink-faint)" }}>
              Módulo de Gestión de Compras
            </div>
          </div>
        </div>

        {notice !== null && (
          <div
            role="status"
            className="mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[0.8rem]"
            style={{
              background: "var(--color-brand-050)",
              color: "var(--color-brand-ink)",
              border: "1px solid var(--color-line)",
            }}
          >
            <Icon name="clock" size={15} />
            <span>{notice}</span>
          </div>
        )}

        <p className="mb-3 text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
          Elija un perfil para ingresar. Cada rol ve solo las secciones y acciones
          que le corresponden en el flujo de compras.
        </p>

        <div className="grid gap-2">
          {demo.map((u) => {
            const rol = u.roles[0] ?? "";
            return (
              <button
                key={u.username}
                type="button"
                disabled={anyBusy}
                onClick={() => void entrar(u.username, DEMO_PASSWORD)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-fluent"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-line)",
                  opacity: anyBusy && busy !== u.username ? 0.5 : 1,
                }}
              >
                <span
                  className="grid place-items-center shrink-0"
                  style={{ width: 34, height: 34, borderRadius: 999, background: "var(--color-brand-050)", color: "var(--color-brand-ink)" }}
                >
                  <Icon name="user" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.86rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {u.nombre}
                  </span>
                  <span className="block truncate text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
                    {ROL_LABEL[rol] ?? rol} · {u.username}
                  </span>
                </span>
                {busy === u.username ? (
                  <Icon name="clock" size={16} />
                ) : (
                  <Icon name="chevron-right" size={16} />
                )}
              </button>
            );
          })}
        </div>

        <div
          className="my-4 flex items-center gap-3 text-[0.7rem] uppercase tracking-wide"
          style={{ color: "var(--color-ink-faint)" }}
        >
          <span className="h-px flex-1" style={{ background: "var(--color-line)" }} />
          o con usuario y contraseña
          <span className="h-px flex-1" style={{ background: "var(--color-line)" }} />
        </div>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar(manual, password);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Usuario
            </span>
            <input
              className="field-control"
              value={manual}
              placeholder="usuario"
              autoComplete="username"
              aria-invalid={error !== null}
              disabled={anyBusy}
              onChange={(e) => {
                setManual(e.target.value);
                if (error !== null) setError(null);
              }}
              style={error !== null ? { borderColor: "var(--color-danger)" } : undefined}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Contraseña
            </span>
            <div className="relative">
              <input
                className="field-control"
                type={showPass ? "text" : "password"}
                value={password}
                placeholder="contraseña"
                autoComplete="current-password"
                aria-invalid={error !== null}
                disabled={anyBusy}
                style={{
                  paddingRight: 68,
                  ...(error !== null ? { borderColor: "var(--color-danger)" } : {}),
                }}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error !== null) setError(null);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-[0.72rem] font-semibold"
                style={{ color: "var(--color-brand-ink)" }}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          {error !== null && (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-[0.78rem]"
              style={{ color: "var(--color-danger)" }}
            >
              <Icon name="x" size={14} />
              <span>{error}</span>
            </p>
          )}

          <Button
            type="submit"
            icon="lock"
            disabled={anyBusy || manual.trim() === "" || password === ""}
          >
            {busy === manual.trim() ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-4 text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
          Contraseña de los perfiles de demostración:{" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--color-ink-soft)" }}>
            {DEMO_PASSWORD}
          </span>
        </p>
      </div>
    </div>
  );
}
