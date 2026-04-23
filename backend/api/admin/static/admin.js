/** @jsxRuntime classic */
/** @jsx React.createElement */
const { useState, useEffect, useRef, useMemo, useCallback, useId } = React;

// FlatButton - CRITICAL: Define FIRST
function FlatButton({ children, onClick, busy, danger, className = "", size }) {
  const classes = ["btn", danger ? "danger" : "", busy ? "is-loading" : "", size ? `btn--${size}` : "", className]
    .filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} onClick={onClick} disabled={busy}>
      <span>{children}</span>
    </button>
  );
}

// Icons available globally from admin-icons.js

// NAV_CONFIG
const NAV_CONFIG = [
  { label: "Dashboard", href: "#/dashboard", icon: Icons.BarChartSquare02, match: "dashboard" },
  { label: "Users", href: "#/users", icon: Icons.Users01, match: "users" },
  { label: "Bytes", href: "#/bytes", icon: Icons.Package, match: "bytes" },
  { label: "Streams", href: "#/streams", icon: Icons.Rows01, match: "streams" },
  { label: "Bits", href: "#/bits", icon: Icons.PieChart03, match: "bits" },
];

const PAGES = ["dashboard", "users", "bytes", "streams", "bits"];

// API Layer + Cache
const cache = new Map();
function getCached(key) {
  return cache.get(key);
}
function setCached(key, value, ttl = 5 * 60 * 1000) {
  cache.set(key, { value, expires: Date.now() + ttl });
}
function invalidateCache(...prefixes) {
  for (let [key] of cache) {
    if (prefixes.some(prefix => key.startsWith(prefix))) {
      cache.delete(key);
    }
  }
}

async function api(path, options = {}) {
  const key = getStoredAuth() + path + JSON.stringify(options?.body || {});
  const cached = getCached(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const auth = getStoredAuth();
  if (!auth) {
    window.location.href = "/admin";
    throw new Error("Not authenticated");
  }

  const headers = { "Content-Type": "application/json", ...options.headers };
  if (auth.startsWith("Bearer ")) headers.Authorization = auth;
  else headers["X-Admin-Key"] = auth;

  const resp = await fetch(path, { ...options, headers });
  const data = await resp.clone().json().catch(() => null);

  if (resp.status === 401 || resp.status === 403) {
    sessionStorage.clear();
    window.location.href = "/admin";
    throw new Error("Session expired");
  }

  if (!resp.ok) throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);

  if (resp.ok && options.method !== "POST" && options.method !== "DELETE") {
    setCached(key, data);
  }
  return data;
}

function getStoredAuth() {
  return sessionStorage.getItem("devbits_admin_token") || sessionStorage.getItem("devbits_admin_key") || "";
}

// ToastStack
function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack">
      {toasts.map(({ id, message, type = "info" }) => (
        <div key={id} className="toast">
          {message}
          <button onClick={() => onDismiss(id)} className="btn btn--small danger" style={{marginLeft:"auto"}}>×</button>
        </div>
      ))}
    </div>
  );
}

// EntityModal
function EntityModal({ entity, type, isOpen, onClose }) {
  if (!isOpen) return null;
  const fields = Object.entries(entity || {}).map(([k, v]) => (
    <div key={k} className="field-row">
      <strong>{k}:</strong> <span>{String(v)}</span>
    </div>
  ));

  return (
    <div className="record-overlay" onClick={onClose}>
      <div className="record-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{type} Expanded view</h3>
          <FlatButton size="small" onClick={onClose}>Close</FlatButton>
        </div>
        <div className="modal-fields">{fields}</div>
      </div>
    </div>
  );
}

// GenericCard
function GenericCard({ entity, type, onDelete, onClick }) {
  const [showConfirm, setShowConfirm] = useState(false);
  return (
    <div className="entity-card" onClick={onClick}>
      <div className="card-title">{entity.title || entity.username || entity.id}</div>
      <div className="card-meta">
        <span>by {entity.owner}</span>
        <span className="date-badge">{new Date(entity.created_at || entity.updated_at).toLocaleDateString()}</span>
      </div>
      <div className="card-preview">{(entity.content || entity.bio || "").slice(0, 120)}...</div>
      <div className="entity-actions">
        <FlatButton size="small" danger onClick={e => {e.stopPropagation(); onDelete(entity.id || entity.username);}}>
          Delete
        </FlatButton>
      </div>
    </div>
  );
}

// UserCard (extends Generic)
function UserCard({ user, onAction }) {
  const initials = user.username ? user.username.slice(0,2).toUpperCase() : '?';
  const isAdmin = user.is_admin;
  const isBanned = user.ban_expires_at;

  const handleAdminToggle = () => onAction(user.username, 'admin', !isAdmin);
  const handleBanToggle = () => onAction(user.username, 'ban', !isBanned);

  return (
    <div className="entity-card">
      <div style={{display:'flex', gap:'0.75rem', alignItems:'center'}}>
        <div className="avatar" style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--db-tint)',color:'var(--db-on-tint)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700'}}>{initials}</div>
        <div>
          <div className="card-title">{user.username}</div>
          <div className="card-preview">{user.bio?.slice(0,80)}...</div>
        </div>
      </div>
      <div className="entity-actions">
        <FlatButton size="small" onClick={() => handleAdminToggle()}>{isAdmin ? 'Revoke Admin' : 'Grant Admin'}</FlatButton>
        <FlatButton size="small" danger={isBanned} onClick={() => handleBanToggle()}>{isBanned ? 'Unban' : 'Ban'}</FlatButton>
        <FlatButton size="small" danger onClick={() => onAction(user.username, 'delete')}>Delete</FlatButton>
      </div>
    </div>
  );
}

