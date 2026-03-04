function getStoredAdminKey() {
  return sessionStorage.getItem('devbits_admin_key') || ''
}

function getStoredAdminToken() {
  return sessionStorage.getItem('devbits_admin_token') || ''
}

function setStoredAdminKey(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    sessionStorage.removeItem('devbits_admin_key')
    return ''
  }
  sessionStorage.setItem('devbits_admin_key', trimmed)
  return trimmed
}

function setStoredAdminToken(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    sessionStorage.removeItem('devbits_admin_token')
    return ''
  }
  sessionStorage.setItem('devbits_admin_token', trimmed)
  return trimmed
}

async function api(path, method = 'GET', body = null) {
  const key = getStoredAdminKey()
  const token = getStoredAdminToken()
  if (!key && !token) {
    window.location.href = '/admin'
    throw new Error('admin authentication required')
  }

  const opts = { method, headers: {} }
  if (key) {
    opts.headers['X-Admin-Key'] = key
  } else if (token) {
    opts.headers.Authorization = `Bearer ${token}`
  }

  if (body) {
    opts.body = JSON.stringify(body)
    opts.headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json().catch(() => null)
}

function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

function toText(value) {
  if (value === null || typeof value === 'undefined') return ''
  return String(value)
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function renderTable(containerId, columns, rows, getActions) {
  const container = document.getElementById(containerId)
  if (!container) return

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')

  columns.forEach(col => {
    const th = document.createElement('th')
    th.textContent = col.label
    headRow.appendChild(th)
  })

  const actionTh = document.createElement('th')
  actionTh.textContent = 'Actions'
  headRow.appendChild(actionTh)
  thead.appendChild(headRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  rows.forEach(row => {
    const tr = document.createElement('tr')

    columns.forEach(col => {
      const td = document.createElement('td')
      const rawValue = typeof col.value === 'function' ? col.value(row) : row[col.value]
      td.textContent = toText(rawValue)
      if (col.truncate) td.className = 'cell-truncate'
      tr.appendChild(td)
    })

    const actionTd = document.createElement('td')
    const actions = typeof getActions === 'function' ? getActions(row) : []
    actions.forEach((action, index) => {
      const button = document.createElement('button')
      button.textContent = action.label
      button.className = action.className || ''
      button.onclick = action.onClick
      actionTd.appendChild(button)
      if (index < actions.length - 1) {
        const spacer = document.createElement('span')
        spacer.textContent = ' '
        actionTd.appendChild(spacer)
      }
    })
    tr.appendChild(actionTd)

    tbody.appendChild(tr)
  })

  table.appendChild(tbody)
  container.innerHTML = ''
  container.appendChild(table)
}

async function refreshOverview() {
  try {
    const data = await api('/admin/overview')
    setText('stat-users', data?.counts?.users ?? '-')
    setText('stat-posts', data?.counts?.posts ?? '-')
    setText('stat-projects', data?.counts?.projects ?? '-')
    setText('stat-comments', data?.counts?.comments ?? '-')
    setText('overview-status', `Server: ${data?.server_time ?? '-'}  DB: ${data?.db_time ?? 'n/a'}`)
  } catch (error) {
    setText('overview-status', `Overview error: ${error.message}`)
  }
}

async function updateAuthStatus() {
  const hasKey = !!getStoredAdminKey()
  const hasToken = !!getStoredAdminToken()
  if (!hasKey && !hasToken) {
    setText('auth-status', 'Not signed in.')
    return
  }

  try {
    const me = await api('/admin/me')
    if (me?.mode === 'key') {
      setText('auth-status', 'Signed in with ultimate admin key.')
      return
    }
    const label = me?.username ? `Signed in as admin user: ${me.username}.` : 'Signed in with admin account.'
    setText('auth-status', label)
  } catch (error) {
    setText('auth-status', `Auth status error: ${error.message}`)
  }
}

async function refreshUsers() {
  try {
    const q = document.getElementById('user-search').value || ''
    const path = q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users'
    const usersResponse = asArray(await api(path))
    const users = Array.isArray(usersResponse) ? usersResponse : []
    renderTable(
      'users',
      [
        { label: 'ID', value: 'id' },
        { label: 'Username', value: 'username' },
        { label: 'Admin', value: (u) => (u.is_admin ? 'Yes' : 'No') },
        { label: 'Ban Until', value: (u) => u.ban_until || '' },
        { label: 'Ban Reason', value: (u) => u.ban_reason || '', truncate: true },
        { label: 'Bio', value: (u) => u.bio || '', truncate: true },
        { label: 'Created', value: 'creation_date' },
      ],
      users,
      (u) => {
        const actions = []

        actions.push({
          label: u.is_admin ? 'Remove Admin' : 'Make Admin',
          className: 'secondary',
          onClick: async () => {
            try {
              const res = await api(`/admin/users/${encodeURIComponent(u.username)}/admin`, 'POST', {
                is_admin: !u.is_admin,
              })
              alert(res.message || 'Admin status updated')
              await refreshUsers()
            } catch (e) {
              alert('Error: ' + e.message)
            }
          }
        })

        if (u.ban_until) {
          actions.push({
            label: 'Unban',
            className: 'secondary',
            onClick: async () => {
              try {
                const res = await api(`/admin/users/${encodeURIComponent(u.username)}/unban`, 'POST')
                alert(res.message || 'User unbanned')
                await refreshUsers()
              } catch (e) {
                alert('Error: ' + e.message)
              }
            }
          })
        } else {
          actions.push({
            label: 'Ban',
            className: 'secondary',
            onClick: async () => {
              const reason = (prompt(`Ban reason for ${u.username}:`, 'Violation of community guidelines') || '').trim()
              if (!reason) {
                alert('Ban reason is required.')
                return
              }

              const minutesText = (prompt('Ban duration (minutes):', '60') || '').trim()
              const durationMinutes = Number.parseInt(minutesText, 10)
              if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
                alert('Duration must be a positive whole number of minutes.')
                return
              }

              try {
                const res = await api(`/admin/users/${encodeURIComponent(u.username)}/ban`, 'POST', {
                  reason,
                  duration_minutes: durationMinutes,
                })
                alert(res.message || 'User banned')
                await refreshUsers()
              } catch (e) {
                alert('Error: ' + e.message)
              }
            }
          })
        }

        actions.push({
          label: 'Delete',
          className: 'danger',
          onClick: async () => {
            if (!confirm('Delete user ' + u.username + '?')) return
            try {
              const res = await api(`/admin/users/${encodeURIComponent(u.username)}`, 'DELETE')
              alert(res.message || 'deleted')
              await refreshUsers()
              await refreshOverview()
            } catch (e) {
              alert('Error: ' + e.message)
            }
          }
        })

        return actions
      }
    )
    setText('overview-status', `Loaded ${users.length} user row(s)`)
  } catch (e) {
    alert('Error: ' + e.message)
  }
}

document.getElementById('refresh-users').onclick = refreshUsers
document.getElementById('clear-search').onclick = () => { document.getElementById('user-search').value = ''; refreshUsers() }
document.getElementById('refresh-overview').onclick = refreshOverview
document.getElementById('reset-key').onclick = () => {
  setStoredAdminKey('')
  setStoredAdminToken('')
  window.location.href = '/admin'
}

async function searchPosts() {
  const q = document.getElementById('post-search').value || ''
  try {
    const path = q ? `/admin/posts?q=${encodeURIComponent(q)}` : '/admin/posts'
    const postsResponse = asArray(await api(path))
    const posts = Array.isArray(postsResponse) ? postsResponse : []
    renderTable(
      'posts',
      [
        { label: 'ID', value: 'id' },
        { label: 'User ID', value: 'user' },
        { label: 'Stream ID', value: 'project' },
        { label: 'Content', value: (p) => p.content || '', truncate: true },
        { label: 'Created', value: 'creation_date' },
      ],
      posts,
      (p) => ([{
        label: 'Delete',
        className: 'danger',
        onClick: async () => {
          if (!confirm('Delete post ' + p.id + '?')) return
          try {
            const res = await api(`/admin/posts/${encodeURIComponent(p.id)}`, 'DELETE')
            setText('post-result', res.message || 'deleted')
            await searchPosts()
            await refreshOverview()
          } catch (e) {
            alert('Error: ' + e.message)
          }
        }
      }])
    )
    setText('post-result', `${posts.length} result(s)`)
  } catch (e) {
    setText('post-result', 'Error: ' + e.message)
  }
}

document.getElementById('search-posts').onclick = searchPosts
document.getElementById('clear-post-search').onclick = () => { document.getElementById('post-search').value = ''; searchPosts() }

async function searchProjects() {
  const q = document.getElementById('project-search').value || ''
  try {
    const path = q ? `/admin/projects?q=${encodeURIComponent(q)}` : '/admin/projects'
    const projectsResponse = asArray(await api(path))
    const projects = Array.isArray(projectsResponse) ? projectsResponse : []
    renderTable(
      'projects',
      [
        { label: 'ID', value: 'id' },
        { label: 'Owner ID', value: 'owner' },
        { label: 'Name', value: (p) => p.name || '' },
        { label: 'Description', value: (p) => p.description || '', truncate: true },
        { label: 'Created', value: 'creation_date' },
      ],
      projects,
      (p) => ([{
        label: 'Delete',
        className: 'danger',
        onClick: async () => {
          if (!confirm('Delete project ' + p.id + '?')) return
          try {
            const res = await api(`/admin/projects/${encodeURIComponent(p.id)}`, 'DELETE')
            setText('project-result', res.message || 'deleted')
            await searchProjects()
            await refreshOverview()
          } catch (e) {
            alert('Error: ' + e.message)
          }
        }
      }])
    )
    setText('project-result', `${projects.length} result(s)`)
  } catch (e) {
    setText('project-result', 'Error: ' + e.message)
  }
}

document.getElementById('search-projects').onclick = searchProjects
document.getElementById('clear-project-search').onclick = () => { document.getElementById('project-search').value = ''; searchProjects() }

async function searchComments() {
  const q = document.getElementById('comment-search').value || ''
  try {
    const path = q ? `/admin/comments?q=${encodeURIComponent(q)}` : '/admin/comments'
    const commentsResponse = asArray(await api(path))
    const comments = Array.isArray(commentsResponse) ? commentsResponse : []
    renderTable(
      'comments',
      [
        { label: 'ID', value: 'id' },
        { label: 'User ID', value: 'user' },
        { label: 'Content', value: (c) => c.content || '', truncate: true },
        { label: 'Created', value: 'created_on' },
      ],
      comments,
      (c) => ([{
        label: 'Delete',
        className: 'danger',
        onClick: async () => {
          if (!confirm('Delete comment ' + c.id + '?')) return
          try {
            const res = await api(`/admin/comments/${encodeURIComponent(c.id)}`, 'DELETE')
            setText('comment-result', res.message || 'deleted')
            await searchComments()
            await refreshOverview()
          } catch (e) {
            setText('comment-result', 'Error: ' + e.message)
          }
        }
      }])
    )
    setText('comment-result', `${comments.length} result(s)`)
  } catch (e) {
    setText('comment-result', 'Error: ' + e.message)
  }
}

document.getElementById('search-comments').onclick = searchComments
document.getElementById('clear-comment-search').onclick = () => { document.getElementById('comment-search').value = ''; searchComments() }

window.addEventListener('load', async () => {
  const existingKey = getStoredAdminKey()
  const existingToken = getStoredAdminToken()
  if (!existingKey && !existingToken) {
    window.location.href = '/admin'
    return
  }

  await updateAuthStatus()
  await refreshOverview()
  await refreshUsers()
  await searchPosts()
  await searchProjects()
  await searchComments()
})
