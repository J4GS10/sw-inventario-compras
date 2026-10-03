// Matriz COMPLETA rol x recurso x operacion (Crear/Leer/Editar/Eliminar +
// acciones especiales) contra el backend VIVO (HTTP real a :3000), con sesion
// real de cada uno de los 8 roles demo.
//
// Estrategia para probar autorizacion sin fabricar datos validos para cada
// combinacion (imposible de mantener a mano): el guard de permiso corre en el
// preHandler, ANTES de tocar el body o buscar el id. Por lo tanto:
//   - POST con un body vacio/basura: si el rol NO tiene el permiso -> 403.
//                                     si SI lo tiene -> pasa el guard y falla
//                                     mas adelante por validacion (400/422),
//                                     nunca por 403. Un 500 aqui SI es un bug.
//   - PUT/DELETE con id inexistente (999999999): si el rol NO tiene permiso
//                                     -> 403. Si SI lo tiene -> pasa el guard
//                                     y falla por NotFound (404).
// Esto permite verificar, para las 8 x 15 x ~4 combinaciones, EXACTAMENTE lo
// que expone `backend/src/common/auth/permissions.ts` +
// `backend/src/presentation/routes/com/{index,transaccional}.ts`, con
// tráfico HTTP real y login real — sin tocar ni un dato de negocio real.
//
// Uso: node scripts/rbac-crud-matrix.mjs

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:3000";
const FAKE_ID = 999999999;

// ---- Espejo del catalogo de permisos (backend/src/common/auth/permissions.ts) --
const P = {
  SOLICITUD_CREAR: "COMPRAS_SOLICITUD_CREAR",
  SOLICITUD_VER: "COMPRAS_SOLICITUD_VER",
  SOLICITUD_APROBAR_JEFE: "COMPRAS_SOLICITUD_APROBAR_JEFE",
  SOLICITUD_APROBAR_GERENTE: "COMPRAS_SOLICITUD_APROBAR_GERENTE",
  RFQ_GESTIONAR: "COMPRAS_RFQ_GESTIONAR",
  COTIZACION_GESTIONAR: "COMPRAS_COTIZACION_GESTIONAR",
  COTIZACION_ADJUDICAR: "COMPRAS_COTIZACION_ADJUDICAR",
  OC_GESTIONAR: "COMPRAS_OC_GESTIONAR",
  RECEPCION_GESTIONAR: "COMPRAS_RECEPCION_GESTIONAR",
  DEVOLUCION_GESTIONAR: "COMPRAS_DEVOLUCION_GESTIONAR",
  CATALOGO_VER: "COMPRAS_CATALOGO_VER",
  CATALOGO_EDITAR: "COMPRAS_CATALOGO_EDITAR",
  CATALOGO_ADMIN: "COMPRAS_CATALOGO_ADMIN",
  ANALISIS_VER: "COMPRAS_ANALISIS_VER",
};

const ROLE_PERMS = {
  solicitante: [P.SOLICITUD_CREAR, P.SOLICITUD_VER, P.CATALOGO_VER, P.ANALISIS_VER],
  jefe: [P.SOLICITUD_CREAR, P.SOLICITUD_VER, P.SOLICITUD_APROBAR_JEFE, P.CATALOGO_VER, P.ANALISIS_VER],
  gerente: [P.SOLICITUD_VER, P.SOLICITUD_APROBAR_GERENTE, P.CATALOGO_VER, P.ANALISIS_VER],
  comprador: [P.SOLICITUD_VER, P.RFQ_GESTIONAR, P.COTIZACION_GESTIONAR, P.OC_GESTIONAR, P.CATALOGO_VER, P.CATALOGO_EDITAR, P.ANALISIS_VER],
  financiero: [P.SOLICITUD_VER, P.COTIZACION_ADJUDICAR, P.OC_GESTIONAR, P.CATALOGO_VER, P.CATALOGO_EDITAR, P.CATALOGO_ADMIN, P.ANALISIS_VER],
  bodega: [P.RECEPCION_GESTIONAR, P.DEVOLUCION_GESTIONAR, P.CATALOGO_VER],
  auditor: [P.SOLICITUD_VER, P.CATALOGO_VER, P.ANALISIS_VER],
  admin: ["*"],
};
const ROLES = Object.keys(ROLE_PERMS);

