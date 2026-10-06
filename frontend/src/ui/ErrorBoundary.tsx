/**
 * Red de seguridad de la interfaz: si un componente lanza durante el render, el
 * usuario ve un mensaje claro con opciones (reintentar / recargar) en vez de una
 * pantalla en blanco. El error completo va a la consola para soporte.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}
interface State {
  readonly error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error de interfaz no controlado", error, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div role="alert" className="grid min-h-screen place-items-center p-6" style={{ background: "var(--color-bg, #f6f7f9)" }}>
        <div className="card grid max-w-md gap-3 p-6 text-center">
          <h1 className="text-lg font-semibold" style={{ color: "var(--color-heading)" }}>
            Algo salió mal en esta pantalla
          </h1>
          <p className="text-[0.9rem]" style={{ color: "var(--color-ink-soft)" }}>
            Tu información no se perdió. Puedes volver a intentarlo o recargar la página.
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
              Reintentar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
