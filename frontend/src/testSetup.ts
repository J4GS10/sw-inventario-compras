import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// React 19 + Vitest no activa este flag por defecto; sin el, `act(...)` (usado
// para simular ResizeObserver en DataTable.test.tsx) emite un warning falso.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);
