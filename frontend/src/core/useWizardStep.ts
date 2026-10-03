/**
 * Capa 2+3 (frontend) - Soporte.
 * Hook generico para un asistente guiado (wizard) de pasos encadenados.
 * Analogo a `StateMachine<TState>` del backend, pero para una secuencia de
 * PANTALLAS en vez de un documento: el esqueleto de avance es fijo
 * (Template Method); cada asistente concreto solo aporta su union de pasos
 * (`TPaso`) y que renderizar en cada uno.
 *
 * Resuelve un problema que se repetia en cada asistente escrito a mano
 * (AsistenteCotizacion): cuando el paso montado es un <DocumentForm>, este
 * llama `onSuccess` y LUEGO `onClose` en toda alta exitosa — hay que
 * distinguir "avanzamos de paso" (ignorar ese onClose que sigue) de "el
 * usuario cancelo de verdad" (si cerrar el asistente completo).
 */
import { useRef, useState } from "react";

export function useWizardStep<TPaso>(inicial: TPaso): {
  readonly paso: TPaso;
  readonly setPaso: (p: TPaso) => void;
  /** Pasa al siguiente paso y marca que el proximo onClose del paso actual no es una cancelacion real. */
  readonly avanzar: (siguiente: TPaso) => void;
  /** Usar como `onClose` del paso montado: distingue avance real de cancelacion. */
  readonly cerrarSiNoAvanzo: (onCancelar: () => void) => void;
} {
  const [paso, setPaso] = useState<TPaso>(inicial);
  const avanzandoRef = useRef(false);

  function avanzar(siguiente: TPaso): void {
    avanzandoRef.current = true;
    setPaso(siguiente);
  }

  function cerrarSiNoAvanzo(onCancelar: () => void): void {
    if (avanzandoRef.current) {
      avanzandoRef.current = false;
      return;
    }
    onCancelar();
  }

  return { paso, setPaso, avanzar, cerrarSiNoAvanzo };
}
