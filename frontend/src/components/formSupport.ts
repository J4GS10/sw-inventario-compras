/**
 * Soporte compartido de formularios: definicion de campo con opciones (estaticas,
 * remotas o remotas DEPENDIENTES de otro campo) y hook que las resuelve.
 * Usado por CrudPage y DocumentForm.
 */

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../core/HttpClient.js";
import { FIELD_KINDS } from "../ui/fieldKinds.js";
import type { FieldDef, FieldValue, SelectOption } from "../ui/Field.js";

export interface RemoteOptions {
  /** Ruta del endpoint. Puede llevar placeholders `{campo}` (select dependiente). */
  readonly path: string;
  /** Propiedad para el `value` de la opcion. */
  readonly value: string;
  /** Propiedad para la etiqueta (o usa `labelTpl`). */
  readonly label?: string;
  readonly label2?: string;
  /** Plantilla de etiqueta con placeholders, ej. "#{id} · {descripcion}". */
  readonly labelTpl?: string;
  readonly prefix?: string;
  /** Nombre de campo del que depende (para resolver `{campo}` en `path`). */
  readonly dependsOn?: string;
  /** Ruta (con puntos) al array dentro de la respuesta, ej. "details". */
  readonly pick?: string;
}

export interface FormFieldDef extends FieldDef {
  readonly optionsFrom?: RemoteOptions;
  /** Catalogo estatico (lista fija de opciones). */
  readonly optionsStatic?: readonly SelectOption[];
  /** El campo se fija con un dato de la sesion (no lo elige el usuario). */
  readonly fromSession?: "idEmpleado";
  /**
   * Prellena (editable) con una propiedad del empleado en sesion
   * (p. ej. "idSucursal"). Se resuelve contra `/api/com/ref/empleados`.
   */
  readonly defaultFromSessionEmpleado?: string;
}

const DEPENDS_LABEL: Record<string, string> = {
  idRfq: "el RFQ",
  idSolicitud: "la solicitud",
  idOrdenCompra: "la orden de compra",
  idRecepcion: "la recepcion",
  idProveedor: "el proveedor",
};

type Row = Record<string, unknown>;
type Values = Record<string, FieldValue>;

function fillPlaceholders(path: string, values: Values): string | null {
  let ok = true;
  const filled = path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = values[key];
    if (v === undefined || v === "" || v === null) {
      ok = false;
      return "";
    }
    return String(v);
  });
  return ok ? filled : null;
}

