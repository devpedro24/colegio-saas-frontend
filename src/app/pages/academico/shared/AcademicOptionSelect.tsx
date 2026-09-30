import { useEffect, useId, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type {InfiniteData} from '@tanstack/react-query';
import { useIntl } from "react-intl";
import { api } from "@/lib/api/client";
import type { AcademicPageMeta } from "@/app/shared/components/AcademicPagination";

export type AcademicOption = {
  id: string;
  nombre?: string;
  name?: string;
  grado?: { nombre: string };
  sede?: { nombre: string } | null;
  sede_id?: string | null;
  nivel_id?: string | null;
  area_id?: string | null;
  area?: { id: string; nombre: string } | null;
  estado?: string;
  url_token?: string;
};

/** Opción pública de los formularios que no deben recibir IDs de la BD. */
export type OpaqueAcademicOption = {
  url_token: string;
  nombre?: string;
  name?: string;
  nivel_token?: string | null;
  area_token?: string | null;
  area?: { url_token: string; nombre: string } | null;
  grado?: {nombre: string; nivel_token?: string | null};
  sede?: {nombre: string} | null;
  estado?: string;
};

const optionValue = (option: AcademicOption | OpaqueAcademicOption): string =>
  'id' in option ? String(option.id) : option.url_token;

type CatalogType =
  | "grados"
  | "materias"
  | "areas"
  | "grupos"
  | "estudiantes"
  | "docentes"
  | "espacios";

type Props<T extends AcademicOption | OpaqueAcademicOption> = {
  tipo: CatalogType;
  yearId: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: T | null) => void;
  initialOptions: T[];
  emptyLabel: string;
  disabled?: boolean;
  required?: boolean;
  selectOnly?: boolean;
  hideLabel?: boolean;
  formatOption?: (option: T) => string;
  filterOption?: (option: T) => boolean;
  compatibleNivelId?: number | null;
  compatibleNivelToken?: string | null;
  /** Solicita el catálogo y envía valores con selectores públicos, sin IDs internos. */
  opaque?: boolean;
};

export function AcademicOptionSelect<T extends AcademicOption | OpaqueAcademicOption>({
  tipo,
  yearId,
  label,
  name,
  value,
  onChange,
  onSelectOption,
  initialOptions,
  emptyLabel,
  disabled = false,
  required = false,
  selectOnly = false,
  hideLabel = false,
  formatOption = (option) => option.nombre ?? option.name ?? optionValue(option),
  filterOption,
  compatibleNivelId,
  compatibleNivelToken,
  opaque = true,
}: Props<T>) {
  const intl = useIntl();
  const id = useId();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [opened, setOpened] = useState(false);
  const client = useQueryClient();
  const allOptionsKey = ["academic-options-all", tipo, yearId, compatibleNivelId, compatibleNivelToken, opaque];
  const cachedOptions = client.getQueryData<InfiniteData<{data: T[]}>>(allOptionsKey)?.pages.flatMap(page => page.data) ?? [];

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const selectedMissing =
    !!value && ![...initialOptions, ...cachedOptions].some((option) => optionValue(option) === value);
  const remote = useQuery({
    queryKey: ["academic-options", tipo, yearId, debouncedSearch, value, compatibleNivelId, compatibleNivelToken, opaque],
    queryFn: () => {
      const params = new URLSearchParams({
        tipo,
        per_page: "50",
      });
      params.set(opaque ? "ano_lectivo_token" : "ano_lectivo_id", yearId);
      if (opaque) params.set("opaque", "1");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (value) params.set(opaque ? "selected_token" : "selected_id", value);
      if (tipo === "materias") {
        if (opaque && compatibleNivelToken) params.set("compatible_nivel_token", compatibleNivelToken);
        else if (!opaque && compatibleNivelId != null) params.set("compatible_nivel_id", String(compatibleNivelId));
      }
      return api.get<{ data: T[]; meta: AcademicPageMeta }>(
        `/catalogos-academicos?${params}`,
      );
    },
    enabled:
      !disabled && !!yearId && ((!selectOnly && !!debouncedSearch) || selectedMissing),
  });

  // A filter with only a select loads the rest of its options when opened.
  // Requests remain bounded and every option stays reachable without a second search field.
  const allOptions = useInfiniteQuery({
    queryKey: allOptionsKey,
    enabled: !disabled && selectOnly && opened && !!yearId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ tipo, page: String(pageParam), per_page: "1000" });
      params.set(opaque ? "ano_lectivo_token" : "ano_lectivo_id", yearId);
      if (opaque) params.set("opaque", "1");
      if (tipo === "materias") {
        if (opaque && compatibleNivelToken) params.set("compatible_nivel_token", compatibleNivelToken);
        else if (!opaque && compatibleNivelId != null) params.set("compatible_nivel_id", String(compatibleNivelId));
      }
      return api.get<{ data: T[]; meta: AcademicPageMeta }>(
        `/catalogos-academicos?${params}`,
      );
    },
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = allOptions;
  useEffect(() => {
    if (
      selectOnly &&
      !disabled &&
      opened &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    selectOnly,
    disabled,
    opened,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const fetchedOptions =
    allOptions.data?.pages.flatMap((page) => page.data) ?? [];
  const options = selectOnly
    ? fetchedOptions.length
      ? fetchedOptions
      : initialOptions
    : debouncedSearch || selectedMissing
      ? (remote.data?.data ?? [])
      : initialOptions;
  const filteredOptions = filterOption ? options.filter(filterOption) : options;
  const selectedOption =
    value &&
    [...initialOptions, ...fetchedOptions, ...(remote.data?.data ?? [])].find(
      (option) => optionValue(option) === value && (!filterOption || filterOption(option)),
    );
  const merged =
    selectedOption && !filteredOptions.some((option) => optionValue(option) === value)
      ? [selectedOption, ...filteredOptions]
      : filteredOptions;

  return (
    <div className="d-flex flex-column gap-2">
      {!hideLabel && (
        <label
          className={`form-label mb-0 ${required ? "required" : ""}`}
          htmlFor={`${id}-select`}
        >
          {label}
        </label>
      )}
      {!selectOnly && (
        <input
          id={`${id}-search`}
          className="form-control form-control-sm"
          type="search"
          maxLength={120}
          aria-label={intl.formatMessage(
            { id: "common.search" },
            { name: label.toLowerCase() },
          )}
          placeholder={intl.formatMessage(
            { id: "common.search" },
            { name: label.toLowerCase() },
          )}
          value={search}
          disabled={disabled || !yearId}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <select
        id={`${id}-select`}
        name={name}
        aria-label={label}
        className="form-select form-select-solid"
        value={value}
        disabled={disabled || !yearId}
        required={required}
        onFocus={() => {
          if (selectOnly) setOpened(true);
        }}
        onPointerDown={() => {
          if (selectOnly) setOpened(true);
        }}
        onChange={(event) => {
          const selectedValue = event.target.value;
          onChange(selectedValue);
          onSelectOption?.(
            merged.find((option) => optionValue(option) === selectedValue) ??
              null,
          );
        }}
        aria-busy={remote.isFetching || allOptions.isFetching}
      >
        <option value="">{emptyLabel}</option>
        {merged.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {formatOption(option)}
          </option>
        ))}
      </select>
      {(remote.isError || allOptions.isError) && (
        <span className="text-danger fs-8" role="alert">
          {remote.error?.message ?? allOptions.error?.message}
        </span>
      )}
    </div>
  );
}
