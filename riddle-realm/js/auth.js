/**
 * Riddle Realm — Auth client (Phase 21)
 * Optional accounts via API + MongoDB sessions.
 * Guests play without signing in. Session token is only a client handle;
 * authorization is enforced on the server (Session + User role).
 */
const Auth = (function () {
  'use strict';

  const TOKEN_KEY = 'rr_auth_token';
  const USER_KEY = 'rr_auth_user';
  const PUBLIC_ROLES = ['student', 'parent', 'teacher'];

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(token, user) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  function isLoggedIn() {
    return !!getToken() && !!getUser();
  }

  function isGuest() {
    return !isLoggedIn();
  }

  function getRole() {
    const u = getUser();
    return (u && u.role) || null;
  }

  function extractError(res, fallback) {
    if (!res) return fallback;
    if (res.data && res.data.error) return res.data.error;
    if (res.error) return res.error;
    return fallback;
  }

  async function register(payload) {
    if (typeof API === 'undefined') {
      return { ok: false, error: 'API client missing — start the server to create an account' };
    }

    const username = String(payload.username || '').trim().toLowerCase();
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const confirm = payload.confirmPassword != null ? String(payload.confirmPassword) : null;
    const displayName = String(payload.displayName || '').trim();
    let role = String(payload.role || 'student').toLowerCase();
    if (PUBLIC_ROLES.indexOf(role) === -1) role = 'student';

    if (username.length < 3 || username.length > 32) {
      return { ok: false, error: 'Username must be 3–32 characters' };
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return { ok: false, error: 'Username may only contain letters, numbers, and underscores' };
    }
    if (!email || email.indexOf('@') === -1) {
      return { ok: false, error: 'Valid email required' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters' };
    }
    if (confirm != null && password !== confirm) {
      return { ok: false, error: 'Passwords do not match' };
    }

    const res = await API.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password,
        displayName: displayName,
        role: role
      })
    });

    if (res.ok && res.data && res.data.token && res.data.user) {
      saveSession(res.data.token, res.data.user);
      return { ok: true, user: res.data.user };
    }
    return {
      ok: false,
      error: extractError(res, 'Register failed'),
      code: res.code || (res.data && res.data.code)
    };
  }

  async function login(payload) {
    if (typeof API === 'undefined') {
      return { ok: false, error: 'API client missing — start the server to sign in' };
    }

    const body = {
      login: String(payload.login || payload.email || payload.username || '')
        .trim()
        .toLowerCase(),
      password: String(payload.password || '')
    };

    if (!body.login || !body.password) {
      return { ok: false, error: 'Login and password required' };
    }

    const res = await API.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok && res.data && res.data.token && res.data.user) {
      saveSession(res.data.token, res.data.user);
      return { ok: true, user: res.data.user };
    }
    return {
      ok: false,
      error: extractError(res, 'Login failed'),
      code: res.code || (res.data && res.data.code)
    };
  }

  async function logout() {
    const token = getToken();
    if (typeof API !== 'undefined' && token) {
      try {
        await API.request('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ token: token })
        });
      } catch (e) {
        /* still clear local session */
      }
    }
    clearSession();
    return { ok: true };
  }

  async function refreshMe() {
    const token = getToken();
    if (!token || typeof API === 'undefined') return { ok: false };
    const res = await API.request('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.ok && res.data && res.data.user) {
      saveSession(token, res.data.user);
      return { ok: true, user: res.data.user };
    }
    if (res.status === 401) clearSession();
    return { ok: false, error: extractError(res, 'Session expired') };
  }

  function routeForRole(user) {
    const role = (user && user.role) || 'student';
    if (role === 'founder') return 'founder';
    if (role === 'parent') return 'dash-parent';
    if (role === 'teacher') return 'dash-teacher';
    return 'dash-student';
  }

  function requireAccount(reason) {
    if (isLoggedIn()) return { ok: true, user: getUser() };
    return {
      ok: false,
      needsAuth: true,
      reason: reason || 'Create an account to unlock this feature.'
    };
  }

  return {
    getToken: getToken,
    getUser: getUser,
    getRole: getRole,
    isLoggedIn: isLoggedIn,
    isGuest: isGuest,
    register: register,
    login: login,
    logout: logout,
    refreshMe: refreshMe,
    clearSession: clearSession,
    routeForRole: routeForRole,
    requireAccount: requireAccount
  };
})();
