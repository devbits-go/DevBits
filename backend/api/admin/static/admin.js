/** @jsxRuntime classic */
/** @jsx React.createElement */

const { useCallback, useEffect, useMemo, useRef, useState } = React;

const ENTITY_CONFIG = {
  users: {
    title: "Users",
    listPath: "/admin/users",
    deletePath: (entity) => `/admin/users/${encodeURIComponent(entity.username)}`,
    key: (entity) => entity.username || entity.id,
    preview: (entity) => entity.bio || "No bio.",
  },
  posts: {
    title: "Bytes",
    listPath: "/admin/posts",
    deletePath: (entity) => `/admin/posts/${entity.id}`,
    key: (entity) => entity.id,
    preview: (entity) => entity.content || "No content.",
  },
  projects: {
    title: "Streams",
    listPath: "/admin/projects",
    deletePath: (entity) => `/admin/projects/${entity.id}`,
    key: (entity) => entity.id,
    preview: (entity) => entity.description || entity.content || "No description.",
  },
  comments: {
    title: "Bits",
    listPath: "/admin/comments",
    deletePath: (entity) => `/admin/comments/${entity.id}`,
    key: (entity) => entity.id,
    preview: (entity) => entity.content || "No comment text.",
  },
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: IconDashboard },
  { key: "users", label: "Users", icon: IconUsers },
  { key: "posts", label: "Bytes", icon: IconPosts },
  { key: "projects", label: "Streams", icon: IconProjects },
  { key: "comments", label: "Bits", icon: IconComments },
];

const PAGE_ALIASES = {
  bytes: "posts",
  streams: "projects",
  bits: "comments",
};

function SvgIcon({ children, className = "" }) {
  return (
    <svg className={`nav-icon ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconDashboard() {
  return (
    <SvgIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 14h3v4H8z" />
      <path d="M13 10h3v8h-3z" />
    </SvgIcon>
  );
}

function IconUsers() {
  return (
    <SvgIcon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <path d="M19 11a3 3 0 1 0 0-6" />
      <path d="M16 19c.2-1.8 1.5-3.3 3.7-4" />
    </SvgIcon>
  );
}

function IconPosts() {
  return (
    <SvgIcon>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </SvgIcon>
  );
}

function IconProjects() {
  return (
    <SvgIcon>
      <path d="M4 20V8l8-4 8 4v12" />
      <path d="M9 20v-6h6v6" />
    </SvgIcon>
  );
}

function IconComments() {
  return (
    <SvgIcon>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </SvgIcon>
  );
}

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

  const response = await fetch(path, {
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
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

function FlatButton({ children, onClick, danger, busy, size = "", className = "", type = "button" }) {
  const classes = ["btn", size ? `btn--${size}` : "", danger ? "danger" : "", busy ? "is-loading" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} onClick={onClick} disabled={busy}>
      {children}
    </button>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type || "info"}`}>
          <div className="toast-message">{toast.message}</div>
          <FlatButton size="small" onClick={() => onDismiss(toast.id)}>Dismiss</FlatButton>
        </div>
      ))}
    </div>
  );
}

