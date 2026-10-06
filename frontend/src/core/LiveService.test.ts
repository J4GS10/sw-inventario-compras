import { describe, expect, it } from "vitest";
import { parseSse } from "./LiveService.js";

describe("parseSse", () => {
  it("separa mensajes por línea en blanco, parsea JSON y deja el resto incompleto", () => {
    const buf =
      'retry: 3000\n\nevent: ready\ndata: {"userId":1}\n\n: latido\n\nid: 7\nevent: decision\ndata: {"idSolicitud":12,"resultado":"RECHAZADA"}\n\nevent: bandeja\ndata: {"mo';
    const { mensajes, resto } = parseSse(buf);
    expect(mensajes.map((m) => m.event)).toEqual(["ready", "decision"]);
    expect(mensajes[1]!.data).toEqual({ idSolicitud: 12, resultado: "RECHAZADA" });
    expect(resto).toBe('event: bandeja\ndata: {"mo');
    // al llegar el resto del trozo, el mensaje se completa
    const sig = parseSse(resto + 'tivo":"orden"}\n\n');
    expect(sig.mensajes[0]).toEqual({ event: "bandeja", data: { motivo: "orden" } });
    expect(sig.resto).toBe("");
  });

  it("ignora comentarios/latidos y soporta CRLF y datos no JSON", () => {
    const { mensajes } = parseSse(": latido\r\n\r\nevent: x\r\ndata: hola\r\n\r\n");
    expect(mensajes).toEqual([{ event: "x", data: "hola" }]);
  });
});