function hasAny(rol, perms) {
  const own = ROLE_PERMS[rol];
  if (own.includes("*")) return true;
  return perms.some((p) => own.includes(p));
}

// ---- Espejo de las rutas mutables (presentation/routes/com/{index,transaccional}.ts) --
const READ_SOLICITUDES = [P.SOLICITUD_VER, P.SOLICITUD_CREAR, P.SOLICITUD_APROBAR_JEFE, P.SOLICITUD_APROBAR_GERENTE, P.ANALISIS_VER];
const READ_RFQ = [P.RFQ_GESTIONAR];
const READ_COTIZACIONES = [P.COTIZACION_GESTIONAR, P.COTIZACION_ADJUDICAR];
const READ_OC = [P.OC_GESTIONAR];
const READ_RECEPCIONES = [P.RECEPCION_GESTIONAR];
const READ_DEVOLUCIONES = [P.DEVOLUCION_GESTIONAR];
const APROBAR = [P.SOLICITUD_APROBAR_JEFE, P.SOLICITUD_APROBAR_GERENTE];

const CATALOGOS = [
  { nombre: "Proveedores", path: "/api/com/proveedores", write: [P.CATALOGO_EDITAR] },
  { nombre: "Categorias de compra", path: "/api/com/categorias-compra", write: [P.CATALOGO_EDITAR] },
  { nombre: "Grupos de compra", path: "/api/com/grupos-compra", write: [P.CATALOGO_EDITAR] },
  { nombre: "Condiciones de pago", path: "/api/com/condiciones-pago", write: [P.CATALOGO_EDITAR] },
  { nombre: "Terminos de entrega", path: "/api/com/terminos-entrega", write: [P.CATALOGO_EDITAR] },
  { nombre: "Centros de costo", path: "/api/com/centros-costo", write: [P.CATALOGO_EDITAR] },
  { nombre: "Acuerdos marco", path: "/api/com/acuerdos-proveedor", write: [P.CATALOGO_EDITAR] },
  { nombre: "Articulo-Proveedor", path: "/api/com/articulo-proveedor", write: [P.CATALOGO_EDITAR] },
  { nombre: "Monedas", path: "/api/com/monedas", write: [P.CATALOGO_ADMIN] },
];
const CATALOGOS_READ = [P.CATALOGO_VER]; // todos los catalogos: misma lectura

const DOCUMENTOS = [
  { nombre: "Solicitudes", path: "/api/com/solicitudes", read: READ_SOLICITUDES, write: [P.SOLICITUD_CREAR] },
  { nombre: "RFQ", path: "/api/com/rfq", read: READ_RFQ, write: [P.RFQ_GESTIONAR] },
  { nombre: "Cotizaciones", path: "/api/com/cotizaciones", read: READ_COTIZACIONES, write: [P.COTIZACION_GESTIONAR] },
  { nombre: "Ordenes de compra", path: "/api/com/ordenes-compra", read: READ_OC, write: [P.OC_GESTIONAR] },
  { nombre: "Recepciones", path: "/api/com/recepciones", read: READ_RECEPCIONES, write: [P.RECEPCION_GESTIONAR], noPut: true },
  { nombre: "Devoluciones", path: "/api/com/devoluciones", read: READ_DEVOLUCIONES, write: [P.DEVOLUCION_GESTIONAR], noPut: true },
];

const ACCIONES_ESPECIALES = [
  { nombre: "Solicitud: aprobar", method: "POST", path: `/api/com/solicitudes/${FAKE_ID}/aprobar`, perms: APROBAR },
  { nombre: "Solicitud: rechazar", method: "POST", path: `/api/com/solicitudes/${FAKE_ID}/rechazar`, perms: APROBAR },
  { nombre: "RFQ: invitar", method: "POST", path: `/api/com/rfq/${FAKE_ID}/invitar`, perms: [P.RFQ_GESTIONAR] },
  { nombre: "RFQ: cerrar", method: "POST", path: `/api/com/rfq/${FAKE_ID}/cerrar`, perms: [P.RFQ_GESTIONAR] },
  { nombre: "RFQ: cancelar", method: "POST", path: `/api/com/rfq/${FAKE_ID}/cancelar`, perms: [P.RFQ_GESTIONAR] },
  { nombre: "Cotizacion: adjudicar", method: "POST", path: `/api/com/cotizaciones/detalle/${FAKE_ID}/adjudicar`, perms: [P.COTIZACION_ADJUDICAR] },
  { nombre: "OC: cambiar estado", method: "POST", path: `/api/com/ordenes-compra/${FAKE_ID}/estado`, perms: [P.OC_GESTIONAR] },
  { nombre: "OC: descargar PDF", method: "GET", path: `/api/com/ordenes-compra/${FAKE_ID}/pdf`, perms: READ_OC },
  { nombre: "Recepcion: reversar", method: "POST", path: `/api/com/recepciones/${FAKE_ID}/reversar`, perms: [P.RECEPCION_GESTIONAR] },
  { nombre: "Recepcion: consistencia", method: "GET", path: `/api/com/recepciones/${FAKE_ID}/consistencia`, perms: [P.OC_GESTIONAR] },
];

