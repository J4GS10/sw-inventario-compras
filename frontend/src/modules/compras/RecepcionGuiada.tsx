/**
 * Asistente guiado de Recepcion (rol Bodega) bajo esquema de CONTEO CIEGO:
 * elegir la orden -> una fila por cada renglon PENDIENTE pero SIN mostrar la
 * cantidad esperada, la cantidad pendiente ni el costo unitario (el
 * bodeguero solo ve que identifica el renglon; cuenta fisicamente e ingresa
 * lo que encontro, sin valor de referencia que lo sesgue) -> confirmar antes
 * de enviar.
 *
 * El backend SI valida internamente que no se reciba mas de lo pendiente
 * (`RecepcionService.registrar`), pero ese mensaje de error trae los numeros
 * exactos (ordenado/procesado/pendiente) — revelarlo aqui violaria el conteo
 * ciego, asi que `registrar()` lo cambia por un aviso generico.
 *
 * Reemplaza, solo para Recepciones, el flujo generico de `DocumentForm`
 * (agregar lineas a mano y elegir el renglon de un select una por una).
 * Reutiliza los mismos `headerFields` de `DOCUMENT_FORMS.recepciones` (mismas
 * opciones, mismas validaciones) y el hook `useWizardStep` (igual que
 * AsistenteCotizacion) para el esqueleto de avance entre pasos.
 */
import { useEffect, useState } from "react";
import { http } from "../../core/HttpClient.js";
import { messageOf } from "../../core/errors.js";
import { formatQty } from "../../core/format.js";
import { normalizarTexto } from "../../core/search.js";
import { useWizardStep } from "../../core/useWizardStep.js";
import { Field, FormGrid, type FieldValue } from "../../ui/Field.js";
import { Modal } from "../../ui/Modal.js";
import { Button } from "../../ui/primitives.js";
import { useToast } from "../../ui/Toast.js";
import { useOptions, withResolvedOptions } from "../../components/formSupport.js";
import { DOCUMENT_FORMS } from "./documentForms.js";

const HEADER_FIELDS = DOCUMENT_FORMS["recepciones"]!.headerFields;

/** Mensaje generico cuando el backend rechaza el conteo por exceder lo pendiente — sin revelar numeros (conteo ciego). */
const MENSAJE_CONTEO_RECHAZADO =
  "El conteo no coincide con lo que el sistema espera para este renglón. Vuelve a contar físicamente y, si la diferencia persiste, avisa a tu supervisor.";

interface LineaCaptura {
  readonly idOcDetalle: number;
  readonly descripcion: string;
  /** Codigo del articulo: lo que lee el lector de codigos de barras. */
  readonly codigo: string | null;
  readonly cantidadRecibida: string;
  readonly cantidadRechazada: string;
  /** Lo pendiente según el sistema. NUNCA se muestra: solo se usa si el bodeguero declara "todo conforme". */
  readonly esperada: number;
  /** El bodeguero declaró que contó físicamente y coincide con lo ordenado (no se muestran cantidades). */
  readonly conforme: boolean;
}

type Header = Record<string, FieldValue>;

type Paso =
  | { tipo: "datos" }
  | { tipo: "cantidades"; header: Header; lineas: readonly LineaCaptura[] }
  | { tipo: "confirmar"; header: Header; lineas: readonly LineaCaptura[] };

