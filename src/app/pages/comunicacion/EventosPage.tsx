import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { Modal } from "react-bootstrap";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import { PageTitle } from "@/_metronic/layout/core";
import { Content } from "@/_metronic/layout/components/content";
import { useAuthz } from "@/app/modules/auth/core/authz";
import { useImpersonation } from "@/app/modules/impersonation/impersonation.store";
import "./eventos.css";

type Group = { id: number; nombre: string; grado?: { nombre: string } };
type EventItem = {
  id: number;
  titulo: string;
  descripcion: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  categoria: string;
  institucional: boolean;
  materia_id: number | null;
  grupos: Group[];
  created_by: number;
  created_at: string;
};
type Detail = EventItem & {
  puede_editar: boolean;
  archivos: {
    id: number;
    nombre: string;
    mime: string;
    size: number;
    url: string;
  }[];
};
type Catalog = {
  es_rector: boolean;
  puede_crear: boolean;
  docentes_cualquier_grupo: boolean;
  grupos: Group[];
  materias: { id: number; nombre: string }[];
  asignaciones: { grupo_id: number; materia_id: number }[];
};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const categories = ["actividad", "tarea", "reunion", "celebracion", "aviso"];
const colors: Record<string, string> = {
  actividad: "#7855c3",
  tarea: "#328ede",
  reunion: "#ef6059",
  celebracion: "#dfb800",
  aviso: "#39a58d",
};

export default function EventosPage() {
  const { isPlatform } = useAuthz();
  const { activeColegio } = useImpersonation();
  if (isPlatform && !activeColegio) return <Navigate to="/dashboard" replace />;
  return <Calendar />;
}

