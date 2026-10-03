/**
 * Asistente guiado: encadena RFQ -> una cotizacion por cada proveedor
 * invitado, sin que el usuario tenga que salir a buscar la siguiente
 * pantalla ni copiar IDs a mano. No es una pantalla nueva: reutiliza el mismo
 * `DocumentForm`/`DOCUMENT_FORMS` de siempre, solo pre-llenado y encadenado.
 * Al terminar entrega el control al Comparativo (adjudicar + generar OC ya
 * estan unidos ahi en una sola pantalla).
 */

import { DocumentForm } from "../../components/DocumentForm.js";
import { DOCUMENT_FORMS } from "./documentForms.js";
import { http } from "../../core/HttpClient.js";
import { messageOf } from "../../core/errors.js";
import { useWizardStep } from "../../core/useWizardStep.js";
import { useToast } from "../../ui/Toast.js";

interface Proveedor {
  readonly idProveedor: number;
  readonly nombre: string;
}

type Paso =
  | { tipo: "rfq" }
  | { tipo: "cotizacion"; idRfq: number; proveedores: readonly Proveedor[]; indice: number };

export function AsistenteCotizacion(props: {
  idSolicitud: number;
  onClose: () => void;
  onFinish: (idSolicitud: number) => void;
}): React.ReactElement {
  const toast = useToast();
  const { paso, avanzar, cerrarSiNoAvanzo } = useWizardStep<Paso>({ tipo: "rfq" });

  function alCrearRfq(created?: Record<string, unknown>): void {
    const idRfq = Number(created?.["idRfq"]);
    if (!Number.isInteger(idRfq) || idRfq <= 0) {
      toast.error("No se pudo continuar: el RFQ no devolvio un id valido");
      props.onClose();
      return;
    }
    void (async () => {
      try {
        const page = await http.list<Record<string, unknown>>(
          `/api/com/ref/rfq/${idRfq}/proveedores`,
        );
        const proveedores: Proveedor[] = page.data.map((r) => ({
          idProveedor: Number(r["idProveedor"]),
          nombre: String(r["razonSocial"] ?? `Proveedor ${String(r["idProveedor"] ?? "")}`),
        }));
        if (proveedores.length === 0) {
          toast.error("El RFQ no quedo con proveedores invitados");
          props.onClose();
          return;
        }
        toast.info(
          `RFQ creado — registra la cotizacion de ${proveedores[0]!.nombre} (1 de ${proveedores.length})`,
        );
        avanzar({ tipo: "cotizacion", idRfq, proveedores, indice: 0 });
      } catch (e: unknown) {
        toast.error(messageOf(e));
        props.onClose();
      }
    })();
  }

  function siguienteCotizacion(): void {
    if (paso.tipo !== "cotizacion") return;
    const siguiente = paso.indice + 1;
    if (siguiente < paso.proveedores.length) {
      toast.info(
        `Cotizacion de ${paso.proveedores[siguiente]!.nombre} (${siguiente + 1} de ${paso.proveedores.length})`,
      );
      avanzar({ ...paso, indice: siguiente });
      return;
    }
    toast.success("Cotizaciones registradas — abriendo el comparativo");
    props.onFinish(props.idSolicitud);
  }

  function saltarProveedor(): void {
    // Cancelar esta cotizacion puntual no pierde nada: el RFQ y las
    // cotizaciones ya guardadas quedan; se completa despues desde la
    // pantalla de Cotizaciones si hace falta. Se interpreta como "saltar
    // este proveedor" y se sigue con el siguiente.
    toast.info("Proveedor saltado — puedes registrar su cotizacion despues desde Cotizaciones");
    siguienteCotizacion();
  }

  if (paso.tipo === "rfq") {
    return (
      <DocumentForm
        open
        config={DOCUMENT_FORMS["rfq"]!}
        initial={{ header: { idSolicitud: String(props.idSolicitud) }, lines: [{}, {}, {}] }}
        onClose={() => cerrarSiNoAvanzo(props.onClose)}
        onSuccess={alCrearRfq}
      />
    );
  }

  const proveedor = paso.proveedores[paso.indice]!;
  return (
    <DocumentForm
      key={proveedor.idProveedor}
      open
      config={DOCUMENT_FORMS["cotizaciones"]!}
      initial={{ header: { idRfq: String(paso.idRfq), idProveedor: String(proveedor.idProveedor) } }}
      onClose={() => cerrarSiNoAvanzo(saltarProveedor)}
      onSuccess={siguienteCotizacion}
    />
  );
}