function getByPath(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, k) => {
    if (acc !== null && typeof acc === "object" && k in acc) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

function buildLabel(row: Row, src: RemoteOptions): string {
  if (src.labelTpl !== undefined) {
    return (src.prefix ?? "") + src.labelTpl.replace(/\{(\w+)\}/g, (_m, k: string) => {
      const v = row[k];
      return v === undefined || v === null ? "" : String(v);
    }).replace(/\s+/g, " ").trim();
  }
  const parts = [src.label ? row[src.label] : undefined, src.label2 ? row[src.label2] : undefined]
    .filter((v) => v !== undefined && v !== null && String(v) !== "")
    .map(String);
  const text = parts.length > 0 ? parts.join(" ") : `#${String(row[src.value])}`;
  return (src.prefix ?? "") + text;
}

/**
 * Resuelve las opciones de todos los campos con `optionsFrom` / `optionsStatic`.
 * `values` alimenta los placeholders de los selects dependientes; el hook
 * vuelve a pedir cuando cambia el valor del campo `dependsOn`.
 */
export function useOptions(
  fields: readonly FormFieldDef[],
  values: Values = {},
): Record<string, readonly SelectOption[]> {
  const [remote, setRemote] = useState<Record<string, readonly SelectOption[]>>({});
  // Ruta ya resuelta por campo en el ultimo pase: solo se vuelve a pedir el
  // endpoint de un select cuya ruta realmente cambio (p. ej. un select
  // dependiente al mover su padre). Los catalogos independientes se descargan
  // una sola vez.
  const lastPaths = useRef<Record<string, string | null>>({});

  // [nombre, rutaResuelta | null, config] por cada campo con opciones remotas.
  const resolved = fields
    .filter(
      (f): f is FormFieldDef & { optionsFrom: RemoteOptions } =>
        f.optionsFrom !== undefined,
    )
    .map(
      (f) =>
        [f.name, fillPlaceholders(f.optionsFrom.path, values), f.optionsFrom] as const,
    );

  // Clave de dependencias: cambia si cambia alguna ruta resuelta.
  const depKey = resolved.map(([name, path]) => `${name}::${path ?? "?"}`).join("|");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const prev = lastPaths.current;
      const nextPaths: Record<string, string | null> = {};
      const updates: Record<string, readonly SelectOption[]> = {};

      const jobs = resolved.map(async ([name, path, src]) => {
        nextPaths[name] = path;
        if (path === null) {
          updates[name] = [];
          return;
        }
        // Ruta sin cambios: conserva las opciones ya cargadas (no re-pide).
        if (prev[name] === path) return;
        try {
          const body = await http.raw<unknown>(path, { pageSize: 300 });
          const root = (body as { data?: unknown }).data ?? body;
          const arr: unknown = src.pick !== undefined ? getByPath(root, src.pick) : root;
          const rows: Row[] = Array.isArray(arr) ? (arr as Row[]) : [];
          updates[name] = rows.map((row) => ({
            value: String(row[src.value]),
            label: buildLabel(row, src),
          }));
        } catch {
          updates[name] = [];
        }
      });

      await Promise.all(jobs);
      if (!alive) return;
      lastPaths.current = nextPaths;
      setRemote((current) => ({ ...current, ...updates }));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return useMemo(() => {
    const out: Record<string, readonly SelectOption[]> = { ...remote };
    for (const f of fields) {
      if (f.optionsStatic !== undefined) out[f.name] = f.optionsStatic;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, fields]);
}

/** Devuelve el `FieldDef` con `options` ya resueltas (si aplica). */
export function withResolvedOptions(
  f: FormFieldDef,
  resolved: Record<string, readonly SelectOption[]>,
): FieldDef {
  if (f.optionsFrom !== undefined || f.optionsStatic !== undefined) {
    const options = resolved[f.name] ?? [];
    const dep = f.optionsFrom?.dependsOn;
    const emptyHint =
      dep !== undefined && options.length === 0
        ? `Elige primero ${DEPENDS_LABEL[dep] ?? "el campo del que depende"}`
        : undefined;
    return { ...f, options, ...(emptyHint !== undefined ? { emptyHint } : {}) };
  }
  return f;
}

/** Convierte los valores de un formulario en payload segun el tipo de cada campo. */
export function toPayload(
  fields: readonly FormFieldDef[],
  values: Values,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "switch") {
      out[f.name] = raw === true;
      continue;
    }
    const s = String(raw ?? "").trim();
    if (s === "") continue;
    const numeric = FIELD_KINDS[f.kind].inputType === "number";
    const numericSelect = f.kind === "select" && /^-?\d+$/.test(s);
    out[f.name] = numeric || numericSelect ? Number(s) : s;
  }
  return out;
}

export function firstError(
  fields: readonly FormFieldDef[],
  values: Values,
): string | null {
  for (const f of fields) {
    if (f.kind === "switch") continue;
    const err = FIELD_KINDS[f.kind].validate?.(
      String(values[f.name] ?? ""),
      f.required ?? false,
    );
    if (err != null) return `${f.label}: ${err}`;
  }
  return null;
}

export function blankValues(fields: readonly FormFieldDef[]): Values {
  const v: Values = {};
  for (const f of fields) v[f.name] = f.kind === "switch" ? false : "";
  return v;
}

/* -------------------------------------------------------------------------- *
 * Inferencia: rellena y BLOQUEA campos cuyo valor ya esta decidido por otra
 * seleccion (p. ej. la OC toma proveedor/moneda/tasa/precio de la cotizacion
 * adjudicada). Declarativo por formulario via `DocumentFormConfig.autoFill`.
 * -------------------------------------------------------------------------- */

