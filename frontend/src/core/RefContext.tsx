/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Catalogo de referencia compartido: resuelve un ID de llave foranea a su
 * etiqueta legible (idMoneda 1 -> "GTQ", idProveedor 7 -> "Ferreteria ...").
 *
 * Carga cada catalogo pequeno UNA vez y lo cachea para toda la sesion, de modo
 * que ninguna tabla del sistema muestre numeros crudos. Tolerante: si un
 * endpoint falla (permiso, red), esa clave cae a "#<id>" sin romper la vista.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { http } from "./HttpClient.js";

export type RefKind =
  | "moneda"
  | "proveedor"
  | "condicionPago"
  | "grupoCompra"
  | "terminoEntrega"
  | "centroCosto"
  | "categoriaCompra"
  | "categoria"
  | "unidadMedida"
  | "articulo"
  | "empleado"
  | "sucursal"
  | "bodega"
  | "departamento";

/** Referencias a OTRO documento del flujo: se muestran con prefijo, sin fetch. */
export type DocRef =
  | "docSolicitud"
  | "docRfq"
  | "docCotizacion"
  | "docOrden"
  | "docRecepcion"
  | "docDevolucion";

const DOC_PREFIX: Record<DocRef, string> = {
  docSolicitud: "SOL-",
  docRfq: "RFQ-",
  docCotizacion: "COT-",
  docOrden: "OC-",
  docRecepcion: "REC-",
  docDevolucion: "DEV-",
};

interface Source {
  readonly path: string;
  readonly id: string;
  readonly label: (r: Record<string, unknown>) => string;
}

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const SOURCES: Record<RefKind, Source> = {
  moneda: { path: "/api/com/monedas", id: "idMoneda", label: (r) => s(r["codigo"]) || s(r["nombre"]) },
  proveedor: { path: "/api/com/proveedores", id: "idProveedor", label: (r) => s(r["razonSocial"]) },
  condicionPago: { path: "/api/com/condiciones-pago", id: "idCondicionPago", label: (r) => s(r["nombre"]) },
  grupoCompra: { path: "/api/com/grupos-compra", id: "idGrupoCompra", label: (r) => s(r["nombre"]) },
  terminoEntrega: { path: "/api/com/terminos-entrega", id: "idTerminoEntrega", label: (r) => s(r["nombre"]) },
  centroCosto: { path: "/api/com/centros-costo", id: "idCentroCosto", label: (r) => s(r["nombre"]) },
  categoriaCompra: { path: "/api/com/categorias-compra", id: "idCategoriaCompra", label: (r) => s(r["nombre"]) },
  categoria: { path: "/api/com/ref/categorias-articulo", id: "idCategoria", label: (r) => s(r["nombre"]) },
  unidadMedida: { path: "/api/com/ref/unidades-medida", id: "idUnidadMedida", label: (r) => s(r["nombre"]) },
  articulo: {
    path: "/api/com/ref/articulos",
    id: "idArticulo",
    label: (r) => [s(r["codigo"]), s(r["nombre"])].filter(Boolean).join(" — "),
  },
  empleado: {
    path: "/api/com/ref/empleados",
    id: "idEmpleado",
    label: (r) => [s(r["nombres"]), s(r["apellidos"])].filter(Boolean).join(" ").trim(),
  },
  sucursal: { path: "/api/com/ref/sucursales", id: "idSucursal", label: (r) => s(r["nombre"]) },
  bodega: { path: "/api/com/ref/bodegas", id: "idBodega", label: (r) => s(r["nombre"]) },
  departamento: { path: "/api/com/ref/departamentos", id: "idDepartamento", label: (r) => s(r["nombre"]) },
};

const SUSTANTIVO: Partial<Record<RefKind, string>> = {
  proveedor: "Proveedor",
  articulo: "Artículo",
  empleado: "Empleado",
  bodega: "Bodega",
  sucursal: "Sucursal",
  moneda: "Moneda",
};

