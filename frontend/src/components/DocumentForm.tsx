/**
 * Formulario de captura de un documento: cabecera + N lineas dinamicas, en un
 * modal. Reutiliza Field/FormGrid (ancho por tipo de dato) y useOptions.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../core/HttpClient.js";
import { AppError, messageOf } from "../core/errors.js";
import { guardarBorrador, quitarBorrador, vaciarPendientes } from "../core/borradores.js";
import { encolarEnvio, esErrorDeConexion } from "../core/outbox.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { Field, FormGrid, dateBounds, fieldError, type FieldValue, type SelectOption } from "../ui/Field.js";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/primitives.js";
import { useToast } from "../ui/Toast.js";
import { formatMoney, formatQty, formatRate } from "../core/format.js";
import {
  blankValues,
  firstError,
  limiteError,
  parsearPegado,
  fillPlaceholders,
  getByPath,
  guardarRecordados,
  leerRecordados,
  toPayload,
  useAutoFill,
  useOptions,
  withResolvedOptions,
  type AutoFillSpec,
  type FormFieldDef,
  type LineSeedSpec,
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
  /** Arma las lineas solas a partir de lo que el sistema ya sabe (ver LineSeedSpec). */
  readonly seedLines?: LineSeedSpec;
}

/** Etiqueta legible de un valor capturado, para el paso de revision. */
function displayValue(
  f: FormFieldDef,
  raw: FieldValue,
  opts: Record<string, readonly SelectOption[]>,
): string {
  if (f.kind === "switch") return raw === true ? "Sí" : "No";
  const s = String(raw ?? "").trim();
  if (s === "") return "—";
  if (f.kind === "select") {
    const list = f.optionsStatic ?? f.options ?? opts[f.name] ?? [];
    return list.find((o) => o.value === s)?.label ?? s;
  }
  // Fechas como las lee una persona (20/10/2026 12:00), no como las guarda el sistema.
  if (f.kind === "date" || f.kind === "datetime") {
    const d = s.slice(0, 10);
    if (/^d{4}-d{2}-d{2}$/.test(d)) {
      const base = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
      return f.kind === "datetime" && s.length >= 16 ? `${base} ${s.slice(11, 16)}` : base;
    }
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

/**
 * Resumen lateral: lo IMPORTANTE siempre a la vista mientras se captura. Ocupa la parte
 * menor de la proporcion aurea (el formulario 61.8 %, el resumen 38.2 %) y queda fijo al
 * desplazarse. Muestra que se esta creando, lo ya decidido, el total y cuanto falta.
 */
function ResumenLateral(props: {
  titulo: string;
  datos: readonly { label: string; value: string }[];
  lineas?: { etiqueta: string; cantidad: number; total: number | null };
  progreso: { hechos: number; total: number; faltan: readonly string[] };
  nota?: string;
}): React.ReactElement {
  const { hechos, total, faltan } = props.progreso;
  const pct = total === 0 ? 100 : Math.round((hechos / total) * 100);
  const listo = faltan.length === 0;
  return (
    <aside className="doc-resumen" aria-label="Resumen del documento">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
        Resumen
      </div>
      <div className="mt-1 text-[1.05rem] font-semibold" style={{ color: "var(--color-heading)" }}>
        {props.titulo}
      </div>

      <div className="doc-datos mt-3 grid gap-2.5">
        {props.datos.length === 0 && (
          <p className="text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
            Elige los datos y aquí verás lo que vas armando.
          </p>
        )}
        {props.datos.map((d) => (
          <div key={d.label} className="min-w-0">
            <div className="field-label">{d.label}</div>
            <div className="truncate text-[0.88rem] font-semibold" style={{ color: "var(--color-ink)" }} title={d.value}>
              {d.value}
            </div>
          </div>
        ))}
      </div>

      {props.lineas !== undefined && (
        <div className="doc-datos mt-3 rounded-lg px-3 py-2.5" style={{ background: "var(--color-brand-050)" }}>
          <div className="text-[0.72rem] font-semibold" style={{ color: "var(--color-brand-ink)" }}>
            {props.lineas.etiqueta}
          </div>
          <div className="text-[1.25rem] font-bold leading-tight" style={{ color: "var(--color-brand-ink)" }}>
            {props.lineas.cantidad}
          </div>
          {props.lineas.total !== null && props.lineas.total > 0 && (
            <div className="mt-0.5 text-[0.78rem]" style={{ color: "var(--color-brand-ink)" }}>
              Total estimado <b>{formatMoney(props.lineas.total)}</b>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[0.72rem] font-semibold" style={{ color: listo ? "var(--color-success)" : "var(--color-ink-soft)" }}>
          <span>{listo ? "Todo listo para registrar" : `Faltan ${faltan.length} dato${faltan.length === 1 ? "" : "s"}`}</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--color-line)", overflow: "hidden" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%`, height: "100%", background: listo ? "var(--color-success)" : "var(--color-brand)", transition: "width 220ms ease" }} />
        </div>
        {!listo && (
          <ul className="mt-2 grid gap-0.5 text-[0.76rem]" style={{ color: "var(--color-ink-soft)" }}>
            {faltan.slice(0, 5).map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--color-warning)", flex: "none" }} />
                {f}
              </li>
            ))}
            {faltan.length > 5 && <li>… y {faltan.length - 5} más</li>}
          </ul>
        )}
      </div>
      {props.nota !== undefined && (
        <p className="doc-datos mt-3 text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
          {props.nota}
        </p>
      )}
    </aside>
  );
}

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
  /** Boton del aviso de exito: lleva al SIGUIENTE paso del flujo ("Registrar ofertas"...). */
  successAction?: import("../ui/Toast.js").ToastAction;
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

  /** Valores que el SISTEMA puso (para no pisar lo que el usuario escribio despues). */
  const autoPuesto = useRef<Record<string, string>>({});
  const aplicadosRecordados = useRef<Set<string>>(new Set());
  const sembradoPara = useRef<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Pegar renglones desde Excel
  const [pegando, setPegando] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [avisosPegado, setAvisosPegado] = useState<readonly string[]>([]);
  function aplicarPegado(): void {
    const r = parsearPegado(textoPegado, config.lineFields ?? [], lineOpts);
    if (r.lineas.length === 0) {
      setAvisosPegado(["No se encontraron filas. Copia las celdas en Excel (con o sin encabezados) y pégalas aquí."]);
      return;
    }
    tocado.current = true;
    setLines((prev) => {
      // Si la unica linea esta vacia, se reemplaza; si no, se agregan al final.
      const vacia =
        prev.length === 1 &&
        (config.lineFields ?? []).every((f) => {
          const v = String(prev[0]![f.name] ?? "");
          return v === "" || v === String(blankValues([f])[f.name] ?? "");
        });
      return vacia ? r.lineas : [...prev, ...r.lineas];
    });
    setAvisosPegado(r.avisos);
    toast.success(`${r.lineas.length} renglón${r.lineas.length === 1 ? "" : "es"} agregado${r.lineas.length === 1 ? "" : "s"}${r.avisos.length > 0 ? ` (${r.avisos.length} aviso${r.avisos.length === 1 ? "" : "s"})` : ""}`);
    if (r.avisos.length === 0) {
      setPegando(false);
      setTextoPegado("");
    }
  }
  const formKey = config.submitPath;
  /** Errores que devolvio el SERVIDOR por campo (clave "h:campo" o "l:indice:campo"). */
  const [erroresServidor, setErroresServidor] = useState<Record<string, string>>({});
  /** Resumen de TODO lo que el servidor rechazo (incluye lo que no cae en un campo visible): cada punto lleva a su linea. */
  const [resumenErrores, setResumenErrores] = useState<readonly { texto: string; linea: number | null }[]>([]);
  const tocado = useRef(false);
  const [borrador, setBorrador] = useState<{ header: Values; lines: Values[]; en: number } | null>(null);
  const claveBorrador = sesion === null ? null : `erp.borrador.${sesion.idUsuario}.${formKey}`;

  const firmaCabecera = config.headerFields.map((f) => String(header[f.name] ?? "")).join("|");
  const firmaLineas = lines.map((l) => (config.lineFields ?? []).map((f) => String(l[f.name] ?? "")).join("|")).join("||");

  // 1) Recordar lo ultimo elegido por este usuario (grupo, termino, moneda, bodega...).
  useEffect(() => {
    if (!props.open || editing || sesion === null) return;
    const rec = leerRecordados(sesion.idUsuario, formKey);
    const hacer = (scope: "h" | "l", f: FormFieldDef, i: number): void => {
      if (f.remember !== true) return;
      const k = `${scope}:${i}:${f.name}`;
      if (aplicadosRecordados.current.has(k)) return;
      const guardado = rec[`${scope}.${f.name}`];
      if (guardado === undefined || guardado === "") return;
      const opts = (scope === "h" ? headerOpts : lineOpts)[f.name];
      if (f.kind === "select" && (opts === undefined || !opts.some((o) => o.value === guardado))) return;
      aplicadosRecordados.current.add(k);
      if (scope === "h") {
        setHeader((h) => ((h[f.name] ?? "") === "" ? { ...h, [f.name]: guardado } : h));
      } else {
        setLines((ls) => ls.map((l, idx) => (idx === i && (l[f.name] ?? "") === "" ? { ...l, [f.name]: guardado } : l)));
      }
    };
    for (const f of config.headerFields) hacer("h", f, 0);
    for (const f of config.lineFields ?? []) lines.forEach((_, i) => hacer("l", f, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, headerOpts, lineOpts, lines.length, firmaCabecera]);

  // 2) Una sola opcion posible => ya esta elegida (nadie debe "elegir" entre una).
  useEffect(() => {
    if (!props.open || editing) return;
    const patchH: Values = {};
    for (const f of config.headerFields) {
      if (f.kind !== "select" || f.required !== true || lockedFields.has(f.name)) continue;
      const o = headerOpts[f.name];
      if (o !== undefined && o.length === 1 && (header[f.name] ?? "") === "") patchH[f.name] = o[0]!.value;
    }
    if (Object.keys(patchH).length > 0) setHeader((h) => ({ ...h, ...patchH }));
    if (hasLines) {
      setLines((ls) =>
        ls.map((l) => {
          let cambio = l;
          for (const f of config.lineFields ?? []) {
            if (f.kind !== "select" || f.required !== true) continue;
            const o = lineOpts[f.name];
            if (o !== undefined && o.length === 1 && (l[f.name] ?? "") === "") {
              if (cambio === l) cambio = { ...l };
              cambio[f.name] = o[0]!.value;
            }
          }
          return cambio;
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, headerOpts, lineOpts, firmaCabecera]);

  // 3) Elegir algo completa lo demas que ya se sabe de ello (articulo -> nombre y unidad...).
  useEffect(() => {
    if (!props.open || editing) return;
    const llenar = (
      campos: readonly FormFieldDef[],
      valores: Values,
      opts: Record<string, readonly SelectOption[]>,
      clave: string,
    ): Values | null => {
      let patch: Values | null = null;
      for (const f of campos) {
        if (f.fillOnSelect === undefined) continue;
        const elegido = String(valores[f.name] ?? "");
        if (elegido === "") continue;
        const data = opts[f.name]?.find((o) => o.value === elegido)?.data;
        if (data === undefined) continue;
        for (const [destino, prop] of Object.entries(f.fillOnSelect)) {
          const nuevo = data[prop] === null || data[prop] === undefined ? "" : String(data[prop]);
          if (nuevo === "") continue;
          const actual = String(valores[destino] ?? "");
          const k = `${clave}:${destino}`;
          if (actual === nuevo) {
            autoPuesto.current[k] = nuevo;
            continue;
          }
          // Solo si esta vacio o conserva lo que el sistema puso antes (no pisa lo que el usuario escribio).
          if (actual === "" || actual === autoPuesto.current[k]) {
            autoPuesto.current[k] = nuevo;
            patch = { ...(patch ?? {}), [destino]: nuevo };
          }
        }
      }
      return patch;
    };
    const ph = llenar(config.headerFields, header, headerOpts, "h");
    if (ph !== null) setHeader((h) => ({ ...h, ...ph }));
    if (hasLines) {
      let alguno = false;
      const nuevas = lines.map((l, i) => {
        const pl = llenar(config.lineFields ?? [], l, lineOpts, `l${i}`);
        if (pl === null) return l;
        alguno = true;
        return { ...l, ...pl };
      });
      if (alguno) setLines(nuevas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, firmaCabecera, firmaLineas, headerOpts, lineOpts]);

  // 4) Las lineas que el sistema ya conoce se arman solas (RFQ -> un renglon por articulo pedido...).
  const seed = config.seedLines;
  const disparo = seed === undefined ? "" : String(header[seed.when] ?? "");
  useEffect(() => {
    if (!props.open || editing || seed === undefined || !hasLines) return;
    if (disparo === "") {
      sembradoPara.current = "";
      return;
    }
    if (sembradoPara.current === disparo) return;
    const path = fillPlaceholders(seed.source, header);
    if (path === null) return;
    // Solo si el usuario aun no empezo a llenar lineas (nunca se pisa su trabajo).
    const vacias = lines.every((l) => (config.lineFields ?? []).every((f) => {
      const v = String(l[f.name] ?? "");
      return v === "" || v === String(blankValues([f])[f.name] ?? "");
    }));
    if (!vacias && sembradoPara.current === "") {
      sembradoPara.current = disparo;
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        const body = await http.raw<unknown>(path, { pageSize: 300 });
        const root = (body as { data?: unknown }).data ?? body;
        const arr = seed.pick !== undefined ? getByPath(root, seed.pick) : root;
        const filas = (Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []).slice(0, seed.limit ?? 50);
        if (!vivo || filas.length === 0) return;
        sembradoPara.current = disparo;
        setLines(
          filas.map((fila) => {
            const base = blankValues(config.lineFields ?? []);
            for (const [campo, prop] of Object.entries(seed.map)) {
              const v = fila[prop];
              if (v !== null && v !== undefined) base[campo] = String(v);
            }
            return base;
          }),
        );
      } catch {
        /* sin siembra: el usuario arma las lineas a mano */
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, disparo]);

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
    setShowAdvanced(false);
    autoPuesto.current = {};
    aplicadosRecordados.current = new Set();
    sembradoPara.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  function setLine(i: number, name: string, v: FieldValue): void {
    tocado.current = true;
    setResumenErrores((r) => (r.length === 0 ? r : r.filter((x) => x.linea !== i)));
    setErroresServidor((e) => {
      if (e[`l:${i}:${name}`] === undefined) return e;
      const { [`l:${i}:${name}`]: _quitado, ...resto } = e;
      return resto;
    });
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [name]: v } : l)));
  }

  function cambiarCabecera(name: string, v: FieldValue): void {
    tocado.current = true;
    setResumenErrores((r) => (r.length === 0 ? r : r.filter((x) => x.linea !== null)));
    setErroresServidor((e) => {
      if (e[`h:${name}`] === undefined) return e;
      const { [`h:${name}`]: _quitado, ...resto } = e;
      return resto;
    });
    setHeader((p) => ({ ...p, [name]: v }));
  }

  /** Lleva el foco (y la vista) al primer campo con error: el usuario no tiene que buscarlo. */
  function enfocarPrimerError(): void {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[role="dialog"] [data-state="invalid"], [data-state="invalid"]');
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      el?.focus?.();
    }, 60);
  }

  // Borrador: se guarda solo lo que el usuario escribio y se ofrece recuperarlo al reabrir.
  useEffect(() => {
    if (!props.open || editing || claveBorrador === null || !tocado.current) return;
    const t = window.setTimeout(() => {
      guardarBorrador(claveBorrador, { header, lines, en: Date.now() });
    }, 700);
    return () => window.clearTimeout(t);
  }, [props.open, editing, claveBorrador, firmaCabecera, firmaLineas]);

  // Cierre brusco (pestana cerrada, apagon con reanudacion, cambio de pestana): se guarda al instante, sin esperar el temporizador.
  const estadoBorrador = useRef({ header, lines });
  estadoBorrador.current = { header, lines };
  useEffect(() => {
    if (!props.open || editing || claveBorrador === null) return;
    const guardarYa = (): void => {
      if (!tocado.current) return;
      guardarBorrador(claveBorrador, { ...estadoBorrador.current, en: Date.now() });
      vaciarPendientes();
    };
    const alOcultar = (): void => {
      if (document.visibilityState === "hidden") guardarYa();
    };
    window.addEventListener("pagehide", guardarYa);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      window.removeEventListener("pagehide", guardarYa);
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, [props.open, editing, claveBorrador]);

  useEffect(() => {
    if (!props.open || editing || claveBorrador === null || props.initial !== undefined) {
      setBorrador(null);
      return;
    }
    tocado.current = false;
    try {
      const raw = window.localStorage.getItem(claveBorrador);
      const d = raw === null ? null : (JSON.parse(raw) as { header: Values; lines: Values[]; en: number });
      setBorrador(d !== null && Date.now() - d.en < 7 * 864e5 ? d : null);
    } catch {
      setBorrador(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  function descartarBorrador(): void {
    if (claveBorrador !== null) quitarBorrador(claveBorrador);
    setBorrador(null);
  }

  // Atajo: Ctrl/Cmd + Enter registra (o pasa a revision) sin buscar el boton.
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !saving) {
        e.preventDefault();
        onPrimaryClickRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, saving]);

  /** true si pasa; si no, marca errores y avisa (mismo mensaje de siempre). */
  function validar(): boolean {
    const hErr = firstError(shownHeader, header);
    const lErr = hasLines
      ? lines
          .map((l, i) => {
            const e = firstError(config.lineFields!, l);
            if (e !== null) return e;
            const tope = config.lineFields!.map((f) => limiteError(f, l, lineOpts)).find((x) => x !== null) ?? null;
            return tope === null ? null : `Línea ${i + 1}: ${tope}`;
          })
          .find((e) => e !== null) ?? null
      : null;
    if (hErr !== null || lErr !== null) {
      setShowErrors(true);
      toast.error(hErr ?? lErr ?? "Revise los campos");
      enfocarPrimerError();
      return false;
    }
    if (hasLines && lines.length < minLines) {
      toast.error(`Agregue al menos ${minLines} ${config.lineLabel?.toLowerCase() ?? "líneas"} (van ${lines.length})`);
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
    setResumenErrores([]);
    setErroresServidor({});
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
        toast.success(`${config.title} registrada`, props.successAction !== undefined ? 9000 : undefined, props.successAction);
        descartarBorrador();
        if (sesion !== null) {
          const rec: Record<string, string> = {};
          for (const f of config.headerFields) if (f.remember === true && String(header[f.name] ?? "") !== "") rec[`h.${f.name}`] = String(header[f.name]);
          for (const f of config.lineFields ?? []) {
            const v = String(lines[0]?.[f.name] ?? "");
            if (f.remember === true && v !== "") rec[`l.${f.name}`] = v;
          }
          if (Object.keys(rec).length > 0) guardarRecordados(sesion.idUsuario, formKey, { ...leerRecordados(sesion.idUsuario, formKey), ...rec });
        }
      }
      props.onSuccess(created);
      props.onClose();
    } catch (e: unknown) {
      // Sin conexion (o servidor caido): el envio NO se pierde; queda en cola y sale solo al volver la red.
      if (!editing && sesion !== null && esErrorDeConexion(e)) {
        const cuerpo =
          config.shape === "cabecera-detalles"
            ? { cabecera: { ...toPayload(shownHeader, header), ...(config.fixed ?? {}) }, detalles: lines.map((l) => { const p = toPayload(config.lineFields ?? [], l); return config.lineTransform !== undefined ? config.lineTransform(p) : p; }) }
            : hasLines
              ? { ...toPayload(shownHeader, header), ...(config.fixed ?? {}), [config.linesKey ?? "lineas"]: lines.map((l) => { const p = toPayload(config.lineFields ?? [], l); return config.lineTransform !== undefined ? config.lineTransform(p) : p; }) }
              : { ...toPayload(shownHeader, header), ...(config.fixed ?? {}) };
        encolarEnvio(sesion.idUsuario, config.title, config.submitPath, cuerpo);
        descartarBorrador();
        toast.info(`Sin conexión: tu ${config.title.toLowerCase()} quedó guardada y se enviará sola al volver la red`, 8000);
        props.onClose();
        return;
      }
      toast.error(messageOf(e));
      // Si el servidor indica QUE campo fallo, el error aparece bajo ese campo y lleva el foco.
      const detalles = e instanceof Error && "details" in e ? ((e as { details?: readonly { field?: string; message: string }[] }).details ?? []) : [];
      const mapa: Record<string, string> = {};
      setResumenErrores(
        detalles.map((d) => {
          const ml = d.field === undefined ? null : /^(?:lineas|detalles|proveedores|líneas)\[(\d+)\]/.exec(d.field);
          return { texto: d.message, linea: ml === null ? null : Number(ml[1]) };
        }),
      );
      for (const d of detalles) {
        if (d.field === undefined) continue;
        const m = /^(?:lineas|detalles|proveedores)\[(\d+)\]\.(\w+)$/.exec(d.field);
        if (m !== null) mapa[`l:${m[1]}:${m[2]}`] = d.message;
        else if (config.headerFields.some((f) => f.name === d.field)) mapa[`h:${d.field}`] = d.message;
      }
      if (Object.keys(mapa).length > 0) {
        setErroresServidor(mapa);
        enfocarPrimerErrorServidor();
      }
    } finally {
      setSaving(false);
    }
  }

  /** Cuerpo del POST de creacion tal como lo enviaria "Registrar". */
  function cuerpoDeCreacion(): Record<string, unknown> {
    const cab = { ...toPayload(shownHeader, header), ...(config.fixed ?? {}) };
    const det = lines.map((l) => {
      const p = toPayload(config.lineFields ?? [], l);
      return config.lineTransform !== undefined ? config.lineTransform(p) : p;
    });
    return config.shape === "cabecera-detalles"
      ? { cabecera: cab, detalles: det }
      : hasLines
        ? { ...cab, [config.linesKey ?? "lineas"]: det }
        : { ...cab };
  }

  function enfocarPrimerErrorServidor(): void {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-state="invalid"]');
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      el?.focus?.();
    }, 80);
  }

  const onPrimaryClickRef = useRef<() => void>(() => undefined);
  /** Boton principal: valida y, si el documento lo pide, pasa a revision antes de enviar. */
  function onPrimaryClick(): void {
    if (config.confirmBeforeSubmit === true && !confirming) {
      if (validar()) setConfirming(true);
      return;
    }
    void submit();
  }

  onPrimaryClickRef.current = onPrimaryClick;

  // Campos visibles (los opcionales colapsan salvo que ya traigan valor), resumen y progreso.
  const campos = shownHeader.filter((f) => !lockedFields.has(f.name) && !lockedHeader.has(f.name));
  const esAvanzado = (f: FormFieldDef): boolean => f.advanced === true && String(header[f.name] ?? "") === "" && !editing;
  const visibles = campos.filter((f) => !esAvanzado(f));
  const avanzados = campos.filter((f) => esAvanzado(f));

  const datosResumen = shownHeader
    .filter((f) => f.kind === "select" || f.kind === "date" || f.kind === "datetime")
    .map((f) => ({ label: f.label, value: displayValue(f, header[f.name] ?? "", headerOpts) }))
    .filter((d) => d.value !== "—");

  const totalLineas = (() => {
    const fs = config.lineFields ?? [];
    const q = fs.find((f) => f.name === "cantidad" || f.name === "cantidadSolicitada");
    const pr = fs.find((f) => f.name === "precioUnitario");
    if (q === undefined || pr === undefined) return null;
    return lines.reduce((acc, l) => {
      const n = Number(l[q.name]);
      const pu = Number(l[pr.name]);
      const d = Number(l["porcentajeDescuento"] ?? 0) || 0;
      const imp = Number(l["porcentajeImpuesto"] ?? 0) || 0;
      return Number.isFinite(n) && Number.isFinite(pu) ? acc + n * pu * (1 - d / 100) * (1 + imp / 100) : acc;
    }, 0);
  })();

  const progreso = (() => {
    const faltan: string[] = [];
    let total = 0;
    for (const f of shownHeader) {
      if (f.required !== true || lockedFields.has(f.name) || lockedHeader.has(f.name)) continue;
      total++;
      if (fieldError(f, String(header[f.name] ?? ""), dateBounds(f, header)) !== null) faltan.push(f.label);
    }
    if (hasLines) {
      total++;
      if (lines.length < minLines) faltan.push(`${config.lineLabel ?? "Líneas"} (mínimo ${minLines})`);
      const campo = (config.lineFields ?? []).filter((f) => f.required === true && !lockedLineFields.has(f.name));
      lines.forEach((l, i) => {
        for (const f of campo) {
          total++;
          if (fieldError(f, String(l[f.name] ?? ""), dateBounds(f, l)) !== null || limiteError(f, l, lineOpts) !== null) faltan.push(`Línea ${i + 1}: ${f.label}`);
        }
      });
    }
    return { hechos: total - faltan.length, total, faltan };
  })();

  /** Aviso en vivo del SERVIDOR (reglas que solo el conoce): se muestra bajo el formulario y sobre el campo si lo indica. */
  const [avisoServidor, setAvisoServidor] = useState<string | null>(null);
  const validacionSeq = useRef(0);
  const firmaTodo = JSON.stringify([header, lines]);
  const faltanAhora = progreso.faltan.length;
  useEffect(() => {
    if (!props.open || editing || confirming || saving || faltanAhora > 0) {
      setAvisoServidor(null);
      return;
    }
    const seq = ++validacionSeq.current;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          await http.validarEnServidor(config.submitPath, cuerpoDeCreacion());
          if (seq !== validacionSeq.current) return;
          setAvisoServidor(null);
          setErroresServidor({});
        } catch (e: unknown) {
          if (seq !== validacionSeq.current) return;
          // Solo un rechazo real de reglas (4xx) se muestra; cortes de red o caidas no estorban al escribir.
          if (!(e instanceof AppError) || e.httpStatus < 400 || e.httpStatus >= 500 || e.httpStatus === 401 || e.httpStatus === 403) return;
          const detalles = "details" in e ? ((e as { details?: readonly { field?: string; message: string }[] }).details ?? []) : [];
          const mapa: Record<string, string> = {};
          for (const d of detalles) {
            if (d.field === undefined) continue;
            const m = /^(?:lineas|detalles|proveedores)\[(\d+)\]\.(\w+)$/.exec(d.field);
            if (m !== null) mapa[`l:${m[1]}:${m[2]}`] = d.message;
            else if (config.headerFields.some((f) => f.name === d.field)) mapa[`h:${d.field}`] = d.message;
          }
          setErroresServidor(mapa);
          setAvisoServidor(messageOf(e));
        }
      })();
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, editing, confirming, saving, faltanAhora, firmaTodo]);


  return (
    <Modal
      open={props.open}
      title={`${editing ? "Editar" : "Nuevo"} · ${config.title}`}
      onClose={props.onClose}
      width={editing && props.editLines !== true ? 560 : 1000}
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
            Revisa los datos antes de confirmar — una vez registrado no se puede deshacer desde aquí.
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
                {config.lineLabel ?? "Líneas"} ({lines.length})
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
      <div className="doc-layout">
        <div className="grid min-w-0 grid-cols-1 gap-5">
        {avisoServidor !== null && resumenErrores.length === 0 && (
          <div
            role="alert"
            className="mb-3 rounded-lg px-3 py-2 text-[0.82rem]"
            style={{ border: "1px solid var(--color-warning)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
          >
            <b style={{ color: "var(--color-warning)" }}>El sistema detectó un problema: </b>
            {avisoServidor}
          </div>
        )}
        {resumenErrores.length > 0 && (
          <div
            role="alert"
            className="rounded-lg px-3 py-2 text-[0.82rem]"
            style={{ background: "var(--color-danger-050, #fdecec)", border: "1px solid var(--color-danger)", color: "var(--color-ink)" }}
          >
            <div className="mb-1 font-semibold" style={{ color: "var(--color-danger)" }}>
              Corrige {resumenErrores.length === 1 ? "este punto" : `estos ${resumenErrores.length} puntos`} para continuar:
            </div>
            <ul className="grid gap-1">
              {resumenErrores.map((x, k) => (
                <li key={k}>
                  {x.linea !== null ? (
                    <button
                      type="button"
                      className="text-left underline"
                      onClick={() => {
                        const el = document.querySelector<HTMLElement>(`[data-linea="${x.linea}"]`);
                        el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
                        (el?.querySelector<HTMLElement>("input, [role=combobox], textarea") ?? el)?.focus?.();
                      }}
                    >
                      {x.texto}
                    </button>
                  ) : (
                    x.texto
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {borrador !== null && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-[0.82rem]"
            style={{ background: "var(--color-warning-050, #fff4de)", border: "1px solid var(--color-warning)" }}
            role="status"
          >
            <span style={{ color: "var(--color-ink)" }}>
              Tienes un <b>borrador</b> sin registrar ({new Date(borrador.en).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}).
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setHeader(borrador.header);
                  setLines(borrador.lines);
                  tocado.current = true;
                  setBorrador(null);
                }}
              >
                Recuperar
              </Button>
              <Button size="sm" variant="ghost" onClick={descartarBorrador}>
                Descartar
              </Button>
            </span>
          </div>
        )}
        <section>
          <h3 className="mb-2 text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
            Datos generales
          </h3>
          <FormGrid>
            {visibles.map((f) => (
                <Field
                  key={f.name}
                  def={withResolvedOptions(f, headerOpts)}
                  value={header[f.name] ?? ""}
                  onChange={(v) => cambiarCabecera(f.name, v)}
                  externalError={erroresServidor[`h:${f.name}`] ?? null}
                  showErrors={showErrors}
                  values={header}
                />
              ))}
            <PanelDerivado
              items={shownHeader
                .filter((f) => lockedFields.has(f.name))
                .map((f) => ({ def: withResolvedOptions(f, headerOpts), value: header[f.name] ?? "" }))}
              opts={headerOpts}
              nota="Se registra a tu nombre (usuario en sesión)."
            />
            <PanelDerivado
              items={shownHeader
                .filter((f) => lockedHeader.has(f.name))
                .map((f) => ({ def: withResolvedOptions(f, headerOpts), value: header[f.name] ?? "" }))}
              opts={headerOpts}
              nota="Se toma de la cotización adjudicada."
            />
          </FormGrid>
          {avanzados.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                className="text-[0.8rem] font-semibold"
                style={{ color: "var(--color-brand-ink)" }}
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "− Ocultar datos opcionales" : `+ Más datos (opcional) · ${avanzados.length}`}
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <FormGrid>
                    {avanzados.map((f) => (
                      <Field
                        key={f.name}
                        def={withResolvedOptions(f, headerOpts)}
                        value={header[f.name] ?? ""}
                        onChange={(v) => cambiarCabecera(f.name, v)}
                  externalError={erroresServidor[`h:${f.name}`] ?? null}
                        showErrors={showErrors}
                        values={header}
                      />
                    ))}
                  </FormGrid>
                </div>
              )}
            </div>
          )}
        </section>

        {hasLines && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3
                className="text-[0.78rem] font-semibold uppercase tracking-wide"
                style={{ color: lines.length < minLines ? "var(--color-warning)" : "var(--color-ink-soft)" }}
              >
                {config.lineLabel ?? "Líneas"} ({lines.length}
                {minLines > 1 ? ` de ${minLines} mínimo` : ""})
              </h3>
              <div className="flex gap-1.5">
                {!editing && (
                  <Button size="sm" variant="ghost" icon="clipboard" onClick={() => setPegando((v) => !v)}>
                    Pegar de Excel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  icon="plus"
                  onClick={() => setLines((p) => [...p, blankValues(config.lineFields!)])}
                >
                  Agregar
                </Button>
              </div>
            </div>
            {pegando && (
              <div className="mb-2 grid gap-2 rounded-xl p-3" style={{ border: "1px dashed var(--color-line)" }}>
                <span className="field-hint">
                  Copia las celdas en Excel (con o sin fila de encabezados: Artículo, Descripción, Cantidad…) y pégalas aquí. Un renglón por fila.
                </span>
                <textarea
                  className="field-control"
                  rows={5}
                  autoFocus
                  placeholder="Pega aquí las filas copiadas de Excel"
                  value={textoPegado}
                  onChange={(e) => setTextoPegado(e.target.value)}
                />
                {avisosPegado.length > 0 && (
                  <ul className="text-[0.78rem]" style={{ color: "var(--color-warning)" }}>
                    {avisosPegado.slice(0, 6).map((a) => (
                      <li key={a}>• {a}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button size="sm" icon="check" disabled={textoPegado.trim() === ""} onClick={aplicarPegado}>
                    Agregar renglones
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPegando(false); setAvisosPegado([]); }}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  data-linea={i}
                  className="surface-2 rounded-xl p-3"
                  style={{
                    border: resumenErrores.some((x) => x.linea === i) ? "1px solid var(--color-danger)" : "1px solid var(--color-line)",
                  }}
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
                        aria-label="Quitar línea"
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
                            externalError={erroresServidor[`l:${i}:${f.name}`] ?? limiteError(f, line, lineOpts)}
                            showErrors={showErrors}
                            values={line}
                          />
                        ))}
                        <PanelDerivado
                          items={derivados.map((f) => ({
                            def: withResolvedOptions(f, lineOpts),
                            value: line[f.name] ?? "",
                          }))}
                          opts={lineOpts}
                          nota="Se toma de la cotización adjudicada."
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
        <ResumenLateral
          titulo={config.title}
          datos={datosResumen}
          {...(hasLines
            ? { lineas: { etiqueta: config.lineLabel ?? "Líneas", cantidad: lines.length, total: totalLineas } }
            : {})}
          progreso={progreso}
          nota={editing ? undefined : "Lo que el sistema ya sabe se completa solo; puedes cambiarlo."}
        />
      </div>
      )}
    </Modal>
  );
}