function Calendar() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id }, { name: "" });
  const client = useQueryClient();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [group, setGroup] = useState("");
  const [day, setDay] = useState("");
  const [list, setList] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<EventItem> | null>(null);
  const [formGroups, setFormGroups] = useState<number[]>([]);
  const [institutional, setInstitutional] = useState(false);
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const catalog = useQuery({
    queryKey: ["eventos-catalogo"],
    queryFn: async () =>
      (await api.get<{ data: Catalog }>("/eventos/catalogo")).data,
  });
  const from = dateKey(month);
  const until = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const events = useQuery({
    queryKey: ["eventos", from, group],
    queryFn: async () => {
      const all: EventItem[] = [];
      let page = 1;
      let lastPage = 1;
      do {
        const result = await api.get<{ data: EventItem[]; last_page: number }>(
          `/eventos?desde=${from}&hasta=${until}&grupo_id=${group}&page=${page}`,
        );
        all.push(...result.data);
        lastPage = result.last_page;
        page++;
      } while (page <= lastPage);
      return all;
    },
  });
  const detail = useQuery({
    queryKey: ["evento", selected],
    enabled: selected !== null,
    queryFn: async () =>
      (await api.get<{ data: Detail }>(`/eventos/${selected}`)).data,
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
    },
    onError: (cause) => setError(cause.message),
  });
  const saveMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const result = form?.id
        ? await api.put<{ data: EventItem }>(`/eventos/${form.id}`, body)
        : await api.post<{ data: EventItem }>("/eventos", body);
      // Conservar el id si falla un adjunto: reintentar no duplica el evento.
      setForm(result.data);
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        await api.post(`/eventos/${result.data.id}/archivos`, body);
        setFiles((current) => current.filter((item) => item !== file));
      }
      return result.data;
    },
    onSuccess: async (result) => {
      setForm(null);
      setSelected(result.id);
      setNotice(t("events.saved"));
      await client.invalidateQueries({ queryKey: ["eventos"] });
      await client.invalidateQueries({ queryKey: ["evento", result.id] });
    },
    onError: (cause) => setError(cause.message),
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
  const visible = (events.data ?? []).filter(
    (item) => !day || item.fecha === day,
  );
  const recent = [...visible].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  function openForm(event?: EventItem) {
    setError("");
    setForm(
      event ?? { fecha: day || dateKey(new Date()), categoria: "actividad" },
    );
    setFormGroups(event?.grupos.map((item) => item.id) ?? []);
    setInstitutional(event?.institucional ?? false);
    setSubject(String(event?.materia_id ?? ""));
    setFiles([]);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    saveMutation.mutate({
      ...fields,
      institucional: institutional,
      grupo_ids: institutional ? [] : formGroups,
      materia_id: institutional || !subject ? null : Number(subject),
      hora_inicio: fields.hora_inicio || null,
      hora_fin: fields.hora_fin || null,
    });
  }
  const allowedSubjects =
    catalog.data?.materias.filter(
      (item) =>
        catalog.data?.es_rector ||
        catalog.data?.docentes_cualquier_grupo ||
        formGroups.every((id) =>
          catalog.data?.asignaciones.some(
            (a) => a.grupo_id === id && a.materia_id === item.id,
          ),
        ),
    ) ?? [];
  return (
    <>
      <PageTitle>{t("events.title")}</PageTitle>
      <Content>
        <div className="d-flex flex-wrap gap-4 align-items-center justify-content-between mb-7">
          <div>
            <h1 className="fw-bolder mb-2">{t("events.title")}</h1>
            <p className="text-muted mb-0">{t("events.subtitle")}</p>
          </div>
          {catalog.data?.puede_crear && (
            <button
              className="btn btn-primary rounded-pill px-6"
              onClick={() => openForm()}
            >
              + {t("events.new")}
            </button>
          )}
        </div>
        {(events.error || catalog.error) && (
          <div role="alert" className="alert alert-danger">
            {(events.error || catalog.error)?.message}
          </div>
        )}
        {notice && (
          <div role="status" className="alert alert-success">
            {notice}
            <button
              className="btn-close float-end"
              aria-label={t("common.close")}
              onClick={() => setNotice("")}
            />
          </div>
        )}
        {catalog.data?.es_rector && (
          <details className="card mb-5">
            <summary className="p-5 fw-semibold">{t("events.policy")}</summary>
            <div className="px-5 pb-5">
              <label className="form-check form-switch">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={catalog.data.docentes_cualquier_grupo}
                  disabled={mutation.isPending}
                  onChange={(e) =>
                    mutation.mutate({
                      path: "/eventos/configuracion",
                      method: "put",
                      body: { docentes_cualquier_grupo: e.target.checked },
                    })
                  }
                />
                <span className="form-check-label">
                  {t("events.policyAny")}
                </span>
              </label>
              <p className="text-muted mt-3 mb-0">{t("events.policyHelp")}</p>
            </div>
          </details>
        )}
        {error && !form && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <div className="row g-6">
          <div className="col-xl-8">
            <div className="card h-100">
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
                    ←
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
                    →
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
                      <option key={item.id} value={item.id}>
                        {item.grado?.nombre} · {item.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-light-primary"
                    onClick={() => {
                      setDay("");
                      setList(!list);
                    }}
                  >
                    {t(list ? "events.calendar" : "events.viewAll")}
                  </button>
                  {day && (
                    <button
                      className="btn btn-light"
                      onClick={() => setDay("")}
                    >
                      {t("events.clearDay")}
                    </button>
                  )}
                </div>
                {events.isLoading ? (
                  <p role="status">{t("common.pleaseWait")}</p>
                ) : list ? (
                  <div>
                    {visible.map((item) => (
                      <button
                        className="event-list-row"
                        key={item.id}
                        onClick={() => setSelected(item.id)}
                      >
                        <span className="badge badge-light-primary">
                          {item.fecha}
                        </span>
                        <strong>{item.titulo}</strong>
                        <span>
                          {item.grupos.map((g) => g.nombre).join(", ")}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="event-calendar-grid">
                    {Array.from({ length: 7 }, (_, i) => (
                      <div key={i} className="event-weekday">
                        {intl.formatDate(new Date(2026, 8, 20 + i), {
                          weekday: "short",
                        })}
                      </div>
                    ))}
                    {cells.map((date) => {
                      const key = dateKey(date);
                      const entries = (events.data ?? []).filter(
                        (item) => item.fecha === key,
                      );
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`event-day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${key === dateKey(new Date()) ? "today" : ""} ${key === day ? "selected" : ""}`}
                          onClick={() => setDay(key)}
                          aria-label={`${intl.formatDate(date, { dateStyle: "long" })}: ${entries.length} ${t("events.title")}`}
                        >
                          <span>{date.getDate()}</span>
                          <div className="event-dots">
                            {entries.slice(0, 3).map((item) => (
                              <i
                                key={item.id}
                                style={{ background: colors[item.categoria] }}
                              />
                            ))}
                          </div>
                          {entries.length > 0 && (
                            <small>
                              {entries.length > 3
                                ? `+${entries.length - 3}`
                                : entries[0].titulo}
                            </small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="d-flex gap-4 flex-wrap mt-6">
                  {categories.map((category) => (
                    <span className="small text-muted" key={category}>
                      <i
                        className="event-legend-dot me-2"
                        style={{ background: colors[category] }}
                      />
                      {t(`events.category.${category}`)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <aside className="col-xl-4">
            <div className="card">
              <div className="card-header align-items-center">
                <h3 className="mb-0">
                  {day
                    ? intl.formatDate(`${day}T12:00:00`, {
                        dateStyle: "medium",
                      })
                    : t("events.recent")}
                </h3>
                <span className="badge badge-light-primary">
                  {recent.length}
                </span>
              </div>
              <div className="card-body event-recent">
                {!recent.length && (
                  <p className="text-muted text-center py-10">
                    {t("events.empty")}
                  </p>
                )}
                {recent.map((item) => (
                  <button
                    key={item.id}
                    className="event-preview"
                    onClick={() => setSelected(item.id)}
                  >
                    <span className="badge badge-light-primary mb-3">
                      {t(`events.category.${item.categoria}`)}
                    </span>
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
                        : item.grupos.map((g) => g.nombre).join(", ")}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Content>
      <Modal
        show={selected !== null && form === null}
        onHide={() => {
          setSelected(null);
          setConfirmDelete(false);
        }}
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
              <p className="text-primary fw-semibold">
                {intl.formatDate(`${detail.data.fecha}T12:00:00`, {
                  dateStyle: "full",
                })}{" "}
                {detail.data.hora_inicio?.slice(0, 5)}{" "}
                {detail.data.hora_fin &&
                  `– ${detail.data.hora_fin.slice(0, 5)}`}
              </p>
              <p>
                {detail.data.institucional
                  ? t("events.wholeSchool")
                  : detail.data.grupos.map((g) => g.nombre).join(", ")}
              </p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {detail.data.descripcion}
              </p>
              <div className="d-flex flex-wrap gap-4">
                {detail.data.archivos.map((file) => (
                  <a
                    className="card border p-3 event-attachment"
                    key={file.id}
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
                    { path: `/eventos/${selected}`, method: "delete" },
                    {
                      onSuccess: () => {
                        setSelected(null);
                        setConfirmDelete(false);
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
          <button className="btn btn-light" onClick={() => setSelected(null)}>
            {t("common.close")}
          </button>
        </Modal.Footer>
      </Modal>
      <Modal
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
            {t(form?.id ? "events.edit" : "events.new")}
          </Modal.Title>
        </Modal.Header>
        <form onSubmit={save}>
          <Modal.Body>
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
                <label htmlFor="event-category" className="form-label">
                  {t("events.category")}
                </label>
                <select
                  id="event-category"
                  name="categoria"
                  className="form-select"
                  defaultValue={form?.categoria ?? "actividad"}
                >
                  {categories.map((key) => (
                    <option key={key} value={key}>
                      {t(`events.category.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label htmlFor="event-start" className="form-label">
                  {t("events.start")}
                </label>
                <input
                  id="event-start"
                  type="time"
                  name="hora_inicio"
                  className="form-control"
                  defaultValue={form?.hora_inicio?.slice(0, 5) ?? ""}
                />
              </div>
              <div className="col-6">
                <label htmlFor="event-end" className="form-label">
                  {t("events.end")}
                </label>
                <input
                  id="event-end"
                  type="time"
                  name="hora_fin"
                  className="form-control"
                  defaultValue={form?.hora_fin?.slice(0, 5) ?? ""}
                />
              </div>
            </div>
            {catalog.data?.es_rector && (
              <label className="form-check form-switch mb-5">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={institutional}
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
                  <legend className="fs-6 fw-semibold">
                    {t("events.groups")}
                  </legend>
                  <div className="event-group-picker">
                    {catalog.data?.grupos.map((item) => (
                      <label className="form-check" key={item.id}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={formGroups.includes(item.id)}
                          onChange={(e) => {
                            setSubject("");
                            setFormGroups(
                              e.target.checked
                                ? [...formGroups, item.id]
                                : formGroups.filter((id) => id !== item.id),
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
                  {t("schedule.subject")}
                </label>
                <select
                  id="event-subject"
                  className="form-select mb-5"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">{t("events.optionalSubject")}</option>
                  {allowedSubjects.map((item) => (
                    <option key={item.id} value={item.id}>
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
              className="btn btn-primary"
              disabled={
                saveMutation.isPending ||
                (!institutional && formGroups.length === 0) ||
                files.length > 10
              }
            >
              {t(saveMutation.isPending ? "common.pleaseWait" : "common.save")}
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
}