// Page: Data list (users/bytes/etc)
function DataPage({ page }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState(null);

  const endpoint = `/admin/${page}s?q=${encodeURIComponent(query)}&page=${pageNum}&limit=12`;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(endpoint);
      setItems(data.items || []);
      setHasMore(data.has_more !== false);
    } catch (e) {
      toasts.current.push({id: Date.now(), message: e.message, type: 'error'});
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    refresh();
  }, [query, pageNum]);

  const handleAction = async (id, action, value) => {
    try {
      if (action === 'delete') await api(`/admin/${page}s/${id}`, {method: 'DELETE'});
      else if (action === 'admin') await api(`/admin/${page}s/${id}/admin`, {method: 'POST', body: {is_admin: value}});
      else if (action === 'ban') await api(`/admin/${page}s/${id}/ban`, {method: 'POST', body: {reason: 'Admin action', duration_minutes: value ? 0 : 60*24*7}});
      else if (action === 'unban') await api(`/admin/${page}s/${id}/unban`, {method: 'POST'});
      invalidateCache(`/admin/${page}`);
      refresh();
      toasts.current.push({id: Date.now(), message: 'Action completed', type: 'success'});
    } catch (e) {
      toasts.current.push({id: Date.now(), message: e.message, type: 'error'});
    }
  };

  const CardComponent = page === 'users' ? UserCard : GenericCard;

  const skeletons = Array(6).fill().map((_,i) => (
    <div key={i} className="entity-card" style={{height:'120px', background:'var(--db-surface-alt)', borderColor:'var(--db-border)'}}/>
  ));

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-head">
          <h2>{page.charAt(0).toUpperCase() + page.slice(1)}</h2>
          <div className="list-search-row">
            <input className="admin-input" placeholder={`Search ${page}...`} value={query} onChange={e=>setQuery(e.target.value)} style={{flex:1, minWidth:'200px'}}/>
            <FlatButton onClick={refresh} busy={loading}>Search</FlatButton>
          </div>
        </div>
        <div className="cards-grid">
          {loading && !items.length ? skeletons : items.map(item => (
            <CardComponent key={item.id || item.username} entity={item} type={page} onAction={handleAction} onClick={() => setSelected(item)} />
          ))}
        </div>
        {hasMore && <div className="load-more-row"><FlatButton onClick={() => setPageNum(p => p+1)}>Load more</FlatButton></div>}
      </section>
      <EntityModal entity={selected} type={page} isOpen={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// DashboardPage
function DashboardPage() {
  const [overview, setOverview] = useState({});
  const [snapshots, setSnapshots] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api('/admin/overview').then(data => {
      setOverview(data);
      setSnapshots({
        streams: data.recent_streams?.slice(0,6) || [],
        bytes: data.recent_bytes?.slice(0,6) || [],
        bits: data.recent_bits?.slice(0,6) || []
      });
      setLoading(false);
    }).catch(e => {
      toasts.current.push({id: Date.now(), message: e.message, type: 'error'});
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="page">Loading...</div>;

  const stats = [
    { label: 'Users', value: overview.user_count, icon: Icons.Users01 },
    { label: 'Bytes', value: overview.byte_count, icon: Icons.Package },
    { label: 'Streams', value: overview.stream_count, icon: Icons.Rows01 },
    { label: 'Bits', value: overview.bit_count, icon: Icons.PieChart03 }
  ];

  const snapshotSections = [
    { title: 'Live Streams', items: snapshots.streams, type: 'streams' },
    { title: 'Recent Bytes', items: snapshots.bytes, type: 'bytes' },
    { title: 'Latest Bits', items: snapshots.bits, type: 'bits' }
  ];

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-head"><h2>Overview</h2></div>
        <div className="counter-grid">
          {stats.map(({label, value, icon: Icon}) => (
            <div key={label} className="entity-card">
              <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                <Icon />
                <div>
                  <div style={{fontSize:'2rem', fontWeight:'700'}}>{value || 0}</div>
                  <div style={{color:'var(--db-muted)', fontSize:'0.875rem'}}>{label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {snapshotSections.map(({title, items, type}) => (
        <section key={type} className="section-card">
          <div className="section-head"><h2>{title}</h2></div>
          <div className="cards-grid">
            {items.map(item => <GenericCard key={item.id} entity={item} type={type} onClick={() => setSelected(item)} />)}
          </div>
        </section>
      ))}
      <EntityModal {...{entity: selected, type: 'entity', isOpen: !!selected, onClose: () => setSelected(null)}} />
    </div>
  );
}

// Topbar Search
function TopSearch({ onSearch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef();

  const debouncedSearch = useCallback(debounce(async (q) => {
    if (!q) return setResults({});
    const [users, bytes, streams, bits] = await Promise.all([
      api(`/admin/users?q=${q}`).catch(() => []),
      api(`/admin/posts?q=${q}`).catch(() => []),
      api(`/admin/projects?q=${q}`).catch(() => []),
      api(`/admin/comments?q=${q}`).catch(() => [])
    ]);
    setResults({ users, bytes: bytes, streams, bits });
    setShowDropdown(true);
  }, 220), []);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => debouncedSearch(query), 220);
    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  function debounce(fn, ms) {
    return (...args) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fn(...args), ms);
    };
  }

  const sections = [
    { label: 'Users', items: results.users || [] },
    { label: 'Bytes', items: results.bytes || [] },
    { label: 'Streams', items: results.streams || [] },
    { label: 'Bits', items: results.bits || [] }
  ];

  return (
    <div className="search-wrap">
      <input 
        className="search-input" 
        placeholder="Global search..." 
        value={query} 
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setShowDropdown(true)}
      />
      {showDropdown && Object.values(results).some(arr => arr.length) && (
        <div className="search-dropdown">
          {sections.map(({label, items}) => items?.length ? (
            <div key={label}>
              <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--db-border)', fontWeight:'600'}}>{label}</div>
              {items.slice(0,5).map(item => (
                <div key={item.id} className="search-result" style={{padding:'0.75rem 1rem', cursor:'pointer', borderBottom:'1px solid var(--db-border)'}} onClick={() => {
                  setSelectedGlobal(item); setShowDropdown(false);
                }}>
                  {item.username || item.title || item.content?.slice(0,50)}
                </div>
              ))}
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

// SidebarNavigationSlim
function SidebarNavigationSlim({ activePage, onNavigate, authLabel, onRefresh, onSignOut }) {
  return (
    <nav className="admin-sidebar" role="navigation">
      <div className="sidebar-brand">
        <img src="/Devbits_Icons.png" alt="DevBits" width="32" height="32" />
        <strong>DevBits</strong>
      </div>
      <div className="sidebar-user">
        <small>Admin</small>
        <div>{authLabel}</div>
      </div>
      <nav className="nav-list" role="menubar">
        {NAV_CONFIG.map(item => {
          const Icon = item.icon;
          const isActive = activePage === item.match;
          return (
            <button
              key={item.match}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.href)}
              role="menuitem"
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <FlatButton size="sidebar" onClick={onRefresh}>
          <Icons.LifeBuoy01 /> Refresh
        </FlatButton>
        <FlatButton size="sidebar" danger onClick={onSignOut}>
          <Icons.Settings01 /> Sign Out
        </FlatButton>
      </div>
    </nav>
  );
}

// Main App
function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const toasts = useRef([]);
  const [selectedGlobal, setSelectedGlobal] = useState(null);

  const navigate = useCallback((hash) => {
    const page = hash.split('/')[1] || 'dashboard';
    if (PAGES.includes(page)) setActivePage(page);
    window.location.hash = hash;
  }, []);

  useEffect(() => {
    const me = async () => {
      try {
        const data = await api('/admin/me');
        setUser(data);
      } catch {}
    };
    me();
  }, []);

  useEffect(() => {
    const handler = () => {
      const page = window.location.hash.split('/')[1] || 'dashboard';
      if (PAGES.includes(page)) setActivePage(page);
    };
    window.addEventListener('hashchange', handler);
    handler();
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const PageComponent = activePage === 'dashboard' ? DashboardPage : () => <DataPage page={activePage} />;

  const dismissToast = useCallback(id => {
    toasts.current = toasts.current.filter(t => t.id !== id);
    // Force re-render via key
  }, []);

  return (
    <>
      <div className="admin-root">
        <SidebarNavigationSlim 
          activePage={activePage}
          onNavigate={navigate}
          authLabel={user?.username || 'Administrator'}
          onRefresh={() => window.location.reload()}
          onSignOut={() => {
            sessionStorage.clear();
            window.location.href = '/admin';
          }}
        />
        <main className="admin-main">
          <header className="admin-topbar">
            <div className="topbar-left">
              <img src="/Devbits_Icons.png" alt="DevBits" />
              <div>{activePage.charAt(0).toUpperCase() + activePage.slice(1)}</div>
            </div>
            <div className="topbar-actions">
              <TopSearch />
              <FlatButton size="small" onClick={() => window.location.reload()}>
                <Icons.CheckDone01 />
              </FlatButton>
            </div>
          </header>
          <PageComponent />
        </main>
      </div>
      <ToastStack toasts={toasts.current} onDismiss={dismissToast} />
      <EntityModal entity={selectedGlobal} type="search" isOpen={!!selectedGlobal} onClose={() => setSelectedGlobal(null)} />
    </>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('admin-app'));
root.render(<App />);
