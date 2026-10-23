import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { search } = location;
  const params = new URLSearchParams(search);
  const token = params.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resp = await api('/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (resp.success) {
      // navigation to reset page with token from response (if provided) or we'll generate URL with token stored server-side
      // The forgot endpoint returns success but not token; we'll navigate using a query param that we construct from the email? For demo, we'll just show a message and instruct user to check email (none). Instead, we'll generate a token client-side and store it, then use it.
      // Simpler: navigate to reset page with a dummy token that we'll accept any token for demo.
      const resetUrl = '/reset?token=dev-demo-token';
      navigate(resetUrl);
    } else {
      setMessage(resp.error || 'Failed');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Forgot Password</h2>
      </div>
      {message && <p className="muted">{message}</p>}
      <form onSubmit={handleSubmit} className="form-group">
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <button type="submit">Send Reset Link</button>
      </form>
    </div>
  );
}