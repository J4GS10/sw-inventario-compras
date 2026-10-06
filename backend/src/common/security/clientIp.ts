/**
 * Capa 6 - Componentes Comunes.
 * IP real del cliente. `X-Forwarded-For` lo escribe QUIEN QUIERA: solo se
 * respeta si la conexion directa viene de un proxy de confianza (loopback/red
 * privada, o los de `TRUST_PROXY`, lista separada por comas). Si no, un atacante
 * rota la cabecera y evade el limitador de intentos / contamina la auditoria.
 */

export function esLoopback(addr: string | undefined): boolean {
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function esProxyDeConfianza(addr: string | undefined): boolean {
  if (addr === undefined) return false;
  if (esLoopback(addr)) return true;
  const extra = (process.env["TRUST_PROXY"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(addr);
}

export function clientIpOf(socketAddr: string | undefined, forwardedFor: string | string[] | undefined): string | null {
  const fwd = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (esProxyDeConfianza(socketAddr) && typeof fwd === "string" && fwd.trim() !== "") {
    return fwd.split(",")[0]?.trim() ?? null;
  }
  return socketAddr ?? null;
}
