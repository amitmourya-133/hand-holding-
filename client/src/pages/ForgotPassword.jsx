import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api('/auth/forgot', { method: 'POST', body: { email: email.trim() } });
      setSent(true);
      setMessage(
        'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.'
      );
    } catch (err) {
      setError(err?.message || 'Could not process the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Forgot Password</h2>
        <p className="muted">Enter your account email to request a reset link.</p>
      </div>

      {message && <p className="text-success">{message}</p>}
      {error && <p className="text-danger">{error}</p>}

      {!sent && (
        <form onSubmit={handleSubmit} className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <button type="submit" className="button button-primary mt-2" disabled={busy}>
            {busy ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
      )}

      <p className="muted small mt-3">
        Remembered your password? <Link to="/login" className="link">Back to login</Link>
      </p>
    </div>
  );
}
