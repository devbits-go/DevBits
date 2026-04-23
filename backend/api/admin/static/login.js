function setStoredAdminKey(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    sessionStorage.removeItem("devbits_admin_key");
    return "";
  }
  sessionStorage.setItem("devbits_admin_key", trimmed);
  return trimmed;
}

function setStoredAdminToken(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    sessionStorage.removeItem("devbits_admin_token");
    return "";
  }
  sessionStorage.setItem("devbits_admin_token", trimmed);
  return trimmed;
}

async function verifyKey(key) {
  const response = await fetch("/admin/overview", {
    method: "GET",
    headers: { "X-Admin-Key": key },
  });
  return response.ok;
}

async function loginWithCredentials(username, password) {
  const response = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Invalid credentials";
    throw new Error(message);
  }

  const token = payload?.token;
  if (!token) {
    throw new Error("Login succeeded but token is missing");
  }

  const meResponse = await fetch("/admin/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!meResponse.ok) {
    if (meResponse.status === 403) {
      throw new Error("This account is not an admin");
    }
    throw new Error("Failed to verify admin access");
  }

  return token;
}

const statusEl = document.getElementById("status");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const passwordToggle = document.getElementById("password-toggle");
const signInButton = document.getElementById("sign-in");
const form = document.getElementById("signin-form");

function setSignInVisualState(state) {
  if (!signInButton) return;
  signInButton.classList.remove("is-loading", "is-success", "is-error");
  if (state) {
    signInButton.classList.add(state);
  }
}

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", !!isError);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleSignIn(event) {
  event.preventDefault();
  const username = (usernameInput?.value || "").trim();
  const password = (passwordInput?.value || "").trim();

  if (!username || !password) {
    setStatus("Enter username and password.", true);
    return;
  }

  setStatus("Signing in...", false);
  setSignInVisualState("is-loading");

  try {
    if (username.toLowerCase() === "administrator") {
      const ok = await verifyKey(password);
      if (!ok) {
        throw new Error("Invalid Administrator password.");
      }
      setStoredAdminToken("");
      setStoredAdminKey(password);
    } else {
      const token = await loginWithCredentials(username, password);
      setStoredAdminKey("");
      setStoredAdminToken(token);
    }

    setSignInVisualState("is-success");
    setStatus("Success. Redirecting...", false);
    await wait(280);
    window.location.href = "/admin/console#/dashboard";
  } catch (error) {
    setSignInVisualState("is-error");
    setStatus(`Sign in failed: ${error?.message || "network error"}`, true);
    await wait(420);
    setSignInVisualState("");
  }
}

if (passwordToggle && passwordInput) {
  passwordToggle.addEventListener("click", () => {
    const reveal = passwordInput.type === "password";
    passwordInput.type = reveal ? "text" : "password";
    passwordToggle.textContent = reveal ? "Hide" : "Show";
    passwordToggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
  });
}

if (form) {
  form.addEventListener("submit", handleSignIn);
}