function AnimatedCount({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = displayValue;
    const duration = 600;
    const started = performance.now();
    let frame = 0;

    const tick = (now) => {
      const elapsed = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplayValue(Math.round(start + (target - start) * eased));
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

function Gauge({ label, value, total }) {
  const safeTotal = Math.max(total || 0, 1);
  const clampedValue = Math.max(0, Math.min(value || 0, safeTotal));
  const percent = Math.round((clampedValue / safeTotal) * 100);

  return (
    <div className="gauge-card">
      <div className="gauge-ring" style={{ "--gauge": `${percent}%` }}>
        <div className="gauge-inner">{percent}%</div>
      </div>
      <div className="gauge-meta">
        <strong>{label}</strong>
        <span>{clampedValue} / {safeTotal}</span>
      </div>
    </div>
  );
}

function EntityModal({ entityType, entity, onClose, onActionDone, addToast }) {
  const [busy, setBusy] = useState(false);

  if (!entity) return null;

  const config = ENTITY_CONFIG[entityType];

  const runDelete = async () => {
    if (!window.confirm("Delete this record permanently?")) return;
    setBusy(true);
    try {
      await api(config.deletePath(entity), { method: "DELETE" });
      addToast(`${config.title.slice(0, -1)} deleted`, "success");
      onActionDone();
      onClose();
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const runUserAction = async (action) => {
    setBusy(true);
    try {
      if (action === "toggle-admin") {
        await api(`/admin/users/${encodeURIComponent(entity.username)}/admin`, {
          method: "POST",
          body: { is_admin: !entity.is_admin },
        });
      }
      if (action === "toggle-ban") {
        if (entity.ban_until) {
          await api(`/admin/users/${encodeURIComponent(entity.username)}/unban`, { method: "POST" });
        } else {
          await api(`/admin/users/${encodeURIComponent(entity.username)}/ban`, {
            method: "POST",
            body: { reason: "Admin moderation action", duration_minutes: 60 * 24 * 7 },
          });
        }
      }
      addToast("Action completed", "success");
      onActionDone();
      onClose();
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="record-overlay" onClick={onClose}>
      <div className="record-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{config.title.slice(0, -1)} details</h3>
          <FlatButton size="small" onClick={onClose}>Close</FlatButton>
        </div>

        <div className="modal-actions">
          {entityType === "users" ? (
            <>
              <FlatButton size="small" busy={busy} onClick={() => runUserAction("toggle-admin")}>
                {entity.is_admin ? "Revoke Admin" : "Grant Admin"}
              </FlatButton>
              <FlatButton size="small" busy={busy} danger={!!entity.ban_until} onClick={() => runUserAction("toggle-ban")}>
                {entity.ban_until ? "Unban" : "Ban 7d"}
              </FlatButton>
            </>
          ) : null}
          <FlatButton size="small" busy={busy} danger onClick={runDelete}>Delete</FlatButton>
        </div>

        <pre className="modal-fields">{JSON.stringify(entity, null, 2)}</pre>
      </div>
    </div>
  );
}

function DashboardPage({ addToast }) {
  const [busy, setBusy] = useState(true);
  const [overview, setOverview] = useState(null);
  const [derived, setDerived] = useState({ userAdmins: 0, userBanned: 0 });

  const loadDashboard = useCallback(async () => {
    setBusy(true);
    try {
      const [overviewData, users] = await Promise.all([
        api("/admin/overview"),
        api("/admin/users").then(normalizeListPayload),
      ]);

      const userAdmins = users.filter((user) => user?.is_admin).length;
      const userBanned = users.filter((user) => !!user?.ban_until).length;

      setOverview(overviewData);
      setDerived({ userAdmins, userBanned });
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const counts = overview?.counts || { users: 0, posts: 0, projects: 0, comments: 0 };

  return (
    <div className="page">
      <section className="section-card reveal">
        <div className="section-head">
          <h2>Platform overview</h2>
          <FlatButton onClick={loadDashboard} busy={busy}>Refresh</FlatButton>
        </div>

        <div className="counter-grid">
          <StatCard label="Users" value={counts.users} />
          <StatCard label="Bytes" value={counts.posts} />
          <StatCard label="Streams" value={counts.projects} />
          <StatCard label="Bits" value={counts.comments} />
        </div>
      </section>

      <section className="section-card reveal">
        <div className="section-head"><h2>Live admin health</h2></div>
        <div className="gauge-grid">
          <Gauge label="Admins / Users" value={derived.userAdmins} total={counts.users} />
          <Gauge label="Banned / Users" value={derived.userBanned} total={counts.users} />
          <Gauge label="Bytes / Users" value={counts.posts} total={Math.max(counts.users, 1)} />
          <Gauge label="Bits / Bytes" value={counts.comments} total={Math.max(counts.posts, 1)} />
        </div>
      </section>

      <section className="section-card reveal">
        <div className="section-head"><h2>System timestamps</h2></div>
        <div className="card-meta">
          <span className="badge">Server: {overview?.server_time || "-"}</span>
          <span className="badge">Database: {overview?.db_time || "-"}</span>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value"><AnimatedCount value={value} /></div>
    </div>
  );
}

function DataPage({ type, addToast, onSelectEntity }) {
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

  return (
    <div className="page">
      <section className="section-card reveal">
        <div className="section-head">
          <h2>{config.title}</h2>
          <div className="list-search-row">
            <input
              className="admin-input"
              placeholder={`Search ${config.title.toLowerCase()}...`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && load()}
            />
            <FlatButton onClick={load} busy={busy}>Search</FlatButton>
          </div>
        </div>

        {!items.length && !busy ? (
          <div className="empty-state">No records found.</div>
        ) : (
          <div className="cards-grid">
            {items.map((entity) => (
              <article key={config.key(entity)} className="entity-card" onClick={() => onSelectEntity(entity, type)}>
                <div className="card-title">{entity.title || entity.username || `ID ${entity.id}`}</div>
                <div className="card-meta">
                  {entity.creation_date ? <span className="badge">Created {entity.creation_date}</span> : null}
                  {entity.ban_until ? <span className="badge warn">Banned until {entity.ban_until}</span> : null}
                  {entity.is_admin ? <span className="badge success">Admin</span> : null}
                </div>
                <div className="card-preview">{config.preview(entity)}</div>
                <div className="entity-actions">
                  <FlatButton size="small">Open details</FlatButton>
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
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState({ users: [], posts: [], projects: [], comments: [] });
  const blurTimer = useRef(0);

  useEffect(() => {
    const cleaned = query.trim();
    if (!cleaned) {
      setResults({ users: [], posts: [], projects: [], comments: [] });
      return;
    }

    const timer = window.setTimeout(async () => {
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
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, addToast]);

  const groups = [
    { label: "Users", key: "users", type: "users" },
    { label: "Bytes", key: "posts", type: "posts" },
    { label: "Streams", key: "projects", type: "projects" },
    { label: "Bits", key: "comments", type: "comments" },
  ];

  const hasResults = groups.some((group) => (results[group.key] || []).length);

  return (
    <div className="search-wrap">
      <input
        className="search-input"
        placeholder="Global search users, bytes, streams, bits..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 140);
        }}
      />

      {open && query.trim() && hasResults ? (
        <div className="search-dropdown" onMouseDown={() => window.clearTimeout(blurTimer.current)}>
          {groups.map((group) => {
            const groupItems = results[group.key] || [];
            if (!groupItems.length) return null;

            return (
              <div key={group.key}>
                <div className="search-group-title">{group.label}</div>
                {groupItems.slice(0, 5).map((item) => (
                  <button
                    key={`${group.key}-${item.id || item.username}`}
                    type="button"
                    className="search-result"
                    onClick={() => {
                      onPick(item, group.type);
                      setOpen(false);
                    }}
                  >
                    {item.username || item.title || item.content || `ID ${item.id}`}
                  </button>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedEntityType, setSelectedEntityType] = useState("users");
  const [dataRefreshTick, setDataRefreshTick] = useState(0);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    api("/admin/me").then(setAdminMe).catch(() => {});

    const syncHash = () => {
      const rawPage = window.location.hash.replace("#/", "") || "dashboard";
      const page = PAGE_ALIASES[rawPage] || rawPage;
      const allowed = NAV_ITEMS.map((item) => item.key);
      if (allowed.includes(page)) setActivePage(page);
      else {
        setActivePage("dashboard");
        window.location.hash = "#/dashboard";
      }
    };

    window.addEventListener("hashchange", syncHash);
    syncHash();

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const handleNavigate = (page) => {
    setActivePage(page);
    window.location.hash = `#/${page}`;
    setSidebarOpen(false);
  };

  const handleSelectEntity = (entity, type) => {
    setSelectedEntity(entity);
    setSelectedEntityType(type);
  };

  const Page = activePage === "dashboard" ? (
    <DashboardPage addToast={addToast} key={`dashboard-${dataRefreshTick}`} />
  ) : (
    <DataPage
      key={`${activePage}-${dataRefreshTick}`}
      type={activePage}
      addToast={addToast}
      onSelectEntity={handleSelectEntity}
    />
  );

  const currentTitle = NAV_ITEMS.find((item) => item.key === activePage)?.label || "Dashboard";

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
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.key}
                  className={`nav-item ${activePage === item.key ? "active" : ""}`}
                  onClick={() => handleNavigate(item.key)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <FlatButton onClick={() => setDataRefreshTick((value) => value + 1)}>Refresh data</FlatButton>
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
              <FlatButton size="small" className="mobile-nav-toggle" onClick={() => setSidebarOpen((value) => !value)}>
                Menu
              </FlatButton>
              <img src="/Devbits_Icons.png" alt="DevBits" />
              <span>{currentTitle}</span>
            </div>

            <div className="topbar-actions">
              <TopSearch onPick={handleSelectEntity} addToast={addToast} />
              <FlatButton size="small" onClick={() => setDataRefreshTick((value) => value + 1)}>Refresh</FlatButton>
            </div>
          </header>

          {Page}
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />

      <EntityModal
        entityType={selectedEntityType}
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onActionDone={() => setDataRefreshTick((value) => value + 1)}
        addToast={addToast}
      />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("admin-app"));
root.render(<App />);