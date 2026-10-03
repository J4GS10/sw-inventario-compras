/**
 * Pagina CRUD generica. Capa de presentacion: consume un `CrudService` (capa 3)
 * via el hook `useResource`; nunca habla con `fetch`. PageHeader + DataTable
 * (seleccion multiple, orden, acciones) + Modal con formulario cuyos campos
 * toman su ancho segun el tipo de dato (Field/FormGrid).
 */

import { useEffect, useMemo, useState } from "react";
import { Field, FormGrid } from "../ui/Field.js";
import { DataTable, type Column } from "../ui/DataTable.js";
import { Modal, ConfirmDialog, Tabs } from "../ui/Modal.js";
import { Button, Chip, PageHeader, StatCard, StatRow, tagTone } from "../ui/primitives.js";
import type { HelpContent } from "../ui/HelpTip.js";
import { useToast } from "../ui/Toast.js";
import { useResource } from "../hooks/useResource.js";
import { catalogService } from "../core/CompraServices.js";
import { http } from "../core/HttpClient.js";
import { messageOf } from "../core/errors.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { Permisos } from "../core/auth/permisos.js";
import {
  blankValues,
  firstError,
  toPayload,
  useOptions,
  withResolvedOptions,
  type FormFieldDef,
} from "./formSupport.js";

export type CrudFieldDef = FormFieldDef;

export interface CrudPageConfig {
  readonly title: string;
  readonly subtitle?: string;
  readonly basePath: string;
  readonly idField: string;
  readonly versioned?: boolean;
  readonly columns: readonly Column<Row>[];
  readonly fields: readonly CrudFieldDef[];
  readonly formTabs?: readonly { id: string; label: string; fields: readonly string[] }[];
  /** Permiso que habilita crear/editar/eliminar. Por defecto CATALOGO_EDITAR. */
  readonly writePerm?: string;
  /** Boton "?" junto al titulo — el usuario elige verla, nunca se abre sola. */
  readonly help?: HelpContent;
  /** Nombre de columna sobre el que buscar (server-side, via `campo__like`). */
  readonly searchField?: string;
  readonly searchPlaceholder?: string;
  /** Tarjetas KPI sobre la lista (conteos/promedios a partir de la pagina cargada + el total + los tags derivados, si los hay). */
  readonly stats?: (
    rows: readonly Row[],
    total: number,
    derivedTags: Readonly<Record<number, readonly string[]>>,
  ) => readonly { icon: import("../ui/Icon.js").IconName; tone?: import("../ui/primitives.js").ChipTone; title: string; subtitle: string }[];
  /** Tags derivados (no son un campo propio de la fila): se piden aparte y se inyectan en la columna con esta `key`. */
  readonly derivedTags?: { readonly path: string; readonly columnKey: string };
  /**
   * Boton "Filtrar": un select por campo (server-side, via `campo__eq`).
   * `options` para un catalogo estatico (fijo en el codigo); `optionsFrom`
   * para uno que vive en la base de datos (p. ej. categorias de articulo) —
   * se resuelve una vez, igual que `derivedTags`.
   */
  readonly filterFields?: readonly {
    readonly key: string;
    readonly label: string;
    readonly options?: readonly { value: string; label: string }[];
    readonly optionsFrom?: { readonly path: string; readonly value: string; readonly label: string };
  }[];
}

type Row = Record<string, unknown>;
type Values = Record<string, import("../ui/Field.js").FieldValue>;

