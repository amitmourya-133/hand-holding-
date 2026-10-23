import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      const navigate = useNavigate();
      navigate('/login', { replace: true });
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resp = await api('/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (resp.ok) {
      const navigate = useNavigate();
      navigate('/login', { replace: true });
    } else {
      setError(resp.error || 'Failed to reset password');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Reset Password</h2>
      </div>
      {error && <p className="muted" style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} className="form-group">
        <label>New password</label>
        <input
          type="password"
          placeholder="Enter new password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <small>Minimum 6 characters</small>
        <button type="submit">Reset Password</button>
      </form>
    </div>
  );
}