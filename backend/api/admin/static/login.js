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

async function verifyKey(key) {
  const res = await fetch('/admin/overview', {
    method: 'GET',
    headers: { 'X-Admin-Key': key }
  })
  return res.ok
}

async function loginWithCredentials(username, password) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  let payload = null
  try {
    payload = await res.json()
  } catch (_) {
    payload = null
  }

  if (!res.ok) {
    const msg = payload?.message || payload?.error || 'Invalid credentials'
    throw new Error(msg)
  }

  const token = payload?.token
  if (!token) {
    throw new Error('Login succeeded but token is missing')
  }

  const meRes = await fetch('/admin/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!meRes.ok) {
    if (meRes.status === 403) {
      throw new Error('This account is not an admin')
    }
    throw new Error('Failed to verify admin access')
  }

  return token
}

const statusEl = document.getElementById('status')
const usernameInput = document.getElementById('username-input')
const passwordInput = document.getElementById('password-input')
const signInBtn = document.getElementById('sign-in')

async function signIn() {
  const username = (usernameInput.value || '').trim()
  const password = (passwordInput.value || '').trim()

  if (!username || !password) {
    statusEl.textContent = 'Enter username and password.'
    return
  }

  statusEl.textContent = 'Signing in...'
  signInBtn.disabled = true
  try {
    if (username.toLowerCase() === 'administrator') {
      const ok = await verifyKey(password)
      if (!ok) {
        statusEl.textContent = 'Invalid Administrator password.'
        return
      }

      setStoredAdminToken('')
      setStoredAdminKey(password)
    } else {
      const token = await loginWithCredentials(username, password)
      setStoredAdminKey('')
      setStoredAdminToken(token)
    }

    statusEl.textContent = 'Success. Redirecting...'
    window.location.href = '/admin/console'
  } catch (error) {
    statusEl.textContent = `Sign in failed: ${error.message || 'network error'}`
  } finally {
    signInBtn.disabled = false
  }
}

signInBtn.addEventListener('click', signIn)

usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    signIn()
  }
})

passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    signIn()
  }
})
