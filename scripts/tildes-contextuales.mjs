// Reglas CONTEXTUALES para palabras ambiguas (esta/está, se registro/registró, ¿que/¿qué...): solo en construcciones inequívocas.
const PART = "[a-záéíóúñ]+(?:ad|id)[oa]s?";
const SIGUE_ESTA = "(?= (?:" + PART + "|en|ya|bien|mal|fuera|dentro|sin|por|vac[ií][oa]|disponible|vigente|activ[oa]|inactiv[oa])\\b)";

const PASADO = {
  registro: "registró", uso: "usó", envio: "envió", creo: "creó", genero: "generó", modifico: "modificó", elimino: "eliminó",
  cancelo: "canceló", aprobo: "aprobó", rechazo: "rechazó", adjudico: "adjudicó", cerro: "cerró", emitio: "emitió",
  recibio: "recibió", anulo: "anuló", reporto: "reportó", actualizo: "actualizó", desactivo: "desactivó", despacho: "despachó",
  devolvio: "devolvió", completo: "completó", vencio: "venció", libero: "liberó", resolvio: "resolvió",
};
const INTERROG = {
  que: "qué", quien: "quién", quienes: "quiénes", cual: "cuál", cuales: "cuáles", cuanto: "cuánto", cuantos: "cuántos",
  cuantas: "cuántas", donde: "dónde", como: "cómo", cuando: "cuándo",
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const CONTEXTUALES = [
  [new RegExp("\\b(esta)" + SIGUE_ESTA, "g"), () => "está"],
  [new RegExp("\\b(Esta)" + SIGUE_ESTA, "g"), () => "Está"],
  [new RegExp("\\bse (" + Object.keys(PASADO).join("|") + ")\\b", "g"), (m, v) => "se " + PASADO[v]],
  // "esta" verbal: antes de una interpolacion (fin de fragmento), tras "mientras/ya no", con gerundio o con un estado en MAYUSCULAS
  [/\b(mientras|Mientras|ya no|ya|aún|aun) esta\b(?! (?:cotización|solicitud|orden|recepción|factura|línea|fecha|oferta|cantidad|acción|pantalla))/g, (m, p) => p + " está"],
  [/\besta(?=\s*$)/g, () => "está"],
  [/\besta(?= \w+(?:ando|iendo|yendo)\b)/g, () => "está"],
  [/\besta(?= (?:ABIERT|EMITID|PENDIENTE|RECIBID|CERRAD|CANCELAD|ENVIAD|ADJUDICAD|ALIMENTAD|ELIMINAD|ANULAD|LIQUIDAD|PAGAD|VENCID)[A-Z_]*)/g, () => "está"],
  [/\bsuministro(?= algo)/g, () => "suministró"],
  [/\b(para|Para) que (?=sirve|sirven|se usa|se utiliza|se calcula|se hace)/g, (m, p) => p + " qué "],
  [/\balimento (?=el kardex|la cuenta|CxP|el inventario)/g, () => "alimentó "],
  [new RegExp("¿(" + Object.keys(INTERROG).join("|") + ")\\b", "g"), (m, w) => "¿" + INTERROG[w]],
  [new RegExp("¿(" + Object.keys(INTERROG).map(cap).join("|") + ")\\b", "g"), (m, w) => "¿" + cap(INTERROG[w.toLowerCase()])],
  [/\b(Por|por) que(?=[^?]*\?)/g, (m, p) => p + " qué"],
  [/\ba quien (?=preguntar|acudir|llamar|avisar|escribir|consultar)/g, () => "a quién "],
  [/\b(Hasta|hasta|Desde|desde) cuando\b/g, (m, p) => p + " cuándo"],
  [/\b(Dashboard — |Cada tarjeta — )?(como) (leerlo|usarlo|funciona|se calcula|se lee|se usa)\b/g, (m, a, c, r) => (a ?? "") + "cómo " + r],
];
