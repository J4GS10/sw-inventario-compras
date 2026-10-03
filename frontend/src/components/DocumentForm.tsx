/**
 * Formulario de captura de un documento: cabecera + N lineas dinamicas, en un
 * modal. Reutiliza Field/FormGrid (ancho por tipo de dato) y useOptions.
 */

import { useEffect, useMemo, useState } from "react";
import { http } from "../core/HttpClient.js";
import { messageOf } from "../core/errors.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { Field, FormGrid, type FieldValue, type SelectOption } from "../ui/Field.js";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/primitives.js";
import { useToast } from "../ui/Toast.js";
import { formatMoney, formatQty, formatRate } from "../core/format.js";
import {
  blankValues,
  firstError,
  toPayload,
  useAutoFill,
  useOptions,
  withResolvedOptions,
  type AutoFillSpec,
  type FormFieldDef,
} from "./formSupport.js";

export interface DocumentFormConfig {
  readonly title: string;
  readonly submitPath: string;
  /** Forma del payload al enviar. */
  readonly shape: "cabecera-detalles" | "flat";
  readonly headerFields: readonly FormFieldDef[];
  readonly lineFields?: readonly FormFieldDef[];
  readonly lineLabel?: string;
  readonly minLines?: number;
  /** Clave del array de lineas en shape "flat" (default "lineas"). */
  readonly linesKey?: string;
  /** Transforma cada linea antes de enviar (p. ej. RFQ -> solo el id). */
  readonly lineTransform?: (line: Record<string, unknown>) => unknown;
  readonly fixed?: Record<string, unknown>;
  /** Inferencia: rellena y bloquea campos ya decididos por otra seleccion. */
  readonly autoFill?: AutoFillSpec;
  /**
   * Antes de enviar, muestra un paso de revision de solo lectura con lo
   * capturado ("Volver a editar" / "Confirmar y registrar") en vez de enviar
   * directo al pulsar el boton principal. Para documentos donde un dato mal
   * puesto cuesta caro (montos, cantidades que mueven inventario).
   */
  readonly confirmBeforeSubmit?: boolean;
}

