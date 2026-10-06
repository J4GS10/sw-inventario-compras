// Biblioteca del barrido ortografico: localiza SOLO texto visible para el usuario dentro de codigo TS/TSX
// (cadenas, partes estaticas de plantillas y texto JSX) sin tocar identificadores, rutas, SQL ni valores de datos.

const SQL = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ORDER BY|GROUP BY|VALUES|MERGE|BEGIN|COMMIT|ROWNUM|FETCH|OFFSET|CONNECT BY|NVL|TRUNC|SYSDATE)\b/;
// Contexto previo que indica que la cadena es un DATO (comparacion, clave, valor), no texto de pantalla.
const CTX_DATO = /(===|!==|==|!=|\bcase|\.includes\(|\.startsWith\(|\.endsWith\(|\.indexOf\(|\.has\(|\.get\(|\.set\(|\.on\(|\.emit\(|\bvalue:|\bkey:|\bname:|\bid:|\bleafId:|\btipo:|\bestado:|\bkind:|\btype:|\bcode:|\bcodigo:|\bcolumn:|\bfield:|\brefKind:|\bpath:|\bsort:|\border:|\bmatch\(|\bimport|\bfrom|\brequire\(|\bgetAttribute\(|\bquerySelector(All)?\(|\bsetItem\(|\bgetItem\(|\bkeyof|\bas)\s*[\[(]?\s*$/;

/** Una cadena es "texto de usuario" si parece una frase/rotulo y no una ruta, clave, clase CSS, SQL o constante. */
export function esTextoUsuario(s) {
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3}/.test(t)) return false;
  if (SQL.test(t)) return false;
  if (/^(\/|https?:|\.|#|@|data:|\$\{)/.test(t)) return false;
  if (/[=<>{}\[\];\\|]/.test(t) && !/^[¿¡]?[A-ZÁÉÍÓÚ]/.test(t)) return false;
  if (/(^|\s)[a-z]+-[a-z0-9-]+(\s|$)/.test(t) && !/^[A-ZÁÉÍÓÚ¿¡]/.test(t)) return false; // clases css
  if (/:[a-z]\w*/.test(t) && !/\s/.test(t)) return false; // bind :nombre
  if (/\.(js|ts|tsx|css|json|png|svg|pdf|csv|xlsx)$/.test(t)) return false;
  if (/^[A-Z_0-9]+$/.test(t)) return false; // CONSTANTE
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false; // camelCase / clave
  if (/^[a-z0-9]+([-_.:][a-z0-9]+)+$/i.test(t) && !/\s/.test(t)) return false; // a-b, a_b, a.b
  if (!/\s/.test(t)) return /^[¿¡]?[A-ZÁÉÍÓÚ][a-záéíóúñ]+[.:!?]?$/.test(t); // una sola palabra: solo rotulos Capitalizados
  // frase: no debe empezar en minuscula "tecnica" (camelCase seguido de espacio: "idArticulo desc")
  if (/^[a-z]+[A-Z]\w*\s/.test(t)) return false;
  if (/^[a-z_]+\s+(asc|desc)\b/i.test(t)) return false;
  return true;
}

const REGEX_PREV = "(,=:[!&|?{;";

/**
 * Recorre el codigo y devuelve regiones de texto: { ini, fin, tipo: "str" | "tpl", frags? }.
 * "str": contenido de "..." o '...'. "tpl": plantilla con sus fragmentos estaticos { ini, fin }.
 */
export function regiones(src) {
  const out = [];
  const n = src.length;

  function scanCode(i, enExpr) {
    let depth = 0;
    let prev = "";
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === "/" && d === "/") {
        while (i < n && src[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && d === "*") {
        const e = src.indexOf("*/", i + 2);
        i = e < 0 ? n : e + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== "\n") {
          if (src[j] === "\\") j++;
          j++;
        }
        if (src[j] === c) out.push({ ini: i + 1, fin: j, tipo: "str" });
        i = Math.min(j + 1, n);
        prev = c;
        continue;
      }
      if (c === "`") {
        i = scanTemplate(i + 1);
        prev = "`";
        continue;
      }
      if (c === "/" && (prev === "" || REGEX_PREV.includes(prev))) {
        let j = i + 1;
        let enClase = false;
        while (j < n && src[j] !== "\n") {
          if (src[j] === "\\") j++;
          else if (src[j] === "[") enClase = true;
          else if (src[j] === "]") enClase = false;
          else if (src[j] === "/" && !enClase) break;
          j++;
        }
        i = Math.min(j + 1, n);
        prev = "/";
        continue;
      }
      if (c === "{") depth++;
      if (c === "}") {
        if (enExpr && depth === 0) return i;
        depth--;
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
    return i;
  }

  function scanTemplate(i) {
    const frags = [];
    let ini = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        frags.push({ ini, fin: i });
        out.push({ ini: ini, fin: i, tipo: "tpl", frags });
        return i + 1;
      }
      if (c === "$" && src[i + 1] === "{") {
        frags.push({ ini, fin: i });
        i = scanCode(i + 2, true) + 1;
        ini = i;
        continue;
      }
      i++;
    }
    return i;
  }

  scanCode(0, false);
  return out;
}

function lineaDe(src, pos) {
  const ini = src.lastIndexOf("\n", pos - 1) + 1;
  return { ini, antes: src.slice(ini, pos) };
}

const PLANTILLA_ESTRUCTURAL = /[\/=<>{}\[\]]|\bclass=|var\(--|\.\.\/|\bimport\(/;

/** Aplica fn(texto) a cada texto visible y devuelve el codigo nuevo. Si recolector != null, solo recolecta. */
export function mapearTextos(src, file, fn, recolector) {
  const reemplazos = []; // { ini, fin, nuevo }
  const procesar = (ini, fin) => {
    const orig = src.slice(ini, fin);
    if (recolector) recolector(orig);
    else {
      const nuevo = fn(orig);
      if (nuevo !== orig) reemplazos.push({ ini, fin, nuevo });
    }
  };

  for (const r of regiones(src)) {
    if (r.tipo === "str") {
      const txt = src.slice(r.ini, r.fin);
      const { antes } = lineaDe(src, r.ini - 1);
      if (CTX_DATO.test(antes)) continue;
      if (!esTextoUsuario(txt)) continue;
      procesar(r.ini, r.fin);
    } else {
      const { antes } = lineaDe(src, r.ini - 1);
      if (CTX_DATO.test(antes)) continue;
      const estaticos = r.frags.map((f) => src.slice(f.ini, f.fin)).join("§");
      if (PLANTILLA_ESTRUCTURAL.test(estaticos) || SQL.test(estaticos)) continue;
      if (/(^|\s)[a-z]+-[a-z0-9-]+(\s|$)/.test(estaticos)) continue;
      if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3}/.test(estaticos)) continue;
      for (const f of r.frags) if (/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3}/.test(src.slice(f.ini, f.fin))) procesar(f.ini, f.fin);
    }
  }

  // Texto JSX (entre etiquetas) en la misma linea, y lineas de parrafo JSX.
  const lineas = [];
  let pos = 0;
  for (const ln of src.split("\n")) {
    lineas.push({ ini: pos, texto: ln });
    pos += ln.length + 1;
  }
  const esTsx = file.endsWith(".tsx");
  if (esTsx) {
    for (const { ini, texto } of lineas) {
      const t = texto.trim();
      if (t === "" || /^(\/\/|\*|\/\*)/.test(t)) continue;
      const re = /(<[A-Za-z][^<>]*>)([^<>{}\n]+)(<\/)/g;
      let m;
      while ((m = re.exec(texto)) !== null) {
        if (/[A-Za-z]{3}/.test(m[2])) procesar(ini + m.index + m[1].length, ini + m.index + m[1].length + m[2].length);
      }
      if (/^(import|export|return|const|let|var|if|for|case|type|interface|else|function|await|throw)\b/.test(t)) continue;
      if (/^(while|switch|try|catch|class|enum|static|public|private|protected|readonly|async)\b/.test(t)) continue;
      if (/^[a-zA-Z_$][\w$]*\??:/.test(t)) continue; // clave de objeto / tipo
      // separar lo que esta DENTRO de {...} (expresiones JSX) de lo que es texto; si las llaves no cierran en la linea, se omite
      const trozos = [];
      let prof = 0;
      let ini0 = 0;
      for (let k = 0; k < texto.length; k++) {
        const ch = texto[k];
        if (ch === "{") {
          if (prof === 0 && k > ini0) trozos.push([ini0, k]);
          prof++;
        } else if (ch === "}") {
          prof--;
          if (prof === 0) ini0 = k + 1;
          if (prof < 0) break;
        }
      }
      if (prof !== 0) continue;
      if (ini0 < texto.length) trozos.push([ini0, texto.length]);
      const resto = trozos.map(([x, y]) => texto.slice(x, y)).join(" ").trim();
      if (resto === "" || !/[A-Za-z]{3}/.test(resto)) continue;
      if (/[=;<>$`|\\"&\[\]]|\w\(|=>/.test(resto.replace(/[¿¡→]/g, ""))) continue;
      if (/^[a-z_]+:/.test(resto)) continue;
      // una sola palabra en su propia linea: solo si es un rotulo Capitalizado (texto JSX, p. ej. "Proximo")
      if (resto.split(/\s+/).length < 2 && !/^[¿¡]?[A-ZÁÉÍÓÚ][a-záéíóúñ]+[.:!?]?$/.test(resto)) continue;
      for (const [x, y] of trozos) if (/[A-Za-z]{3}/.test(texto.slice(x, y))) procesar(ini + x, ini + y);
    }
  }

  if (recolector) return src;
  // evitar solapes (un texto JSX dentro de una cadena ya procesada): ordenar y descartar los que se solapan
  reemplazos.sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const limpios = [];
  for (const r of reemplazos) {
    const ult = limpios[limpios.length - 1];
    if (ult !== undefined && r.ini < ult.fin) continue;
    limpios.push(r);
  }
  let out = src;
  for (let k = limpios.length - 1; k >= 0; k--) out = out.slice(0, limpios[k].ini) + limpios[k].nuevo + out.slice(limpios[k].fin);
  return out;
}

export function extraerTextos(src, file) {
  const acopio = [];
  mapearTextos(src, file, (t) => t, (t) => acopio.push(t));
  return acopio;
}
