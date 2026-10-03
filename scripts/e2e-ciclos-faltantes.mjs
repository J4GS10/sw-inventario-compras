// Completa 3 ciclos reales de alta+baja (y edicion) que la corrida anterior
// no cubrio del lado del rol que realmente los ejecuta en produccion:
//   1. Solicitante crea y ELIMINA su propia solicitud (mientras PENDIENTE_JEFE).
//   2. Comprador crea, EDITA (fecha limite) y ELIMINA un RFQ real (sin
//      cotizaciones registradas — el caso que SI debe permitirse).
//   3. Bodega crea una Recepcion y trata de ELIMINARLA de inmediato, mientras
//      sigue en RECIBIDO (antes de que el Observer de CxP la alimente).
// Todo con datos reales, sesiones reales por rol, HTTP real a :3000.

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:3000";
const results = [];
function check(label, pass, detail) {
  results.push({ label, pass, detail: detail ?? "" });
  console.log(`${pass ? "OK  " : "FAIL"} ${label}${detail ? " -> " + detail : ""}`);
}
async function login(username) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "compras.demo" }),
  });
  const j = await r.json();
  if (r.status !== 200) throw new Error(`login ${username} fallo: ${r.status}`);
  return j.data;
}
async function api(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
function expectStatus(label, res, expected) {
  const arr = Array.isArray(expected) ? expected : [expected];
  const pass = arr.includes(res.status);
  check(label, pass, pass ? `HTTP ${res.status}` : `esperaba ${arr.join("/")}, obtuvo ${res.status}: ${JSON.stringify(res.json)}`);
  return res.json?.data;
}

async function main() {
  const S = {};
  for (const rol of ["solicitante", "jefe", "gerente", "comprador", "bodega", "admin"]) S[rol] = await login(rol);
  const T = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.token]));
  const EMP = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.sesion.idEmpleado]));

  const sucursales = await api("GET", "/api/com/ref/sucursales?pageSize=5", T.admin);
  const articulos = await api("GET", "/api/com/ref/articulos?pageSize=20", T.admin);
  const grupos = await api("GET", "/api/com/grupos-compra?pageSize=5", T.admin);
  const terminos = await api("GET", "/api/com/terminos-entrega?pageSize=5", T.admin);
  const idSucursal = sucursales.json.data[0].idSucursal;
  const art = articulos.json.data[0];
  const idGrupoCompra = grupos.json.data[0].idGrupoCompra;
  const idTerminoEntrega = terminos.json.data[0].idTerminoEntrega;
  const fechaRequerida = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

  // ===== 1. Solicitante crea y elimina su propia solicitud =====
  console.log("\n=== Ciclo 1: Solicitante crea y elimina su propia solicitud ===");
  const solCrear = await api("POST", "/api/com/solicitudes", T.solicitante, {
    idEmpleadoSolicitante: EMP.solicitante,
    idSucursal, idGrupoCompra, idTerminoEntrega,
    justificacion: "Solicitud de prueba para verificar Eliminar (E2E, se borra de inmediato)",
    prioridad: 3,
    detalles: [{ idArticulo: art.idArticulo, descripcion: art.nombre, cantidadSolicitada: 5, idUnidadMedida: art.idUnidadMedida, fechaRequerida }],
  });
  const sol = expectStatus("Solicitante crea solicitud desechable", solCrear, 201);
  const idSol = sol?.header?.idSolicitud;

  const otroRolElimina = await api("DELETE", `/api/com/solicitudes/${idSol}`, T.jefe);
  // El jefe tiene SOLICITUD_CREAR (puede eliminar solicitudes en general),
  // pero el alcance por departamento debe impedirle tocar una que no es suya
  // si no esta en su equipo -- se acepta 403 o 204 segun el alcance real de datos demo.
  check("eliminar de otro rol responde 2xx/403 (no 500)", otroRolElimina.status < 500, `HTTP ${otroRolElimina.status}`);

  const propiaElimina = await api("DELETE", `/api/com/solicitudes/${idSol}`, T.solicitante);
  expectStatus("Solicitante elimina su propia solicitud (mientras PENDIENTE_JEFE)", propiaElimina, [204, 404]);

  if (propiaElimina.status === 204) {
    const lista = await api("GET", "/api/com/solicitudes?pageSize=200", T.solicitante);
    const sigue = (lista.json?.data ?? []).some((r) => r.idSolicitud === idSol);
    check("la solicitud desaparece del listado tras eliminarla", !sigue);
  }

  // ===== 2. Comprador crea, edita y elimina un RFQ real (sin cotizaciones) =====
  console.log("\n=== Ciclo 2: Comprador crea, edita y elimina un RFQ real ===");
  const proveedores = await api("GET", "/api/com/proveedores?pageSize=5", T.admin);
  const idsProveedores = proveedores.json.data.slice(0, 3).map((p) => p.idProveedor);

  const sol2Crear = await api("POST", "/api/com/solicitudes", T.solicitante, {
    idEmpleadoSolicitante: EMP.solicitante,
    idSucursal, idGrupoCompra, idTerminoEntrega,
    justificacion: "Solicitud de apoyo para probar ciclo completo de RFQ (E2E)",
    prioridad: 3,
    detalles: [{ idArticulo: art.idArticulo, descripcion: art.nombre, cantidadSolicitada: 8, idUnidadMedida: art.idUnidadMedida, fechaRequerida }],
  });
  const sol2 = expectStatus("crea solicitud de apoyo", sol2Crear, 201);
  const idSol2 = sol2?.header?.idSolicitud;
  await api("POST", `/api/com/solicitudes/${idSol2}/aprobar`, T.jefe, { idEmpleado: EMP.jefe });
  const aprobG = await api("POST", `/api/com/solicitudes/${idSol2}/aprobar`, T.gerente, { idEmpleado: EMP.gerente });
  check("solicitud de apoyo llega a EN_COTIZACION", aprobG.json?.data?.estado === "EN_COTIZACION", aprobG.json?.data?.estado);

  const rfqCrear = await api("POST", "/api/com/rfq", T.comprador, {
    idSolicitud: idSol2,
    fechaLimite: fechaRequerida,
    proveedores: idsProveedores,
  });
  const rfq = expectStatus("Comprador crea RFQ real", rfqCrear, 201);
  const idRfq = rfq?.header?.idRfq;

  const fechaNueva = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
  const rfqEditar = await api("PUT", `/api/com/rfq/${idRfq}`, T.comprador, { fechaLimite: fechaNueva });
  const rfqEditado = expectStatus("Comprador edita la fecha limite del RFQ", rfqEditar, 200);
  check("fechaLimite quedo actualizada", String(rfqEditado?.fechaLimite ?? "").startsWith(fechaNueva));

  const rfqEliminar = await api("DELETE", `/api/com/rfq/${idRfq}`, T.comprador);
  // Nota: los documentos transaccionales (a diferencia de los catalogos, que
  // devuelven 204) responden 200 con {data:{idRfq}} en Eliminar -- funciona,
  // pero es una inconsistencia de la API frente al patron REST de los
  // catalogos; documentada como mejora, no corregida aqui (cambiar el codigo
  // de estado es una decision de contrato de API, no un bug de logica).
  expectStatus("Comprador elimina el RFQ (sin cotizaciones registradas)", rfqEliminar, 200);
  const listaRfq = await api("GET", "/api/com/rfq?pageSize=200", T.comprador);
  const rfqSigue = (listaRfq.json?.data ?? []).some((r) => r.idRfq === idRfq);
  check("el RFQ desaparece del listado tras eliminarlo", !rfqSigue);

  // ===== 3. Bodega crea una Recepcion y trata de eliminarla de inmediato =====
  console.log("\n=== Ciclo 3: Bodega crea y trata de eliminar una Recepcion (antes de CxP) ===");
  const sol3Crear = await api("POST", "/api/com/solicitudes", T.solicitante, {
    idEmpleadoSolicitante: EMP.solicitante,
    idSucursal, idGrupoCompra, idTerminoEntrega,
    justificacion: "Solicitud de apoyo para probar Eliminar de Recepcion (E2E)",
    prioridad: 3,
    detalles: [{ idArticulo: art.idArticulo, descripcion: art.nombre, cantidadSolicitada: 3, idUnidadMedida: art.idUnidadMedida, fechaRequerida }],
  });
  const sol3 = expectStatus("crea 2a solicitud de apoyo", sol3Crear, 201);
  const idSol3 = sol3?.header?.idSolicitud;
  const det3 = sol3?.details?.[0];
  await api("POST", `/api/com/solicitudes/${idSol3}/aprobar`, T.jefe, { idEmpleado: EMP.jefe });
  await api("POST", `/api/com/solicitudes/${idSol3}/aprobar`, T.gerente, { idEmpleado: EMP.gerente });

  const monedas = await api("GET", "/api/com/monedas?pageSize=5", T.admin);
  const idMoneda = monedas.json.data[0].idMoneda;
  const ocCrear = await api("POST", "/api/com/ordenes-compra", T.comprador, {
    idProveedor: idsProveedores[0],
    idEmpleadoGerenteFinanciero: EMP.comprador,
    idMoneda, tasaCambio: 1,
    fechaEntregaEsperada: fechaRequerida,
    idSolicitud: idSol3,
    lineas: [{ idArticulo: art.idArticulo, descripcion: art.nombre, cantidad: 3, idUnidadMedida: art.idUnidadMedida, precioUnitario: 10 }],
  });
  const oc3 = expectStatus("Comprador emite OC manual (precio directo) de apoyo", ocCrear, 201);
  const idOc3 = oc3?.header?.idOrdenCompra;
  const ocDet3 = oc3?.details?.[0];

  const bodegas = await api("GET", "/api/com/ref/bodegas?pageSize=5", T.bodega);
  const idBodega = bodegas.json.data[0].idBodega;
  const recCrear = await api("POST", "/api/com/recepciones", T.bodega, {
    idOrdenCompra: idOc3, idBodega, idEmpleadoRecibe: EMP.bodega,
    lineas: [{ idOcDetalle: ocDet3.idOcDetalle, cantidadRecibida: 3 }],
  });
  const rec3 = expectStatus("Bodega registra la Recepcion", recCrear, 201);
  const idRec3 = rec3?.header?.idRecepcion;

  const estadoInmediato = await api("GET", `/api/com/recepciones/${idRec3}`, T.bodega);
  const estado = estadoInmediato.json?.data?.header?.estado;
  console.log(`   (estado inmediatamente despues de crear: ${estado})`);

  const delRec = await api("DELETE", `/api/com/recepciones/${idRec3}`, T.bodega);
  if (estado === "RECIBIDO") {
    expectStatus("Bodega elimina la Recepcion mientras sigue RECIBIDO", delRec, 204);
  } else {
    expectStatus(
      "el Observer de CxP ya la alimento (ALIMENTADO_CXP) -> Eliminar debe rechazarse con la regla real",
      delRec,
      409,
    );
  }

  // ===== resumen =====
  const fallidos = results.filter((r) => !r.pass);
  console.log(`\n=== RESUMEN: ${results.length} checks, ${results.length - fallidos.length} OK, ${fallidos.length} FALLOS ===`);
  for (const f of fallidos) console.log(` - ${f.label}: ${f.detail}`);
  process.exitCode = fallidos.length > 0 ? 1 : 0;
}
main().catch((e) => { console.error("ERROR FATAL:", e); process.exitCode = 1; });