export interface AutoFillSpec {
  /** Endpoint con las filas fuente; admite placeholders `{campo}` del header. */
  readonly source: string;
  /** Campo de LINEA cuyo valor elige la fila fuente. */
  readonly matchLineField: string;
  /** Propiedad de la fila fuente que iguala a `matchLineField`. */
  readonly matchKey: string;
  /** Copia `fila[from] -> linea[to]` y bloquea `to`. */
  readonly lineMap: Readonly<Record<string, string>>;
  /** Si todas las lineas elegidas comparten `fila[from]`, copia `-> header[to]` (bloqueado). */
  readonly headerMapIfUniform: Readonly<Record<string, string>>;
}

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export function useAutoFill(
  spec: AutoFillSpec | undefined,
  header: Values,
  setHeader: Dispatch<SetStateAction<Values>>,
  lines: Values[],
  setLines: Dispatch<SetStateAction<Values[]>>,
): { lockedHeader: ReadonlySet<string>; lockedLineFields: ReadonlySet<string> } {
  const cache = useRef<Record<string, Row[]>>({});
  const [rows, setRows] = useState<Row[]>([]);

  const path = spec === undefined ? null : fillPlaceholders(spec.source, header);
  const matchValues =
    spec === undefined ? "" : lines.map((l) => s(l[spec.matchLineField])).join(",");

  useEffect(() => {
    if (spec === undefined || path === null) {
      setRows([]);
      return;
    }
    const cached = cache.current[path];
    if (cached !== undefined) {
      setRows(cached);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const body = await http.raw<unknown>(path, { pageSize: 300 });
        const data = (body as { data?: unknown }).data ?? body;
        const arr: Row[] = Array.isArray(data) ? (data as Row[]) : [];
        cache.current[path] = arr;
        if (alive) setRows(arr);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [spec, path]);

  useEffect(() => {
    if (spec === undefined || rows.length === 0) return;
    const byMatch = new Map(rows.map((r) => [s(r[spec.matchKey]), r]));

    // Lineas: copia los campos mapeados de la fila elegida.
    let lineChanged = false;
    const nextLines = lines.map((l) => {
      const row = byMatch.get(s(l[spec.matchLineField]));
      if (row === undefined) return l;
      let patched = l;
      for (const [to, from] of Object.entries(spec.lineMap)) {
        const val = s(row[from]);
        if (val !== "" && s(patched[to]) !== val) {
          if (patched === l) patched = { ...l };
          patched[to] = val;
          lineChanged = true;
        }
      }
      return patched;
    });
    if (lineChanged) setLines(nextLines);

    // Header: solo si todas las lineas elegidas comparten la fila fuente uniforme.
    const chosen = lines
      .map((l) => byMatch.get(s(l[spec.matchLineField])))
      .filter((r): r is Row => r !== undefined);
    const headerEntries = Object.entries(spec.headerMapIfUniform);
    const firstFrom = headerEntries[0]?.[1];
    const uniform =
      chosen.length > 0 &&
      firstFrom !== undefined &&
      chosen.every((r) => s(r[firstFrom]) === s(chosen[0]![firstFrom]));
    if (uniform) {
      let headerChanged = false;
      const patch: Values = {};
      for (const [to, from] of headerEntries) {
        const val = s(chosen[0]![from]);
        if (val !== "" && s(header[to]) !== val) {
          patch[to] = val;
          headerChanged = true;
        }
      }
      if (headerChanged) setHeader((h) => ({ ...h, ...patch }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, rows, matchValues]);

  return useMemo(() => {
    if (spec === undefined) {
      return { lockedHeader: new Set<string>(), lockedLineFields: new Set<string>() };
    }
    const byMatch = new Set(rows.map((r) => s(r[spec.matchKey])));
    const anyChosen = lines.some((l) => byMatch.has(s(l[spec.matchLineField])));
    const chosen = lines
      .map((l) => rows.find((r) => s(r[spec.matchKey]) === s(l[spec.matchLineField])))
      .filter((r): r is Row => r !== undefined);
    const firstFrom = Object.values(spec.headerMapIfUniform)[0];
    const uniform =
      chosen.length > 0 &&
      firstFrom !== undefined &&
      chosen.every((r) => s(r[firstFrom]) === s(chosen[0]![firstFrom]));
    return {
      lockedHeader: uniform ? new Set(Object.keys(spec.headerMapIfUniform)) : new Set<string>(),
      lockedLineFields: anyChosen ? new Set(Object.keys(spec.lineMap)) : new Set<string>(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, rows, matchValues]);
}