export default function CrudPage(props: { config: CrudPageConfig }): React.ReactElement {
  const { config } = props;
  const toast = useToast();
  const { hasPerm } = useAuth();
  const canEdit = hasPerm(config.writePerm ?? Permisos.CATALOGO_EDITAR);

  const service = useMemo(
    () => catalogService(config.basePath, config.idField, config.versioned ?? false),
    [config.basePath, config.idField, config.versioned],
  );
  const res = useResource<Row>(service, config.basePath);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Values>(() => blankValues(config.fields));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(config.formTabs?.[0]?.id ?? "");
  const [toDelete, setToDelete] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [tagsMap, setTagsMap] = useState<Record<number, readonly string[]>>({});
  const [remoteFilterOptions, setRemoteFilterOptions] = useState<
    Record<string, readonly { value: string; label: string }[]>
  >({});

  useEffect(() => {
    const t = setTimeout(() => {
      const combined: Record<string, string> = {};
      if (config.searchField !== undefined && search.trim() !== "") {
        combined[`${config.searchField}__like`] = search.trim();
      }
      for (const [k, v] of Object.entries(filterValues)) {
        if (v !== "") combined[`${k}__eq`] = v;
      }
      res.setFilters(combined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, config.searchField, filterValues]);

  useEffect(() => {
    if (config.derivedTags === undefined) return;
    const ids = res.rows
      .map((r) => Number(r[config.idField]))
      .filter((n) => Number.isFinite(n));
    if (ids.length === 0) {
      setTagsMap({});
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const body = await http.raw<unknown>(config.derivedTags!.path, { ids: ids.join(",") });
        const data = (body as { data?: Record<number, readonly string[]> }).data ?? {};
        if (alive) setTagsMap(data);
      } catch {
        if (alive) setTagsMap({});
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.derivedTags, config.idField, res.rows]);

  // Catalogos de filtro que viven en BD (p. ej. categorias de articulo): se
  // piden una sola vez, igual que derivedTags — no dependen de la pagina ni
  // del filtro activo.
  useEffect(() => {
    const dinamicos = (config.filterFields ?? []).filter((f) => f.optionsFrom !== undefined);
    if (dinamicos.length === 0) return;
    let alive = true;
    void (async () => {
      const updates: Record<string, readonly { value: string; label: string }[]> = {};
      await Promise.all(
        dinamicos.map(async (f) => {
          try {
            const body = await http.raw<unknown>(f.optionsFrom!.path, { pageSize: 300 });
            const rows = ((body as { data?: unknown }).data ?? body) as Row[];
            updates[f.key] = (Array.isArray(rows) ? rows : []).map((r) => ({
              value: String(r[f.optionsFrom!.value]),
              label: String(r[f.optionsFrom!.label] ?? r[f.optionsFrom!.value]),
            }));
          } catch {
            updates[f.key] = [];
          }
        }),
      );
      if (alive) setRemoteFilterOptions(updates);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.filterFields]);

  const columns = useMemo(() => {
    if (config.derivedTags === undefined) return config.columns;
    const { columnKey } = config.derivedTags;
    return config.columns.map((c) =>
      c.key === columnKey
        ? {
            ...c,
            render: (r: Row) => {
              const tags = tagsMap[Number(r[config.idField])] ?? [];
              if (tags.length === 0) {
                return <span style={{ color: "var(--color-ink-faint)" }}>—</span>;
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <Chip key={t} tone={tagTone(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              );
            },
          }
        : c,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.columns, config.derivedTags, config.idField, tagsMap]);

  const stats = config.stats?.(res.rows, res.meta.total, tagsMap) ?? [];

  // Igual que en DocumentForm: el modal esta siempre montado, asi que sin
  // este guard las opciones (incluidas las que dependen de un permiso mas
  // estrecho que el de ver el catalogo) se piden apenas se abre la pantalla,
  // no el modal de alta/edicion.
  const fkOptions = useOptions(open ? config.fields : [], values);
  const fieldsByName = useMemo(
    () => new Map(config.fields.map((f) => [f.name, f])),
    [config.fields],
  );

  function openCreate(): void {
    setEditing(null);
    setValues(blankValues(config.fields));
    setShowErrors(false);
    setTab(config.formTabs?.[0]?.id ?? "");
    setOpen(true);
  }

  function openEdit(row: Row): void {
    setEditing(row);
    const v = blankValues(config.fields);
    for (const f of config.fields) {
      const raw = row[f.name];
      if (raw === null || raw === undefined) continue;
      v[f.name] = f.kind === "switch" ? Boolean(raw) : String(raw);
    }
    setValues(v);
    setShowErrors(false);
    setTab(config.formTabs?.[0]?.id ?? "");
    setOpen(true);
  }

  async function save(): Promise<void> {
    const err = firstError(config.fields, values);
    if (err !== null) {
      setShowErrors(true);
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(config.fields, values);
      if (editing === null) {
        await res.create(payload);
        toast.success("Registro creado");
      } else {
        await res.update(editing, payload);
        toast.success("Cambios guardados");
      }
      setOpen(false);
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (toDelete === null) return;
    try {
      for (const row of toDelete) await res.remove(row);
      toast.success(toDelete.length > 1 ? "Registros eliminados" : "Registro eliminado");
      setToDelete(null);
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  const visibleFieldNames =
    config.formTabs === undefined
      ? config.fields.map((f) => f.name)
      : (config.formTabs.find((t) => t.id === tab)?.fields ?? []);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title={config.title}
        subtitle={
          canEdit
            ? config.subtitle
            : `${config.subtitle ?? ""}${config.subtitle ? " · " : ""}Solo lectura para tu rol`.trim()
        }
        help={config.help}
        actions={
          canEdit ? (
            <Button icon="plus" onClick={openCreate}>
              Nuevo
            </Button>
          ) : undefined
        }
      />

      {res.error !== null && (
        <div className="text-[0.85rem]" style={{ color: "var(--color-danger)" }}>
          {res.error}
        </div>
      )}

      {stats.length > 0 && (
        <StatRow>
          {stats.map((s, i) => (
            // Indice como key a proposito: el numero/orden de tarjetas es fijo
            // por config; `s.title` puede colisionar entre tarjetas distintas
            // mientras los datos aun no cargan (dos "—" simultaneos), lo que
            // rompe la reconciliacion de React y deja un nodo huerfano.
            <StatCard key={i} icon={s.icon} tone={s.tone} title={s.title} subtitle={s.subtitle} />
          ))}
        </StatRow>
      )}

      <DataTable<Row>
        columns={columns}
        rows={res.rows}
        rowKey={(r) => Number(r[config.idField])}
        loading={res.loading}
        selectable={canEdit}
        page={res.meta.page}
        totalPages={res.meta.totalPages}
        total={res.meta.total}
        onPage={res.setPage}
        onReload={res.reload}
        search={
          config.searchField !== undefined
            ? { value: search, onChange: setSearch, placeholder: config.searchPlaceholder ?? `Buscar ${config.title.toLowerCase()}...` }
            : undefined
        }
        filters={
          config.filterFields !== undefined && config.filterFields.length > 0
            ? {
                fields: config.filterFields.map((f) => ({
                  key: f.key,
                  label: f.label,
                  options: f.options ?? remoteFilterOptions[f.key] ?? [],
                })),
                values: filterValues,
                onChange: (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value })),
                onClear: () => setFilterValues({}),
              }
            : undefined
        }
        exportFilename={config.basePath.replace(/^\/api\/com\//, "").replace(/\//g, "-")}
        bulkActions={
          canEdit
            ? [{ label: "Eliminar", icon: "trash", tone: "danger", onClick: (rs) => setToDelete([...rs]) }]
            : []
        }
        actions={
          canEdit
            ? [
                { label: "Editar", icon: "edit", primary: true, onClick: openEdit },
                { label: "Eliminar", icon: "trash", tone: "danger", onClick: (r) => setToDelete([r]) },
              ]
            : []
        }
        emptyTitle={`Sin ${config.title.toLowerCase()}`}
      />

      <Modal
        open={open}
        title={`${editing === null ? "Nuevo" : "Editar"} · ${config.title}`}
        onClose={() => setOpen(false)}
        width={config.formTabs !== undefined ? 640 : 540}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button icon="check" disabled={saving} onClick={() => void save()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </>
        }
      >
        {config.formTabs !== undefined && (
          <Tabs tabs={config.formTabs} active={tab} onChange={setTab} />
        )}
        <FormGrid>
          {visibleFieldNames.map((name) => {
            const f = fieldsByName.get(name);
            if (f === undefined) return null;
            return (
              <Field
                key={f.name}
                def={withResolvedOptions(f, fkOptions)}
                value={values[f.name] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                showErrors={showErrors}
              />
            );
          })}
        </FormGrid>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Confirmar eliminacion"
        message={
          toDelete !== null && toDelete.length > 1
            ? `Se eliminaran ${toDelete.length} registros (marcado como eliminado).`
            : "Se eliminara el registro seleccionado (marcado como eliminado)."
        }
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
