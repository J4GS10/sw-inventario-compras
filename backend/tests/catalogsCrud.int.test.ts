/**
 * Test de INTEGRACION - CRUD generico de los catalogos COM_.
 * Data-driven: por cada recurso ejecuta >= 3 operaciones CRUD
 * (crear -> leer -> listar/filtrar -> actualizar -> eliminar -> 404).
 * Ejecutar:  pnpm exec vitest run --config vitest.int.config.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SYS_HEADERS, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const H = SYS_HEADERS;
const rnd = (): string => Math.random().toString(36).slice(2, 8).toUpperCase();

interface RefIds {
  idCategoriaCompra: number;
  idArticulo: number;
  idProveedor: number;
  idOrdenCompra: number;
  idEmpleado: number;
}
const ids = {} as RefIds;

interface CrudCase {
  readonly name: string;
  readonly path: string;
  readonly idField: string;
  readonly build: () => Record<string, unknown>;
  readonly patch: Record<string, unknown>;
  /** campo unico para probar el filtro de listado */
  readonly filterField: string;
}

const cases: readonly CrudCase[] = [
  {
    name: "monedas",
    path: "/api/com/monedas",
    idField: "idMoneda",
    build: () => ({ codigo: Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(""), nombre: "Moneda " + rnd(), simbolo: "X", activa: true }),
    patch: { nombre: "Moneda editada" },
    filterField: "codigo",
  },
  {
    name: "categorias-compra",
    path: "/api/com/categorias-compra",
    idField: "idCategoriaCompra",
    build: () => ({ nombre: "Categoría " + rnd(), descripcion: "d", estado: "A" }),
    patch: { estado: "I" },
    filterField: "nombre",
  },
  {
    name: "condiciones-pago",
    path: "/api/com/condiciones-pago",
    idField: "idCondicionPago",
    build: () => ({ nombre: "Condición " + rnd(), dias: 45 }),
    patch: { dias: 50 },
    filterField: "nombre",
  },
  {
    name: "terminos-entrega",
    path: "/api/com/terminos-entrega",
    idField: "idTerminoEntrega",
    build: () => ({ nombre: "Termino " + rnd(), diasEstimados: 7 }),
    patch: { diasEstimados: 9 },
    filterField: "nombre",
  },
  {
    name: "centros-costo",
    path: "/api/com/centros-costo",
    idField: "idCentroCosto",
    build: () => ({ codigo: "CC" + rnd(), nombre: "Centro " + rnd(), estado: "A" }),
    patch: { nombre: "Centro editado" },
    filterField: "codigo",
  },
  {
    name: "proveedores",
    path: "/api/com/proveedores",
    idField: "idProveedor",
    build: () => ({ nit: "T" + rnd(), razonSocial: "Proveedor " + rnd(), estado: "A", diasCredito: 30 }),
    patch: { diasCredito: 45, calificacion: "A" },
    filterField: "nit",
  },
  {
    name: "grupos-compra",
    path: "/api/com/grupos-compra",
    idField: "idGrupoCompra",
    build: () => ({ idCategoriaCompra: ids.idCategoriaCompra, nombre: "Grupo " + rnd(), descripcion: "d" }),
    patch: { descripcion: "editada" },
    filterField: "nombre",
  },
  {
    name: "articulo-proveedor",
    path: "/api/com/articulo-proveedor",
    idField: "idArticuloProveedor",
    build: () => ({ idArticulo: ids.idArticulo, idProveedor: ids.idProveedor, precioUltimaCompra: 12.5 }),
    patch: { precioUltimaCompra: 15.75 },
    filterField: "idProveedor",
  },
  {
    name: "acuerdos-proveedor",
    path: "/api/com/acuerdos-proveedor",
    idField: "idAcuerdo",
    build: () => ({
      idProveedor: ids.idProveedor,
      idArticulo: ids.idArticulo,
      precioFijo: 10.0,
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 365 * 864e5).toISOString(),
      activo: true,
    }),
    patch: { precioFijo: 11.25 },
    filterField: "idProveedor",
  },
  {
    name: "seguimiento-orden",
    path: "/api/com/seguimiento-orden",
    idField: "idSeguimiento",
    build: () => ({ idOrdenCompra: ids.idOrdenCompra, estadoReporte: "CONTACTADO", notas: "n " + rnd() }),
    patch: { estadoReporte: "CONFIRMADO" },
    filterField: "idOrdenCompra",
  },
  {
    name: "excepciones-orden",
    path: "/api/com/excepciones-orden",
    idField: "idExcepcion",
    build: () => ({
      idOrdenCompra: ids.idOrdenCompra,
      tipo: "RETRASO",
      descripcion: "Retraso reportado " + rnd(),
      idEmpleadoReporta: ids.idEmpleado,
      resuelta: false,
    }),
    patch: { resuelta: true },
    filterField: "idOrdenCompra",
  },
];

