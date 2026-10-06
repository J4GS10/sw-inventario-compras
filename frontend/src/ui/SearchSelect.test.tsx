import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchSelect from "./SearchSelect.js";

const OPCIONES = [
  { value: "1", label: "Ferretería La Fortaleza, S.A." },
  { value: "2", label: "Distribuidora Metalúrgica Central" },
  { value: "3", label: "Importaciones Industriales del Sur" },
];

function Host(props: { onChange?: (v: string) => void; required?: boolean; initial?: string }): React.ReactElement {
  const [v, setV] = useState(props.initial ?? "");
  return (
    <SearchSelect
      value={v}
      options={OPCIONES}
      required={props.required}
      onChange={(x) => {
        setV(x);
        props.onChange?.(x);
      }}
    />
  );
}

describe("SearchSelect", () => {
  it("el buscador solo aparece al desplegar, ya enfocado", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox"));
    const box = await screen.findByRole("searchbox");
    expect(box).toBeInTheDocument();
    await vi.waitFor(() => expect(box).toHaveFocus());
    expect(screen.getAllByRole("option")).toHaveLength(OPCIONES.length + 0);
  });

  it("filtra sin importar mayúsculas ni acentos y por todas las palabras", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByRole("searchbox"), "ferretería fortal");
    const ops = screen.getAllByRole("option");
    expect(ops).toHaveLength(1);
    expect(ops[0]).toHaveTextContent("Ferretería La Fortaleza");
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/Sin resultados para «zzz»/)).toBeInTheDocument();
  });

  it("Enter elige la primera coincidencia; flechas mueven; el valor se muestra y el panel se cierra", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByRole("searchbox"), "i");
    // Distribuidora(i), Importaciones(i), Ferreteria(i)? -> todas contienen "i"; bajar 1 y elegir
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent(/\S/);
    expect(screen.getByRole("combobox")).not.toHaveTextContent("seleccionar");
  });

  it("clic en una opcion la elige; Escape cierra sin cambiar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Importaciones/ }));
    expect(onChange).toHaveBeenCalledWith("3");

    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("searchbox");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("no obligatorio: ofrece quitar la seleccion; obligatorio: no", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Host initial="2" onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /quitar selección/ }));
    expect(onChange).toHaveBeenLastCalledWith("");
    unmount();

    render(<Host initial="2" required />);
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("searchbox");
    expect(within(screen.getByRole("listbox")).queryByText(/quitar selección/)).not.toBeInTheDocument();
  });

  it("sin opciones muestra el texto de ayuda", async () => {
    const user = userEvent.setup();
    render(<SearchSelect value="" options={[]} onChange={() => {}} emptyHint="Elige primero el RFQ" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Elige primero el RFQ");
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Elige primero el RFQ", { selector: "li" })).toBeInTheDocument();
  });

  it("deshabilitado no abre", async () => {
    const user = userEvent.setup();
    render(<SearchSelect value="" options={OPCIONES} onChange={() => {}} disabled />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
