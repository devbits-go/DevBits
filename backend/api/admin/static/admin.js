/** @jsxRuntime classic */
/** @jsx React.createElement */

const { useState, useEffect, useMemo, useCallback } = React;

const ENTITY_CONFIG = {
  users: {
    title: "Users",
    listPath: "/admin/users",
    deletePath: (entity) => `/admin/users/${encodeURIComponent(entity.username)}`,
  },
  posts: {
    title: "Bytes",
    listPath: "/admin/posts",
    deletePath: (entity) => `/admin/posts/${entity.id}`,
  },
  projects: {
    title: "Streams",
    listPath: "/admin/projects",
    deletePath: (entity) => `/admin/projects/${entity.id}`,
  },
  comments: {
    title: "Bits",
    listPath: "/admin/comments",
    deletePath: (entity) => `/admin/comments/${entity.id}`,
  },
};

const NAV_ITEMS = ["dashboard", "users", "posts", "projects", "comments"];
const PAGE_ALIASES = {
  bytes: "posts",
  streams: "projects",
  bits: "comments",
};

function getStoredAuth() {
  return sessionStorage.getItem("devbits_admin_token") || sessionStorage.getItem("devbits_admin_key") || "";
}

function authHeaders() {
  const auth = getStoredAuth();
  const headers = { "Content-Type": "application/json" };
  if (auth.startsWith("Bearer ")) headers.Authorization = auth;
  else headers["X-Admin-Key"] = auth;
  return headers;
}

