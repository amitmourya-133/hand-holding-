import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api, getToken, setToken, clearToken, hasSessionHint } from './api.js';
import { connectSocket, disconnectSocket } from './socket.js';

const AuthContext = createContext();

const normalizeUser = (u) => (u && !u._id && u.id ? { ...u, _id: u.id } : u);

// Minimal user from the JWT payload, used only if /auth/me is temporarily slow
// or unreachable. The server still validates every request, so this only keeps
// the UI usable instead of logging the user out on a transient network blip.
const userFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return normalizeUser({
      _id: payload.id || payload.sub,
      id: payload.id || payload.sub,
      name: payload.name,
      role: payload.role,
    });
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const setUser = (u) => setUserState(normalizeUser(u));
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api('/notifications');
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  const attachSocket = useCallback(() => {
    const s = connectSocket();
    socketRef.current = s;
    if (!s) return;
    s.on('notification:new', (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const authCheck = async () => {
      let timeoutId;
      try {
        if (!getToken() && !hasSessionHint()) {
          setUser(null);
          setLoading(false);
          return;
        }
        // Give a cold backend (e.g. Render free tier) time to wake up instead of
        // logging the user out after an arbitrary short delay. The HttpOnly
        // session cookie is validated even when localStorage has no token.
        const authPromise = api('/auth/me');
        const timeoutPromise = new Promise((_, reject) => {
          const err = new Error('Auth check timeout');
          timeoutId = setTimeout(() => reject(err), 20000);
        });
        const result = await Promise.race([authPromise, timeoutPromise]);

        if (cancelled) return;
        setUser(result.user);
        attachSocket();
        loadNotifications();
      } catch (error) {
        if (cancelled) return;
        // Only clear the session when the server explicitly rejects the token.
        // Timeouts and network errors should not log the user out.
        if (error?.status === 401 || error?.status === 403) {
          clearToken();
          setUser(null);
        } else {
          const token = getToken();
          const fallback = token ? userFromToken(token) : null;
          if (fallback) {
            setUser(fallback);
          } else {
            clearToken();
            setUser(null);
          }
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        // ALWAYS clear loading state, even on timeout or error
        if (!cancelled) setLoading(false);
      }
    };

    authCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  const afterAuth = (data) => {
    if (data.token) setToken(data.token);
    setUser(data.user);
    attachSocket();
    loadNotifications();
    setLoading(false);
    return data.user;
  };

  const login = async (email, password) => afterAuth(await api('/auth/login', { method: 'POST', body: { email, password } }));

  const register = async (payload) => afterAuth(await api('/auth/register', { method: 'POST', body: payload }));

  // Clear the server-side HttpOnly session cookies as well as local state.
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, continue clearing the local session.
    }
    clearToken();
    disconnectSocket();
    setUser(null);
    setNotifications([]);
    setUnread(0);
  };

  const markAllRead = async () => {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api('/notifications/read-all', { method: 'POST' });
    } catch {
      /* ignore */
    }
  };

  const value = {
    user,
    setUser,
    loading,
    login,
    register,
    logout,
    notifications,
    unread,
    markAllRead,
    refreshNotifications: loadNotifications,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}