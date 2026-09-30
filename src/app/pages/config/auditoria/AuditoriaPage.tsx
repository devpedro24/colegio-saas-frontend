import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { api } from "@/lib/api/client";
import { PageTitle } from "@/_metronic/layout/core";
import { Modal } from "react-bootstrap";
import { Content } from "@/_metronic/layout/components/content";

type Entry = {
  id: string;
  actor_email: string | null;
  actor_rol: string | null;
  impersonated_by?: string | null;
  accion: string;
  recurso: string;
  recurso_id: string | null;
  created_at: string;
  ip: string | null;
  valor_previo: unknown;
  valor_nuevo: unknown;
  motivo: string | null;
};
const initial = {
  colegio_slug: "",
  actor: "",
  rol: "",
  accion: "",
  recurso: "",
  desde: "",
  hasta: "",
};

export default function AuditoriaPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id }, { name: "" });
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Entry | null>(null);
  const tenants = useQuery({
    queryKey: ["audit-tenants"],
    queryFn: () =>
      api.get<{ data: { slug: string; name: string }[] }>(
        "/platform/auditoria/colegios",
      ),
  });
  const params = new URLSearchParams({ page: String(page), per_page: "25" });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const logs = useQuery({
    queryKey: ["audit", filters, page],
    queryFn: () =>
      api.get<{
        data: Entry[];
        current_page: number;
        last_page: number;
        total: number;
      }>(`/platform/auditoria?${params}`),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...draft });
    setPage(1);
  }
  return (
    <>
      <PageTitle>{t("audit.title")}</PageTitle>
      <Content>
        <div className="card mb-6">
          <div className="card-body">
            <h2>{t("audit.title")}</h2>
            <p className="text-muted">{t("audit.description")}</p>
            <form onSubmit={submit} className="row g-4">
              <div className="col-md-4">
                <label htmlFor="audit-tenant" className="form-label">
                  {t("audit.school")}
                </label>
                <select
                  id="audit-tenant"
                  className="form-select"
                  value={draft.colegio_slug}
                  onChange={(e) =>
                    setDraft({ ...draft, colegio_slug: e.target.value })
                  }
                >
                  <option value="">{t("audit.platform")}</option>
                  {tenants.data?.data.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {(
                ["actor", "rol", "accion", "recurso", "desde", "hasta"] as const
              ).map((field) => (
                <div className="col-md-4" key={field}>
                  <label className="form-label" htmlFor={`audit-${field}`}>
                    {t(`audit.${field}`)}
                  </label>
                  <input
                    id={`audit-${field}`}
                    type={
                      field === "desde" || field === "hasta" ? "date" : "text"
                    }
                    className="form-control"
                    value={draft[field]}
                    onChange={(e) =>
                      setDraft({ ...draft, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
              <div className="col-12 d-flex gap-3">
                <button className="btn btn-primary" disabled={logs.isFetching}>
                  {t("audit.filter")}
                </button>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => {
                    setDraft(initial);
                    setFilters(initial);
                    setPage(1);
                  }}
                >
                  {t("audit.clear")}
                </button>
              </div>
            </form>
          </div>
        </div>
        {(logs.error || tenants.error) && (
          <div className="alert alert-danger" role="alert">
            {(logs.error || tenants.error)?.message}
          </div>
        )}
        <div className="card">
          <div className="card-body">
            {logs.isLoading ? (
              <div role="status">{t("common.pleaseWait")}</div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-row-dashed align-middle gs-3 gy-4">
                    <thead>
                      <tr>
                        {[
                          "date",
                          "actor",
                          "rol",
                          "accion",
                          "recurso",
                          "details",
                        ].map((key) => (
                          <th key={key}>{t(`audit.${key}`)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.data?.data.map((entry) => (
                        <tr key={entry.id}>
                          <td className="text-nowrap">
                            {intl.formatDate(entry.created_at, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td>
                            {entry.actor_email || t("audit.system")}
                            {entry.impersonated_by && (
                              <div className="text-warning">
                                {entry.impersonated_by}
                              </div>
                            )}
                          </td>
                          <td>{entry.actor_rol || "â€”"}</td>
                          <td>
                            <span className="badge badge-light-primary">
                              {entry.accion}
                            </span>
                          </td>
                          <td>
                            {entry.recurso}{" "}
                            {entry.recurso_id && (
                              <small>#{entry.recurso_id}</small>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-light-primary"
                              onClick={() => setSelected(entry)}
                            >
                              {t("audit.details")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logs.data?.data.length === 0 && (
                  <p className="text-center text-muted py-10">
                    {t("audit.empty")}
                  </p>
                )}
                <div className="d-flex justify-content-between align-items-center mt-5">
                  <span>
                    {logs.data?.total ?? 0} {t("audit.records")}
                  </span>
                  <div className="d-flex gap-3 align-items-center">
                    <button
                      className="btn btn-light btn-sm"
                      disabled={page <= 1 || logs.isFetching}
                      onClick={() => setPage(page - 1)}
                      aria-label={t("audit.previous")}
                    >
                      â†
                    </button>
                    <span>
                      {page} / {logs.data?.last_page ?? 1}
                    </span>
                    <button
                      className="btn btn-light btn-sm"
                      disabled={
                        page >= (logs.data?.last_page ?? 1) || logs.isFetching
                      }
                      onClick={() => setPage(page + 1)}
                      aria-label={t("audit.next")}
                    >
                      â†’
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <Modal show={!!selected} onHide={() => setSelected(null)} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>
              {t("audit.details")} {selected && `#${selected.id}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selected && (
              <>
                <p>IP: {selected.ip || "?"}</p>
                {selected.motivo && <p>{selected.motivo}</p>}
                <div className="row g-5">
                  {(["valor_previo", "valor_nuevo"] as const).map((key) => (
                    <div className="col-lg-6" key={key}>
                      <h4>{t(`audit.${key}`)}</h4>
                      <pre
                        className="bg-light p-5 rounded"
                        style={{
                          maxHeight: 400,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {JSON.stringify(selected[key], null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-light" onClick={() => setSelected(null)}>
              {t("common.close")}
            </button>
          </Modal.Footer>
        </Modal>
      </Content>
    </>
  );
}