async function api(path, options = {}) {
  const auth = getStoredAuth();
  if (!auth) {
    window.location.href = "/admin";
    throw new Error("Not authenticated");
  }

  const payload = options.body ? JSON.stringify(options.body) : undefined;
  const response = await fetch(path, {
    ...options,
    body: payload,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  const data = await response.clone().json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    sessionStorage.clear();
    window.location.href = "/admin";
    throw new Error("Session expired");
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }

  return data;
}

function normalizeListPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function iconFor(page) {
  const map = {
    dashboard: "📊",
    users: "👥",
    posts: "🧩",
    projects: "🚀",
    comments: "💬",
  };
  return map[page] || "•";
}

function FlatButton({ children, onClick, danger, busy, size = "", className = "" }) {
  const cls = ["btn", danger ? "danger" : "", busy ? "is-loading" : "", size ? `btn--${size}` : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} onClick={onClick} disabled={busy}>
      {children}
    </button>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type || "info"}`}>
          <span>{toast.message}</span>
          <FlatButton size="small" onClick={() => onDismiss(toast.id)}>Dismiss</FlatButton>
        </div>
      ))}
    </div>
  );
}

function EntityModal({ title, entity, onClose }) {
  if (!entity) return null;
  return (
    <div className="record-overlay" onClick={onClose}>
      <div className="record-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title} details</h3>
          <FlatButton size="small" onClick={onClose}>Close</FlatButton>
        </div>
        <pre className="modal-fields">{JSON.stringify(entity, null, 2)}</pre>
      </div>
    </div>
  );
}

function DashboardPage({ addToast }) {
  const [overview, setOverview] = useState(null);
  const [busy, setBusy] = useState(true);

  const fetchOverview = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api("/admin/overview");
      setOverview(data);
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const counts = overview?.counts || { users: 0, posts: 0, projects: 0, comments: 0 };

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-head">
          <h2>Platform overview</h2>
          <FlatButton onClick={fetchOverview} busy={busy}>Refresh</FlatButton>
        </div>
        <div className="counter-grid">
          <div className="stat-card"><div className="stat-label">Users</div><div className="stat-value">{counts.users}</div></div>
          <div className="stat-card"><div className="stat-label">Bytes (posts)</div><div className="stat-value">{counts.posts}</div></div>
          <div className="stat-card"><div className="stat-label">Streams (projects)</div><div className="stat-value">{counts.projects}</div></div>
          <div className="stat-card"><div className="stat-label">Bits (comments)</div><div className="stat-value">{counts.comments}</div></div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-head"><h2>System timestamps</h2></div>
        <div className="card-meta">
          <span className="badge">Server: {overview?.server_time || "-"}</span>
          <span className="badge">Database: {overview?.db_time || "-"}</span>
        </div>
      </section>
    </div>
  );
}

function UserActions({ user, onDone, addToast }) {
  const isBanned = !!user.ban_until;
  const isAdmin = !!user.is_admin;

  const runAction = async (fn, successMessage) => {
    try {
      await fn();
      addToast(successMessage, "success");
      onDone();
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  return (
    <div className="entity-actions">
      <FlatButton
        size="small"
        onClick={() => runAction(
          () => api(`/admin/users/${encodeURIComponent(user.username)}/admin`, { method: "POST", body: { is_admin: !isAdmin } }),
          isAdmin ? "Admin access revoked" : "Admin access granted"
        )}
      >
        {isAdmin ? "Revoke Admin" : "Grant Admin"}
      </FlatButton>
      <FlatButton
        size="small"
        onClick={() => runAction(
          () => isBanned
            ? api(`/admin/users/${encodeURIComponent(user.username)}/unban`, { method: "POST" })
            : api(`/admin/users/${encodeURIComponent(user.username)}/ban`, {
                method: "POST",
                body: { reason: "Admin moderation action", duration_minutes: 60 * 24 * 7 },
              }),
          isBanned ? "User unbanned" : "User banned for 7 days"
        )}
        danger={isBanned}
      >
        {isBanned ? "Unban" : "Ban 7d"}
      </FlatButton>
    </div>
  );
}

function DataPage({ type, addToast, setModalEntity }) {
  const config = ENTITY_CONFIG[type];
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const q = query.trim();
      const path = q ? `${config.listPath}?q=${encodeURIComponent(q)}` : config.listPath;
      const data = await api(path);
      setItems(normalizeListPayload(data));
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }, [addToast, config.listPath, query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (entity) => {
    if (!window.confirm("Delete this record permanently?")) return;
    try {
      await api(config.deletePath(entity), { method: "DELETE" });
      addToast(`${config.title.slice(0, -1)} deleted`, "success");
      load();
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-head">
          <h2>{config.title}</h2>
          <div className="list-search-row">
            <input
              className="admin-input"
              placeholder={`Search ${config.title.toLowerCase()}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <FlatButton onClick={load} busy={busy}>Search</FlatButton>
          </div>
        </div>

        {!items.length && !busy ? (
          <div className="empty-state">No records found.</div>
        ) : (
          <div className="cards-grid">
            {items.map((entity) => (
              <article key={entity.id || entity.username} className="entity-card">
                <div className="card-title">{entity.title || entity.username || `ID ${entity.id}`}</div>
                <div className="card-meta">
                  {entity.creation_date ? <span className="badge">Created {entity.creation_date}</span> : null}
                  {entity.ban_until ? <span className="badge warn">Banned until {entity.ban_until}</span> : null}
                  {entity.is_admin ? <span className="badge success">Admin</span> : null}
                </div>
                <div className="card-preview">
                  {entity.bio || entity.content || entity.description || entity.subtitle || "No preview text."}
                </div>

                <div className="entity-actions">
                  <FlatButton size="small" onClick={() => setModalEntity(entity)}>View</FlatButton>
                  {type === "users" ? (
                    <UserActions user={entity} onDone={load} addToast={addToast} />
                  ) : null}
                  <FlatButton size="small" danger onClick={() => handleDelete(entity)}>Delete</FlatButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TopSearch({ onPick, addToast }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [], projects: [], comments: [] });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const cleaned = query.trim();
    if (!cleaned) {
      setResults({ users: [], posts: [], projects: [], comments: [] });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [users, posts, projects, comments] = await Promise.all([
          api(`/admin/users?q=${encodeURIComponent(cleaned)}`).catch(() => []),
          api(`/admin/posts?q=${encodeURIComponent(cleaned)}`).catch(() => []),
          api(`/admin/projects?q=${encodeURIComponent(cleaned)}`).catch(() => []),
          api(`/admin/comments?q=${encodeURIComponent(cleaned)}`).catch(() => []),
        ]);
        setResults({
          users: normalizeListPayload(users),
          posts: normalizeListPayload(posts),
          projects: normalizeListPayload(projects),
          comments: normalizeListPayload(comments),
        });
      } catch (error) {
        addToast(error.message, "error");
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [query, addToast]);

  const groups = useMemo(
    () => [
      { label: "Users", key: "users" },
      { label: "Bytes", key: "posts" },
      { label: "Streams", key: "projects" },
      { label: "Bits", key: "comments" },
    ],
    []
  );

  const hasResults = groups.some((group) => (results[group.key] || []).length);

  return (
    <div className="search-wrap">
      <input
        className="search-input"
        placeholder="Global search users, bytes, streams, bits..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open && query.trim() && hasResults ? (
        <div className="search-dropdown" onMouseLeave={() => setOpen(false)}>
          {groups.map((group) => {
            const items = results[group.key] || [];
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div className="search-group-title">{group.label}</div>
                {items.slice(0, 5).map((item) => (
                  <div key={`${group.key}-${item.id || item.username}`} className="search-result" onClick={() => onPick(item)}>
                    {item.username || item.title || item.content || `ID ${item.id}`}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [adminMe, setAdminMe] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [modalEntity, setModalEntity] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    api("/admin/me")
      .then((data) => setAdminMe(data))
      .catch(() => {});

    const syncHash = () => {
      const rawPage = window.location.hash.replace("#/", "") || "dashboard";
      const page = PAGE_ALIASES[rawPage] || rawPage;
      if (NAV_ITEMS.includes(page)) setActivePage(page);
      else {
        setActivePage("dashboard");
        window.location.hash = "#/dashboard";
      }
    };

    window.addEventListener("hashchange", syncHash);
    syncHash();

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const navigate = (page) => {
    setActivePage(page);
    window.location.hash = `#/${page}`;
    setSidebarOpen(false);
  };

  return (
    <>
      <div className={`admin-root ${sidebarOpen ? "sidebar-open" : ""}`}>
        <aside className="admin-sidebar">
          <div className="sidebar-brand">
            <img src="/Devbits_Icons.png" alt="DevBits" />
            <span>DevBits Admin</span>
          </div>
          <div className="sidebar-user">
            Signed in as
            <strong>{adminMe?.username || "Administrator"}</strong>
          </div>

          <nav className="nav-list" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                className={`nav-item ${activePage === item ? "active" : ""}`}
                onClick={() => navigate(item)}
                type="button"
              >
                <span aria-hidden="true">{iconFor(item)}</span>
                <span>{item === "posts" ? "Bytes" : item === "projects" ? "Streams" : item === "comments" ? "Bits" : item.charAt(0).toUpperCase() + item.slice(1)}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <FlatButton onClick={() => window.location.reload()}>Refresh</FlatButton>
            <FlatButton
              danger
              onClick={() => {
                sessionStorage.clear();
                window.location.href = "/admin";
              }}
            >
              Sign out
            </FlatButton>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <div className="topbar-left">
              <FlatButton size="small" onClick={() => setSidebarOpen((v) => !v)} className="mobile-nav-toggle">
                Menu
              </FlatButton>
              <img src="/Devbits_Icons.png" alt="DevBits" />
              <span>{activePage === "posts" ? "Bytes" : activePage === "projects" ? "Streams" : activePage === "comments" ? "Bits" : activePage.charAt(0).toUpperCase() + activePage.slice(1)}</span>
            </div>
            <div className="topbar-actions">
              <TopSearch onPick={setModalEntity} addToast={addToast} />
              <FlatButton size="small" onClick={() => window.location.reload()}>↻</FlatButton>
            </div>
          </header>

          {activePage === "dashboard" ? (
            <DashboardPage addToast={addToast} />
          ) : (
            <DataPage type={activePage} addToast={addToast} setModalEntity={setModalEntity} />
          )}
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <EntityModal
        title="Record"
        entity={modalEntity}
        onClose={() => setModalEntity(null)}
      />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("admin-app"));
root.render(<App />);