// ---------------------------------------------------------------------------
let ok = 0;
let fail = 0;
const fallos = [];

function assertExpected(label, expectAllowed, status) {
  const allowedRealidad = status !== 403;
  const pass = allowedRealidad === expectAllowed;
  if (pass) ok++;
  else {
    fail++;
    fallos.push(`${label}: se esperaba ${expectAllowed ? "PERMITIDO (no-403)" : "403"}, HTTP real = ${status}`);
  }
  return pass;
}

// Un 5xx SIEMPRE es un fallo, sin importar el rol (nunca deberia pasar).
function assertNo5xx(label, status) {
  if (status >= 500) {
    fail++;
    fallos.push(`${label}: HTTP ${status} (error interno — nunca deberia pasar, ni con datos basura)`);
    return false;
  }
  ok++;
  return true;
}

async function login(username) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "compras.demo" }),
  });
  const j = await r.json();
  if (r.status !== 200) throw new Error(`login '${username}' fallo: ${r.status}`);
  return j.data.token;
}

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return r.status;
}

async function main() {
  console.log("Login de las 8 sesiones reales...");
  const T = {};
  for (const rol of ROLES) T[rol] = await login(rol);
  console.log("OK.\n");

  // ================= CATALOGOS =================
  for (const cat of CATALOGOS) {
    console.log(`\n--- Catalogo: ${cat.nombre} ---`);
    const row = { rol: [], leer: [], crear: [], editar: [], eliminar: [] };
    for (const rol of ROLES) {
      const token = T[rol];
      const expReadOk = hasAny(rol, CATALOGOS_READ);
      const sGet = await call("GET", `${cat.path}?pageSize=1`, token);
      assertExpected(`${cat.nombre} / ${rol} / LEER`, expReadOk, sGet);

      const expWriteOk = hasAny(rol, cat.write);
      const sPost = await call("POST", cat.path, token, {}); // body vacio a proposito
      assertExpected(`${cat.nombre} / ${rol} / CREAR (autorizacion)`, expWriteOk, sPost);
      assertNo5xx(`${cat.nombre} / ${rol} / CREAR (sin 500)`, sPost);

      const sPut = await call("PUT", `${cat.path}/${FAKE_ID}`, token, {});
      assertExpected(`${cat.nombre} / ${rol} / EDITAR (autorizacion)`, expWriteOk, sPut);
      assertNo5xx(`${cat.nombre} / ${rol} / EDITAR (sin 500)`, sPut);

      const sDel = await call("DELETE", `${cat.path}/${FAKE_ID}`, token);
      assertExpected(`${cat.nombre} / ${rol} / ELIMINAR (autorizacion)`, expWriteOk, sDel);
      assertNo5xx(`${cat.nombre} / ${rol} / ELIMINAR (sin 500)`, sDel);

      row.rol.push(rol.padEnd(11));
      row.leer.push((sGet === 200 ? "OK " : sGet === 403 ? "-  " : String(sGet).padEnd(3)));
      row.crear.push((sPost === 403 ? "-  " : sPost < 500 ? "OK " : "ERR"));
      row.editar.push((sPut === 403 ? "-  " : sPut < 500 ? "OK " : "ERR"));
      row.eliminar.push((sDel === 403 ? "-  " : sDel < 500 ? "OK " : "ERR"));
    }
    console.log("rol        " + ROLES.map((r) => r.slice(0, 4).padEnd(5)).join(""));
    console.log("leer       " + row.leer.map((v) => v.padEnd(5)).join(""));
    console.log("crear      " + row.crear.map((v) => v.padEnd(5)).join(""));
    console.log("editar     " + row.editar.map((v) => v.padEnd(5)).join(""));
    console.log("eliminar   " + row.eliminar.map((v) => v.padEnd(5)).join(""));
  }

  // ================= DOCUMENTOS =================
  for (const doc of DOCUMENTOS) {
    console.log(`\n--- Documento: ${doc.nombre} ---`);
    const row = { leer: [], crear: [], editar: [], eliminar: [] };
    for (const rol of ROLES) {
      const token = T[rol];
      const expReadOk = hasAny(rol, doc.read);
      const sGet = await call("GET", `${doc.path}?pageSize=1`, token);
      assertExpected(`${doc.nombre} / ${rol} / LEER`, expReadOk, sGet);

      const expWriteOk = hasAny(rol, doc.write);
      const sPost = await call("POST", doc.path, token, {});
      assertExpected(`${doc.nombre} / ${rol} / CREAR (autorizacion)`, expWriteOk, sPost);
      assertNo5xx(`${doc.nombre} / ${rol} / CREAR (sin 500)`, sPost);

      let sPut = null;
      if (!doc.noPut) {
        sPut = await call("PUT", `${doc.path}/${FAKE_ID}`, token, {});
        assertExpected(`${doc.nombre} / ${rol} / EDITAR (autorizacion)`, expWriteOk, sPut);
        assertNo5xx(`${doc.nombre} / ${rol} / EDITAR (sin 500)`, sPut);
      }

      const sDel = await call("DELETE", `${doc.path}/${FAKE_ID}`, token);
      assertExpected(`${doc.nombre} / ${rol} / ELIMINAR (autorizacion)`, expWriteOk, sDel);
      assertNo5xx(`${doc.nombre} / ${rol} / ELIMINAR (sin 500)`, sDel);

      row.leer.push(sGet === 200 ? "OK " : sGet === 403 ? "-  " : String(sGet).padEnd(3));
      row.crear.push(sPost === 403 ? "-  " : sPost < 500 ? "OK " : "ERR");
      row.editar.push(doc.noPut ? "n/a" : sPut === 403 ? "-  " : sPut < 500 ? "OK " : "ERR");
      row.eliminar.push(sDel === 403 ? "-  " : sDel < 500 ? "OK " : "ERR");
    }
    console.log("rol        " + ROLES.map((r) => r.slice(0, 4).padEnd(5)).join(""));
    console.log("leer       " + row.leer.map((v) => v.padEnd(5)).join(""));
    console.log("crear      " + row.crear.map((v) => v.padEnd(5)).join(""));
    console.log("editar     " + row.editar.map((v) => v.padEnd(5)).join(""));
    console.log("eliminar   " + row.eliminar.map((v) => v.padEnd(5)).join(""));
  }

  // ================= ACCIONES ESPECIALES =================
  console.log("\n--- Acciones especiales (fuera del CRUD basico) ---");
  for (const accion of ACCIONES_ESPECIALES) {
    const fila = [];
    for (const rol of ROLES) {
      const token = T[rol];
      const expOk = hasAny(rol, accion.perms);
      const s = await call(accion.method, accion.path, token, accion.method === "POST" ? {} : undefined);
      assertExpected(`${accion.nombre} / ${rol}`, expOk, s);
      assertNo5xx(`${accion.nombre} / ${rol} (sin 500)`, s);
      fila.push(s === 403 ? "-  " : s < 500 ? "OK " : "ERR");
    }
    console.log(`${accion.nombre.padEnd(28)} ${fila.map((v) => v.padEnd(5)).join("")}`);
  }
  console.log("rol (referencia arriba):   " + ROLES.map((r) => r.slice(0, 4).padEnd(5)).join(""));

  // ================= RESUMEN =================
  console.log(`\n\n=== RESUMEN: ${ok + fail} checks, ${ok} OK, ${fail} FALLOS ===`);
  if (fallos.length > 0) {
    console.log("\nDetalle de fallos:");
    for (const f of fallos) console.log(` - ${f}`);
  }
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("ERROR FATAL:", e);
  process.exitCode = 1;
});
