// QA de API sobre el SERVIDOR OFICIAL (producción, :8443 -> proxy -> :3000, Oracle local + MinIO).
// Cubre lo agregado en esta etapa: modo de producción, borradores, solo-validar, delegación,
// adjudicación sugerida, escasez, idempotencia (cola sin conexión), PDF y almacenamiento.
// Uso: node scripts/qa-oficial-api.mjs
const BASE = process.env["QA_API_URL"] ?? "http://localhost:8443";
const PASS = process.env["QA_PASS"] ?? "compras.demo";
const res = [];
const check = (w, ok, d = "") => { res.push(ok); console.log(`${ok ? "OK  " : "FAIL"} ${w}${d ? " — " + d : ""}`); };
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const tokens = {};
async function api(who, method, path, body, headers = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(who ? { authorization: `Bearer ${tokens[who].token}` } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const raw = r.status === 204 ? "" : await r.arrayBuffer().then((b) => Buffer.from(b));
  let json = null;
  if (raw.length && (r.headers.get("content-type") ?? "").includes("json")) json = JSON.parse(raw.toString("utf8"));
  return { status: r.status, json, raw, headers: r.headers };
}
async function login(u) {
  const r = await api(null, "POST", "/api/auth/login", { username: u, password: PASS });
  if (r.status !== 200) throw new Error(`login ${u}: ${r.status}`);
  tokens[u] = { token: r.json.data.token, sesion: r.json.data.sesion };
}

// 1) Es el servidor de PRODUCCION
{
  const demo = await api(null, "GET", "/api/auth/usuarios-demo");
  check("producción: no se listan perfiles de demostración", demo.status === 404);
  const dev = await api(null, "GET", "/api/com/solicitudes", undefined, { "x-dev-user": "0" });
  check("producción: el atajo X-Dev-User no autentica", dev.status === 401);
  const sal = await api(null, "GET", "/api/salud");
  check("salud: base de datos y almacenamiento arriba", sal.json?.data?.db === "up" && sal.json?.data?.storage === "up", JSON.stringify(sal.json?.data));
}
for (const u of ["admin", "solicitante", "jefe", "gerente", "comprador"]) await login(u);
const emp = (u) => tokens[u].sesion.idEmpleado;

// 2) Borradores (continuidad entre equipos)
{
  const clave = `erp.borrador.${tokens["solicitante"].sesion.idUsuario}.qa-oficial-${Date.now()}`;
  const p1 = await api("solicitante", "PUT", "/api/borradores", { clave, contenido: JSON.stringify({ v: "nuevo", en: Date.now() }), actualizadoEn: Date.now() });
  check("borrador: se guarda", p1.status === 200);
  await api("solicitante", "PUT", "/api/borradores", { clave, contenido: JSON.stringify({ v: "viejo", en: 1 }), actualizadoEn: Date.now() - 600000 });
  const lista = await api("solicitante", "GET", "/api/borradores");
  const mio = lista.json.data.find((b) => b.clave === clave);
  check("borrador: una edición vieja no pisa la nueva", mio && JSON.parse(mio.contenido).v === "nuevo");
  const ajeno = await api("jefe", "GET", "/api/borradores");
  check("borrador: otro usuario no lo ve", !ajeno.json.data.some((b) => b.clave === clave));
  check("borrador: se descarta", (await api("solicitante", "DELETE", `/api/borradores?clave=${encodeURIComponent(clave)}`)).status === 204);
}

// 3) Solo validar: valida todo y NO crea nada
const sol = (fecha) => ({
  cabecera: { idEmpleadoSolicitante: emp("solicitante"), idSucursal: tokens["solicitante"].sesion.idSucursal ?? 1, idGrupoCompra: 1, idTerminoEntrega: 1, justificacion: "QA oficial: validar sin registrar", prioridad: 3 },
  detalles: [{ descripcion: "Artículo QA", cantidadSolicitada: 2, idUnidadMedida: 1, fechaRequerida: fecha }],
});
{
  // ids de catalogos reales
  const cat = async (p) => (await api("admin", "GET", `${p}?pageSize=1`)).json.data[0];
  const suc = await cat("/api/com/ref/sucursales");
  const grp = await cat("/api/com/grupos-compra");
  const ter = await cat("/api/com/terminos-entrega");
  const uni = await cat("/api/com/ref/unidades-medida");
  const armar = (f) => {
    const b = sol(f);
    b.cabecera.idSucursal = suc.idSucursal; b.cabecera.idGrupoCompra = grp.idGrupoCompra; b.cabecera.idTerminoEntrega = ter.idTerminoEntrega;
    b.detalles[0].idUnidadMedida = uni.idUnidadMedida;
    return b;
  };
  const total = async () => (await api("admin", "GET", "/api/com/solicitudes?pageSize=1")).json.meta.total;
  const antes = await total();
  const ok = await api("solicitante", "POST", "/api/com/solicitudes", armar(dia(10)), { "x-solo-validar": "1" });
  check("solo-validar: documento válido responde 200 { valido }", ok.status === 200 && ok.json?.data?.valido === true);
  check("solo-validar: no creó ninguna solicitud", (await total()) === antes);
  const mal = await api("solicitante", "POST", "/api/com/solicitudes", armar(dia(-4)), { "x-solo-validar": "1" });
  check("solo-validar: fecha pasada devuelve 422 con motivo", mal.status === 422 && /fecha/i.test(mal.json?.error?.message ?? ""));

  // 4) Idempotencia (cola sin conexión): la misma clave dos veces = un solo documento
  const key = `qa-oficial-${Date.now()}-abcdef`;
  const a = await api("solicitante", "POST", "/api/com/solicitudes", armar(dia(12)), { "idempotency-key": key });
  const b = await api("solicitante", "POST", "/api/com/solicitudes", armar(dia(12)), { "idempotency-key": key });
  const idA = a.json?.data?.header?.idSolicitud;
  check("idempotencia: el reintento devuelve el mismo documento", a.status === 201 && b.status === 201 && idA === b.json?.data?.header?.idSolicitud && b.headers.get("idempotent-replay") === "true", `SOL-${idA}`);
  check("idempotencia: solo se creó una solicitud", (await total()) === antes + 1);

  // 5) Delegación de aprobaciones
  const delegado = emp("comprador");
  const nueva = await api("solicitante", "POST", "/api/com/solicitudes", armar(dia(15)));
  const idSol = nueva.json.data.header.idSolicitud;
  const sinDel = await api("comprador", "POST", `/api/com/solicitudes/${idSol}/aprobar`, { idEmpleado: delegado });
  check("delegación: sin delegación el comprador no aprueba (403)", sinDel.status === 403);
  const noJefe = await api("solicitante", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: delegado, desde: dia(0), hasta: dia(2) });
  check("delegación: quien no aprueba no puede delegar (403)", noJefe.status === 403);
  const del = await api("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: delegado, desde: dia(0), hasta: dia(2), motivo: "QA oficial" });
  check("delegación: el jefe delega", del.status === 201);
  const me = await api("comprador", "GET", "/api/auth/me");
  check("delegación: la sesión del delegado lo refleja", me.json.data.permisos.includes("COMPRAS_SOLICITUD_APROBAR_JEFE") && me.json.data.delegadoDe?.length > 0);
  const apr = await api("comprador", "POST", `/api/com/solicitudes/${idSol}/aprobar`, { idEmpleado: delegado, comentario: "ok QA" });
  check("delegación: el delegado aprueba (200)", apr.status === 200, apr.json?.error?.message ?? "");
  const supl = await api("comprador", "POST", `/api/com/solicitudes/${idSol}/aprobar`, { idEmpleado: emp("jefe") });
  check("delegación: no puede decidir a nombre del delegante (403)", supl.status === 403);
  const rev = await api("jefe", "DELETE", `/api/com/delegaciones/${del.json.data.idDelegacion}`);
  check("delegación: el jefe revoca", rev.status === 204);
  const otra = (await api("solicitante", "POST", "/api/com/solicitudes", armar(dia(16)))).json.data.header.idSolicitud;
  const trasRev = await api("comprador", "POST", `/api/com/solicitudes/${otra}/aprobar`, { idEmpleado: delegado });
  check("delegación: tras revocar se corta al instante (403)", trasRev.status === 403);
}

// 6) Escasez: vincular alertas
{
  const v0 = await api("solicitante", "POST", "/api/com/ref/articulos/bajo-minimo/vincular", { idSolicitud: 1, idAlertas: [] });
  check("escasez: vincular sin alertas se rechaza (422)", v0.status === 422);
  const v1 = await api("solicitante", "POST", "/api/com/ref/articulos/bajo-minimo/vincular", { idSolicitud: 1, idAlertas: [999999999] });
  check("escasez: una alerta inexistente no vincula nada", v1.status === 200 && v1.json.data.vinculadas === 0);
  const l = await api("solicitante", "GET", "/api/com/ref/articulos/bajo-minimo");
  check("escasez: el listado de alertas responde", l.status === 200);
}

// 7) Adjudicación sugerida sobre solicitudes reales con cotizaciones
{
  const sols = (await api("admin", "GET", "/api/com/solicitudes?pageSize=60&sort=idSolicitud&order=desc")).json.data;
  let probadas = 0, conSugerencia = 0, reglaOk = true;
  for (const s of sols) {
    const c = await api("admin", "GET", `/api/com/comparativo/solicitud/${s.idSolicitud}/sugerencia`);
    if (c.status !== 200) continue;
    probadas++;
    for (const r of c.json.data.renglones) {
      if (r.sugerida === null) continue;
      conSugerencia++;
      const min = Math.min(...r.ofertas.map((o) => o.precioNetoMoneda));
      if (r.sugerida.precioNetoMoneda > min * 1.1500001 && r.ofertas.some((o) => o.elegible)) reglaOk = false;
    }
    if (conSugerencia >= 5) break;
  }
  check("adjudicación sugerida: el endpoint responde en solicitudes reales", probadas > 0, `${probadas} solicitudes, ${conSugerencia} renglones`);
  check("adjudicación sugerida: nunca sugiere una oferta >15 % sobre la más barata", reglaOk);
  const noAdj = await api(null, "GET", `/api/com/comparativo/solicitud/${sols[0].idSolicitud}/sugerencia`);
  check("adjudicación sugerida: exige sesión (401)", noAdj.status === 401);
}

// 8) Recepción: el renglón trae el código del artículo (lector de barras)
{
  const ocs = (await api("admin", "GET", "/api/com/ordenes-compra?pageSize=40&sort=idOrdenCompra&order=desc")).json.data;
  let visto = false;
  for (const oc of ocs) {
    const l = await api("admin", "GET", `/api/com/ref/oc/${oc.idOrdenCompra}/lineas-pendientes`);
    if (l.status === 200 && l.json.data.length > 0) { visto = l.json.data.every((x) => "codigo" in x); break; }
  }
  check("recepción: los renglones pendientes traen `codigo`", visto);

  // 9) PDF formal + almacenamiento en MinIO
  const oc = ocs[0];
  const pdf = await api("admin", "GET", `/api/com/ordenes-compra/${oc.idOrdenCompra}/pdf`);
  check("PDF de la orden de compra se genera", pdf.status === 200 && pdf.raw.subarray(0, 5).toString() === "%PDF-", `OC-${oc.idOrdenCompra}, ${pdf.raw.length} bytes`);
  const sols = (await api("admin", "GET", "/api/com/solicitudes?pageSize=1&sort=idSolicitud&order=desc")).json.data;
  const guardado = await api("admin", "POST", `/api/com/comparativo/solicitud/${sols[0].idSolicitud}/pdf`);
  check("PDF del comparativo se almacena en MinIO", guardado.status === 201 && guardado.json?.data?.storage === "s3", guardado.json?.data?.storage ?? String(guardado.status));
}

const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} comprobaciones OK`);
process.exit(fallos === 0 ? 0 : 1);
