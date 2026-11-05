import { useState, useEffect } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, Input, Textarea, Avatar, Spinner, EmptyState, Badge } from '../components/ui.jsx';

export default function Roadmaps() {
  const { user } = useAuth();
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  useEffect(() => {
    loadRoadmaps();
    if (user?.role === 'mentor' || user?.role === 'admin') {
      loadUsers();
    }
  }, []);

  async function loadRoadmaps() {
    setLoading(true);
    try {
      const data = await api('/roadmaps');
      setRoadmaps(data.roadmaps || []);
    } catch (err) {
      setError(err.message || 'Failed to load roadmaps');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await api('/users/mentees');
      setUsers(data.mentees || []);
    } catch (err) {
      // ignore
    }
  }

  async function createRoadmap(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await api('/roadmaps', {
        method: 'POST',
        body: {
          userId: selectedUser || user.id,
          title: newTitle.trim(),
          description: newDesc.trim(),
          category: newCategory.trim(),
        },
      });
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewCategory('');
      setSelectedUser('');
      loadRoadmaps();
    } catch (err) {
      setError(err.message || 'Failed to create roadmap');
    }
  }

  async function viewRoadmap(roadmap) {
    try {
      const data = await api(`/roadmaps/${roadmap._id}`);
      setSelectedRoadmap(data.roadmap);
      setMilestones(data.roadmap.milestones || []);
    } catch (err) {
      setError(err.message || 'Failed to load roadmap');
    }
  }

  async function addMilestone(e) {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !selectedRoadmap) return;
    try {
      await api(`/roadmaps/${selectedRoadmap._id}/milestones`, {
        method: 'POST',
        body: { title: newMilestoneTitle.trim() },
      });
      setNewMilestoneTitle('');
      viewRoadmap(selectedRoadmap);
    } catch (err) {
      setError(err.message || 'Failed to add milestone');
    }
  }

  async function toggleMilestone(milestone) {
    if (!selectedRoadmap) return;
    try {
      await api(`/roadmaps/${selectedRoadmap._id}/milestones/${milestone._id}`, {
        method: 'PATCH',
        body: { completed: !milestone.completed },
      });
      viewRoadmap(selectedRoadmap);
    } catch (err) {
      setError(err.message || 'Failed to update milestone');
    }
  }

  async function deleteRoadmap(id) {
    if (!window.confirm('Delete this roadmap and all its milestones?')) return;
    try {
      await api(`/roadmaps/${id}`, { method: 'DELETE' });
      if (selectedRoadmap?._id === id) {
        setSelectedRoadmap(null);
        setMilestones([]);
      }
      loadRoadmaps();
    } catch (err) {
      setError(err.message || 'Failed to delete roadmap');
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h2>Career Roadmap</h2></div>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Career Roadmap</h2>
        {(user?.role === 'mentor' || user?.role === 'admin') && (
          <Button onClick={() => setShowCreate(true)}>+ New Roadmap</Button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Create Roadmap</h3>
          <form onSubmit={createRoadmap}>
            {(user?.role === 'mentor' || user?.role === 'admin') && (
              <div className="form-group">
                <label>For User</label>
                <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                  <option value="">Select mentee...</option>
                  {users.map((u) => (
                    <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Title</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Roadmap title" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. career, skills" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="submit">Create</Button>
              <Button type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h3>Roadmaps</h3>
          {roadmaps.length === 0 ? (
            <EmptyState title="No roadmaps yet" body="Create a career roadmap to get started." />
          ) : (
            roadmaps.map((r) => (
              <div
                key={r._id}
                className="card"
                style={{ marginBottom: '0.5rem', cursor: 'pointer', border: selectedRoadmap?._id === r._id ? '2px solid #4f6df5' : undefined }}
                onClick={() => viewRoadmap(r)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{r.title}</strong>
                  <Badge tone={r.status === 'completed' ? 'success' : r.status === 'in_progress' ? 'warning' : 'neutral'}>
                    {r.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="muted small">{r.description}</p>
                {r.category && <span className="badge badge-neutral">{r.category}</span>}
                {(user?.role === 'mentor' || user?.role === 'admin') && (
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); deleteRoadmap(r._id); }} style={{ marginTop: '0.5rem' }}>
                    Delete
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {selectedRoadmap && (
          <div style={{ flex: 2, minWidth: '320px' }}>
            <div className="card">
              <h3>{selectedRoadmap.title}</h3>
              <p className="muted">{selectedRoadmap.description}</p>
              <h4>Milestones</h4>
              {milestones.length === 0 ? (
                <EmptyState title="No milestones yet" body="Add milestones to track progress." />
              ) : (
                milestones.map((m) => (
                  <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={m.completed}
                      onChange={() => toggleMilestone(m)}
                    />
                    <span style={{ textDecoration: m.completed ? 'line-through' : 'none' }}>{m.title}</span>
                    {m.dueDate && <span className="muted small">Due: {new Date(m.dueDate).toLocaleDateString()}</span>}
                  </div>
                ))
              )}

              {(user?.role === 'mentor' || user?.role === 'admin') && (
                <form onSubmit={addMilestone} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <Input
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="New milestone title"
                    style={{ flex: 1 }}
                  />
                  <Button type="submit">Add</Button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
