import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Card, Button, FormGroup, Input, Textarea } from '../components/ui.jsx';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  role: 'mentor',
  mentorType: 'faculty',
  department: '',
  bio: '',
  skills: '',
  availability: 'available',
};

export default function Admin() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStatsError('');
      const d = await api('/stats');
      setStats(d.admin);
    } catch (err) {
      setStatsError(err?.message || 'Could not load admin statistics');
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    loadStats();
  }, [user?._id, user?.role, loadStats]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setNotice('');
    setSaving(true);
    try {
      await api('/users/admin/create', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          mentorType: form.role === 'mentor' ? form.mentorType : '',
          department: form.department,
          bio: form.bio,
          skills:
            form.role === 'mentor'
              ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
          availability: form.role === 'mentor' ? form.availability : 'available',
        },
      });
      setNotice('User created successfully');
      setShowAddUser(false);
      setForm(EMPTY_FORM);
      await loadStats();
    } catch (err) {
      setFormError(err?.message || 'Could not create user');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (!stats) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Admin Dashboard</h2>
        </div>
        {statsError ? (
          <>
            <p className="text-danger">{statsError}</p>
            <Button button-primary onClick={loadStats}>Retry</Button>
          </>
        ) : (
          <div className="page-loading">Loading admin dashboard…</div>
        )}
      </div>
    );
  }

  const { users, connections, meetings, goals, feedback, messages } = stats;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Admin Dashboard</h2>
      </div>

      {notice && <p className="text-success small">{notice}</p>}

      <div className="row">
        {/* Users column */}
        <div className="col-12 col-md-4">
          <Card>
            <h3>Users</h3>
            <p className="muted small">Total: {users?.total ?? 0}</p>
            <ul className="list-unstyled small">
              <li>Mentees: {users?.mentees ?? 0}</li>
              <li>Mentors: {users?.mentors ?? 0}</li>
              <li>Admins: {users?.admins ?? 0}</li>
            </ul>
            <Button button-primary onClick={() => setShowAddUser((v) => !v)}>
              {showAddUser ? 'Close' : 'Add User'}
            </Button>
          </Card>

          {showAddUser && (
            <Card>
              <h3>Add User</h3>
              <form onSubmit={handleAddUser}>
                {formError && <p className="text-danger small">{formError}</p>}
                <FormGroup>
                  <Input
                    label="Full Name"
                    name="fullName"
                    type="text"
                    required
                    value={form.fullName}
                    onChange={handleFormChange}
                  />
                </FormGroup>
                <FormGroup>
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleFormChange}
                  />
                </FormGroup>
                <FormGroup>
                  <Input
                    label="Temporary Password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={handleFormChange}
                  />
                  <small className="muted xsmall">
                    At least 8 characters with one letter and one number
                  </small>
                </FormGroup>
                <FormGroup>
                  <label className="input-label">Role</label>
                  <select name="role" className="input" value={form.role} onChange={handleFormChange}>
                    <option value="mentor">Mentor</option>
                    <option value="mentee">Mentee</option>
                  </select>
                </FormGroup>
                {form.role === 'mentor' && (
                  <>
                    <FormGroup>
                      <label className="input-label">Mentor Type</label>
                      <select
                        name="mentorType"
                        className="input"
                        value={form.mentorType}
                        onChange={handleFormChange}
                      >
                        <option value="faculty">Faculty</option>
                        <option value="alumni">Alumni</option>
                        <option value="industry">Industry</option>
                      </select>
                    </FormGroup>
                    <FormGroup>
                      <label className="input-label">Availability</label>
                      <select
                        name="availability"
                        className="input"
                        value={form.availability}
                        onChange={handleFormChange}
                      >
                        <option value="available">Available</option>
                        <option value="limited">Limited</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </FormGroup>
                    <FormGroup>
                      <Input
                        label="Skills (comma separated)"
                        name="skills"
                        type="text"
                        value={form.skills}
                        onChange={handleFormChange}
                        placeholder="e.g., Leadership, Coaching"
                      />
                    </FormGroup>
                  </>
                )}
                <FormGroup>
                  <Input
                    label="Department"
                    name="department"
                    type="text"
                    value={form.department}
                    onChange={handleFormChange}
                  />
                </FormGroup>
                <FormGroup>
                  <Textarea
                    label="Bio"
                    name="bio"
                    rows={3}
                    value={form.bio}
                    onChange={handleFormChange}
                    placeholder="Short introduction"
                  />
                </FormGroup>
                <Button type="submit" button-primary w-full disabled={saving}>
                  {saving ? 'Creating…' : 'Create User'}
                </Button>
              </form>
            </Card>
          )}

          <Card>
            <h3>Connections</h3>
            <p className="muted small">Total: {connections?.total ?? 0}</p>
            <ul className="list-unstyled small">
              <li>Pending: {connections?.pending ?? 0}</li>
              <li>Accepted: {connections?.accepted ?? 0}</li>
            </ul>
          </Card>
        </div>

        {/* Meetings column */}
        <div className="col-12 col-md-4">
          <Card>
            <h3>Meetings</h3>
            <p className="muted small">Total: {meetings?.total ?? 0}</p>
            <ul className="list-unstyled small">
              <li>Pending: {meetings?.pending ?? 0}</li>
              <li>Accepted: {meetings?.accepted ?? 0}</li>
              <li>Completed: {meetings?.completed ?? 0}</li>
            </ul>
          </Card>

          <Card>
            <h3>Goals</h3>
            <p className="muted small">Total: {goals?.total ?? 0}</p>
            <ul className="list-unstyled small">
              <li>Completed: {goals?.completed ?? 0}</li>
              <li>In Progress: {goals?.inProgress ?? 0}</li>
            </ul>
          </Card>
        </div>

        {/* Feedback column */}
        <div className="col-12 col-md-4">
          <Card>
            <h3>Feedback</h3>
            <p className="muted small">Count: {feedback?.count ?? 0}</p>
            <ul className="list-unstyled small">
              <li>Avg Rating: {feedback?.avg ?? 0}★</li>
            </ul>
          </Card>

          <Card>
            <h3>Messages</h3>
            <p className="muted small">Total: {messages ?? 0}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
