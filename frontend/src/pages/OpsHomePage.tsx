import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = "http://localhost:8080/api";

type ProjectSummary = { id: string; name: string };
type PublishTarget = "travefy" | "wetu" | "file";

export function OpsHomePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [publishes, setPublishes] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDestination, setNewProjectDestination] = useState("");
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [projectActionMenuId, setProjectActionMenuId] = useState<string | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const activeProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  async function loadProjects(preferredId?: string) {
    setProjectsLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as ProjectSummary[];
      const list = Array.isArray(data) ? data : [];
      setProjects(list);
      if (preferredId) {
        setProjectId(preferredId);
        return;
      }
      if (projectId && !list.some((p) => p.id === projectId)) {
        setProjectId(list[0]?.id ?? "");
        return;
      }
      if (!projectId && list[0]) {
        setProjectId(list[0].id);
      }
    } catch (e) {
      setProjects([]);
      setProjectsLoadError(e instanceof Error ? e.message : "无法加载项目列表（后端是否在 http://localhost:8080 运行？）");
    }
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) {
      return;
    }
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProjectName.trim(),
        destination: newProjectDestination.trim() || undefined
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(err);
      return;
    }
    const created = await res.json();
    setNewProjectName("");
    setNewProjectDestination("");
    await loadProjects(created.id);
    await loadDetail(created.id);
    await loadJobs(created.id);
  }

  async function loadDetail(id: string) {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    const data = await res.json();
    setDetail(data);
    setPublishes(data.publishes ?? []);
  }

  async function loadJobs(id: string) {
    const res = await fetch(`${API_BASE}/projects/${id}/research-jobs`);
    setJobs(await res.json());
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setDetail(null);
      setJobs([]);
      setPublishes([]);
      return;
    }
    loadDetail(projectId);
    loadJobs(projectId);
  }, [projectId]);

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !chatText.trim()) {
      return;
    }
    await fetch(`${API_BASE}/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chatText })
    });
    setChatText("");
    await loadDetail(projectId);
    await loadJobs(projectId);
  }

  async function uploadProposal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) {
      return;
    }
    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>("input[type=file]");
    if (!input?.files?.[0]) {
      return;
    }
    const payload = new FormData();
    payload.append("proposal", input.files[0]);
    await fetch(`${API_BASE}/projects/${projectId}/proposal`, { method: "POST", body: payload });
    form.reset();
    await loadDetail(projectId);
    await loadJobs(projectId);
  }

  async function addBudgetLine() {
    if (!projectId) {
      return;
    }
    await fetch(`${API_BASE}/projects/${projectId}/budget/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "activity",
        name: "Campus Workshop",
        amount: 3200,
        currency: "CNY"
      })
    });
    await loadDetail(projectId);
  }

  async function addLogistics() {
    if (!projectId) {
      return;
    }
    await fetch(`${API_BASE}/projects/${projectId}/logistics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "vehicle",
        title: "Reserve coach bus for Day 2",
        owner: "ops-team"
      })
    });
    await loadDetail(projectId);
  }

  async function addRunbook() {
    if (!projectId) {
      return;
    }
    await fetch(`${API_BASE}/projects/${projectId}/runbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "pretrip", title: "Verify insurance records" })
    });
    await loadDetail(projectId);
  }

  async function renameProject(projectIdToRename: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return false;
    }
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectIdToRename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed })
    });
    if (!res.ok) {
      return false;
    }
    await loadProjects();
    return true;
  }

  async function deleteProjectById(id: string) {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      return false;
    }
    await loadProjects();
    return true;
  }

  async function publish(target: PublishTarget) {
    if (!projectId) {
      return;
    }
    await fetch(`${API_BASE}/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target })
    });
    const res = await fetch(`${API_BASE}/projects/${projectId}/publishes`);
    setPublishes(await res.json());
  }

  return (
    <main>
      <h1>StudyTour Ops Console</h1>

      <section className="card">
        <h2>Project</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          先在此选择或创建项目，再打开下方 <strong>Modules</strong> 中的入口（链接会带上当前项目 ID）。
        </p>
        {projectsLoadError && <p className="error-banner">{projectsLoadError}</p>}
        <div className="ops-project-field">
          <div className="muted" style={{ marginBottom: 8 }}>
            Project（点选一行；名称过长会自动换行）
          </div>
          {projects.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {projectsLoadError ? "（加载失败，见上方红色提示）" : "（暂无项目，请使用下方表单创建）"}
            </p>
          ) : (
            <div className="ops-project-pick" role="radiogroup" aria-label="选择项目">
              {projects.map((p) => (
                <div key={p.id} className="ops-project-pick-item">
                  <div
                    className={`ops-project-pick-row${projectId === p.id ? " ops-project-pick-row--selected" : ""}`}
                  >
                    <label className="ops-project-pick-main">
                      <input
                        type="radio"
                        name="ops-current-project"
                        value={p.id}
                        checked={projectId === p.id}
                        onChange={() => setProjectId(p.id)}
                        className="ops-project-pick-radio"
                      />
                      <span className="ops-project-pick-name">{p.name}</span>
                    </label>
                    <OpsProjectRowMenu
                      project={p}
                      menuOpen={projectActionMenuId === p.id}
                      onToggleMenu={() =>
                        setProjectActionMenuId((cur) => (cur === p.id ? null : p.id))
                      }
                      onCloseMenu={() => setProjectActionMenuId(null)}
                      onEdit={() => {
                        setProjectActionMenuId(null);
                        setRenameTargetId(p.id);
                        setRenameDraft(p.name);
                      }}
                      onDelete={async () => {
                        setProjectActionMenuId(null);
                        if (
                          !window.confirm(`确定删除项目「${p.name}」？此操作不可恢复（演示环境内存数据）。`)
                        ) {
                          return;
                        }
                        await deleteProjectById(p.id);
                      }}
                    />
                  </div>
                  {renameTargetId === p.id ? (
                    <form
                      className="ops-project-rename-bar"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const ok = await renameProject(p.id, renameDraft);
                        if (ok) {
                          setRenameTargetId(null);
                        }
                      }}
                    >
                      <input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        placeholder="项目名称"
                        aria-label="编辑项目名称"
                        className="ops-project-rename-input"
                      />
                      <button type="submit">保存</button>
                      <button type="button" className="ops-btn-muted" onClick={() => setRenameTargetId(null)}>
                        取消
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
        <p>Active: {activeProject?.name ?? (projectId || "—")}</p>
        <form className="row" onSubmit={createProject} style={{ marginTop: 12 }}>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="新项目名称"
            style={{ minWidth: 200 }}
          />
          <input
            value={newProjectDestination}
            onChange={(e) => setNewProjectDestination(e.target.value)}
            placeholder="目的地（可选）"
            style={{ minWidth: 160 }}
          />
          <button type="submit">创建项目</button>
        </form>
      </section>

      <section className="card">
        <h2>Modules</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          使用<strong>上方已选项目</strong>打开模块（URL 含项目 ID）。
        </p>
        <div className="module-grid">
          {projectId ? (
            <Link
              to={`/projects/${encodeURIComponent(projectId)}/modules/internal-information-collection`}
              className="module-tile"
            >
              <h3>Internal Information Collection</h3>
              <p className="muted">当前项目：{activeProject?.name ?? projectId}</p>
            </Link>
          ) : (
            <div className="module-tile module-tile-disabled">
              <h3>Internal Information Collection</h3>
              <p className="muted">
                {projectsLoadError
                  ? "无法加载项目：请先确认后端已启动，或刷新页面。"
                  : projects.length === 0
                    ? "暂无项目：请先在上方「创建项目」，再点此区域刷新后进入。"
                    : "请先在上方项目列表中点选一项。"}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Collaboration Chat</h2>
          <form onSubmit={sendChat}>
            <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="输入游学意图..." />
            <button type="submit">Send + Trigger Research</button>
          </form>
          <ul>
            {(detail?.thread?.messages ?? []).map((m: any) => (
              <li key={m.id}>
                <b>{m.role}</b>: {m.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Proposal Upload</h2>
          <form onSubmit={uploadProposal}>
            <input type="file" />
            <button type="submit">Upload Proposal</button>
          </form>
          <p>上传后会自动创建研究任务。</p>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Research Jobs</h2>
          <button onClick={() => projectId && loadJobs(projectId)}>Refresh</button>
          <ul>
            {jobs.map((j: any) => (
              <li key={j.id}>
                {j.status} - {j.query}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Budget / Logistics / Runbook</h2>
          <div className="row">
            <button onClick={addBudgetLine}>Add Budget Line</button>
            <button onClick={addLogistics}>Add Logistics Task</button>
            <button onClick={addRunbook}>Add Runbook Item</button>
          </div>
          <p>Budget items: {detail?.itinerary?.budget?.lines?.length ?? 0}</p>
          <p>Logistics items: {detail?.itinerary?.logistics?.length ?? 0}</p>
          <p>Runbook items: {detail?.itinerary?.runbook?.length ?? 0}</p>
        </div>
      </section>

      <section className="card">
        <h2>Publish / Sync Status</h2>
        <div className="row">
          <button onClick={() => publish("travefy")}>Publish to Travefy</button>
          <button onClick={() => publish("wetu")}>Publish to Wetu</button>
          <button onClick={() => publish("file")}>Export File</button>
        </div>
        <ul>
          {publishes.map((p) => (
            <li key={p.id}>
              [{p.target}] {p.state} attempts={p.attemptCount} external={p.externalId ?? "-"}{" "}
              {p.lastError ? `error=${p.lastError}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid">
        <PartnerView projectId={projectId} />
        <TravelerView projectId={projectId} />
      </section>
    </main>
  );
}