/** Etiqueta legible de un valor capturado, para el paso de revision. */
function displayValue(
  f: FormFieldDef,
  raw: FieldValue,
  opts: Record<string, readonly SelectOption[]>,
): string {
  if (f.kind === "switch") return raw === true ? "Si" : "No";
  const s = String(raw ?? "").trim();
  if (s === "") return "—";
  if (f.kind === "select") {
    const list = f.optionsStatic ?? f.options ?? opts[f.name] ?? [];
    return list.find((o) => o.value === s)?.label ?? s;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (f.kind === "money") return formatMoney(n);
  if (f.kind === "quantity" || f.kind === "integer") return formatQty(n);
  if (f.kind === "rate") return formatRate(n);
  if (f.kind === "percent") return `${s}%`;
  return s;
}

/**
 * Datos ya decididos por otra seleccion (autorelleno) o por la sesion: se
 * muestran AGRUPADOS en un panel de solo lectura con una unica nota al pie,
 * en vez de repetir la misma leyenda bajo cada campo (un campo bloqueado por
 * fila ya se sentia como "relleno" — feedback directo del usuario). El valor
 * se ve claro, no en gris: no hay nada que el usuario pueda "trabajar" ahi,
 * solo confirmar que esta correcto antes de enviar.
 */
function PanelDerivado(props: {
  items: readonly { def: FormFieldDef; value: FieldValue }[];
  opts: Record<string, readonly SelectOption[]>;
  nota: string;
}): React.ReactElement | null {
  if (props.items.length === 0) return null;
  return (
    <div
      className="grid gap-1.5 rounded-lg px-3 py-2.5"
      style={{ flex: "1 1 100%", background: "var(--color-surface-2)", borderLeft: "3px solid var(--color-brand)" }}
    >
      <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {props.items.map(({ def, value }) => (
          <div key={def.name} className="min-w-0">
            <div className="field-label">{def.label}</div>
            <div className="truncate text-[0.85rem] font-semibold" style={{ color: "var(--color-ink)" }}>
              {displayValue(def, value, props.opts)}
            </div>
          </div>
        ))}
      </div>
      <span className="field-hint">{props.nota}</span>
    </div>
  );
}

type Values = Record<string, FieldValue>;

export function DocumentForm(props: {
  open: boolean;
  config: DocumentFormConfig;
  onClose: () => void;
  /** Recibe el registro creado (desempaquetado) — util para encadenar pasos (asistentes). */
  onSuccess: (created?: Record<string, unknown>) => void;
  /** Valores iniciales (asistente): p. ej. OC pre-armada desde el comparativo. */
  initial?: { header?: Values; lines?: readonly Values[] };
  /** Si se pasa, el formulario EDITA ese documento (PUT) en vez de crear. */
  editId?: number;
  /** En modo edicion, subconjunto de campos de cabecera a mostrar. */
  editFields?: readonly string[];
  /** En modo edicion, tambien permite reemplazar las lineas del documento. */
  editLines?: boolean;
}): React.ReactElement {
  const { config } = props;
  const toast = useToast();
  const { sesion } = useAuth();
  const editing = props.editId !== undefined;
  // Empleado de la sesion: los campos "quien hace esto" se fijan a este valor y
  // no se eligen a mano (evita crear un documento a nombre de otro y que luego
  // "no aparezca" por el filtro de alcance por rol). 0 = usuario sin empleado
  // ligado (admin): el campo queda editable.
  const sessionEmpId =
    sesion !== null && sesion.idEmpleado > 0 ? String(sesion.idEmpleado) : "";
  const lockedFields = useMemo(
    () =>
      new Set(
        sessionEmpId === ""
          ? []
          : config.headerFields.filter((f) => f.fromSession === "idEmpleado").map((f) => f.name),
      ),
    [config.headerFields, sessionEmpId],
  );
  const hasLines =
    (!editing || props.editLines === true) &&
    config.lineFields !== undefined &&
    config.lineFields.length > 0;
  const minLines = config.minLines ?? (hasLines ? 1 : 0);

  const shownHeader = useMemo(
    () =>
      editing && props.editFields !== undefined
        ? config.headerFields.filter((f) => props.editFields!.includes(f.name))
        : config.headerFields,
    [editing, props.editFields, config.headerFields],
  );

  const [header, setHeader] = useState<Values>(() => blankValues(config.headerFields));
  const [lines, setLines] = useState<Values[]>(() =>
    hasLines ? [blankValues(config.lineFields!)] : [],
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  // Paso de revision de solo lectura (confirmBeforeSubmit) antes de enviar.
  const [confirming, setConfirming] = useState(false);

  // Las opciones de cabecera pueden depender entre si; las de las lineas
  // dependen de campos de la cabecera (p. ej. idOcDetalle depende de idOrdenCompra).
  // El formulario esta SIEMPRE montado (el padre solo alterna `open`), asi que
  // sin este guard se piden las opciones (p. ej. RFQ) apenas se abre la
  // PANTALLA, no el modal — y para un rol sin permiso sobre ese catalogo
  // (p. ej. Financiero y RFQ en Cotizaciones) eso es un 403 innecesario antes
  // de que el usuario siquiera pulse "Nuevo".
  const headerOpts = useOptions(props.open ? config.headerFields : [], header);
  const lineOpts = useOptions(props.open ? (config.lineFields ?? []) : [], header);

  // Inferencia: rellena y bloquea lo que ya esta decidido por otra seleccion
  // (p. ej. OC -> proveedor/moneda/tasa/precio desde la cotizacion adjudicada).
  const { lockedHeader, lockedLineFields } = useAutoFill(
    editing ? undefined : config.autoFill,
    header,
    setHeader,
    lines,
    setLines,
  );

  useEffect(() => {
    if (!props.open) return;
    const seedHeader: Values = {
      ...blankValues(config.headerFields),
      ...(props.initial?.header ?? {}),
    };
    for (const name of lockedFields) seedHeader[name] = sessionEmpId;
    setHeader(seedHeader);

    // Prellenado editable desde el empleado de la sesion (p. ej. sucursal).
    const desdeEmpleado = config.headerFields.filter(
      (f) => f.defaultFromSessionEmpleado !== undefined,
    );
    if (!editing && sessionEmpId !== "" && desdeEmpleado.length > 0) {
      void (async () => {
        try {
          const page = await http.list<Record<string, unknown>>(
            "/api/com/ref/empleados",
            { pageSize: 500 },
          );
          const emp = page.data.find(
            (r) => String(r["idEmpleado"]) === sessionEmpId,
          );
          if (emp === undefined) return;
          setHeader((h) => {
            const next = { ...h };
            for (const f of desdeEmpleado) {
              const v = emp[f.defaultFromSessionEmpleado as string];
              if ((next[f.name] ?? "") === "" && v !== null && v !== undefined) {
                next[f.name] = String(v);
              }
            }
            return next;
          });
        } catch {
          /* sin prellenado si el maestro no carga */
        }
      })();
    }

    if (hasLines) {
      const seed = props.initial?.lines;
      setLines(
        seed !== undefined && seed.length > 0
          ? seed.map((l) => ({ ...blankValues(config.lineFields!), ...l }))
          : [blankValues(config.lineFields!)],
      );
    } else {
      setLines([]);
    }
    setShowErrors(false);
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  function setLine(i: number, name: string, v: FieldValue): void {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [name]: v } : l)));
  }

  /** true si pasa; si no, marca errores y avisa (mismo mensaje de siempre). */
  function validar(): boolean {
    const hErr = firstError(shownHeader, header);
    const lErr = hasLines
      ? lines.map((l) => firstError(config.lineFields!, l)).find((e) => e !== null) ?? null
      : null;
    if (hErr !== null || lErr !== null) {
      setShowErrors(true);
      toast.error(hErr ?? lErr ?? "Revise los campos");
      return false;
    }
    if (hasLines && lines.length < minLines) {
      toast.error(`Agregue al menos ${minLines} ${config.lineLabel?.toLowerCase() ?? "lineas"} (van ${lines.length})`);
      return false;
    }
    return true;
  }

  // Sin chequeo de permiso interno: quien monte <DocumentForm> (DocumentoList,
  // ComparativoView) debe gatear su apertura por el permiso de gestion del
  // documento. Mantener este invariante si se reutiliza en un lugar nuevo.
  async function submit(): Promise<void> {
    if (!validar()) return;

    const headerPayload = { ...toPayload(shownHeader, header), ...(config.fixed ?? {}) };

    setSaving(true);
    try {
      let created: Record<string, unknown> | undefined;
      if (editing) {
        const version = Number(props.initial?.header?.["version"]);
        const putBody: Record<string, unknown> = {
          ...headerPayload,
          ...(Number.isFinite(version) ? { version } : {}),
        };
        if (hasLines) {
          putBody[config.linesKey ?? "lineas"] = lines.map((l) => {
            const p = toPayload(config.lineFields ?? [], l);
            return config.lineTransform !== undefined ? config.lineTransform(p) : p;
          });
        }
        created = await http.put<Record<string, unknown>>(`${config.submitPath}/${props.editId}`, putBody);
        toast.success(`${config.title} actualizada`);
      } else {
        const linePayloads = lines.map((l) => {
          const p = toPayload(config.lineFields ?? [], l);
          return config.lineTransform !== undefined ? config.lineTransform(p) : p;
        });
        const body: Record<string, unknown> =
          config.shape === "cabecera-detalles"
            ? { cabecera: headerPayload, detalles: linePayloads }
            : hasLines
              ? { ...headerPayload, [config.linesKey ?? "lineas"]: linePayloads }
              : { ...headerPayload };
        created = await http.post<Record<string, unknown>>(config.submitPath, body);
        toast.success(`${config.title} registrada`);
      }
      props.onSuccess(created);
      props.onClose();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  /** Boton principal: valida y, si el documento lo pide, pasa a revision antes de enviar. */
  function onPrimaryClick(): void {
    if (config.confirmBeforeSubmit === true && !confirming) {
      if (validar()) setConfirming(true);
      return;
    }
    void submit();
  }

  return (
    <Modal
      open={props.open}
      title={`${editing ? "Editar" : "Nuevo"} · ${config.title}`}
      onClose={props.onClose}
      width={editing && props.editLines !== true ? 560 : 760}
      footer={
        confirming ? (
          <>
            <Button variant="ghost" icon="chevron-left" onClick={() => setConfirming(false)}>
              Volver a editar
            </Button>
            <Button icon="check" disabled={saving} onClick={() => void submit()}>
              {saving ? "Guardando..." : "Confirmar y registrar"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button
              icon="check"
              disabled={saving || (hasLines && lines.length < minLines)}
              onClick={onPrimaryClick}
            >
              {saving
                ? "Guardando..."
                : hasLines && lines.length < minLines
                  ? `Faltan ${minLines - lines.length}`
                  : config.confirmBeforeSubmit === true
                    ? "Revisar"
                    : editing
                      ? "Guardar cambios"
                      : "Registrar"}
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="grid grid-cols-1 gap-4">
          <p className="text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
            Revisa los datos antes de confirmar — una vez registrado no se puede deshacer desde aqui.
          </p>
          <section className="grid gap-1.5">
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Datos generales
            </h3>
            <div className="surface-2 grid gap-1 rounded-xl p-3" style={{ border: "1px solid var(--color-line)" }}>
              {shownHeader.map((f) => (
                <div key={f.name} className="flex justify-between gap-3 text-[0.82rem]">
                  <span style={{ color: "var(--color-ink-faint)" }}>{f.label}</span>
                  <span style={{ color: "var(--color-ink)", fontWeight: 600, textAlign: "right" }}>
                    {displayValue(f, header[f.name] ?? "", headerOpts)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {hasLines && (
            <section className="grid gap-1.5">
              <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                {config.lineLabel ?? "Lineas"} ({lines.length})
              </h3>
              <div className="grid gap-2">
                {lines.map((line, i) => (
                  <div key={i} className="surface-2 grid gap-1 rounded-xl p-3" style={{ border: "1px solid var(--color-line)" }}>
                    <span className="text-[0.72rem] font-semibold" style={{ color: "var(--color-ink-faint)" }}>
                      #{i + 1}
                    </span>
                    {(config.lineFields ?? []).map((f) => (
                      <div key={f.name} className="flex justify-between gap-3 text-[0.82rem]">
                        <span style={{ color: "var(--color-ink-faint)" }}>{f.label}</span>
                        <span style={{ color: "var(--color-ink)", fontWeight: 600, textAlign: "right" }}>
                          {displayValue(f, line[f.name] ?? "", lineOpts)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4">
        <section>
          <h3 className="mb-2 text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
            Datos generales
          </h3>
          <FormGrid>
            {shownHeader
              .filter((f) => !lockedFields.has(f.name) && !lockedHeader.has(f.name))
              .map((f) => (
                <Field
                  key={f.name}
                  def={withResolvedOptions(f, headerOpts)}
                  value={header[f.name] ?? ""}
                  onChange={(v) => setHeader((p) => ({ ...p, [f.name]: v }))}
                  showErrors={showErrors}
                />
              ))}
            <PanelDerivado
              items={shownHeader
                .filter((f) => lockedFields.has(f.name))
                .map((f) => ({ def: withResolvedOptions(f, headerOpts), value: header[f.name] ?? "" }))}
              opts={headerOpts}
              nota="Se registra a tu nombre (usuario en sesion)."
            />
            <PanelDerivado
              items={shownHeader
                .filter((f) => lockedHeader.has(f.name))
                .map((f) => ({ def: withResolvedOptions(f, headerOpts), value: header[f.name] ?? "" }))}
              opts={headerOpts}
              nota="Se toma de la cotizacion adjudicada."
            />
          </FormGrid>
        </section>

        {hasLines && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3
                className="text-[0.78rem] font-semibold uppercase tracking-wide"
                style={{ color: lines.length < minLines ? "var(--color-warning)" : "var(--color-ink-soft)" }}
              >
                {config.lineLabel ?? "Lineas"} ({lines.length}
                {minLines > 1 ? ` de ${minLines} minimo` : ""})
              </h3>
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => setLines((p) => [...p, blankValues(config.lineFields!)])}
              >
                Agregar
              </Button>
            </div>
            <div className="grid gap-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="surface-2 rounded-xl p-3"
                  style={{ border: "1px solid var(--color-line)" }}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[0.72rem] font-semibold" style={{ color: "var(--color-ink-faint)" }}>
                      #{i + 1}
                    </span>
                    {lines.length > minLines && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="trash"
                        onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                        style={{ color: "var(--color-danger)" }}
                        aria-label="Quitar linea"
                      />
                    )}
                  </div>
                  {(() => {
                    const lineResuelta =
                      config.autoFill !== undefined &&
                      String(line[config.autoFill.matchLineField] ?? "") !== "";
                    const camposLinea = config.lineFields ?? [];
                    const editables = camposLinea.filter((f) => !(lineResuelta && lockedLineFields.has(f.name)));
                    const derivados = lineResuelta
                      ? camposLinea.filter((f) => lockedLineFields.has(f.name))
                      : [];
                    return (
                      <FormGrid>
                        {editables.map((f) => (
                          <Field
                            key={f.name}
                            def={withResolvedOptions(f, lineOpts)}
                            value={line[f.name] ?? ""}
                            onChange={(v) => setLine(i, f.name, v)}
                            showErrors={showErrors}
                          />
                        ))}
                        <PanelDerivado
                          items={derivados.map((f) => ({
                            def: withResolvedOptions(f, lineOpts),
                            value: line[f.name] ?? "",
                          }))}
                          opts={lineOpts}
                          nota="Se toma de la cotizacion adjudicada."
                        />
                      </FormGrid>
                    );
                  })()}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}
    </Modal>
  );
}
