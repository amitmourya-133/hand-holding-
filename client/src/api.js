import React from 'react';

const COOKIE_NAME = 'hh_token';

export const getToken = () => {
  // Try cookies first (HttpOnly, set by server via res.cookie)
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp('(?:(?:^|;)\s*' + COOKIE_NAME + ')=([^;]*)'));
    if (match?.[1]) return match[1];
  }
  // Fall back to localStorage for transitional support
  return localStorage.getItem(COOKIE_NAME);
};

export const setToken = (t) => {
  if (typeof document !== 'undefined') {
    // Set cookie with same options as backend
    const options = 'httpOnly;secure=' + (process.env.NODE_ENV === 'production') + ';SameSite=' + (process.env.NODE_ENV === 'production' ? 'none' : 'lax') + ';path=/;max-age=' + (7 * 24 * 60 * 60);
    document.cookie = COOKIE_NAME + '=' + t + '; ' + options;
  }
  localStorage.setItem(COOKIE_NAME, t);
};

export const clearToken = () => {
  if (typeof document !== 'undefined') {
    document.cookie = COOKIE_NAME + '=; Max-Age=0; Path=/;';
  }
  localStorage.removeItem(COOKIE_NAME);
};

export function useAuth() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub || payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
        });
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  return { user, loading };
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
