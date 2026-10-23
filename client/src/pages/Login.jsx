import { useContext, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('mentee');
  const [error, setError] = useState('');

  if (loading) return <div className="page-loading">Loading App for Hand Holding…</div>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
              <option value="mentee">Mentee</option>
              <option value="mentor">Mentor</option>
            </select>
          </div>
          {role === 'mentor' && (
            <div className="form-group">
              <label>Mentor Type</label>
              <select className="input">
                <option value="faculty">Faculty</option>
                <option value="alumni">Alumni</option>
                <option value="industry">Industry</option>
              </select>
            </div>
          )}
          {error && <p className="text-danger small">{error}</p>}
          <button type="submit" className="button button-primary w-full">
            Sign In
          </button>
        </form>
        <p className="auth-divider">or</p>
        <div className="auth-links">
          <a href="/register" className="link">Create an account</a>
          <a href="/forgot" className="link">Forgot Password?</a>
        </div>
      </div>
    </div>
  );
}