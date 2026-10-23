import React from 'react';

// Production API URL: overridden via VITE_API_URL env var
// When NODE_ENV=production and VITE_API_URL is set, requests use the actual backend origin.
// When unset (development), requests go through the Vite /api proxy to localhost:5000.
// VITE_API_URL is the backend ORIGIN only (e.g. https://api.example.com).
// Requests are made to "<origin>/api", or the Vite proxy "/api" in development.
const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// Origin used for non-fetch transports (e.g. Socket.IO). Empty in dev so the
// Vite proxy handles it and requests stay same-origin.
export const API_ORIGIN = API_ROOT;
const API_BASE = API_ROOT ? `${API_ROOT}/api` : '/api';

const COOKIE_NAME = 'hh_token';

export const getToken = () => localStorage.getItem(COOKIE_NAME);

export const setToken = (t) => {
  // The server sets the real HttpOnly session cookie; JS cannot and must not
  // duplicate it. Store the token for the Authorization header fallback.
  localStorage.setItem(COOKIE_NAME, t);
};

export const clearToken = () => {
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

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
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

export async function apiBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers, credentials: 'include' });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* response was not JSON */
    }
    throw new Error(message);
  }
  return res.blob();
}
