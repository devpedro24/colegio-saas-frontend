import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { Modal } from "react-bootstrap";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { KTIcon } from "@/_metronic/helpers";
import { useToast } from "@/lib/ui/toast";
import { api } from "@/lib/api/client";
import { formatSchoolTime } from "@/lib/format/schoolTime";
import { PageTitle } from "@/_metronic/layout/core";
import { Content } from "@/_metronic/layout/components/content";
import { AcademicPageHeader } from "@/app/shared/components/AcademicPageHeader";
import { useAuthz } from "@/app/modules/auth/core/authz";
import { useImpersonation } from "@/app/modules/impersonation/impersonation.store";
import "./eventos.css";

type Group = { url_token: string; nombre: string; grado?: { nombre: string } };
type EventItem = {
  url_token: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  categoria: string;
  institucional: boolean;
  materia_token: string | null;
  grupo_tokens: string[];
  grupos: Group[];
  created_by_token: string;
  created_at: string;
  origen: "evento" | "aula";
  estado: "borrador" | "publicado";
  version: number;
  publicado_en: string | null;
  fecha_limite?: string | null;
  enviar_correo: boolean;
  zona_horaria?: string;
};
type Detail = EventItem & {
  puede_editar: boolean;
  correos?: Record<"pendiente" | "enviando" | "enviado" | "fallido" | "cancelado", number>;
  archivos: {
    url_token: string;
    nombre: string;
    mime: string;
    size: number;
    url: string;
  }[];
};
type Catalog = {
  es_rector: boolean;
  puede_crear: boolean;
  puede_institucional: boolean;
  docentes_cualquier_grupo: boolean;
  grupos: Group[];
  materias: { url_token: string; nombre: string }[];
  asignaciones: { grupo_token: string; materia_token: string }[];
};
type DaySummary = {fecha: string; total: number; titulo_unico: string | null;
  marcas: {categoria: string; estado: string; total: number}[]};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const categories = ["actividad", "reunion", "celebracion", "aviso"];
const colors: Record<string, string> = {
  actividad: "#7855c3",
  tarea: "#328ede",
  reunion: "#ef6059",
  celebracion: "#dfb800",
  aviso: "#39a58d",
};
const colorInk: Record<string, string> = {
  actividad: "#5c3f9c",
  tarea: "#1c5d97",
  reunion: "#a92f2b",
  celebracion: "#765b00",
  aviso: "#216f61",
};
const categoryBadgeStyle = (category: string) => ({
  backgroundColor: `${colors[category] ?? colors.actividad}24`,
  color: colorInk[category] ?? colorInk.actividad,
});
const groupLabel = (group: Group) => group.grado?.nombre ? `${group.grado.nombre} · ${group.nombre}` : group.nombre;

function dayDots(marks: DaySummary["marcas"], maximum: number) {
  const remaining = marks.map((mark) => ({...mark}));
  const dots: {categoria: string; estado: string}[] = [];
  while (dots.length < maximum && remaining.some((mark) => mark.total > 0)) {
    for (const mark of remaining) {
      if (mark.total <= 0 || dots.length >= maximum) continue;
      dots.push({categoria: mark.categoria, estado: mark.estado});
      mark.total--;
    }
  }
  return dots;
}

export default function EventosPage() {
  const { isPlatform } = useAuthz();
  const { activeColegio } = useImpersonation();
  if (isPlatform && !activeColegio) return <Navigate to="/dashboard" replace />;
  return <Calendar />;
}

