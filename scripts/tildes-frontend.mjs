// Barrido ORTOGRAFICO del frontend: agrega tildes a los textos que ve el usuario (etiquetas, ayudas, mensajes).
// Solo toca CONTENIDO de cadenas/JSX (no identificadores, rutas ni claves). Idempotente.
//   node scripts/tildes-frontend.mjs [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/src");
const DRY = process.argv.includes("--dry");

const PALABRAS = {
  justificacion: "justificación", descripcion: "descripción", cotizacion: "cotización", recepcion: "recepción",
  devolucion: "devolución", condicion: "condición", condiciones: "condiciones", direccion: "dirección", telefono: "teléfono",
  razon: "razón", codigo: "código", articulo: "artículo", articulos: "artículos", categoria: "categoría", categorias: "categorías",
  dias: "días", ultima: "última", ultimo: "último", ultimos: "últimos", numero: "número", ordenes: "órdenes", termino: "término",
  terminos: "términos", area: "área", aprobacion: "aprobación", adjudicacion: "adjudicación", informacion: "información",
  ubicacion: "ubicación", facturacion: "facturación", liquidacion: "liquidación", proyeccion: "proyección", comparacion: "comparación",
  creacion: "creación", edicion: "edición", seleccion: "selección", opcion: "opción", opciones: "opciones", gestion: "gestión",
  modulo: "módulo", pagina: "página", sesion: "sesión", contrasena: "contraseña", tamano: "tamaño", accion: "acción",
  unico: "único", tambien: "también", telefonos: "teléfonos", historico: "histórico", analisis: "análisis", critica: "crítica",
  basico: "básico", automatico: "automático", electronico: "electrónico", economico: "económico", logistica: "logística",
  mercaderia: "mercadería", garantia: "garantía", politica: "política", poliza: "póliza", exito: "éxito", numeros: "números",
  fecha_limite: "fecha_limite", transito: "tránsito", despues: "después", ademas: "además", rapido: "rápido", facil: "fácil",
  asi: "así", mas: "más", aun: "aún", via: "vía", dia: "día", util: "útil", tipico: "típico", nomina: "nómina",
  inventarios: "inventarios", metodo: "método", valido: "válido", invalido: "inválido", usuario: "usuario",
};
// Palabras ambiguas (mas/aun/asi/si/solo...) se aplican SOLO en contextos seguros: ver SEGURAS.
const AMBIGUAS = new Set(["mas", "aun", "asi", "via", "util", "metodo", "valido", "invalido", "dia", "tipico", "critica", "basico", "unico"]);
const SEGURAS = [
  [/\bMas datos\b/g, "Más datos"], [/\bmas datos\b/g, "más datos"], [/\bmas de\b/g, "más de"], [/\bmas opciones\b/gi, (m) => (m[0] === "M" ? "Más opciones" : "más opciones")],
  [/\bAsi\b(?= que| como| el| la| se)/g, "Así"], [/\bun dia\b/g, "un día"], [/\b(cada|por|del|el|ese|este|otro) dia\b/g, (m) => m.replace("dia", "día")],
  [/\bSi\b(?= no|, )/g, "Sí"],
];

function conMayus(orig, nuevo) {
  if (orig === orig.toUpperCase() && orig.length > 1) return nuevo.toUpperCase();
  if (orig[0] === orig[0].toUpperCase()) return nuevo[0].toUpperCase() + nuevo.slice(1);
  return nuevo;
}

const reLetra = "A-Za-zÁÉÍÓÚáéíóúñÑ0-9_";
const reLista = Object.keys(PALABRAS).filter((w) => !AMBIGUAS.has(w) && PALABRAS[w] !== w).sort((a, b) => b.length - a.length).join("|");
const reTexto = new RegExp(`(?<![${reLetra}])(${reLista})(?![${reLetra}])`, "gi");

function acentuar(texto) {
  let t = texto.replace(reTexto, (m) => conMayus(m, PALABRAS[m.toLowerCase()]));
  for (const [re, rep] of SEGURAS) t = t.replace(re, rep);
  return t;
}

/** Una cadena es "texto de usuario" si tiene espacios o empieza en mayuscula, y no es ruta/clave/URL. */
function esTextoUsuario(s) {
  if (s.length < 3) return false;
  if (/^(\/|https?:|\.|#|@|data:|[a-z]+[-_.:][a-z-_.:]*$)/.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false; // camelCase / clave
  if (/^[A-Z_0-9]+$/.test(s) && !s.includes(" ")) return false; // CONSTANTE
  if (/\.(js|ts|tsx|css|json|png|svg)$/.test(s)) return false;
  return s.includes(" ") || /^[A-Z][a-z]/.test(s);
}

let archivos = 0;
let cambios = 0;
function procesar(file) {
  const src = fs.readFileSync(file, "utf8");
  let out = src;
  // 1) cadenas "..." (sin comillas escapadas) y '...' que sean texto de usuario
  out = out.replace(/"((?:[^"\\\n]|\\.)*)"/g, (m, c) => (esTextoUsuario(c) ? `"${acentuar(c)}"` : m));
  out = out.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, c) => (esTextoUsuario(c) && !/^[a-z-]+$/.test(c) ? `'${acentuar(c)}'` : m));
  // 2) partes estaticas de plantillas `...${x}...`
  out = out.replace(/`((?:[^`\\]|\\.)*)`/g, (m, c) => {
    if (/(?:\.\.\/|\/api\/|import\(|\bclass=|margin:|var\(--)/.test(c)) return m;
    return "`" + c.split(/(\$\{[^}]*\})/).map((p) => (p.startsWith("${") ? p : esTextoUsuario(p.trim()) || /[ ]/.test(p) ? acentuar(p) : p)).join("") + "`";
  });
  // 3) texto JSX: contenido entre una etiqueta de apertura y su cierre, en la misma linea
  out = out.replace(/(<[A-Za-z][^<>]*>)([^<>{}\n]+)(<\/)/g, (m, o, c, cl) => (/[A-Za-z]{3}/.test(c) ? o + acentuar(c) + cl : m));
  // 4) lineas de PARRAFO JSX (solo palabras y puntuacion): ayudas y textos largos en varias lineas (solo .tsx)
  if (file.endsWith(".tsx")) {
    out = out
      .split("\n")
      .map((ln) => {
        const t = ln.trim();
        if (t === "" || /^(\/\/|\*|\/\*|import|export|return|const|let|var|if|for|case|type|interface)/.test(t)) return ln;
        if (/[{}\[\]()=;<>$`|"'&:]/.test(t.replace(/[¿¡]/g, ""))) return ln;
        if (t.split(/\s+/).length < 2 || !/[A-Za-z]{3}/.test(t)) return ln;
        return ln.replace(t, acentuar(t));
      })
      .join("\n");
  }
  if (out !== src) {
    cambios++;
    if (!DRY) fs.writeFileSync(file, out, "utf8");
  }
  archivos++;
}

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && !/generated|vite-env/.test(e.name)) procesar(p);
  }
}
recorrer(raiz);
console.log(`${DRY ? "(simulacion) " : ""}${cambios} archivos modificados de ${archivos}`);
