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

describe("DataTable — render básico", () => {
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

  it("estado vacío con el título dado cuando no hay filas", () => {
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

describe("DataTable — menú de acciones por fila", () => {
  it("abre el menú, dispara la acción, y oculta las acciones marcadas hidden", async () => {
    const user = userEvent.setup();
    const onEditar = vi.fn();
    const actions: readonly RowAction<Row>[] = [
      { label: "Editar", onClick: onEditar },
      { label: "Adjudicar", onClick: vi.fn(), hidden: (r) => r.estado !== "PENDIENTE" },
    ];
    render(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} actions={actions} />);

    const menuButtons = screen.getAllByRole("button", { name: "Más opciones" });
    // Fila 0 = Beta (APROBADA): "Adjudicar" no debe aparecer.
    await user.click(menuButtons[0]!);
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Adjudicar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(onEditar).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe("DataTable — paginación", () => {
  it("Anterior deshabilitado en la primera página; Siguiente llama onPage", async () => {
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
  it("sin grow explícito, la primera columna de texto absorbe el espacio (sin celdas vacías de relleno)", () => {
    const sinGrow: readonly Column<Row>[] = [
      { key: "nombre", header: "Nombre", type: "text", value: (r) => r.nombre },
      { key: "estado", header: "Estado", type: "estado", value: (r) => r.estado },
    ];
    render(<DataTable columns={sinGrow} rows={ROWS} rowKey={rowKey} />);
    const firstDataRow = screen.getAllByRole("row")[1]!;
    // Solo las 2 columnas de datos: el espacio sobrante lo absorbe "Nombre", no un <td> vacio.
    expect(firstDataRow.querySelectorAll("td")).toHaveLength(2);
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

    const disclosure = screen.getAllByRole("button", { name: "Mostrar más detalles" })[0]!;
    await user.click(disclosure);
    expect(screen.getByText("detalle b")).toBeInTheDocument();
  });

  it("las columnas secondary nunca van en la tabla, ni con el contenedor ancho (viven en el detalle de la fila)", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<DataTable columns={conSecundaria} rows={ROWS} rowKey={rowKey} />);
    FakeResizeObserver.current?.fire(1000);
    expect(screen.queryByRole("columnheader", { name: "Extra" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mostrar más detalles" }).length).toBeGreaterThan(0);
  });

  it("por debajo de 560px cambia a vista tarjeta (sin tabla)", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<DataTable columns={conSecundaria} rows={ROWS} rowKey={rowKey} />);
    FakeResizeObserver.current?.fire(400);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});

describe("DataTable — orden en servidor (onSort)", () => {
  it("cicla asc -> desc -> sin orden y NO reordena la pagina en el cliente", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const { rerender } = render(
      <DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} sort={null} onSort={onSort} />,
    );
    const nombre = screen.getByRole("columnheader", { name: "Nombre" });

    await user.click(nombre);
    expect(onSort).toHaveBeenLastCalledWith({ key: "nombre", dir: "asc" });
    // El servidor decide el orden: las filas siguen tal como llegaron (Beta, Alfa).
    let cells = screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]?.textContent);
    expect(cells).toEqual(["Beta", "Alfa"]);

    rerender(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} sort={{ key: "nombre", dir: "asc" }} onSort={onSort} />);
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("columnheader", { name: "Nombre" }));
    expect(onSort).toHaveBeenLastCalledWith({ key: "nombre", dir: "desc" });

    rerender(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} sort={{ key: "nombre", dir: "desc" }} onSort={onSort} />);
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("columnheader", { name: "Nombre" }));
    expect(onSort).toHaveBeenLastCalledWith(null); // vuelve al orden por defecto: lo mas reciente primero
    cells = screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]?.textContent);
    expect(cells).toEqual(["Beta", "Alfa"]);
  });
});

describe("DataTable — buscador", () => {
  it("notifica lo tecleado, limpia con el botón y con Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} search={{ value: "", onChange, placeholder: "Buscar algo" }} />,
    );
    const box = screen.getByRole("searchbox");
    await user.type(box, "a");
    expect(onChange).toHaveBeenLastCalledWith("a");
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).not.toBeInTheDocument();

    rerender(<DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} search={{ value: "alfa", onChange }} />);
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    await user.type(screen.getByRole("searchbox"), "{Escape}");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("sin resultados: dice que se busco y ofrece limpiar (no el vacío genérico)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DataTable columns={BASE_COLUMNS} rows={[]} rowKey={rowKey} emptyTitle="Aún no hay nada" search={{ value: "zzz", onChange }} />,
    );
    expect(screen.getByText("Sin resultados para «zzz»")).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay nada")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todos los registros" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("sin búsqueda activa y sin filas se muestra el vacío normal", () => {
    render(<DataTable columns={BASE_COLUMNS} rows={[]} rowKey={rowKey} emptyTitle="Aún no hay nada" search={{ value: "", onChange: vi.fn() }} />);
    expect(screen.getByText("Aún no hay nada")).toBeInTheDocument();
  });

  it("el pie cuenta 'resultados' cuando hay búsqueda", () => {
    render(
      <DataTable columns={BASE_COLUMNS} rows={ROWS} rowKey={rowKey} page={1} totalPages={1} total={2} onPage={vi.fn()} search={{ value: "a", onChange: vi.fn() }} />,
    );
    expect(screen.getByText(/2 resultados/)).toBeInTheDocument();
  });
});

describe("DataTable — fechas", () => {
  const FILAS = [{ id: 1, nombre: "x", monto: 1, estado: "A", extra: "" }];
  it("un DATE (medianoche UTC) no se corre de dia; un instante se muestra en hora local", () => {
    const cols: readonly Column<Row>[] = [
      { key: "d", header: "Día", type: "date", value: () => "2026-10-19T00:00:00.000Z" },
      { key: "t", header: "Instante", type: "datetime", value: () => "2026-10-05T22:26:48.000Z" },
    ];
    render(<DataTable columns={cols} rows={FILAS} rowKey={rowKey} />);
    expect(screen.getByText("2026-10-19")).toBeInTheDocument();
    const local = new Date("2026-10-05T22:26:48.000Z");
    const hh = local.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(screen.getByText(`${local.toLocaleDateString("en-CA")} ${hh}`)).toBeInTheDocument();
  });
});
