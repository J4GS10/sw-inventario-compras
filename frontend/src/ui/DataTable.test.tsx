import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, type Column, type RowAction } from "./DataTable.js";
import { formatMoney } from "../core/format.js";

interface Row {
  readonly id: number;
  readonly nombre: string;
  readonly monto: number;
  readonly estado: string;
  readonly extra: string;
}

const ROWS: readonly Row[] = [
  { id: 1, nombre: "Beta", monto: 200, estado: "APROBADA", extra: "detalle b" },
  { id: 2, nombre: "Alfa", monto: 100, estado: "PENDIENTE", extra: "detalle a" },
];

const rowKey = (r: Row): number => r.id;

/**
 * jsdom no implementa ResizeObserver (DataTable.tsx:250-264 lo usa para medir
 * el contenedor). Este stub captura la instancia observada y expone `fire`
 * para simular un cambio de ancho, ejercitando las ramas responsive.
 */
class FakeResizeObserver {
  static current: FakeResizeObserver | null = null;
  private target: Element | null = null;
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.current = this;
  }
  observe(el: Element): void {
    this.target = el;
  }
  unobserve(): void {}
  disconnect(): void {}
  fire(width: number): void {
    if (this.target === null) return;
    const entry = { contentRect: { width } } as ResizeObserverEntry;
    act(() => this.cb([entry], this as unknown as ResizeObserver));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeResizeObserver.current = null;
});

const BASE_COLUMNS: readonly Column<Row>[] = [
  { key: "nombre", header: "Nombre", type: "text", value: (r) => r.nombre, sortable: true, grow: true },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto },
  { key: "estado", header: "Estado", type: "estado", value: (r) => r.estado },
];

describe("DataTable — render basico", () => {
  it("muestra columnas y filas con formato por tipo", () => {
    render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} />);
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    const montoCell = screen.getAllByRole("cell").find((td) => td.textContent === formatMoney(200));
    expect(montoCell).toBeDefined();
  });

  it("muestra un tooltip con el valor completo en celdas truncables", () => {
    render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} />);
    expect(screen.getByText("Beta").closest("td")).toHaveAttribute("title", "Beta");
  });

  it("estado vacio con el titulo dado cuando no hay filas", () => {
    render(<DataTable columns={BASE_COLUMNS} rows={[]} rowKey={rowKey} emptyTitle="Sin proveedores" />);
    expect(screen.getByText("Sin proveedores")).toBeInTheDocument();
  });

  it("muestra el esqueleto de carga en vez de la tabla", () => {
    const { container } = render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} loading />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("DataTable — orden", () => {
  it("click en un header sortable ordena asc y luego desc", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} />);
    const nombreHeader = screen.getByRole("columnheader", { name: "Nombre" });

    await user.click(nombreHeader);
    let cells = screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]?.textContent);
    expect(cells).toEqual(["Alfa", "Beta"]);

    await user.click(nombreHeader);
    cells = screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]?.textContent);
    expect(cells).toEqual(["Beta", "Alfa"]);
  });
});

describe("DataTable — selección y acciones masivas", () => {
  it("marcar una fila muestra la barra de seleccion; Limpiar la oculta", async () => {
    const user = userEvent.setup();
    const onBulk = vi.fn();
    render(
      <DataTable
        columns={BASE_COLUMNS}
        rows={ROWS}
        rowKey={rowKey}
        selectable
        bulkActions={[{ label: "Eliminar", onClick: onBulk }]}
      />,
    );
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: "Seleccionar fila" });
    await user.click(rowCheckboxes[0]!);

    expect(screen.getByText("1 seleccionada(s)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onBulk).toHaveBeenCalledWith([ROWS[0]]);

    await user.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.queryByText("1 seleccionada(s)")).not.toBeInTheDocument();
  });
});

describe("DataTable — menu de acciones por fila", () => {
  it("abre el menu, dispara la accion, y oculta las acciones marcadas hidden", async () => {
    const user = userEvent.setup();
    const onEditar = vi.fn();
    const actions: readonly RowAction<Row>[] = [
      { label: "Editar", onClick: onEditar },
      { label: "Adjudicar", onClick: vi.fn(), hidden: (r) => r.estado !== "PENDIENTE" },
    ];
    render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} actions={actions} />);

    const menuButtons = screen.getAllByRole("button", { name: "Acciones de la fila" });
    // Fila 0 = Beta (APROBADA): "Adjudicar" no debe aparecer.
    await user.click(menuButtons[0]!);
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Adjudicar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(onEditar).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe("DataTable — paginacion", () => {
  it("Anterior deshabilitado en la primera pagina; Siguiente llama onPage", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(
      <DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} page={1} totalPages={3} onPage={onPage} />,
    );
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe("DataTable — columna de relleno sin grow (fix 2026-09-10)", () => {
  it("agrega una celda extra invisible cuando ninguna columna tiene grow", () => {
    const sinGrow: readonly Column<Row>[] = [
      { key: "nombre", header: "Nombre", type: "text", value: (r) => r.nombre },
      { key: "estado", header: "Estado", type: "estado", value: (r) => r.estado },
    ];
    render(<DataTable columns={sinGrow} rows={ROWS} rowKey={rowKey} />);
    const firstDataRow = screen.getAllByRole("row")[1]!;
    // 2 columnas de datos + 1 <td> de relleno (aria-hidden, fuera del arbol de a11y) = 3.
    expect(firstDataRow.querySelectorAll("td")).toHaveLength(3);
  });

  it("no agrega relleno cuando una columna ya tiene grow", () => {
    render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} />);
    const firstDataRow = screen.getAllByRole("row")[1]!;
    expect(within(firstDataRow).getAllByRole("cell")).toHaveLength(BASE_COLUMNS.length);
  });
});

describe("DataTable — responsive", () => {
  const conSecundaria: readonly Column<Row>[] = [
    { key: "nombre", header: "Nombre", type: "text", value: (r) => r.nombre, grow: true },
    { key: "estado", header: "Estado", type: "estado", value: (r) => r.estado },
    { key: "extra", header: "Extra", type: "text", value: (r) => r.extra, priority: "secondary" },
  ];

  it("oculta las columnas secondary y las revela con el disclosure de la fila", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<DataTable columns={conSecundaria} rows={ROWS} rowKey={rowKey} />);

    // primary (nombre 220 + estado 140 = 360) + secondary (extra 220) + slack (32) = 612.
    // 580 alcanza para las primary (no es vista tarjeta, <560 lo seria) pero no para todas.
    FakeResizeObserver.current?.fire(580);

    expect(screen.queryByRole("columnheader", { name: "Extra" })).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("detalle b")).not.toBeInTheDocument();

    const disclosure = screen.getAllByRole("button", { name: "Mostrar mas detalles" })[0]!;
    await user.click(disclosure);
    expect(screen.getByText("detalle b")).toBeInTheDocument();
  });

  it("muestra las columnas secondary inline cuando el contenedor es suficientemente ancho", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<DataTable columns={conSecundaria} rows={ROWS} rowKey={rowKey} />);
    FakeResizeObserver.current?.fire(900);
    expect(screen.getByRole("columnheader", { name: "Extra" })).toBeInTheDocument();
  });

  it("por debajo de 560px cambia a vista tarjeta (sin tabla)", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<DataTable columns={conSecundaria} rows={ROWS} rowKey={rowKey} />);
    FakeResizeObserver.current?.fire(400);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});
