import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';
import { connectSocket, disconnectSocket } from './socket.js';

const AuthContext = createContext();

const normalizeUser = (u) => (u && !u._id && u.id ? { ...u, _id: u.id } : u);

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
      try {
        if (!getToken()) {
          setUser(null);
          setLoading(false);
          return;
        }
        // Use Promise.race with a timeout to prevent infinite hanging
        const authPromise = api('/auth/me');
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth check timeout')), 5000);
        });
        const result = await Promise.race([authPromise, timeoutPromise]);

        if (cancelled) return;
        setUser(result.user);
        attachSocket();
        loadNotifications();
      } catch (error) {
        // Always clear invalid auth state on any error
        clearToken();
      } finally {
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
    setToken(data.token);
    setUser(data.user);
    attachSocket();
    loadNotifications();
    setLoading(false);
    return data.user;
  };

  const login = async (email, password) => afterAuth(await api('/auth/login', { method: 'POST', body: { email, password } }));

  const register = async (payload) => afterAuth(await api('/auth/register', { method: 'POST', body: payload }));

  const logout = () => {
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