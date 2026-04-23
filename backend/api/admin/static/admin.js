/** @jsxRuntime classic */
/** @jsx React.createElement */

const { useCallback, useEffect, useMemo, useRef, useState } = React;

const ENTITY_CONFIG = {
  users: {
    title: "Users",
    listPath: "/admin/users",
    deletePath: (entity) => `/admin/users/${encodeURIComponent(entity.username)}`,
    key: (entity) => entity.username || entity.id,
    summary: (entity) => ({
      primary: entity.username,
      secondary: entity.bio || "No bio",
      meta: [
        `ID: ${entity.id}`,
        entity.creation_date ? `Created: ${entity.creation_date}` : null,
        entity.is_admin ? "Admin" : null,
        entity.ban_until ? `Banned until: ${entity.ban_until}` : null,
      ].filter(Boolean),
    }),
  },
  posts: {
    title: "Bytes",
    listPath: "/admin/posts",
    deletePath: (entity) => `/admin/posts/${entity.id}`,
    key: (entity) => entity.id,
    summary: (entity, getUsername) => ({
      primary: `Byte #${entity.id}`,
      secondary: trimText(entity.content, 160),
      meta: [
        `By: ${getUsername(entity.user)}`,
        `Likes: ${entity.likes || 0}`,
        `Saves: ${entity.saves || 0}`,
        entity.created_on ? `Created: ${formatDate(entity.created_on)}` : null,
      ].filter(Boolean),
    }),
  },
  projects: {
    title: "Streams",
    listPath: "/admin/projects",
    deletePath: (entity) => `/admin/projects/${entity.id}`,
    key: (entity) => entity.id,
    summary: (entity, getUsername) => ({
      primary: entity.name || `Stream #${entity.id}`,
      secondary: trimText(entity.description || "No description", 160),
      meta: [
        `By: ${getUsername(entity.owner)}`,
        `Status: ${entity.status ?? "-"}`,
        `Likes: ${entity.likes || 0}`,
        `Saves: ${entity.saves || 0}`,
      ].filter(Boolean),
    }),
  },
  comments: {
    title: "Bits",
    listPath: "/admin/comments",
    deletePath: (entity) => `/admin/comments/${entity.id}`,
    key: (entity) => entity.id,
    summary: (entity, getUsername) => ({
      primary: `Bit #${entity.id}`,
      secondary: trimText(entity.content || "No content", 160),
      meta: [
        `By: ${getUsername(entity.user)}`,
        `Likes: ${entity.likes || 0}`,
        entity.created_on ? `Created: ${formatDate(entity.created_on)}` : null,
      ].filter(Boolean),
    }),
  },
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: IconDashboard },
  { key: "users", label: "Users", icon: IconUsers },
  { key: "posts", label: "Bytes", icon: IconPosts },
  { key: "projects", label: "Streams", icon: IconProjects },
  { key: "comments", label: "Bits", icon: IconComments },
];

const PAGE_ALIASES = { bytes: "posts", streams: "projects", bits: "comments" };

function trimText(text, max = 120) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

function formatDate(input) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return date.toLocaleString();
}

