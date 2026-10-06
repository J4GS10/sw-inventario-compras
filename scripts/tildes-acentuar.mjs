// Nucleo del barrido: acentuar(texto) con el diccionario y las reglas contextuales.
import { DICCIONARIO } from "./tildes-diccionario.mjs";
import { CONTEXTUALES } from "./tildes-contextuales.mjs";

const letra = "A-Za-zÁÉÍÓÚáéíóúñÑüÜ0-9_$";
const lista = Object.keys(DICCIONARIO).sort((a, b) => b.length - a.length).join("|");
// No reemplaza si esta pegada a letras/digitos/_/$ , ni si forma parte de ruta/campo (precedida o seguida de . - / : (  ).
const re = new RegExp(`(?<![${letra}.\\-{])(${lista})(?![${letra}\\-(}])`, "gi");

export function acentuar(texto) {
  let t = texto.replace(re, (m) => {
    if (m.length > 1 && m === m.toUpperCase()) return m; // SIGLAS/constantes en mayuscula: no tocar
    const nuevo = DICCIONARIO[m.toLowerCase()];
    return m[0] === m[0].toUpperCase() ? nuevo[0].toUpperCase() + nuevo.slice(1) : nuevo;
  });
  for (const [r, f] of CONTEXTUALES) t = t.replace(r, f);
  return t;
}

