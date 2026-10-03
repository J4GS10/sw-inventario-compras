/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Contexto de sesion + RBAC. Resuelve el usuario autenticado (login real contra
 * /api/auth), valida la expiracion del token y expone helpers `hasPerm` /
 * `hasAnyPerm` para que la navegacion y las acciones muestren solo lo que
 * corresponde al rol.
 *
 * Patron: Facade sobre `HttpClient` + Observer implicito (React context) para
 * repropagar el cambio de sesion a toda la app.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { http } from "../HttpClient.js";
import { grants, grantsAny } from "./permisos.js";

export interface Sesion {
  readonly idUsuario: number;
  readonly username: string;
  readonly idEmpleado: number;
  readonly nombre: string;
  readonly roles: readonly string[];
  readonly permisos: readonly string[];
}

interface AuthState {
  readonly sesion: Sesion | null;
  /** true cuando ya se resolvio el estado inicial (token guardado -> /me). */
  readonly ready: boolean;
  /** Aviso para la pantalla de acceso (p. ej. "sesion expirada"). */
  readonly notice: string | null;
  login(username: string, password: string): Promise<void>;
  logout(): void;
  clearNotice(): void;
  hasPerm(code: string): boolean;
  hasAnyPerm(codes: readonly string[]): boolean;
}

const AuthContext = createContext<AuthState | null>(null);

/** Devuelve el `exp` (segundos epoch) del JWT, o null si no se puede leer. */
function jwtExp(token: string): number | null {
  const parts = token.split(".");
  const body = parts[1];
  if (parts.length !== 3 || body === undefined) return null;
  try {
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function tokenVigente(token: string): boolean {
  const exp = jwtExp(token);
  // Si no hay exp legible, dejamos que el backend decida en /me.
  return exp === null || exp * 1000 > Date.now();
}

export function AuthProvider(props: { children: ReactNode }): React.ReactElement {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Rehidratar: si hay token guardado y vigente, recuperar la sesion.
  useEffect(() => {
    let vivo = true;
    async function boot(): Promise<void> {
      const token = http.getToken();
      if (token === null) {
        setReady(true);
        return;
      }
      if (!tokenVigente(token)) {
        http.setToken(null);
        if (vivo) {
          setNotice("Tu sesion expiro. Vuelve a ingresar.");
          setReady(true);
        }
        return;
      }
      try {
        const s = await http.get<Sesion>("/api/auth/me");
        if (vivo) setSesion(s);
      } catch {
        http.setToken(null);
      } finally {
        if (vivo) setReady(true);
      }
    }
    void boot();
    return () => {
      vivo = false;
    };
  }, []);

  // El HttpClient avisa cuando un request autenticado recibe 401.
  useEffect(() => {
    http.onAuthExpired(() => {
      setSesion(null);
      setNotice("Tu sesion expiro. Vuelve a ingresar.");
    });
    return () => http.onAuthExpired(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const res = await http.post<{ token: string; sesion: Sesion }>(
        "/api/auth/login",
        { username, password },
      );
      http.setToken(res.token);
      setNotice(null);
      setSesion(res.sesion);
    },
    [],
  );

  const logout = useCallback((): void => {
    // Best-effort: deja la marca LOGOUT en la bitacora; no bloquea el cierre.
    void http.post("/api/auth/logout").catch(() => undefined);
    http.setToken(null);
    setSesion(null);
  }, []);

  const clearNotice = useCallback((): void => setNotice(null), []);

  const value = useMemo<AuthState>(
    () => ({
      sesion,
      ready,
      notice,
      login,
      logout,
      clearNotice,
      hasPerm: (code) =>
        sesion === null ? false : grants(sesion.permisos, code),
      hasAnyPerm: (codes) =>
        sesion === null ? false : grantsAny(sesion.permisos, codes),
    }),
    [sesion, ready, notice, login, logout, clearNotice],
  );

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
