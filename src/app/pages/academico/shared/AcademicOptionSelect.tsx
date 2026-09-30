import { useEffect, useId, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { api } from "@/lib/api/client";
import type { AcademicPageMeta } from "@/app/shared/components/AcademicPagination";

export type AcademicOption = {
  id: number;
  nombre?: string;
  name?: string;
  grado?: { nombre: string };
  sede?: { nombre: string } | null;
  sede_id?: number | null;
  nivel_id?: number | null;
  estado?: string;
  url_token?: string;
};

type CatalogType =
  | "grados"
  | "materias"
  | "areas"
  | "grupos"
  | "estudiantes"
  | "docentes"
  | "espacios";

type Props = {
  tipo: CatalogType;
  yearId: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: AcademicOption | null) => void;
  initialOptions: AcademicOption[];
  emptyLabel: string;
  disabled?: boolean;
  required?: boolean;
  selectOnly?: boolean;
  hideLabel?: boolean;
  formatOption?: (option: AcademicOption) => string;
  filterOption?: (option: AcademicOption) => boolean;
};

export function AcademicOptionSelect({
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
  formatOption = (option) => option.nombre ?? option.name ?? String(option.id),
  filterOption,
}: Props) {
  const intl = useIntl();
  const id = useId();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const selectedMissing =
    !!value && !initialOptions.some((option) => String(option.id) === value);
  const remote = useQuery({
    queryKey: ["academic-options", tipo, yearId, debouncedSearch, value],
    queryFn: () => {
      const params = new URLSearchParams({
        tipo,
        ano_lectivo_id: yearId,
        per_page: "50",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (value) params.set("selected_id", value);
      return api.get<{ data: AcademicOption[]; meta: AcademicPageMeta }>(
        `/catalogos-academicos?${params}`,
      );
    },
    enabled:
      !!yearId && ((!selectOnly && !!debouncedSearch) || selectedMissing),
  });

  // A filter with only a select loads the rest of its options when opened.
  // Requests remain bounded and every option stays reachable without a second search field.
  const allOptions = useInfiniteQuery({
    queryKey: ["academic-options-all", tipo, yearId],
    enabled: selectOnly && opened && !!yearId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<{ data: AcademicOption[]; meta: AcademicPageMeta }>(
        `/catalogos-academicos?${new URLSearchParams({ tipo, ano_lectivo_id: yearId, page: String(pageParam), per_page: "1000" })}`,
      ),
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = allOptions;
  useEffect(() => {
    if (
      selectOnly &&
      opened &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    selectOnly,
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
    [...initialOptions, ...(remote.data?.data ?? [])].find(
      (option) => String(option.id) === value && (!filterOption || filterOption(option)),
    );
  const merged =
    selectedOption && !filteredOptions.some((option) => String(option.id) === value)
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
        onPointerEnter={() => {
          if (selectOnly) setOpened(true);
        }}
        onChange={(event) => {
          const selectedValue = event.target.value;
          onChange(selectedValue);
          onSelectOption?.(
            merged.find((option) => String(option.id) === selectedValue) ??
              null,
          );
        }}
        aria-busy={remote.isFetching || allOptions.isFetching}
      >
        <option value="">{emptyLabel}</option>
        {merged.map((option) => (
          <option key={option.id} value={option.id}>
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
