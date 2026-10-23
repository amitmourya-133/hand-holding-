import { useContext, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Navigate } from 'react-router-dom';

export default function Register() {
  const { user, loading, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('mentee');
  const [mentorType, setMentorType] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [skills, setSkills] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');

  if (loading) return <div className="page-loading">Loading App for Hand Holding…</div>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register({
        name,
        email,
        password,
        role,
        mentorType: role === 'mentor' ? mentorType : '',
        department,
        batch,
        company,
        designation,
        skills: skills.split(',').map(s => s.trim()).filter(s => s),
        bio,
      });
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
            <>
              <div className="form-group">
                <label>Mentor Type</label>
                <select value={mentorType} onChange={(e) => setMentorType(e.target.value)} className="input">
                  <option value="faculty">Faculty</option>
                  <option value="alumni">Alumni</option>
                  <option value="industry">Industry</option>
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="input" placeholder="e.g., Computer Science" />
              </div>
              <div className="form-group">
                <label>Batch / Graduation Year</label>
                <input type="text" value={batch} onChange={(e) => setBatch(e.target.value)} className="input" placeholder="e.g., 2024" />
              </div>
            </>
          )}
          {role === 'mentee' && (
            <>
              <div className="form-group">
                <label>Department</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="input" placeholder="e.g., Computer Science" />
              </div>
              <div className="form-group">
                <label>Batch / Graduation Year</label>
                <input type="text" value={batch} onChange={(e) => setBatch(e.target.value)} className="input" placeholder="e.g., 2027" />
              </div>
            </>
          )}
          {role === 'mentor' && (
            <div className="form-group">
              <label>Company / Organization</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="input" placeholder="e.g., Google / TCS" />
            </div>
          )}
          {role === 'mentor' && (
            <div className="form-group">
              <label>Designation / Title</label>
              <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className="input" placeholder="e.g., Senior Engineer" />
            </div>
          )}
          {role === 'mentor' && (
            <div className="form-group">
              <label>Skills (comma separated)</label>
              <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} className="input" placeholder="e.g., Leadership, Coaching, Python" />
            </div>
          )}
          {role === 'mentee' && (
            <div className="form-group">
              <label>Bio (optional)</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="textarea" rows={3} placeholder="Tell us about yourself" />
            </div>
          )}
          {error && <p className="text-danger small">{error}</p>}
          <button type="submit" className="button button-primary w-full">
            Sign Up
          </button>
        </form>
        <p className="auth-divider">or</p>
        <div className="auth-links">
          <a href="/login" className="link">Sign in</a>
        </div>
      </div>
    </div>
  );
}