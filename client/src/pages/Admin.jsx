import { useContext, useEffect, useState } from 'react';
import { useAuth, api } from '../api.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, EmptyState, StatButton, Button } from '../components/ui.jsx';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'mentor',
    bio: '',
    skills: '',
    availability: 'available',
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const d = await api('/stats');
        setStats(d.admin);
      } catch {}
    })();
  }, [user?.id]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const resp = await api('/users/admin/create', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          bio: form.bio,
          skills: form.role === 'mentor' ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          availability: form.role === 'mentor' ? form.availability : 'available',
        },
      });
      if (resp.ok) {
        alert('User created successfully');
        setShowAddUser(false);
        // optionally refresh stats
      } else {
        alert(resp.error || 'Failed to create user');
      }
    } catch (err) {
      alert(err?.message || 'Error creating user');
    }
  };

  if (!user) return null;
  if (!stats) return <div>Loading admin dashboard…</div>;

  const { users, connections, meetings, goals, feedback } = stats;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Admin Dashboard</h2>
      </div>

      <div className="row">
        {/* Users column */}
        <div className="col-12 col-md-4">
          <Card>
            <h3>Users</h3>
            <p className="muted small">Total: {users?.total}</p>
            <ul className="list-unstyled small">
              {users?.mentees ? (
                <li>Mentees: {users.mentees}</li>
              ) : ''}
              {users?.mentors ? (
                <li>Mentors: {users.mentors}</li>
              ) : ''}
              {users?.admins ? (
                <li>Admins: {users.admins}</li>
              ) : ''}
</ul>
            </Card>
          {user?.role === 'admin' && (
            <Button button-primary onClick={() => setShowAddUser(true)}>Add User</Button>
          )}

          <Card>
            <h3>Connections</h3>
            <p className="muted small">Total: {connections?.total}</p>
            <ul className="list-unstyled small">
              {connections?.pending ? (
                <li>Pending: {connections.pending}</li>
              ) : ''}
              {connections?.accepted ? (
                <li>Accepted: {connections.accepted}</li>
              ) : ''}
            </ul>
          </Card>
        </div>

        {/* Meetings column */}
        <div className="col-12 col-md-4">
          <Card>
            <h3>Meetings</h3>
            <p className="muted small">Total: {meetings?.total}</p>
            <ul className="list-unstyled small">
              {meetings?.pending ? (
                <li>Pending: {meetings.pending}</li>
              ) : ''}
              {meetings?.accepted ? (
                <li>Accepted: {meetings.accepted}</li>
              ) : ''}
              {meetings?.completed ? (
                <li>Completed: {meetings.completed}</li>
              ) : ''}
            </ul>
          </Card>

          <Card>
            <h3>Goals</h3>
            <p className="muted small">Total: {goals?.total}</p>
            <ul className="list-unstyled small">
              {goals?.completed ? (
                <li>Completed: {goals.completed}</li>
              ) : ''}
              {goals?.inProgress ? (
                <li>In Progress: {goals.inProgress}</li>
              ) : ''}
            </ul>
          </Card>
        </div>

        {/* Feedback column */}
        <div className="col-12 col-md-4">
          <Card>
            <h3>Feedback</h3>
            <p className="muted small">Count: {feedback?.count}</p>
            <ul className="list-unstyled small">
              {feedback?.avg !== undefined && (
                <li>Avg Rating: {feedback.avg}★</li>
              )}
            </ul>
          </Card>

          <Card>
            <h3>Messages</h3>
            <p className="muted small">Total: {feedback?.messages || 0}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}