/**
 * Capa 4 (frontend) - Presentacion / adaptador.
 * Enlaza un `CrudService` (capa 3) con el estado de React. La UI no habla con
 * `fetch` ni con repositorios: consume este hook. Se resuscribe al `EventBus`
 * para recargar cuando el mismo recurso cambia en otra pantalla (Observer).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrudService } from "../core/CrudService.js";
import type { PageMeta } from "../core/HttpClient.js";
import { AppEvents, eventBus, type EntityChangedPayload } from "../core/EventBus.js";
import { messageOf } from "../core/errors.js";

const EMPTY_META: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

export interface ResourceState<T> {
  readonly rows: readonly T[];
  readonly meta: PageMeta;
  readonly loading: boolean;
  readonly error: string | null;
  readonly page: number;
}

export interface UseResource<T> extends ResourceState<T> {
  setPage(page: number): void;
  setSort(sort: string, order: "asc" | "desc"): void;
  /** Filtros extra de la query string (p. ej. `{ razonSocial__like: "acme" }`). */
  setFilters(filters: Readonly<Record<string, string | number | boolean>>): void;
  reload(): void;
  create(dto: Record<string, unknown>): Promise<T>;
  update(entity: T, dto: Record<string, unknown>): Promise<T>;
  remove(entity: T): Promise<void>;
}

export function useResource<T extends Record<string, unknown>>(
  service: CrudService<T>,
  resourceKey: string,
): UseResource<T> {
  const [rows, setRows] = useState<readonly T[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ sort?: string; order: "asc" | "desc" }>({ order: "asc" });
  const [filters, setFilters] = useState<Readonly<Record<string, string | number | boolean>>>({});
  const [tick, setTick] = useState(0);

  const query = useMemo(
    () => ({
      page,
      pageSize: 20,
      ...(sort.sort !== undefined ? { sort: sort.sort, order: sort.order } : {}),
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    }),
    [page, sort, filters],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    service
      .list(query)
      .then((res) => {
        if (!alive) return;
        setRows(res.data as T[]);
        setMeta(res.meta);
      })
      .catch((e: unknown) => {
        if (alive) setError(messageOf(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [service, query, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // Observer: recarga si el recurso cambia en otra parte de la app.
  useEffect(() => {
    const events = [AppEvents.EntityCreated, AppEvents.EntityUpdated, AppEvents.EntityRemoved];
    const offs = events.map((ev) =>
      eventBus.on<EntityChangedPayload>(ev, (p) => {
        if (p.resource === resourceKey) reload();
      }),
    );
    return () => offs.forEach((off) => off());
  }, [resourceKey, reload]);

  return {
    rows,
    meta,
    loading,
    error,
    page,
    setPage,
    setSort: (s, o) => setSort({ sort: s, order: o }),
    setFilters: (f) => {
      setFilters(f);
      setPage(1);
    },
    reload,
    create: async (dto) => {
      const r = await service.create(dto);
      reload();
      return r;
    },
    update: async (entity, dto) => {
      const r = await service.update(entity, dto);
      reload();
      return r;
    },
    remove: async (entity) => {
      await service.remove(entity);
      reload();
    },
  };
}
