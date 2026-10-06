// Validacion de negocio END-TO-END sobre el backend VIVO (HTTP real, :3000),
// con sesiones reales de cada rol demo (no `x-dev-user`, no app.inject) y datos
// con sentido de negocio, como si el sistema ya estuviera en produccion.
//
// Fase 1: alta / edicion / baja REAL en los 9 catalogos del modulo.
// Fase 2: ciclo completo Solicitud -> Aprobacion (jefe+gerente) -> RFQ ->
//         Cotizaciones -> Adjudicacion -> Orden de Compra -> cambios de estado
//         -> Recepcion (parcial + completa) -> Devolucion, cada paso con el
//         ROL real que lo ejecuta en produccion, mas los casos negativos
//         (permiso equivocado, regla de negocio violada, bloqueo optimista)
//         que un flujo real tiene que rechazar.
//
// Uso: node scripts/e2e-negocio-real.mjs
// Requiere: backend :3000 arriba (pnpm dev) + Oracle + MinIO si aplica.

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:3000";
const results = [];

function record(label, pass, detail) {
  results.push({ label, pass, detail: detail ?? "" });
  const tag = pass ? "OK  " : "FAIL";
  console.log(`${tag} ${label}${detail ? " -> " + detail : ""}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function login(username) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "compras.demo" }),
  });
  const j = await r.json().catch(() => null);
  if (r.status !== 200) {
    throw new Error(`login '${username}' fallo: ${r.status} ${JSON.stringify(j)}`);
  }
  return j.data;
}

async function api(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* sin cuerpo (204) */
  }
  return { status: r.status, json };
}

function expectStatus(label, res, expected) {
  const expectedArr = Array.isArray(expected) ? expected : [expected];
  const pass = expectedArr.includes(res.status);
  record(
    label,
    pass,
    pass ? `HTTP ${res.status}` : `esperaba ${expectedArr.join("/")}, obtuvo ${res.status}: ${JSON.stringify(res.json)}`,
  );
  return res.json?.data;
}

function check(label, pass, detail) {
  record(label, pass, detail);
}

async function main() {
  section("Login de sesiones reales (una por rol)");
  const sesiones = {};
  for (const rol of ["solicitante", "jefe", "gerente", "comprador", "financiero", "bodega", "auditor", "admin"]) {
    const s = await login(rol);
    sesiones[rol] = s;
    check(`login ${rol}`, typeof s.token === "string" && s.token.length > 0, `idEmpleado=${s.sesion.idEmpleado}`);
  }
  const T = Object.fromEntries(Object.entries(sesiones).map(([k, v]) => [k, v.token]));
  const EMP = Object.fromEntries(Object.entries(sesiones).map(([k, v]) => [k, v.sesion.idEmpleado]));

  // ------------------------------------------------------------------------
  section("Datos maestros de referencia (lectura real)");
  const sucursales = await api("GET", "/api/com/ref/sucursales?pageSize=5", T.admin);
  const articulos = await api("GET", "/api/com/ref/articulos?pageSize=20", T.admin);
  const grupos = await api("GET", "/api/com/grupos-compra?pageSize=20", T.admin);
  const terminos = await api("GET", "/api/com/terminos-entrega?pageSize=20", T.admin);
  const condiciones = await api("GET", "/api/com/condiciones-pago?pageSize=20", T.admin);
  const monedas = await api("GET", "/api/com/monedas?pageSize=20", T.admin);
  const proveedoresExistentes = await api("GET", "/api/com/proveedores?pageSize=20", T.admin);

  const idSucursal = sucursales.json.data[0]?.idSucursal;
  const listaArticulos = articulos.json.data;
  const idGrupoCompra = grupos.json.data[0]?.idGrupoCompra;
  const idTerminoEntrega = terminos.json.data[0]?.idTerminoEntrega;
  const idCondicionPago = condiciones.json.data[0]?.idCondicionPago;
  const idMoneda = monedas.json.data[0]?.idMoneda;
  const proveedoresBase = proveedoresExistentes.json.data.slice(0, 3).map((p) => p.idProveedor);
  check(
    "maestros minimos disponibles",
    idSucursal && idGrupoCompra && idTerminoEntrega && idCondicionPago && idMoneda && listaArticulos.length >= 2 && proveedoresBase.length >= 3,
    `sucursal=${idSucursal} grupo=${idGrupoCompra} termino=${idTerminoEntrega} condicion=${idCondicionPago} moneda=${idMoneda} articulos=${listaArticulos.length} proveedores=${proveedoresBase.length}`,
  );

  // ==========================================================================
  section("FASE 1 — Catalogos: alta / edicion / baja real");
  // 1.1 Proveedor nuevo, con NIT unico real de negocio.
  // Sufijo unico por corrida: los nombres/NIT/codigos son UNIQUE y una corrida abortada dejaba
  // filas que hacian fallar (409) todas las siguientes. NIT es VARCHAR2(20): `NIT-E2E-` + base36 cabe.
  const SFX = Date.now().toString(36);
  const nit = `NIT-E2E-${SFX}`;
  const provCrear = await api("POST", "/api/com/proveedores", T.comprador, {
    nit,
    razonSocial: "Suministros Industriales del Norte, S.A.",
    nombreComercial: "Sumindus",
    direccion: "Km 14.5 Carretera al Atlantico, Zona Industrial",
    telefono: "+502 2345-6789",
    email: "ventas@sumindus-e2e.example.com",
    diasCredito: 30,
    calificacion: "A",
    estado: "A",
  });
  const idProveedorNuevo = expectStatus("crea Proveedor real (Sumindus)", provCrear, 201)?.idProveedor;

  const provDup = await api("POST", "/api/com/proveedores", T.comprador, {
    nit,
    razonSocial: "Duplicado a proposito",
  });
  expectStatus("rechaza NIT duplicado (unicidad real)", provDup, 409);

  if (idProveedorNuevo) {
    const provEditar = await api("PUT", `/api/com/proveedores/${idProveedorNuevo}`, T.comprador, {
      telefono: "+502 2345-9999",
      diasCredito: 45,
    });
    const editado = expectStatus("edita Proveedor (telefono/diasCredito)", provEditar, 200);
    check("el cambio de diasCredito se aplico", editado?.diasCredito === 45, `diasCredito=${editado?.diasCredito}`);
  }

  // 1.2 Categoria + Grupo de compra encadenados (el grupo depende de la categoria).
  const catCrear = await api("POST", "/api/com/categorias-compra", T.comprador, {
    nombre: `Materiales de Construccion (E2E ${SFX})`,
    descripcion: "Cemento, agregados y ferreteria para obra",
    estado: "A",
  });
  const idCategoriaNueva = expectStatus("crea Categoria de compra", catCrear, 201)?.idCategoriaCompra;

  let idGrupoNuevo;
  if (idCategoriaNueva) {
    const grpCrear = await api("POST", "/api/com/grupos-compra", T.comprador, {
      idCategoriaCompra: idCategoriaNueva,
      nombre: `Cemento y Agregados (E2E ${SFX})`,
      descripcion: "Cemento, arena, piedrin",
    });
    idGrupoNuevo = expectStatus("crea Grupo de compra (bajo la categoria nueva)", grpCrear, 201)?.idGrupoCompra;
  }

  // 1.3 Condicion de pago + Termino de entrega.
  const condCrear = await api("POST", "/api/com/condiciones-pago", T.comprador, {
    nombre: `Credito 45 dias (E2E ${SFX})`,
    dias: 45,
  });
  const idCondicionNueva = expectStatus("crea Condicion de pago", condCrear, 201)?.idCondicionPago;
  if (idCondicionNueva) {
    const condEditar = await api("PUT", `/api/com/condiciones-pago/${idCondicionNueva}`, T.comprador, { dias: 60 });
    const e = expectStatus("edita Condicion de pago (45 -> 60 dias)", condEditar, 200);
    check("dias quedo en 60", e?.dias === 60, `dias=${e?.dias}`);
  }

  const termCrear = await api("POST", "/api/com/terminos-entrega", T.comprador, {
    nombre: `Entrega en bodega central (E2E ${SFX})`,
    diasEstimados: 7,
  });
  const idTerminoNuevo = expectStatus("crea Termino de entrega", termCrear, 201)?.idTerminoEntrega;

  // 1.4 Centro de costo.
  const centroCrear = await api("POST", "/api/com/centros-costo", T.comprador, {
    codigo: `CC-E2E-${Date.now() % 100000}`,
    nombre: "Obra Zona 10 (E2E)",
    estado: "A",
  });
  const idCentroNuevo = expectStatus("crea Centro de costo", centroCrear, 201)?.idCentroCosto;

  // 1.5 Moneda — sensible: comprador NO debe poder, financiero si.
  const monedaComoComprador = await api("POST", "/api/com/monedas", T.comprador, {
    codigo: "ZZC",
    nombre: "Moneda que Comprador no deberia crear",
  });
  expectStatus("Comprador NO puede crear Moneda (403)", monedaComoComprador, 403);

  const monedaCrear = await api("POST", "/api/com/monedas", T.financiero, {
    // 3 letras mayusculas (ISO 4217) unicas por corrida
    codigo: Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(""),
    nombre: "Moneda de prueba E2E",
    simbolo: "Z$",
    activa: true,
  });
  const idMonedaNueva = expectStatus("Financiero SI puede crear Moneda", monedaCrear, 201)?.idMoneda;
  if (idMonedaNueva) {
    const monedaEditar = await api("PUT", `/api/com/monedas/${idMonedaNueva}`, T.financiero, { activa: false });
    const m = expectStatus("Financiero edita Moneda (desactiva)", monedaEditar, 200);
    check("moneda quedo inactiva", m?.activa === false, `activa=${m?.activa}`);
  }

  // 1.6 Acuerdo marco + Articulo-Proveedor sobre un proveedor/articulo YA existentes
  // (no se acopla a los que se estan por eliminar en este mismo flujo).
  const provRef = proveedoresBase[0];
  const artRef = listaArticulos[0]?.idArticulo;
  const acuerdoCrear = await api("POST", "/api/com/acuerdos-proveedor", T.comprador, {
    idProveedor: provRef,
    idArticulo: artRef,
    precioFijo: 99.5,
    fechaInicio: new Date().toISOString(),
    fechaFin: new Date(Date.now() + 180 * 864e5).toISOString(),
    activo: true,
  });
  const idAcuerdoNuevo = expectStatus("crea Acuerdo marco (precio fijo)", acuerdoCrear, 201)?.idAcuerdo;
  if (idAcuerdoNuevo) {
    const acuerdoEditar = await api("PUT", `/api/com/acuerdos-proveedor/${idAcuerdoNuevo}`, T.comprador, {
      precioFijo: 105.0,
    });
    const a = expectStatus("edita Acuerdo marco (precio)", acuerdoEditar, 200);
    check("precioFijo actualizado", Number(a?.precioFijo) === 105, `precioFijo=${a?.precioFijo}`);
  }

  const artProvCrear = await api("POST", "/api/com/articulo-proveedor", T.comprador, {
    idProveedor: provRef,
    idArticulo: listaArticulos[1]?.idArticulo ?? artRef,
    precioUltimaCompra: 42.75,
    fechaUltimaCompra: new Date().toISOString().slice(0, 10),
  });
  const idArtProvNuevo = expectStatus("crea Articulo-Proveedor (respaldo de precio)", artProvCrear, 201)?.idArticuloProveedor;

  // 1.7 Baja real (soft delete) de TODO lo creado en esta fase + verificacion
  // de que desaparece del listado.
  section("FASE 1 — Baja real de los catalogos creados");
  const bajas = [
    ["Articulo-Proveedor", "/api/com/articulo-proveedor", idArtProvNuevo, T.comprador],
    ["Acuerdo marco", "/api/com/acuerdos-proveedor", idAcuerdoNuevo, T.comprador],
    ["Moneda", "/api/com/monedas", idMonedaNueva, T.financiero],
    ["Centro de costo", "/api/com/centros-costo", idCentroNuevo, T.comprador],
    ["Termino de entrega", "/api/com/terminos-entrega", idTerminoNuevo, T.comprador],
    ["Condicion de pago", "/api/com/condiciones-pago", idCondicionNueva, T.comprador],
    ["Grupo de compra", "/api/com/grupos-compra", idGrupoNuevo, T.comprador],
    ["Categoria de compra", "/api/com/categorias-compra", idCategoriaNueva, T.comprador],
    ["Proveedor", "/api/com/proveedores", idProveedorNuevo, T.comprador],
  ];
  for (const [nombre, path, id, token] of bajas) {
    if (!id) {
      check(`elimina ${nombre}`, false, "no se creo antes, se omite");
      continue;
    }
    const del = await api("DELETE", `${path}/${id}`, token);
    expectStatus(`elimina ${nombre} (borrado logico)`, del, 204);
    const lista = await api("GET", `${path}?pageSize=200`, token);
    const sigueVisible = (lista.json?.data ?? []).some((r) => Object.values(r).includes(id));
    check(`${nombre} desaparece del listado tras eliminar`, !sigueVisible);
  }

  // ==========================================================================
  section("FASE 2 — Ciclo transaccional completo, con roles reales");

  const inTwoWeeks = new Date(Date.now() + 14 * 864e5);
  const fechaRequerida = inTwoWeeks.toISOString().slice(0, 10);

  const art1 = listaArticulos[0];
  const art2 = listaArticulos[1];

  const solCrear = await api("POST", "/api/com/solicitudes", T.solicitante, {
    idEmpleadoSolicitante: EMP.solicitante,
    idSucursal,
    idGrupoCompra,
    idTerminoEntrega,
    justificacion: "Reposicion de materiales para mantenimiento preventivo de planta (E2E)",
    prioridad: 2,
    montoEstimado: 4500.0,
    detalles: [
      {
        idArticulo: art1.idArticulo,
        descripcion: art1.nombre,
        cantidadSolicitada: 50,
        idUnidadMedida: art1.idUnidadMedida,
        fechaRequerida,
      },
      {
        idArticulo: art2.idArticulo,
        descripcion: art2.nombre,
        cantidadSolicitada: 200,
        idUnidadMedida: art2.idUnidadMedida,
        fechaRequerida,
      },
    ],
  });
  const solicitud = expectStatus("Solicitante crea Solicitud (2 lineas reales)", solCrear, 201);
  const idSolicitud = solicitud?.header?.idSolicitud;
  const detalle1 = solicitud?.details?.[0];
  const detalle2 = solicitud?.details?.[1];
  check("Solicitud nace en PENDIENTE_JEFE", solicitud?.header?.estado === "PENDIENTE_JEFE", solicitud?.header?.estado);

  // Bloqueo optimista: editar con version incorrecta debe rechazarse.
  const editVersionMala = await api("PUT", `/api/com/solicitudes/${idSolicitud}`, T.solicitante, {
    justificacion: "Edicion con version vieja (debe fallar)",
    version: (solicitud.header.version ?? 1) + 999,
  });
  expectStatus("rechaza edicion con version optimista incorrecta", editVersionMala, 409);

  const editVersionBuena = await api("PUT", `/api/com/solicitudes/${idSolicitud}`, T.solicitante, {
    justificacion: "Reposicion de materiales para mantenimiento preventivo de planta - urgente (E2E)",
    version: solicitud.header.version,
  });
  const editado = expectStatus("edita Solicitud con version correcta", editVersionBuena, 200);
  check("justificacion actualizada", /urgente/.test(editado?.header?.justificacion ?? ""));

  // Rol equivocado: el propio solicitante no puede aprobar su solicitud.
  const autoAprobar = await api("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, T.solicitante, {
    idEmpleado: EMP.solicitante,
  });
  expectStatus("Solicitante NO puede aprobar su propia solicitud (403)", autoAprobar, 403);

  const aprobJefe = await api("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, T.jefe, {
    idEmpleado: EMP.jefe,
    comentario: "Aprobado, prioridad justificada por mantenimiento (E2E)",
  });
  const s1 = expectStatus("Jefe aprueba -> PENDIENTE_GERENTE", aprobJefe, 200);
  check("estado PENDIENTE_GERENTE", s1?.estado === "PENDIENTE_GERENTE", s1?.estado);

  const jefeDobleAprobacion = await api("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, T.jefe, {
    idEmpleado: EMP.jefe,
  });
  expectStatus("Jefe NO puede volver a aprobar lo que ya no es su nivel", jefeDobleAprobacion, [403, 409]);

  const aprobGerente = await api("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, T.gerente, {
    idEmpleado: EMP.gerente,
    comentario: "Aprobado a nivel gerencia (E2E)",
  });
  const s2 = expectStatus("Gerente aprueba -> EN_COTIZACION", aprobGerente, 200);
  check("estado EN_COTIZACION", s2?.estado === "EN_COTIZACION", s2?.estado);

  const editarYaAprobada = await api("PUT", `/api/com/solicitudes/${idSolicitud}`, T.solicitante, {
    justificacion: "Intento de editar solicitud ya aprobada (debe fallar)",
    version: editado.header.version,
  });
  expectStatus("ya no se puede editar la Solicitud tras aprobarse", editarYaAprobada, 409);

  // --- RFQ ---
  const rfqPocos = await api("POST", "/api/com/rfq", T.comprador, {
    idSolicitud,
    fechaLimite: fechaRequerida,
    proveedores: proveedoresBase.slice(0, 2),
  });
  expectStatus("rechaza RFQ con menos de 3 proveedores", rfqPocos, [400, 422]);

  const rfqRolEquivocado = await api("POST", "/api/com/rfq", T.bodega, {
    idSolicitud,
    fechaLimite: fechaRequerida,
    proveedores: proveedoresBase,
  });
  expectStatus("Bodega NO puede crear RFQ (403)", rfqRolEquivocado, 403);

  const rfqCrear = await api("POST", "/api/com/rfq", T.comprador, {
    idSolicitud,
    fechaLimite: fechaRequerida,
    proveedores: proveedoresBase,
  });
  const rfq = expectStatus("Comprador abre RFQ a 3 proveedores reales", rfqCrear, 201);
  const idRfq = rfq?.header?.idRfq;

  // --- Cotizaciones: 3 ofertas reales con precios distintos (competencia real) ---
  const preciosPorProveedor = [
    { idProveedor: proveedoresBase[0], p1: 28.9, p2: 3.75 },
    { idProveedor: proveedoresBase[1], p1: 26.4, p2: 3.5 }, // la mas barata en ambas lineas
    { idProveedor: proveedoresBase[2], p1: 27.75, p2: 3.6 },
  ];
  const cotizacionesCreadas = [];
  for (const [i, oferta] of preciosPorProveedor.entries()) {
    const cot = await api("POST", "/api/com/cotizaciones", T.comprador, {
      idRfq,
      idProveedor: oferta.idProveedor,
      idCondicionPago,
      idMoneda,
      tasaCambio: 1,
      fechaVencimiento: inTwoWeeks.toISOString(),
      lineas: [
        {
          idSolicitudDetalle: detalle1.idSolicitudDetalle,
          precioUnitario: oferta.p1,
          cantidad: 50,
          idUnidadMedida: art1.idUnidadMedida,
          porcentajeImpuesto: 12,
        },
        {
          idSolicitudDetalle: detalle2.idSolicitudDetalle,
          precioUnitario: oferta.p2,
          cantidad: 200,
          idUnidadMedida: art2.idUnidadMedida,
          porcentajeImpuesto: 12,
        },
      ],
    });
    const c = expectStatus(`Comprador registra cotizacion #${i + 1} (proveedor ${oferta.idProveedor})`, cot, 201);
    if (c) cotizacionesCreadas.push(c);
  }

  // Comprador NO adjudica (solo Financiero).
  const primeraLinea = cotizacionesCreadas[0]?.details?.[0];
  if (primeraLinea) {
    const adjComoComprador = await api(
      "POST",
      `/api/com/cotizaciones/detalle/${primeraLinea.idCotizacionDetalle}/adjudicar`,
      T.comprador,
    );
    expectStatus("Comprador NO puede adjudicar (403)", adjComoComprador, 403);
  }

  // Financiero adjudica la oferta mas barata de CADA linea (proveedor #2 en ambas).
  const masBarata = cotizacionesCreadas[1]; // proveedor con p1=26.4 y p2=3.5
  const lineaAdjudicada1 = masBarata.details.find((d) => d.idSolicitudDetalle === detalle1.idSolicitudDetalle);
  const lineaAdjudicada2 = masBarata.details.find((d) => d.idSolicitudDetalle === detalle2.idSolicitudDetalle);

  const adj1 = await api("POST", `/api/com/cotizaciones/detalle/${lineaAdjudicada1.idCotizacionDetalle}/adjudicar`, T.financiero);
  const adjr1 = expectStatus("Financiero adjudica linea 1 (oferta mas barata)", adj1, 200);
  check("linea 1 queda adjudicada=true", adjr1?.adjudicado === true);

  const adj2 = await api("POST", `/api/com/cotizaciones/detalle/${lineaAdjudicada2.idCotizacionDetalle}/adjudicar`, T.financiero);
  const adjr2 = expectStatus("Financiero adjudica linea 2 (oferta mas barata)", adj2, 200);
  check("linea 2 queda adjudicada=true", adjr2?.adjudicado === true);

  // Verifica des-adjudicacion automatica de competidoras.
  const otraCotizLinea1 = cotizacionesCreadas[0].details.find((d) => d.idSolicitudDetalle === detalle1.idSolicitudDetalle);
  const verifCompetidora = await api("GET", `/api/com/cotizaciones/${cotizacionesCreadas[0].header.idCotizacion}`, T.comprador);
  const lineaCompetidora = verifCompetidora.json?.data?.details?.find(
    (d) => d.idCotizacionDetalle === otraCotizLinea1.idCotizacionDetalle,
  );
  check(
    "la competidora de la linea 1 quedo des-adjudicada",
    lineaCompetidora?.adjudicado === false || lineaCompetidora?.adjudicado === "N",
    JSON.stringify(lineaCompetidora?.adjudicado),
  );

  // Ya con linea adjudicada, la cotizacion ganadora no se puede editar/eliminar.
  const editarGanadora = await api("PUT", `/api/com/cotizaciones/${masBarata.header.idCotizacion}`, T.comprador, {
    tasaCambio: 1.05,
  });
  expectStatus("no se puede editar una cotizacion con linea adjudicada", editarGanadora, 409);

  // No se puede eliminar el RFQ porque ya tiene cotizaciones.
  const eliminarRfqConCotizaciones = await api("DELETE", `/api/com/rfq/${idRfq}`, T.comprador);
  expectStatus("no se puede eliminar un RFQ con cotizaciones registradas", eliminarRfqConCotizaciones, 409);

  // --- Orden de Compra ---
  const ocCrear = await api("POST", "/api/com/ordenes-compra", T.comprador, {
    idProveedor: masBarata.header.idProveedor,
    idEmpleadoGerenteFinanciero: EMP.financiero,
    idMoneda,
    tasaCambio: 1,
    fechaEntregaEsperada: inTwoWeeks.toISOString(),
    idSolicitud,
    numeroReferencia: `OC-E2E-${Date.now()}`,
    lineas: [
      {
        idArticulo: art1.idArticulo,
        descripcion: art1.nombre,
        cantidad: 50,
        idUnidadMedida: art1.idUnidadMedida,
        idCotizacionDetalle: lineaAdjudicada1.idCotizacionDetalle,
      },
      {
        idArticulo: art2.idArticulo,
        descripcion: art2.nombre,
        cantidad: 200,
        idUnidadMedida: art2.idUnidadMedida,
        idCotizacionDetalle: lineaAdjudicada2.idCotizacionDetalle,
      },
    ],
  });
  const oc = expectStatus("Comprador emite Orden de Compra desde la adjudicacion", ocCrear, 201);
  const idOrdenCompra = oc?.header?.idOrdenCompra;
  const ocDetalle1 = oc?.details?.find((d) => d.idArticulo === art1.idArticulo);
  const ocDetalle2 = oc?.details?.find((d) => d.idArticulo === art2.idArticulo);
  check("precio de linea 1 = precio de la cotizacion adjudicada (Strategy)", Number(ocDetalle1?.precioUnitario) === 26.4, ocDetalle1?.precioUnitario);
  check("precio de linea 2 = precio de la cotizacion adjudicada (Strategy)", Number(ocDetalle2?.precioUnitario) === 3.5, ocDetalle2?.precioUnitario);

  const solTrasOc = await api("GET", `/api/com/solicitudes/${idSolicitud}`, T.comprador);
  check("Solicitud pasa a ORDEN_GENERADA", solTrasOc.json?.data?.header?.estado === "ORDEN_GENERADA", solTrasOc.json?.data?.header?.estado);

  // Avance realista de estado de la OC.
  const ocEnviada = await api("POST", `/api/com/ordenes-compra/${idOrdenCompra}/estado`, T.comprador, { estado: "ENVIADA" });
  expectStatus("OC: EMITIDA -> ENVIADA", ocEnviada, 200);
  const ocTransito = await api("POST", `/api/com/ordenes-compra/${idOrdenCompra}/estado`, T.comprador, { estado: "EN_TRANSITO" });
  expectStatus("OC: ENVIADA -> EN_TRANSITO", ocTransito, 200);
  const ocRetroceso = await api("POST", `/api/com/ordenes-compra/${idOrdenCompra}/estado`, T.comprador, { estado: "EMITIDA" });
  expectStatus("OC no admite retroceder a EMITIDA (409)", ocRetroceso, 409);

  // --- Recepcion: PARCIAL primero (linea 1 completa, linea 2 parcial) ---
  const bodegas = await api("GET", "/api/com/ref/bodegas?pageSize=5", T.bodega);
  const idBodega = bodegas.json?.data?.[0]?.idBodega;

  const recParcial = await api("POST", "/api/com/recepciones", T.bodega, {
    idOrdenCompra,
    idBodega,
    idEmpleadoRecibe: EMP.bodega,
    lineas: [
      { idOcDetalle: ocDetalle1.idOcDetalle, cantidadRecibida: 50 },
      { idOcDetalle: ocDetalle2.idOcDetalle, cantidadRecibida: 120 },
    ],
  });
  const recepcion1 = expectStatus("Bodega registra Recepcion parcial (120 de 200 en linea 2)", recParcial, 201);
  const idRecepcion1 = recepcion1?.header?.idRecepcion;

  const ocTrasParcial = await api("GET", `/api/com/ordenes-compra/${idOrdenCompra}`, T.comprador);
  check(
    "OC queda RECIBIDA_PARCIAL",
    ocTrasParcial.json?.data?.header?.estado === "RECIBIDA_PARCIAL",
    ocTrasParcial.json?.data?.header?.estado,
  );

  const sobreRecepcion = await api("POST", "/api/com/recepciones", T.bodega, {
    idOrdenCompra,
    idBodega,
    idEmpleadoRecibe: EMP.bodega,
    lineas: [{ idOcDetalle: ocDetalle2.idOcDetalle, cantidadRecibida: 999 }],
  });
  expectStatus("rechaza sobre-recepcion mas alla de lo pendiente", sobreRecepcion, 409);

  const recCompleta = await api("POST", "/api/com/recepciones", T.bodega, {
    idOrdenCompra,
    idBodega,
    idEmpleadoRecibe: EMP.bodega,
    lineas: [{ idOcDetalle: ocDetalle2.idOcDetalle, cantidadRecibida: 80 }],
  });
  const recepcion2 = expectStatus("Bodega completa la Recepcion (80 restantes de linea 2)", recCompleta, 201);
  const idRecepcion2 = recepcion2?.header?.idRecepcion;
  const idRecDetalle2 = recepcion2?.details?.[0]?.idRecepcionDetalle;

  const ocTrasCompleta = await api("GET", `/api/com/ordenes-compra/${idOrdenCompra}`, T.comprador);
  check(
    "OC queda RECIBIDA_COMPLETA",
    ocTrasCompleta.json?.data?.header?.estado === "RECIBIDA_COMPLETA",
    ocTrasCompleta.json?.data?.header?.estado,
  );

  // El Observer (CxP) debe haber alimentado la recepcion -> ALIMENTADO_CXP.
  const recepcionEstado = await api("GET", `/api/com/recepciones/${idRecepcion2}`, T.bodega);
  check(
    "Recepcion #2 quedo ALIMENTADO_CXP (Observer de CxP disparo)",
    recepcionEstado.json?.data?.header?.estado === "ALIMENTADO_CXP",
    recepcionEstado.json?.data?.header?.estado,
  );

  // --- Devolucion ---
  const devCrear = await api("POST", "/api/com/devoluciones", T.bodega, {
    idRecepcion: idRecepcion2,
    motivo: "Material con dano de empaque detectado al descargar (E2E)",
    idEmpleadoSolicita: EMP.bodega,
    lineas: [{ idRecepcionDetalle: idRecDetalle2, cantidadDevuelta: 10 }],
  });
  const devolucion = expectStatus("Bodega registra Devolucion parcial por dano", devCrear, 201);

  const devExceso = await api("POST", "/api/com/devoluciones", T.bodega, {
    idRecepcion: idRecepcion2,
    motivo: "Intento de devolver mas de lo recibido (debe fallar)",
    idEmpleadoSolicita: EMP.bodega,
    lineas: [{ idRecepcionDetalle: idRecDetalle2, cantidadDevuelta: 999 }],
  });
  expectStatus("rechaza devolver mas de lo recibido", devExceso, 409);

  const reversaConDevolucion = await api("POST", `/api/com/recepciones/${idRecepcion2}/reversar`, T.bodega);
  expectStatus("no se puede reversar una recepcion con devoluciones activas", reversaConDevolucion, [400, 409]);

  // --- RBAC en vivo, durante el flujo real (control cruzado) ---
  section("Control cruzado de RBAC durante el flujo real");
  const gerenteVeCotizaciones = await api("GET", "/api/com/cotizaciones", T.gerente);
  expectStatus("Gerente de area sigue sin ver Cotizaciones (403)", gerenteVeCotizaciones, 403);
  const auditorVeOc = await api("GET", "/api/com/ordenes-compra", T.auditor);
  expectStatus("Auditor sigue sin ver Ordenes de compra (403)", auditorVeOc, 403);
  const solicitanteVeRecepciones = await api("GET", "/api/com/recepciones", T.solicitante);
  expectStatus("Solicitante sigue sin ver Recepciones (403)", solicitanteVeRecepciones, 403);

  // ==========================================================================
  section("RESUMEN");
  const fallidos = results.filter((r) => !r.pass);
  console.log(`\nTotal checks: ${results.length}  |  OK: ${results.length - fallidos.length}  |  FALLOS: ${fallidos.length}`);
  if (fallidos.length > 0) {
    console.log("\nDetalle de fallos:");
    for (const f of fallidos) console.log(` - ${f.label}: ${f.detail}`);
  }
  console.log(`\nIDs generados para trazabilidad real: idSolicitud=${idSolicitud} idRfq=${idRfq} idOrdenCompra=${idOrdenCompra} idRecepcion1=${idRecepcion1} idRecepcion2=${idRecepcion2} idDevolucion=${devolucion?.header?.idDevolucion}`);

  process.exitCode = fallidos.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("ERROR FATAL EN EL SCRIPT:", err);
  process.exitCode = 1;
});