const ALL_KINDS = Object.keys(SOURCES) as RefKind[];

export interface Refs {
  /** Etiqueta legible de un id. `kind` puede ser un catalogo o un DocRef. */
  label(kind: RefKind | DocRef, id: unknown): string;
  /** true cuando ya se resolvio la primera carga de catalogos. */
  ready: boolean;
}

const FALLBACK: Refs = {
  label: (kind, id) => {
    if (id === null || id === undefined || id === "") return "—";
    const p = DOC_PREFIX[kind as DocRef];
    return p !== undefined ? `${p}${id}` : `#${id}`;
  },
  ready: false,
};

const RefContext = createContext<Refs | null>(null);

export function RefProvider(props: { children: ReactNode }): React.ReactElement {
  const maps = useRef<Map<RefKind, Map<number, string>>>(new Map());
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.all(
        ALL_KINDS.map(async (kind) => {
          const src = SOURCES[kind];
          try {
            const page = await http.list<Record<string, unknown>>(src.path, { pageSize: 300 });
            const m = new Map<number, string>();
            for (const row of page.data) {
              const idVal = Number(row[src.id]);
              if (Number.isFinite(idVal)) m.set(idVal, src.label(row) || `#${idVal}`);
            }
            maps.current.set(kind, m);
          } catch {
            maps.current.set(kind, new Map());
          }
        }),
      );
      if (alive) {
        setReady(true);
        setTick((t) => t + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Ids que no vinieron en la carga inicial (catalogo paginado, registro inactivo...): se resuelven de a uno, bajo demanda.
  const pedidos = useRef<Set<string>>(new Set());
  const fallidos = useRef<Set<string>>(new Set());
  const resolverUno = (kind: RefKind, n: number): void => {
    const clave = `${kind}:${n}`;
    if (pedidos.current.has(clave)) return;
    pedidos.current.add(clave);
    const src = SOURCES[kind];
    // Consulta por filtro (200 con lista vacia si no existe: sin 404 en consola). Los /ref/* no filtran: no se resuelven.
    if (src.path.includes("/ref/")) {
      fallidos.current.add(clave);
      return;
    }
    void http
      .list<Record<string, unknown>>(src.path, { pageSize: 1, [`${src.id}__eq`]: String(n) })
      .then((page) => {
        const row = page.data[0];
        if (row === undefined) throw new Error("no existe");
        const texto = src.label(row);
        if (texto === "") throw new Error("sin etiqueta");
        const m = maps.current.get(kind) ?? new Map<number, string>();
        m.set(n, texto);
        maps.current.set(kind, m);
      })
      .catch(() => fallidos.current.add(clave))
      .finally(() => setTick((t) => t + 1));
  };

  const value = useMemo<Refs>(() => {
    void tick;
    return {
      ready,
      label: (kind, id) => {
        if (id === null || id === undefined || id === "") return "—";
        const doc = DOC_PREFIX[kind as DocRef];
        if (doc !== undefined) return `${doc}${id}`;
        const n = Number(id);
        const m = maps.current.get(kind as RefKind);
        const hit = m?.get(n);
        if (hit !== undefined) return hit;
        if (!Number.isFinite(n)) return String(id);
        const clave = `${kind as RefKind}:${n}`;
        if (fallidos.current.has(clave)) return `${SUSTANTIVO[kind as RefKind] ?? "Registro"} #${n} (no disponible)`;
        if (ready && SOURCES[kind as RefKind] !== undefined) resolverUno(kind as RefKind, n);
        return "…";
      },
    };
  }, [ready, tick]);

  return <RefContext.Provider value={value}>{props.children}</RefContext.Provider>;
}

/** Devuelve el resolver de referencias; fuera de <RefProvider> usa un fallback. */
export function useRefs(): Refs {
  return useContext(RefContext) ?? FALLBACK;
}