beforeAll(async () => {
  app = await startTestApp();
  ids.idCategoriaCompra = await scalar(
    "SELECT MIN(ID_CATEGORIA_COMPRA) V FROM COM_CATEGORIA_COMPRA WHERE ELIMINADO='N'",
  );
  ids.idArticulo = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  ids.idProveedor = await scalar("SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N'");
  ids.idEmpleado = await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  const idMoneda = await scalar("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'");
  const idUnidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");

  // OC standalone (sin solicitud/cotizacion) solo para tener un FK valido en
  // seguimiento/excepciones: precioUnitario explicito evita el PriceResolver.
  const oc = await app.inject({
    method: "POST",
    url: "/api/com/ordenes-compra",
    headers: H,
    payload: {
      idProveedor: ids.idProveedor,
      idEmpleadoGerenteFinanciero: ids.idEmpleado,
      idMoneda,
      tasaCambio: 1,
      fechaEntregaEsperada: new Date(Date.now() + 14 * 864e5).toISOString(),
      lineas: [
        {
          descripcion: "OC de prueba (catálogos seguimiento/excepciones)",
          cantidad: 1,
          idUnidadMedida,
          precioUnitario: 10,
        },
      ],
    },
  });
  ids.idOrdenCompra = (
    oc.json() as { data: { header: { idOrdenCompra: number } } }
  ).data.header.idOrdenCompra;
});

afterAll(async () => {
  await stopTestApp(app);
});

describe.each(cases)("CRUD catálogo: $name", (c) => {
  let createdId = 0;
  let created: Record<string, unknown> = {};

  it("1. crea (POST 201) y devuelve el recurso", async () => {
    const res = await app.inject({ method: "POST", url: c.path, headers: H, payload: c.build() });
    expect(res.statusCode).toBe(201);
    created = (res.json() as { data: Record<string, unknown> }).data;
    createdId = Number(created[c.idField]);
    expect(createdId).toBeGreaterThan(0);
  });

  it("2. lee por id (GET 200) y aparece filtrado en el listado", async () => {
    const byId = await app.inject({ method: "GET", url: `${c.path}/${createdId}`, headers: H });
    expect(byId.statusCode).toBe(200);

    const filterValue = String(created[c.filterField]);
    const list = await app.inject({
      method: "GET",
      url: `${c.path}?pageSize=50&${c.filterField}=${encodeURIComponent(filterValue)}`,
      headers: H,
    });
    expect(list.statusCode).toBe(200);
    const rows = (list.json() as { data: Record<string, unknown>[] }).data;
    expect(rows.some((r) => Number(r[c.idField]) === createdId)).toBe(true);
  });

  it("3. actualiza (PUT 200) aplicando el patch", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `${c.path}/${createdId}`,
      headers: H,
      payload: c.patch,
    });
    expect(res.statusCode).toBe(200);
    const updated = (res.json() as { data: Record<string, unknown> }).data;
    for (const [k, v] of Object.entries(c.patch)) {
      expect(updated[k]).toBe(v);
    }
  });

  it("4. elimina (DELETE 204) y luego GET da 404 (soft delete)", async () => {
    const del = await app.inject({ method: "DELETE", url: `${c.path}/${createdId}`, headers: H });
    expect(del.statusCode).toBe(204);
    const after = await app.inject({ method: "GET", url: `${c.path}/${createdId}`, headers: H });
    expect(after.statusCode).toBe(404);
  });

  it("5. rechaza cuerpo inválido (POST 422)", async () => {
    const res = await app.inject({ method: "POST", url: c.path, headers: H, payload: {} });
    expect(res.statusCode).toBe(422);
  });
});