function OpsProjectRowMenu({
  project,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete
}: {
  project: ProjectSummary;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen, onCloseMenu]);

  return (
    <div className="ops-project-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ops-project-more-btn"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`「${project.name}」更多操作`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleMenu();
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="6" r="1.75" fill="currentColor" />
          <circle cx="12" cy="12" r="1.75" fill="currentColor" />
          <circle cx="12" cy="18" r="1.75" fill="currentColor" />
        </svg>
      </button>
      {menuOpen ? (
        <div className="ops-project-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="ops-project-dropdown-item"
            onClick={() => {
              onCloseMenu();
              onEdit();
            }}
          >
            编辑
          </button>
          <button
            type="button"
            role="menuitem"
            className="ops-project-dropdown-item ops-project-dropdown-item--danger"
            onClick={() => void onDelete()}
          >
            删除
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PartnerView({ projectId }: { projectId: string }) {
  const [view, setView] = useState<any>(null);
  useEffect(() => {
    if (!projectId) {
      return;
    }
    fetch(`${API_BASE}/projects/${projectId}/view/partner`)
      .then((r) => r.json())
      .then(setView);
  }, [projectId]);

  return (
    <div className="card">
      <h2>Partner View</h2>
      <p>{view?.note}</p>
      <p>Logistics shared: {view?.logistics?.length ?? 0}</p>
      <p>Runbook shared: {view?.runbook?.length ?? 0}</p>
    </div>
  );
}

function TravelerView({ projectId }: { projectId: string }) {
  const [view, setView] = useState<any>(null);
  useEffect(() => {
    if (!projectId) {
      return;
    }
    fetch(`${API_BASE}/projects/${projectId}/view/traveler`)
      .then((r) => r.json())
      .then(setView);
  }, [projectId]);

  return (
    <div className="card">
      <h2>Traveler View</h2>
      <p>{view?.note}</p>
      <p>Published days: {view?.itineraryDays?.length ?? 0}</p>
    </div>
  );
}
