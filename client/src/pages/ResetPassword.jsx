import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

const isStrongEnough = (password) =>
  password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!isStrongEnough(password)) {
      setError('Password must be at least 8 characters and contain at least one letter and one number');
      return;
    }

    setBusy(true);
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Reset Password</h2>
        </div>
        <p className="text-danger">This reset link is missing its token.</p>
        <Link to="/forgot" className="link">Request a new reset link</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Reset Password</h2>
        <p className="muted">Choose a new password for your account.</p>
      </div>

      {error && <p className="text-danger">{error}</p>}

      <form onSubmit={handleSubmit} className="form-group">
        <label>New password</label>
        <input
          type="password"
          placeholder="Enter new password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="mt-2">Confirm new password</label>
        <input
          type="password"
          placeholder="Re-enter new password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <small>Minimum 8 characters with at least one letter and one number.</small>
        <button type="submit" className="button button-primary mt-2" disabled={busy}>
          {busy ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>

      <p className="muted small mt-3">
        <Link to="/login" className="link">Back to login</Link>
      </p>
    </div>
  );
}