function Calendar() {
  const intl = useIntl();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const t = (id: string) => intl.formatMessage({ id }, { name: "" });
  const client = useQueryClient();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [group, setGroup] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [day, setDay] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [dotCapacity, setDotCapacity] = useState(7);
  const [calendarHeight, setCalendarHeight] = useState(0);
  const calendarCard = useRef<HTMLDivElement>(null);
  const calendarGrid = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(() => {
    const token = params.get("evento");
    return token && /^[A-Za-z0-9_-]{24}$/.test(token) ? token : null;
  });
  const [sendMail, setSendMail] = useState(false);
  const [form, setForm] = useState<Partial<EventItem> | null>(null);
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [formGroups, setFormGroups] = useState<string[]>([]);
  const [institutional, setInstitutional] = useState(false);
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const catalog = useQuery({
    queryKey: ["eventos-catalogo"],
    queryFn: async () =>
      (await api.get<{ data: Catalog }>("/eventos/catalogo?opaque=1")).data,
  });
  const from = dateKey(month);
  const until = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const summary = useQuery({
    queryKey: ["eventos", "resumen", from, group, categoryFilter],
    queryFn: async () => (await api.get<{data: DaySummary[]}>(
      `/eventos/resumen?opaque=1&desde=${from}&hasta=${until}&grupo_token=${encodeURIComponent(group)}&categoria=${categoryFilter}`)).data,
    staleTime: Infinity, gcTime: 60 * 60_000,
  });
  const taskEvents = useQuery({
    queryKey: ["eventos", "tareas", from, group, categoryFilter],
    queryFn: async () => {
      if (categoryFilter && categoryFilter !== "tarea") return [];
      const all: EventItem[] = [];
      let page = 1;
      let lastPage = 1;
      do {
        const result = await api.get<{ data: EventItem[]; last_page: number }>(
          `/eventos/tareas?opaque=1&desde=${from}&hasta=${until}&grupo_token=${encodeURIComponent(group)}&page=${page}`,
        );
        all.push(...result.data);
        lastPage = result.last_page;
        page++;
      } while (page <= lastPage);
      return all;
    },
    staleTime: Infinity, gcTime: 60 * 60_000,
  });
  const feed = useInfiniteQuery({
    queryKey: ["eventos", "flujo", from, group, categoryFilter, day],
    initialPageParam: "",
    queryFn: async ({pageParam}) => api.get<{data: EventItem[]; next_cursor: string | null}>(
      `/eventos/flujo?opaque=1&desde=${from}&hasta=${until}&grupo_token=${encodeURIComponent(group)}&categoria=${categoryFilter}${day ? `&dia=${day}` : ""}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}&limite=${pageParam ? 10 : 50}`),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: Infinity, gcTime: 60 * 60_000,
  });
  useEffect(() => { setVisibleCount(50); }, [from, group, categoryFilter, day]);
  useEffect(() => {
    if (!calendarCard.current || !calendarGrid.current) return;
    const update = () => {
      const width = calendarGrid.current?.querySelector<HTMLElement>(".event-day")?.clientWidth ?? 0;
      if (width) setDotCapacity(Math.max(1, Math.floor((width - 24 - 34 + 6) / 18)));
      const height = calendarCard.current?.getBoundingClientRect().height ?? 0;
      if (height) setCalendarHeight(height);
    };
    const observer = new ResizeObserver(update);
    observer.observe(calendarCard.current);
    observer.observe(calendarGrid.current);
    update();
    return () => observer.disconnect();
  }, [summary.isLoading, taskEvents.isLoading]);
  const detail = useQuery({
    queryKey: ["evento", selected],
    enabled: selected !== null,
    refetchInterval: (query) => {
      const counts = query.state.data?.correos;
      return counts && (counts.pendiente + counts.enviando > 0) ? 15_000 : false;
    },
    queryFn: async () =>
      (await api.get<{ data: Detail }>(`/eventos/${encodeURIComponent(selected!)}?opaque=1`)).data,
  });
  const mutation = useMutation({
    mutationFn: async ({
      path,
      body,
      method = "post",
    }: {
      path: string;
      body?: unknown;
      method?: "post" | "put" | "delete";
    }) => (method === "delete" ? api.delete(path) : api[method](path, body)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["eventos"] });
      await client.invalidateQueries({ queryKey: ["eventos-catalogo"] });
      await client.invalidateQueries({ queryKey: ["evento", selected] });
      toast.success(t("events.actionDone"));
    },
    onError: (cause) => toast.error(cause.message),
  });
  const saveMutation = useMutation({
    mutationFn: async ({body, publish}: {body: unknown; publish: boolean}) => {
      const result = form?.url_token
        ? await api.put<{ data: EventItem }>(`/eventos/${encodeURIComponent(form.url_token)}?opaque=1`, body)
        : await api.post<{ data: EventItem }>("/eventos?opaque=1", body);
      // Conservar el selector si falla un adjunto: reintentar no duplica el evento.
      setForm(result.data);
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        await api.post(`/eventos/${encodeURIComponent(result.data.url_token)}/archivos?opaque=1`, body);
        setFiles((current) => current.filter((item) => item !== file));
      }
      if (publish && result.data.estado !== "publicado") {
        return (await api.post<{data: EventItem}>(`/eventos/${encodeURIComponent(result.data.url_token)}/publicar?opaque=1`, {version: result.data.version})).data;
      }
      return result.data;
    },
    onSuccess: async (result) => {
      setForm(null);
      setSelected(result.url_token);
      toast.success(t(result.estado === "publicado" ? "events.publishedSaved" : "events.draftSaved"));
      await client.invalidateQueries({ queryKey: ["eventos"] });
      await client.invalidateQueries({ queryKey: ["evento", result.url_token] });
    },
    onError: (cause) => { setError(cause.message); toast.error(cause.message); },
  });
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    first.setDate(first.getDate() - first.getDay());
    return Array.from(
      { length: 42 },
      (_, i) =>
        new Date(first.getFullYear(), first.getMonth(), first.getDate() + i),
    );
  }, [month]);
  const daySummaries = useMemo(() => {
    const result: Record<string, DaySummary> = {};
    for (const entry of summary.data ?? []) result[entry.fecha] = {...entry, marcas: entry.marcas.map((mark) => ({...mark}))};
    for (const task of taskEvents.data ?? []) {
      const entry = result[task.fecha] ??= {fecha: task.fecha, total: 0, titulo_unico: null, marcas: []};
      entry.total++;
      entry.titulo_unico = entry.total === 1 ? task.titulo : null;
      const mark = entry.marcas.find((item) => item.categoria === "tarea");
      if (mark) mark.total++;
      else entry.marcas.push({categoria: "tarea", estado: "publicado", total: 1});
    }
    return result;
  }, [summary.data, taskEvents.data]);
  const total = day ? (daySummaries[day]?.total ?? 0)
    : Object.values(daySummaries).reduce((sum, entry) => sum + entry.total, 0);
  const loaded = [...(feed.data?.pages.flatMap((page) => page.data) ?? []),
    ...(taskEvents.data ?? []).filter((task) => !day || task.fecha === day)]
    // El cursor del servidor usa created_at + id. El token opaco no refleja el id:
    // desempatar por token reordenaba los eventos anteriores al cargar otra página.
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const recent = loaded.slice(0, visibleCount);
  const canLoadMore = recent.length < total;
  async function loadMore() {
    if (feed.isFetchingNextPage) return;
    if (loaded.length < visibleCount + 10 && feed.hasNextPage) {
      const result = await feed.fetchNextPage();
      if (result.isError) return;
    }
    setVisibleCount((current) => current + 10);
  }
  function openForm(event?: EventItem) {
    setError("");
    setEventStartTime(event?.hora_inicio?.slice(0, 5) ?? "");
    setEventEndTime(event?.hora_fin?.slice(0, 5) ?? "");
    setForm(
      event ?? { fecha: day || dateKey(new Date()) },
    );
    setFormGroups(event?.grupo_tokens ?? []);
    setInstitutional(event?.institucional ?? false);
    setSubject(event?.materia_token ?? "");
    setFiles([]);
    setSendMail(event?.enviar_correo ?? false);
  }
  function openItem(item: EventItem) {
    if (item.origen === "aula") navigate(`/evaluacion/aula/recursos/${item.url_token}`);
    else setSelected(item.url_token);
  }
  function closeDetail() {
    setSelected(null); setConfirmDelete(false);
    if (params.has("evento")) setParams({}, {replace: true});
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const publish = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "publish";
    saveMutation.mutate({publish, body: {
      ...fields,
      institucional: institutional,
      grupo_tokens: institutional ? [] : formGroups,
      materia_token: institutional || !subject ? null : subject,
      hora_inicio: fields.hora_inicio || null,
      hora_fin: fields.hora_fin || null,
      enviar_correo: sendMail,
      ...(form?.version ? {version: form.version} : {}),
    }});
  }
  const allowedSubjects =
    catalog.data?.materias.filter(
      (item) =>
        catalog.data?.es_rector ||
        formGroups.every((token) =>
          catalog.data?.asignaciones.some(
            (a) => a.grupo_token === token && a.materia_token === item.url_token,
          ),
        ),
    ) ?? [];
  return (
    <>
      <PageTitle>{t("events.title")}</PageTitle>
      <Content>
        <div className="mb-7">
          <AcademicPageHeader title={t("events.title")} description={t("events.subtitle")}>
          {catalog.data?.puede_crear && (
            <button
              className="btn btn-primary rounded-pill px-6"
              onClick={() => openForm()}
            >
              + {t("events.new")}
            </button>
          )}
          </AcademicPageHeader>
        </div>
        {(summary.error || taskEvents.error || feed.error || catalog.error) && (
          <div role="alert" className="alert alert-danger">
            {(summary.error || taskEvents.error || feed.error || catalog.error)?.message}
          </div>
        )}
        {error && !form && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <div className="row g-6">
          <div className="col-xl-8">
            <div className="card" ref={calendarCard}>
              <div className="card-body p-5 p-lg-8">
                <div className="d-flex flex-wrap gap-3 align-items-center mb-6">
                  <h2 className="mb-0 me-auto">{t("events.calendar")}</h2>
                  <button
                    className="btn btn-icon btn-light btn-sm"
                    aria-label={t("events.previous")}
                    onClick={() => {
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      );
                      setDay("");
                    }}
                  >
                    <KTIcon iconName="left" className="fs-3" />
                  </button>
                  <input
                    aria-label={t("events.month")}
                    type="month"
                    className="form-control w-auto"
                    value={from.slice(0, 7)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [year, nextMonth] = e.target.value
                          .split("-")
                          .map(Number);
                        setMonth(new Date(year, nextMonth - 1, 1));
                        setDay("");
                      }
                    }}
                  />
                  <button
                    className="btn btn-icon btn-light btn-sm"
                    aria-label={t("events.next")}
                    onClick={() => {
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      );
                      setDay("");
                    }}
                  >
                    <KTIcon iconName="right" className="fs-3" />
                  </button>
                </div>
                <div className="d-flex gap-3 flex-wrap mb-6">
                  <select
                    aria-label={t("schedule.group")}
                    className="form-select w-auto"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    <option value="">{t("schedule.allGroups")}</option>
                    {catalog.data?.grupos.map((item) => (
                      <option key={item.url_token} value={item.url_token}>
                        {item.grado?.nombre} · {item.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t("events.filterCategory")}
                    className="form-select w-auto"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">{t("events.allCategories")}</option>
                    {[...categories, "tarea"].map((category) => (
                      <option key={category} value={category}>{t(`events.category.${category}`)}</option>
                    ))}
                  </select>
                  {day && (
                    <button
                      className="btn btn-light"
                      onClick={() => setDay("")}
                    >
                      {t("events.clearDay")}
                    </button>
                  )}
                </div>
                {(summary.isLoading || taskEvents.isLoading) ? (
                  <p role="status">{t("common.pleaseWait")}</p>
                ) : (
                  <div className="event-calendar-grid" ref={calendarGrid}>
                    {Array.from({ length: 7 }, (_, i) => (
                      <div key={i} className="event-weekday">
                        {intl.formatDate(new Date(2026, 8, 20 + i), {
                          weekday: "short",
                        })}
                      </div>
                    ))}
                    {cells.map((date) => {
                      const key = dateKey(date);
                      const entry = daySummaries[key];
                      const dots = dayDots(entry?.marcas ?? [], dotCapacity);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`event-day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${key === dateKey(new Date()) ? "today" : ""} ${key === day ? "selected" : ""}`}
                          onClick={() => {
                            if (date.getMonth() !== month.getMonth()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                            setDay(key);
                          }}
                          aria-label={`${intl.formatDate(date, { dateStyle: "long" })}: ${entry?.total ?? 0} ${t("events.title")}`}
                        >
                          <span>{date.getDate()}</span>
                          <div className="event-dots">
                            {dots.map((item, index) => (
                              <i
                                key={`${item.categoria}-${item.estado}-${index}`}
                                className={item.estado === "borrador" ? "event-dot-draft" : ""}
                                style={{ background: item.estado === "borrador" ? "#ad7600" : colors[item.categoria] }}
                              />
                            ))}
                            {(entry?.total ?? 0) > dots.length && <b className="event-more-count">+{entry.total - dots.length}</b>}
                          </div>
                          {entry?.total === 1 && <small>{entry.titulo_unico}</small>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="d-flex gap-4 flex-wrap mt-6">
                  {[...categories, "tarea"].map((category) => (
                    <span className="small text-muted" key={category}>
                      <i
                        className="event-legend-dot me-2"
                        style={{ background: colors[category] }}
                      />
                      {t(`events.category.${category}`)}
                    </span>
                  ))}
                  <span className="small text-muted"><i className="event-legend-dot event-dot-draft me-2" />{t("events.state.borrador")}</span>
                </div>
              </div>
            </div>
          </div>
          <aside className="col-xl-4">
            <div className="card event-recent-card" style={calendarHeight ? (day ? {maxHeight: calendarHeight} : {height: calendarHeight}) : undefined}>
              <div className="card-header align-items-center">
                <h3 className="mb-0">
                  {day
                    ? intl.formatDate(`${day}T12:00:00`, {
                        dateStyle: "medium",
                      })
                    : t("events.recent")}
                </h3>
                <span className="badge badge-light-primary">
                  {total}
                </span>
              </div>
              <div className="card-body event-recent">
                {feed.isLoading && <p role="status">{t("common.pleaseWait")}</p>}
                {!feed.isLoading && !recent.length && (
                  <p className="text-muted text-center py-10">
                    {t("events.empty")}
                  </p>
                )}
                {recent.map((item) => (
                  <button
                    key={item.url_token}
                    className="event-preview"
                    style={{ borderLeft: `4px solid ${colors[item.categoria] ?? colors.actividad}` }}
                    onClick={() => openItem(item)}
                  >
                    <span className="badge mb-3" style={categoryBadgeStyle(item.categoria)}>
                      {t(item.origen === "aula" ? "events.classroomTask" : `events.category.${item.categoria}`)}
                    </span>
                    {item.estado === "borrador" && <span className="badge badge-light-warning ms-2">{t("events.state.borrador")}</span>}
                    <h4>{item.titulo}</h4>
                    <div className="text-primary fw-semibold mb-3">
                      {intl.formatDate(`${item.fecha}T12:00:00`, {
                        dateStyle: "long",
                      })}
                    </div>
                    <p className="text-body">
                      {item.descripcion.slice(0, 180)}
                      {item.descripcion.length > 180 ? "…" : ""}
                    </p>
                    <small>
                      {item.institucional
                        ? t("events.wholeSchool")
                        : item.grupos.map(groupLabel).join(", ")}
                    </small>
                    {item.estado === "borrador" && <small className="d-block text-warning mt-2">{t("events.draftPrivate")}</small>}
                    {item.origen === "aula" && <small className="d-block text-muted mt-2">{t(item.fecha_limite ? "events.taskDue" : "events.taskPublished")}</small>}
                  </button>
                ))}
                {canLoadMore && <button className="btn btn-light-primary w-100" type="button" disabled={feed.isFetchingNextPage}
                  onClick={() => void loadMore()}>{t(feed.isFetchingNextPage ? "common.pleaseWait" : "events.loadMore")}</button>}
              </div>
            </div>
          </aside>
        </div>
      </Content>
      <Modal
        className="event-dialog"
        show={selected !== null && form === null}
        onHide={closeDetail}
        centered
        size="lg"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>{detail.data?.titulo ?? t("events.title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail.isLoading && <p>{t("common.pleaseWait")}</p>}
          {detail.error && (
            <div className="alert alert-danger">{detail.error.message}</div>
          )}
          {detail.data && (
            <>
              <div className="d-flex flex-wrap gap-3 align-items-center mb-4">
                <span className={`badge ${detail.data.estado === "borrador" ? "badge-light-warning" : "badge-light-success"}`}>{t(`events.state.${detail.data.estado || "publicado"}`)}</span>
                <span className="badge" style={categoryBadgeStyle(detail.data.categoria)}>{t(`events.category.${detail.data.categoria}`)}</span>
                {detail.data.publicado_en && <small className="text-muted">{t("events.publishedOn")}: {intl.formatDate(detail.data.publicado_en, {timeZone: detail.data.zona_horaria || "America/Bogota", dateStyle: "medium", timeStyle: "short"})}</small>}
              </div>
              <p className="text-primary fw-semibold">
                {intl.formatDate(`${detail.data.fecha}T12:00:00`, {
                  dateStyle: "full",
                })}{" "}
                {detail.data.hora_inicio && formatSchoolTime(detail.data.hora_inicio)}{" "}
                {detail.data.hora_fin &&
                  `– ${formatSchoolTime(detail.data.hora_fin)}`}
              </p>
              <p>
                {detail.data.institucional
                  ? t("events.wholeSchool")
                  : detail.data.grupos.map(groupLabel).join(", ")}
              </p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {detail.data.descripcion}
              </p>
              <div className="d-flex flex-wrap gap-4">
                {detail.data.archivos.map((file) => (
                  <a
                    className="card border p-3 event-attachment"
                    key={file.url_token}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {file.mime.startsWith("image/") && (
                      <img alt={file.nombre} src={file.url} loading="lazy" />
                    )}
                    <span>{file.nombre}</span>
                    <small className="text-muted">
                      {Math.ceil(file.size / 1024)} KB
                    </small>
                  </a>
                ))}
              </div>
              {detail.data.puede_editar && detail.data.enviar_correo && detail.data.correos && <section className="event-mail-status mt-6" aria-label={t("events.mailStatus")}>
                <h4>{t("events.mailStatus")}</h4>
                <p className="text-muted fs-7">{t("events.mailStatusHelp")}</p>
                <div className="d-flex flex-wrap gap-3">
                  {Object.entries(detail.data.correos).map(([state, count]) => <span key={state} className={`badge ${state === "fallido" ? "badge-light-danger" : state === "enviado" ? "badge-light-success" : "badge-light-warning"}`}>{t(`events.mail.${state}`)}: {count}</span>)}
                </div>
                {detail.data.correos.fallido > 0 && <button className="btn btn-light-primary btn-sm mt-4" disabled={mutation.isPending}
                  onClick={() => mutation.mutate({path: `/eventos/${selected}/correos/reintentar?opaque=1`})}>{t("events.retryMail")}</button>}
              </section>}
            </>
          )}
          {confirmDelete && (
            <div className="alert alert-warning mt-5">
              {t("events.confirmDelete")}
              <button
                className="btn btn-danger btn-sm ms-3"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate(
                    { path: `/eventos/${encodeURIComponent(selected!)}?opaque=1`, method: "delete" },
                    {
                      onSuccess: () => {
                        closeDetail();
                      },
                    },
                  )
                }
              >
                {t("common.delete")}
              </button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {detail.data?.puede_editar && (
            <>
              <button
                className="btn btn-light-danger me-auto"
                onClick={() => setConfirmDelete(true)}
              >
                {t("common.delete")}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => openForm(detail.data)}
              >
                {t("common.edit")}
              </button>
            </>
          )}
          <button className="btn btn-light" onClick={closeDetail}>
            {t("common.close")}
          </button>
        </Modal.Footer>
      </Modal>
      <Modal
        className="event-dialog"
        show={form !== null}
        onHide={() => {
          if (!saveMutation.isPending) setForm(null);
        }}
        centered
        size="lg"
        scrollable
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t(form?.url_token ? "events.edit" : "events.new")}
          </Modal.Title>
        </Modal.Header>
        <form onSubmit={save}>
          <Modal.Body>
            <p className="text-muted">{t("events.formHelp")}</p>
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            <label htmlFor="event-title" className="form-label required">
              {t("events.eventTitle")}
            </label>
            <input
              id="event-title"
              name="titulo"
              className="form-control mb-5"
              maxLength={180}
              required
              defaultValue={form?.titulo ?? ""}
            />
            <div className="row g-4 mb-5">
              <div className="col-md-6">
                <label htmlFor="event-date" className="form-label required">
                  {t("events.date")}
                </label>
                <input
                  id="event-date"
                  type="date"
                  name="fecha"
                  className="form-control"
                  required
                  defaultValue={form?.fecha ?? ""}
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="event-category" className="form-label required">
                  {t("events.category")}
                </label>
                <select
                  id="event-category"
                  name="categoria"
                  required
                  className="form-select"
                  defaultValue={form?.categoria ?? ""}
                >
                  <option value="" disabled>{t("events.selectType")}</option>
                  {categories.map((key) => (
                    <option key={key} value={key}>
                      {t(`events.category.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label htmlFor="event-start" className="form-label">
                  {t("events.start")} {t("common.field.optional")}
                </label>
                <input
                  id="event-start"
                  type="time"
                  name="hora_inicio"
                  className="form-control"
                  value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label htmlFor="event-end" className={eventStartTime ? "form-label required" : "form-label"}>
                  {t("events.end")} {!eventStartTime && t("common.field.optional")}
                </label>
                <input
                  id="event-end"
                  type="time"
                  name="hora_fin"
                  required={Boolean(eventStartTime)}
                  className="form-control"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                />
              </div>
            </div>
            {catalog.data?.puede_institucional && (
              <label className="form-check form-switch mb-5">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={institutional}
                  disabled={form?.estado === "publicado"}
                  onChange={(e) => setInstitutional(e.target.checked)}
                />
                <span className="form-check-label">
                  {t("events.wholeSchool")}
                </span>
              </label>
            )}
            {!institutional && (
              <>
                <fieldset className="mb-5">
                  <legend className="fs-6 fw-semibold required">
                    {t("events.groups")}
                  </legend>
                  <div className="event-group-picker">
                    {catalog.data?.grupos.map((item) => (
                      <label className="form-check" key={item.url_token}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={formGroups.includes(item.url_token)}
                          disabled={form?.estado === "publicado"}
                          onChange={(e) => {
                            setSubject("");
                            setFormGroups(
                              e.target.checked
                                ? [...formGroups, item.url_token]
                                : formGroups.filter((token) => token !== item.url_token),
                            );
                          }}
                        />
                        <span className="form-check-label">
                          {item.grado?.nombre} · {item.nombre}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor="event-subject" className="form-label">
                  {t("schedule.subject")} {t("common.field.optional")}
                </label>
                <select
                  id="event-subject"
                  className="form-select mb-5"
                  value={subject}
                  disabled={form?.estado === "publicado"}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">{t("events.optionalSubject")}</option>
                  {allowedSubjects.map((item) => (
                    <option key={item.url_token} value={item.url_token}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="event-description" className="form-label required">
              {t("events.description")}
            </label>
            <textarea
              id="event-description"
              name="descripcion"
              className="form-control mb-5"
              rows={5}
              maxLength={10000}
              required
              defaultValue={form?.descripcion ?? ""}
            />
            <label htmlFor="event-files" className="form-label">
              {t("events.files")}
            </label>
            <input
              id="event-files"
              type="file"
              className="form-control"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.txt"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <small className="text-muted d-block mt-2">
              {t("events.fileHelp")}
            </small>
            <div>
              {files.map((file) => (
                <span className="badge badge-light m-1" key={file.name}>
                  {file.name}
                </span>
              ))}
            </div>
            <div className="event-mail-status mt-6">
              <label className="form-check form-switch d-flex align-items-center gap-3 mb-3">
                <input type="checkbox" className="form-check-input m-0" checked={sendMail} disabled={form?.estado === "publicado"}
                  onChange={event => setSendMail(event.target.checked)} />
                <span className="form-check-label fw-semibold">{t("events.sendMail")}</span>
              </label>
              <p className="text-muted mb-0">{t(institutional ? "events.mailWholeSchool" : "events.mailGroups")}</p>
              <p className="text-muted mt-2 mb-0">{t(form?.estado === "publicado" ? "events.publishedScopeLocked" : "events.mailHelp")}</p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-light"
              disabled={saveMutation.isPending}
              onClick={() => setForm(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              className={form?.estado === "publicado" ? "btn btn-primary" : "btn btn-light-primary"}
              type="submit"
              value="save"
              disabled={
                saveMutation.isPending ||
                (!institutional && formGroups.length === 0) ||
                files.length > 10
              }
            >
              {t(saveMutation.isPending ? "common.pleaseWait" : form?.estado === "publicado" ? "common.save" : "events.saveDraft")}
            </button>
            {form?.estado !== "publicado" && <button type="submit" value="publish" className="btn btn-primary"
              disabled={saveMutation.isPending || (!institutional && !formGroups.length) || files.length > 10}>
              {t(saveMutation.isPending ? "common.pleaseWait" : "events.publish")}
            </button>}
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
}
