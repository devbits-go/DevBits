// SVG Icons for UntitledUI-style sidebar (React components)
const Icons = {
  HomeLine: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  BarChartSquare02: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <path d="M9 9h6v6H9z"/>
      <path d="M15 9v6"/>
      <path d="M9 15h6"/>
    </svg>
  ),
  Users01: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Rows01: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="4" rx="2"/>
      <rect x="3" y="12" width="18" height="4" rx="2"/>
      <rect x="3" y="20" width="18" height="4" rx="2"/>
    </svg>
  ),
  CheckDone01: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  PieChart03: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6h6"/>
    </svg>
  ),
  Settings01: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-.33-.06l-.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1 .33z"/>
    </svg>
  ),
  LifeBuoy01: ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9 9s1.5-1.5 4 0s1.5 1.5 0 4s-1.5 1.5-4 0s-1.5-1.5 0-4"/>
      <path d="M12 17c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      <path d="M15 15c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
    </svg>
  )
};

// Usage: <Icons.HomeLine className="w-5 h-5 text-muted hover:text-tint" />

