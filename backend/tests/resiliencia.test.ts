import { describe, expect, it } from "vitest";
import { FailureRateLimiter } from "../src/common/security/RateLimiter.js";
import { mapOracleError } from "../src/common/errors/OracleErrorAdapter.js";
import {
  ConflictError,
  ServiceUnavailableError,
  ValidationError,
  InternalError,
} from "../src/common/errors/AppError.js";

describe("FailureRateLimiter", () => {
  it("bloquea al llegar al máximo de fallos y se libera al vencer la ventana", () => {
    let t = 1_000_000;
    const rl = new FailureRateLimiter(3, 60_000, () => t);
    expect(rl.estado("ip").bloqueado).toBe(false);
    rl.registrarFallo("ip");
    rl.registrarFallo("ip");
    expect(rl.estado("ip").bloqueado).toBe(false);
    rl.registrarFallo("ip");
    const e = rl.estado("ip");
    expect(e.bloqueado).toBe(true);
    expect(e.reintentarEnSeg).toBe(60);
    t += 61_000;
    expect(rl.estado("ip").bloqueado).toBe(false);
  });

  it("un login correcto limpia el contador; las claves no se mezclan", () => {
    const rl = new FailureRateLimiter(2, 60_000);
    rl.registrarFallo("a");
    rl.registrarFallo("a");
    expect(rl.estado("a").bloqueado).toBe(true);
    expect(rl.estado("b").bloqueado).toBe(false);
    rl.limpiar("a");
    expect(rl.estado("a").bloqueado).toBe(false);
  });
});

describe("mapOracleError: la BD caida es un 503 reintentable, no un 500", () => {
  it.each([[12541], [12514], [3113], [3114], [1033], [1034], [12170]])("ORA-%i -> ServiceUnavailableError", (num) => {
    const e = mapOracleError({ errorNum: num, message: `ORA-${num}` }, "COM_X");
    expect(e).toBeInstanceOf(ServiceUnavailableError);
    expect(e.httpStatus).toBe(503);
  });

  it("errores del driver sin ORA (cola del pool, conexión rechazada) también", () => {
    expect(mapOracleError(new Error("NJS-040: connection request timeout. Request exceeded queueTimeout of 15000"), "x")).toBeInstanceOf(ServiceUnavailableError);
    expect(mapOracleError(new Error("connect ECONNREFUSED 127.0.0.1:1521"), "x")).toBeInstanceOf(ServiceUnavailableError);
  });

  it("deadlock / recurso ocupado -> 409 reintentable; formato de numero o fecha -> 422", () => {
    expect(mapOracleError({ errorNum: 60, message: "ORA-00060" }, "x")).toBeInstanceOf(ConflictError);
    expect(mapOracleError({ errorNum: 54, message: "ORA-00054" }, "x")).toBeInstanceOf(ConflictError);
    expect(mapOracleError({ errorNum: 1438, message: "ORA-01438" }, "x")).toBeInstanceOf(ValidationError);
    expect(mapOracleError({ errorNum: 1861, message: "ORA-01861" }, "x")).toBeInstanceOf(ValidationError);
  });

  it("un error desconocido sigue siendo interno", () => {
    expect(mapOracleError({ errorNum: 942, message: "ORA-00942" }, "x")).toBeInstanceOf(InternalError);
  });
});
