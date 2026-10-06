/**
 * Delegar mis aprobaciones: durante una ausencia (vacaciones, viaje) un jefe o gerente cede a otra
 * persona, por un rango de fechas, la capacidad de aprobar/rechazar las solicitudes de su equipo.
 * Se puede revocar en cualquier momento (surte efecto al instante). La decision queda a nombre de
 * quien la toma, con la nota "por delegacion de ...".
 */
import { useCallback, useEffect, useState } from "react";
import { http } from "../../core/HttpClient.js";
import { messageOf } from "../../core/errors.js";
import { useAuth } from "../../core/auth/AuthContext.js";
import { Field, FormGrid, type FieldValue, type SelectOption } from "../../ui/Field.js";
import { Modal } from "../../ui/Modal.js";
import { Button } from "../../ui/primitives.js";
import { useToast } from "../../ui/Toast.js";

interface Delegacion {
  readonly idDelegacion: number;
  readonly nombreDelegante: string;
  readonly nombreDelegado: string;
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: string | null;
  readonly vigente: boolean;
}
interface Estado {
  readonly otorgadas: readonly Delegacion[];
  readonly recibidas: readonly Delegacion[];
}

const dia = (n: number): string => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
const fmt = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export default function Delegaciones(props: { open: boolean; onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const { sesion } = useAuth();
  const [estado, setEstado] = useState<Estado>({ otorgadas: [], recibidas: [] });
  const [empleados, setEmpleados] = useState<SelectOption[]>([]);
  const [form, setForm] = useState<Record<string, FieldValue>>({ idEmpleadoDelegado: "", desde: dia(0), hasta: dia(7), motivo: "" });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async (): Promise<void> => {
    try {
      setEstado(await http.get<Estado>("/api/com/delegaciones"));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }, [toast]);

  useEffect(() => {
    if (!props.open) return;
    setForm({ idEmpleadoDelegado: "", desde: dia(0), hasta: dia(7), motivo: "" });
    setShowErrors(false);
    void cargar();
    void http
      .list<Record<string, unknown>>("/api/com/ref/empleados", { pageSize: 500 })
      .then((r) =>
        setEmpleados(
          r.data
            .filter((e) => Number(e["idEmpleado"]) !== sesion?.idEmpleado)
            .map((e) => ({ value: String(e["idEmpleado"]), label: `${String(e["nombres"] ?? "")} ${String(e["apellidos"] ?? "")}`.trim() })),
        ),
      )
      .catch(() => setEmpleados([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function delegar(): Promise<void> {
    if (String(form["idEmpleadoDelegado"]) === "" || String(form["desde"]) === "" || String(form["hasta"]) === "") {
      setShowErrors(true);
      toast.error("Elige a quién delegas y el rango de fechas");
      return;
    }
    setSaving(true);
    try {
      await http.post("/api/com/delegaciones", {
        idEmpleadoDelegado: Number(form["idEmpleadoDelegado"]),
        desde: form["desde"],
        hasta: form["hasta"],
        motivo: String(form["motivo"] ?? "").trim() === "" ? undefined : String(form["motivo"]).trim(),
      });
      toast.success("Delegación registrada: esa persona ya puede aprobar en tu lugar");
      setForm((f) => ({ ...f, idEmpleadoDelegado: "", motivo: "" }));
      setShowErrors(false);
      await cargar();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  async function revocar(id: number): Promise<void> {
    try {
      await http.delete(`/api/com/delegaciones/${id}`);
      toast.success("Delegación revocada: ya no puede aprobar en tu lugar");
      await cargar();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  return (
    <Modal open={props.open} title="Delegar mis aprobaciones" onClose={props.onClose} width={620} footer={<Button variant="ghost" onClick={props.onClose}>Cerrar</Button>}>
      <div className="grid gap-4">
        <p className="text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
          Si te ausentas, cede tus aprobaciones a otra persona por unos días. Verá y decidirá las solicitudes de tu equipo; cada decisión queda registrada a su nombre con la nota «por delegación de {sesion?.nombre ?? "ti"}». Puedes revocarla cuando quieras.
        </p>

        <FormGrid>
          <Field
            def={{ name: "idEmpleadoDelegado", label: "Delegar en", kind: "select", required: true, options: empleados }}
            value={form["idEmpleadoDelegado"] ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, idEmpleadoDelegado: v }))}
            showErrors={showErrors}
          />
          <Field
            def={{ name: "desde", label: "Desde", kind: "date", required: true, minDate: "today" }}
            value={form["desde"] ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, desde: v }))}
            showErrors={showErrors}
            values={form}
          />
          <Field
            def={{ name: "hasta", label: "Hasta", kind: "date", required: true, minDateField: "desde", help: "Máximo 60 días." }}
            value={form["hasta"] ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, hasta: v }))}
            showErrors={showErrors}
            values={form}
          />
          <Field
            def={{ name: "motivo", label: "Motivo (opcional)", kind: "shortText", fullWidth: true }}
            value={form["motivo"] ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, motivo: v }))}
          />
        </FormGrid>
        <div>
          <Button icon="check" disabled={saving} onClick={() => void delegar()}>
            {saving ? "Guardando…" : "Delegar"}
          </Button>
        </div>

        <section className="grid gap-2">
          <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
            Mis delegaciones
          </h3>
          {estado.otorgadas.length === 0 ? (
            <p className="text-[0.82rem]" style={{ color: "var(--color-ink-faint)" }}>No has delegado nada.</p>
          ) : (
            estado.otorgadas.map((d) => (
              <div key={d.idDelegacion} className="surface-2 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-[0.82rem]" style={{ border: "1px solid var(--color-line)" }}>
                <span>
                  <b>{d.nombreDelegado}</b> · {fmt(d.desde)} → {fmt(d.hasta)}
                  {d.vigente ? <span style={{ color: "var(--color-success)" }}> · vigente</span> : <span style={{ color: "var(--color-ink-faint)" }}> · programada</span>}
                  {d.motivo !== null && <span style={{ color: "var(--color-ink-faint)" }}> · {d.motivo}</span>}
                </span>
                <Button size="sm" variant="ghost" icon="undo" onClick={() => void revocar(d.idDelegacion)}>
                  Revocar
                </Button>
              </div>
            ))
          )}
        </section>

        {estado.recibidas.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Me delegaron
            </h3>
            {estado.recibidas.map((d) => (
              <div key={d.idDelegacion} className="text-[0.82rem]" style={{ color: "var(--color-ink)" }}>
                <b>{d.nombreDelegante}</b> · {fmt(d.desde)} → {fmt(d.hasta)}
                {d.vigente ? " · vigente: ya apruebas en su lugar" : " · aún no inicia"}
              </div>
            ))}
          </section>
        )}
      </div>
    </Modal>
  );
}
