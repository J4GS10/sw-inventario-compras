/**
 * Filtros de reporteria compartidos por todas las pestanas de Reportes.
 *
 * Un reporte declara sus campos (FieldDef) y sus valores iniciales; este
 * modulo los pinta, cuenta los activos, los convierte en la query del
 * servidor y redacta la linea "Filtros aplicados" del PDF. Como la pantalla y
 * el PDF salen del MISMO objeto de valores, el PDF trae exactamente lo que se ve.
 */

import { useEffect, useState } from "react";
import type { FiltrosReporte } from "../../core/CompraServices.js";
import { http } from "../../core/HttpClient.js";
import { Field, FormGrid, type FieldDef, type FieldValue, type SelectOption } from "../../ui/Field.js";

export type ValoresFiltro = Readonly<Record<string, FieldValue>>;

export interface OpcionesFiltro {
  readonly proveedores: readonly SelectOption[];
  readonly categorias: readonly SelectOption[];
  readonly departamentos: readonly SelectOption[];
}

const VACIO: OpcionesFiltro = { proveedores: [], categorias: [], departamentos: [] };

async function opciones(
  ruta: string,
  id: string,
  etiqueta: (r: Record<string, unknown>) => string,
): Promise<SelectOption[]> {
  try {
    const r = await http.list<Record<string, unknown>>(ruta, { pageSize: 200 });
    return r.data
      .map((x) => ({ value: String(x[id]), label: etiqueta(x) }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  } catch {
    return []; // sin permiso o sin datos: el filtro queda en "Todos"
  }
}

/** Catalogos para los selects de filtro (una sola carga por pantalla). */
export function useOpcionesFiltro(): OpcionesFiltro {
  const [o, setO] = useState<OpcionesFiltro>(VACIO);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [proveedores, categorias, departamentos] = await Promise.all([
        opciones("/api/com/proveedores", "idProveedor", (r) => String(r["razonSocial"] ?? r["idProveedor"])),
        opciones("/api/com/ref/categorias-articulo", "idCategoria", (r) => String(r["nombre"] ?? r["idCategoria"])),
        opciones("/api/com/ref/departamentos", "idDepartamento", (r) => String(r["nombre"] ?? r["idDepartamento"])),
      ]);
      if (vivo) setO({ proveedores, categorias, departamentos });
    })();
    return () => {
      vivo = false;
    };
  }, []);
  return o;
}

/** Select con opcion "Todos" al inicio. */
export function selectTodos(name: string, label: string, opts: readonly SelectOption[], help?: string): FieldDef {
  return {
    name,
    label,
    kind: "select",
    options: [{ value: "", label: "Todos" }, ...opts],
    ...(help !== undefined ? { help } : {}),
  };
}

/** Rango de fechas estandar (hasta >= desde). */
export function camposRango(etiquetaDesde = "Desde", etiquetaHasta = "Hasta"): FieldDef[] {
  return [
    { name: "desde", label: etiquetaDesde, kind: "date" },
    { name: "hasta", label: etiquetaHasta, kind: "date", minDateField: "desde" },
  ];
}

export function campoBuscar(label: string): FieldDef {
  return { name: "q", label, kind: "name", help: "Coincide con todas las palabras, sin importar tildes ni mayúsculas." };
}

/** Cuantos filtros difieren de su valor inicial. */
export function contarActivos(valores: ValoresFiltro, inicial: ValoresFiltro): number {
  return Object.keys(valores).filter((k) => valores[k] !== inicial[k] && valores[k] !== "" && valores[k] !== false).length;
}

/** Valores de pantalla -> query del servidor (los vacios se omiten en el servicio). */
export function aFiltros(valores: ValoresFiltro): FiltrosReporte {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(valores)) out[k] = typeof v === "string" ? v.trim() : v;
  return out;
}

/** "Proveedor: X · Desde: 2026-10-01 · Solo vencidas" — para el encabezado del PDF. */
export function describirFiltros(campos: readonly FieldDef[], valores: ValoresFiltro): string {
  const partes: string[] = [];
  for (const c of campos) {
    const v = valores[c.name];
    if (v === undefined || v === "" || v === false) continue;
    if (c.kind === "switch") partes.push(c.label);
    else if (c.kind === "select") partes.push(`${c.label}: ${c.options?.find((o) => o.value === v)?.label ?? String(v)}`);
    else partes.push(`${c.label}: ${String(v)}`);
  }
  return partes.join(" · ");
}

/** Pinta los campos de filtro con sus valores. */
export function CamposFiltro(props: {
  campos: readonly FieldDef[];
  valores: ValoresFiltro;
  onChange: (v: ValoresFiltro) => void;
}): React.ReactElement {
  return (
    <FormGrid>
      {props.campos.map((c) => (
        <Field
          key={c.name}
          def={c}
          values={props.valores}
          value={props.valores[c.name] ?? (c.kind === "switch" ? false : "")}
          onChange={(v: FieldValue) => props.onChange({ ...props.valores, [c.name]: v ?? "" })}
        />
      ))}
    </FormGrid>
  );
}