export function RecepcionGuiada(props: {
  open: boolean;
  onClose: () => void;
  onSuccess: (created?: Record<string, unknown>) => void;
}): React.ReactElement {
  const toast = useToast();
  const { paso, setPaso, avanzar, cerrarSiNoAvanzo } = useWizardStep<Paso>({ tipo: "datos" });
  const [header, setHeader] = useState<Header>({});
  const [showErrors, setShowErrors] = useState(false);
  const [cargandoLineas, setCargandoLineas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [declaroConteo, setDeclaroConteo] = useState(false);
  const headerOpts = useOptions(props.open ? HEADER_FIELDS : [], header);

  useEffect(() => {
    if (!props.open) return;
    setHeader({});
    setShowErrors(false);
    setDeclaroConteo(false);
    setPaso({ tipo: "datos" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  function faltaDatos(): string | null {
    for (const f of HEADER_FIELDS) {
      if (f.required === true && String(header[f.name] ?? "").trim() === "") {
        return `${f.label}: requerido`;
      }
    }
    return null;
  }

  async function irACantidades(): Promise<void> {
    const err = faltaDatos();
    if (err !== null) {
      setShowErrors(true);
      toast.error(err);
      return;
    }
    const idOrdenCompra = Number(header["idOrdenCompra"]);
    setCargandoLineas(true);
    try {
      const page = await http.list<Record<string, unknown>>(
        `/api/com/ref/oc/${idOrdenCompra}/lineas-pendientes`,
      );
      // El filtro por pendiente>0 decide QUE renglones mostrar (uno ya
      // completo no aplica) — no se muestra ese numero, solo se usa para
      // elegir las filas.
      const pendientes = page.data.filter((r) => Number(r["cantidadPendiente"]) > 0);
      if (pendientes.length === 0) {
        toast.error("Esta orden no tiene renglones pendientes por recibir");
        return;
      }
      // Conteo ciego: SIN prellenar con la cantidad esperada — el bodeguero
      // ingresa lo que contó físicamente, en blanco por defecto.
      const lineas: LineaCaptura[] = pendientes.map((r) => ({
        idOcDetalle: Number(r["idOcDetalle"]),
        descripcion: String(r["descripcion"]),
        codigo: r["codigo"] === null || r["codigo"] === undefined ? null : String(r["codigo"]),
        cantidadRecibida: "",
        cantidadRechazada: "",
        esperada: Number(r["cantidadPendiente"]),
        conforme: false,
      }));
      avanzar({ tipo: "cantidades", header, lineas });
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setCargandoLineas(false);
    }
  }

  /** Declaración explícita: "conté todo y coincide". Rellena lo pendiente SIN mostrarlo (el conteo sigue ciego). */
  function recibirTodoConforme(): void {
    if (paso.tipo !== "cantidades" || !declaroConteo) return;
    const lineas = paso.lineas.map((l) => ({ ...l, conforme: true, cantidadRecibida: String(l.esperada), cantidadRechazada: "" }));
    setPaso({ ...paso, lineas });
  }

  function contarManual(idx: number): void {
    if (paso.tipo === "datos") return;
    const lineas = paso.lineas.map((l, i) => (i === idx ? { ...l, conforme: false, cantidadRecibida: "", cantidadRechazada: "" } : l));
    setPaso({ ...paso, lineas });
  }

  /**
   * Lector de codigos de barras (emula teclado: escribe el codigo y Enter). Cada lectura cuenta UNA unidad
   * del renglon cuyo articulo coincide; "CODIGO*12" cuenta 12. Un codigo ajeno a la orden se avisa al instante.
   * El conteo sigue siendo ciego: nunca se muestra la cantidad esperada.
   */
  function escanear(texto: string): void {
    if (paso.tipo !== "cantidades") return;
    const m = /^(.+?)(?:\*(\d+(?:\.\d+)?))?$/.exec(texto.trim());
    if (m === null || m[1] === undefined) return;
    const codigo = normalizarTexto(m[1]);
    const unidades = m[2] !== undefined ? Number(m[2]) : 1;
    const idx = paso.lineas.findIndex((l) => l.codigo !== null && normalizarTexto(l.codigo) === codigo);
    if (idx < 0) {
      toast.error(`El código «${m[1]}» no corresponde a ningún renglón pendiente de esta orden`);
      return;
    }
    const lineas = paso.lineas.map((l, i) =>
      i === idx ? { ...l, conforme: false, cantidadRecibida: String(Number(l.cantidadRecibida || "0") + unidades) } : l,
    );
    setPaso({ ...paso, lineas });
    document.querySelectorAll<HTMLElement>(`[data-linea="${paso.lineas[idx]!.idOcDetalle}"]`)[0]?.scrollIntoView?.({ block: "nearest" });
  }

  function setLinea(idx: number, campo: "cantidadRecibida" | "cantidadRechazada", valor: string): void {
    if (paso.tipo === "datos") return;
    const lineas = paso.lineas.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l));
    setPaso({ ...paso, lineas });
  }

  /**
   * Validacion a ciegas: solo que los numeros sean validos y que haya algo
   * contado. NO compara contra lo pendiente (eso es exactamente lo que el
   * conteo ciego no debe revelar) — el backend sí lo valida al registrar.
   */
  function irAConfirmar(): void {
    if (paso.tipo !== "cantidades") return;
    for (const l of paso.lineas) {
      const recibida = Number(l.cantidadRecibida || "0");
      const rechazada = Number(l.cantidadRechazada || "0");
      if (!Number.isFinite(recibida) || recibida < 0 || !Number.isFinite(rechazada) || rechazada < 0) {
        toast.error(`${l.descripcion}: cantidad inválida`);
        return;
      }
      if (recibida + rechazada <= 0) {
        toast.error(`${l.descripcion}: registra el conteo fisico (recibido y/o rechazado)`);
        return;
      }
    }
    avanzar({ tipo: "confirmar", header: paso.header, lineas: paso.lineas });
  }

  async function registrar(): Promise<void> {
    if (paso.tipo !== "confirmar") return;
    setSaving(true);
    try {
      const body = {
        idOrdenCompra: Number(paso.header["idOrdenCompra"]),
        idBodega: Number(paso.header["idBodega"]),
        idEmpleadoRecibe: Number(paso.header["idEmpleadoRecibe"]),
        lineas: paso.lineas.map((l) => ({
          idOcDetalle: l.idOcDetalle,
          cantidadRecibida: Number(l.cantidadRecibida || "0"),
          cantidadRechazada: Number(l.cantidadRechazada || "0"),
        })),
      };
      const created = await http.post<Record<string, unknown>>("/api/com/recepciones", body);
      toast.success("Recepción registrada");
      props.onSuccess(created);
      props.onClose();
    } catch (e: unknown) {
      const msg = messageOf(e);
      toast.error(normalizarTexto(msg).includes("admite maximo") ? MENSAJE_CONTEO_RECHAZADO : msg);
    } finally {
      setSaving(false);
    }
  }

  if (paso.tipo === "datos") {
    return (
      <Modal
        open={props.open}
        title="Recepción guiada · 1. Orden y bodega"
        onClose={() => cerrarSiNoAvanzo(props.onClose)}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button icon="arrow-right" disabled={cargandoLineas} onClick={() => void irACantidades()}>
              {cargandoLineas ? "Cargando renglones..." : "Siguiente"}
            </Button>
          </>
        }
      >
        <FormGrid>
          {HEADER_FIELDS.map((f) => (
            <Field
              key={f.name}
              def={withResolvedOptions(f, headerOpts)}
              value={header[f.name] ?? ""}
              onChange={(v) => setHeader((h) => ({ ...h, [f.name]: v }))}
              showErrors={showErrors}
            />
          ))}
        </FormGrid>
      </Modal>
    );
  }

  if (paso.tipo === "cantidades") {
    return (
      <Modal
        open={props.open}
        title="Recepción guiada · 2. Cantidades"
        onClose={() => cerrarSiNoAvanzo(props.onClose)}
        width={680}
        footer={
          <>
            <Button variant="ghost" icon="chevron-left" onClick={() => setPaso({ tipo: "datos" })}>
              Atrás
            </Button>
            <Button icon="arrow-right" onClick={irAConfirmar}>
              Siguiente
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
          Conteo ciego: cuenta físicamente cada renglón e ingresa lo que encontraste. No se muestra la cantidad esperada ni el costo — eso se reconcilia después, en Cuentas por Pagar.
        </p>
        <label className="mb-3 grid gap-1">
          <span className="field-label">Escanear código de barras (o escribir el código y Enter)</span>
          <input
            className="field-control"
            autoFocus
            placeholder="Apunta el lector aquí · CÓDIGO*12 cuenta 12 unidades"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const el = e.currentTarget;
              if (el.value.trim() !== "") escanear(el.value);
              el.value = "";
            }}
          />
        </label>
        <div className="mb-3 grid gap-2 rounded-xl p-3" style={{ border: "1px dashed var(--color-line)" }}>
          <label className="flex items-start gap-2 text-[0.82rem]" style={{ color: "var(--color-ink)" }}>
            <input type="checkbox" className="mt-0.5" checked={declaroConteo} onChange={(e) => setDeclaroConteo(e.target.checked)} />
            <span>Conté físicamente cada renglón y todo coincide con lo ordenado (sin faltantes, sobrantes ni rechazos).</span>
          </label>
          <div>
            <Button size="sm" variant="secondary" icon="check" disabled={!declaroConteo} onClick={recibirTodoConforme}>
              Recibir todo conforme
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          {paso.lineas.map((l, i) => (
            <div key={l.idOcDetalle} data-linea={l.idOcDetalle} className="surface-2 grid gap-2 rounded-xl p-3" style={{ border: "1px solid var(--color-line)" }}>
              <span className="text-[0.85rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                {l.descripcion}
              </span>
              {l.conforme ? (
                <div className="flex flex-wrap items-center gap-3 text-[0.82rem]" style={{ color: "var(--color-success)" }}>
                  <span className="font-semibold">✓ Conforme con la orden</span>
                  <Button size="sm" variant="ghost" onClick={() => contarManual(i)}>
                    Contar manualmente
                  </Button>
                </div>
              ) : (
              <div className="flex flex-wrap gap-3">
                <label className="grid gap-1">
                  <span className="field-label">Cantidad recibida</span>
                  <input
                    className="field-control"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    style={{ width: 130 }}
                    data-conteo=""
                    autoFocus={false}
                    onKeyDown={(e) => {
                      // Captura rapida con el teclado: Enter salta al siguiente campo de conteo (el conteo sigue siendo CIEGO).
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const todos = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-conteo]"));
                      todos[todos.indexOf(e.currentTarget) + 1]?.focus();
                    }}
                    value={l.cantidadRecibida}
                    onChange={(e) => setLinea(i, "cantidadRecibida", e.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="field-label">Cantidad rechazada</span>
                  <input
                    className="field-control"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    style={{ width: 130 }}
                    data-conteo=""
                                        onKeyDown={(e) => {
                      // Captura rapida con el teclado: Enter salta al siguiente campo de conteo (el conteo sigue siendo CIEGO).
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const todos = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-conteo]"));
                      todos[todos.indexOf(e.currentTarget) + 1]?.focus();
                    }}
                    value={l.cantidadRechazada}
                    onChange={(e) => setLinea(i, "cantidadRechazada", e.target.value)}
                  />
                </label>
              </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={props.open}
      title="Recepción guiada · 3. Confirmar"
      onClose={() => cerrarSiNoAvanzo(props.onClose)}
      width={620}
      footer={
        <>
          <Button variant="ghost" icon="chevron-left" onClick={() => avanzar({ tipo: "cantidades", header: paso.header, lineas: paso.lineas })}>
            Volver a editar
          </Button>
          <Button icon="check" disabled={saving} onClick={() => void registrar()}>
            {saving ? "Guardando..." : "Confirmar y registrar"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
        Revisa antes de confirmar — una vez registrada, la recepción alimenta el kardex y la cuenta por pagar.
      </p>
      <div className="grid gap-2">
        {paso.lineas.map((l) => (
          <div key={l.idOcDetalle} className="flex items-center justify-between text-[0.82rem]">
            <span style={{ color: "var(--color-ink)" }}>{l.descripcion}</span>
            <span style={{ color: "var(--color-ink-faint)" }}>
              {l.conforme ? (
                "conforme con la orden"
              ) : (
                <>
                  recibida {formatQty(Number(l.cantidadRecibida))}
                  {Number(l.cantidadRechazada) > 0 ? ` · rechazada ${formatQty(Number(l.cantidadRechazada))}` : ""}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