function SvgIcon({ children }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconDashboard() {
  return <SvgIcon><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 14h3v4H8z" /><path d="M13 10h3v8h-3z" /></SvgIcon>;
}
function IconUsers() {
  return <SvgIcon><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" /><path d="M19 11a3 3 0 1 0 0-6" /><path d="M16 19c.2-1.8 1.5-3.3 3.7-4" /></SvgIcon>;
}
function IconPosts() {
  return <SvgIcon><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></SvgIcon>;
}
function IconProjects() {
  return <SvgIcon><path d="M4 20V8l8-4 8 4v12" /><path d="M9 20v-6h6v6" /></SvgIcon>;
}
function IconComments() {
  return <SvgIcon><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></SvgIcon>;
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
  return <button type={type} className={classes} onClick={onClick} disabled={busy}>{children}</button>;
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
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = display;
    const startTime = performance.now();
    const duration = 520;
    let frame = 0;

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function Gauge({ label, value, total }) {
  const max = Math.max(total || 1, 1);
  const clamped = Math.max(0, Math.min(value || 0, max));
  const percent = Math.round((clamped / max) * 100);

  return (
    <div className="gauge-card">
      <div className="gauge-ring" style={{ "--gauge": `${percent}%` }}>
        <div className="gauge-inner">{percent}%</div>
      </div>
      <div className="gauge-meta">
        <strong>{label}</strong>
        <span>{clamped} / {max}</span>
      </div>
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

function DashboardPage({ addToast, userLookup }) {
  const [busy, setBusy] = useState(true);
  const [overview, setOverview] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setOverview(await api("/admin/overview"));
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = overview?.counts || { users: 0, posts: 0, projects: 0, comments: 0 };
  const allUsers = Object.values(userLookup);
  const adminUsers = allUsers.filter((user) => user?.is_admin).length;
  const bannedUsers = allUsers.filter((user) => !!user?.ban_until).length;

  return (
    <div className="page">
      <section className="section-card reveal">
        <div className="section-head">
          <h2>Platform overview</h2>
          <FlatButton busy={busy} onClick={load}>Refresh</FlatButton>
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
          <Gauge label="Admins / Users" value={adminUsers} total={counts.users} />
          <Gauge label="Banned / Users" value={bannedUsers} total={counts.users} />
          <Gauge label="Bytes / Users" value={counts.posts} total={Math.max(counts.users, 1)} />
          <Gauge label="Bits / Bytes" value={counts.comments} total={Math.max(counts.posts, 1)} />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ entity, type, getUsername, onOpen }) {
  const config = ENTITY_CONFIG[type];
  const summary = config.summary(entity, getUsername);

  return (
    <article className="entity-card" onClick={() => onOpen(entity, type)}>
      <div className="card-title">{summary.primary}</div>
      <div className="card-preview">{summary.secondary}</div>
      <div className="card-meta">
        {summary.meta.map((entry, index) => <span key={`${entry}-${index}`} className="badge">{entry}</span>)}
      </div>
      <div className="entity-actions">
        <FlatButton size="small">Open details</FlatButton>
      </div>
    </article>
  );
}

function DataPage({ type, addToast, onOpenEntity, getUsername }) {
  const config = ENTITY_CONFIG[type];
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const q = query.trim();
      const path = q ? `${config.listPath}?q=${encodeURIComponent(q)}` : config.listPath;
      setItems(normalizeListPayload(await api(path)));
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
              <SummaryCard
                key={config.key(entity)}
                entity={entity}
                type={type}
                getUsername={getUsername}
                onOpen={onOpenEntity}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InspectorPanel({ panel, index, getUsername, resolveUserByAnyRef, onOpenEntity, onClosePanel, onActionDone, addToast }) {
  const { entity, type } = panel;
  const [busy, setBusy] = useState(false);
  const config = ENTITY_CONFIG[type];
  const title = type === "users" ? entity.username : config.summary(entity, getUsername).primary;

  const userRefs = useMemo(() => {
    if (type === "users") return [];
    const refs = [];
    if (entity.user != null) refs.push(entity.user);
    if (entity.owner != null) refs.push(entity.owner);
    return [...new Set(refs)];
  }, [entity, type]);

  const runDelete = async () => {
    if (!window.confirm("Delete this record permanently?")) return;
    setBusy(true);
    try {
      await api(config.deletePath(entity), { method: "DELETE" });
      addToast(`${config.title.slice(0, -1)} deleted`, "success");
      onActionDone();
      onClosePanel(index);
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
        await api(`/admin/users/${encodeURIComponent(entity.username)}/admin`, { method: "POST", body: { is_admin: !entity.is_admin } });
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
      onClosePanel(index);
    } catch (error) {
      addToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="inspector-panel" style={{ animationDelay: `${index * 60}ms` }}>
      <header className="inspector-header">
        <div>
          <h3>{title}</h3>
          <p>{type === "users" ? `Tracked by username: ${entity.username}` : `${config.title.slice(0, -1)} details`}</p>
        </div>
        <FlatButton size="small" onClick={() => onClosePanel(index)}>Close</FlatButton>
      </header>

      {userRefs.length ? (
        <div className="linked-users-row">
          {userRefs.map((ref) => {
            const user = resolveUserByAnyRef(ref);
            const username = user?.username || getUsername(ref);
            return (
              <button
                type="button"
                key={`ref-${ref}`}
                className="linked-user-chip"
                onClick={() => {
                  if (user) onOpenEntity(user, "users");
                }}
              >
                @{username}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="modal-actions">
        {type === "users" ? (
          <>
            <FlatButton size="small" busy={busy} onClick={() => runUserAction("toggle-admin")}>{entity.is_admin ? "Revoke Admin" : "Grant Admin"}</FlatButton>
            <FlatButton size="small" busy={busy} danger={!!entity.ban_until} onClick={() => runUserAction("toggle-ban")}>{entity.ban_until ? "Unban" : "Ban 7d"}</FlatButton>
          </>
        ) : null}
        <FlatButton size="small" danger busy={busy} onClick={runDelete}>Delete</FlatButton>
      </div>

      <pre className="modal-fields">{JSON.stringify(entity, null, 2)}</pre>
    </section>
  );
}

function InspectorStack({ panels, getUsername, resolveUserByAnyRef, onOpenEntity, onClosePanel, onActionDone, addToast }) {
  if (!panels.length) return null;

  return (
    <div className="record-overlay" onClick={() => onClosePanel(0, true)}>
      <div className="inspector-stack" onClick={(event) => event.stopPropagation()}>
        {panels.map((panel, index) => (
          <InspectorPanel
            key={panel.key}
            panel={panel}
            index={index}
            getUsername={getUsername}
            resolveUserByAnyRef={resolveUserByAnyRef}
            onOpenEntity={onOpenEntity}
            onClosePanel={onClosePanel}
            onActionDone={onActionDone}
            addToast={addToast}
          />
        ))}
      </div>
    </div>
  );
}

function TopSearch({ onOpenEntity, addToast, getUsername }) {
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
    { key: "users", label: "Users", type: "users" },
    { key: "posts", label: "Bytes", type: "posts" },
    { key: "projects", label: "Streams", type: "projects" },
    { key: "comments", label: "Bits", type: "comments" },
  ];

  const hasResults = groups.some((group) => (results[group.key] || []).length);

  const renderLabel = (item, type) => {
    if (type === "users") return `@${item.username}`;
    if (type === "posts") return `Byte #${item.id} • ${getUsername(item.user)}`;
    if (type === "projects") return `${item.name || `Stream #${item.id}`} • ${getUsername(item.owner)}`;
    return `Bit #${item.id} • ${getUsername(item.user)}`;
  };

  return (
    <div className="search-wrap">
      <input
        className="search-input"
        value={query}
        placeholder="Global search users, bytes, streams, bits..."
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
                    type="button"
                    key={`${group.key}-${item.id || item.username}`}
                    className="search-result"
                    onClick={() => {
                      onOpenEntity(item, group.type);
                      setOpen(false);
                    }}
                  >
                    {renderLabel(item, group.type)}
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
  const [panels, setPanels] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userLookup, setUserLookup] = useState({});
  const [usernameLookup, setUsernameLookup] = useState({});

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const hydrateUsers = useCallback(async () => {
    try {
      const users = normalizeListPayload(await api("/admin/users"));
      const byId = {};
      const byName = {};
      users.forEach((user) => {
        byId[String(user.id)] = user;
        byName[String(user.username).toLowerCase()] = user;
      });
      setUserLookup(byId);
      setUsernameLookup(byName);
    } catch (error) {
      addToast(error.message, "error");
    }
  }, [addToast]);

  useEffect(() => {
    api("/admin/me").then(setAdminMe).catch(() => {});
    hydrateUsers();

    const syncHash = () => {
      const raw = window.location.hash.replace("#/", "") || "dashboard";
      const page = PAGE_ALIASES[raw] || raw;
      if (NAV_ITEMS.some((item) => item.key === page)) setActivePage(page);
      else {
        setActivePage("dashboard");
        window.location.hash = "#/dashboard";
      }
    };

    window.addEventListener("hashchange", syncHash);
    syncHash();
    return () => window.removeEventListener("hashchange", syncHash);
  }, [hydrateUsers]);

  const getUsername = useCallback((ref) => {
    if (ref === null || ref === undefined) return "unknown";
    if (typeof ref === "string" && Number.isNaN(Number(ref))) return ref;
    return userLookup[String(ref)]?.username || `user-${ref}`;
  }, [userLookup]);

  const resolveUserByAnyRef = useCallback((ref) => {
    if (ref === null || ref === undefined) return null;
    if (typeof ref === "number" || !Number.isNaN(Number(ref))) {
      return userLookup[String(ref)] || null;
    }
    return usernameLookup[String(ref).toLowerCase()] || null;
  }, [userLookup, usernameLookup]);

  const openEntity = useCallback((entity, type) => {
    const keyRoot = type === "users" ? (entity.username || entity.id) : (entity.id || JSON.stringify(entity));
    const key = `${type}:${keyRoot}`;
    setPanels((current) => {
      if (current.some((panel) => panel.key === key)) return current;
      return [...current, { key, type, entity }];
    });
  }, []);

  const closePanel = useCallback((index, closeAll = false) => {
    setPanels((current) => {
      if (closeAll) return [];
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const refreshAll = () => {
    setRefreshKey((value) => value + 1);
    hydrateUsers();
  };

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
                  onClick={() => {
                    setActivePage(item.key);
                    window.location.hash = `#/${item.key}`;
                    setSidebarOpen(false);
                  }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <FlatButton onClick={refreshAll}>Refresh data</FlatButton>
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
              <FlatButton size="small" className="mobile-nav-toggle" onClick={() => setSidebarOpen((value) => !value)}>Menu</FlatButton>
              <img src="/Devbits_Icons.png" alt="DevBits" />
              <span>{currentTitle}</span>
            </div>
            <div className="topbar-actions">
              <TopSearch onOpenEntity={openEntity} addToast={addToast} getUsername={getUsername} />
              <FlatButton size="small" onClick={refreshAll}>Refresh</FlatButton>
            </div>
          </header>

          {activePage === "dashboard" ? (
            <DashboardPage key={`dash-${refreshKey}`} addToast={addToast} userLookup={userLookup} />
          ) : (
            <DataPage
              key={`${activePage}-${refreshKey}`}
              type={activePage}
              addToast={addToast}
              onOpenEntity={openEntity}
              getUsername={getUsername}
            />
          )}
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />

      <InspectorStack
        panels={panels}
        getUsername={getUsername}
        resolveUserByAnyRef={resolveUserByAnyRef}
        onOpenEntity={openEntity}
        onClosePanel={closePanel}
        onActionDone={refreshAll}
        addToast={addToast}
      />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("admin-app"));
root.render(<App />);
