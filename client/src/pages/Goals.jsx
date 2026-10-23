import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { useLocation } from 'react-router-dom';
import { Button, EmptyState, StatusBadge, formatDate } from '../components/ui.jsx';

const menteeIdOf = (g) => String(g.mentee?._id || g.mentee || '');

export default function Goals() {
  const { user } = useAuth();
  const location = useLocation();

  const [goals, setGoals] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [selectedMentee, setSelectedMentee] = useState('');
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', dueDate: '' });
  const [error, setError] = useState('');

  const queryMentee = new URLSearchParams(location.search).get('mentee') || '';

  const loadGoals = async () => {
    try {
      const d = await api('/goals');
      setGoals(d.goals);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    loadGoals();
    if (user.role === 'mentor' || user.role === 'admin') {
      (async () => {
        try {
          const d = await api('/users/mentees');
          setMentees(d.mentees);
        } catch {}
      })();
    }
    if (queryMentee) setSelectedMentee(queryMentee);
  }, [user]);

  const updateStatus = async (goalId, status) => {
    try {
      await api(`/goals/${goalId}`, { method: 'PATCH', body: { status } });
      await loadGoals();
    } catch (err) {
      alert(err?.message || 'Could not update goal');
    }
  };

  const removeGoal = async (goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api(`/goals/${goalId}`, { method: 'DELETE' });
      await loadGoals();
    } catch (err) {
      alert(err?.message || 'Could not delete goal');
    }
  };

  const submitAddGoal = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedMentee) {
      setError('Select a mentee first');
      return;
    }
    try {
      await api('/goals', {
        method: 'POST',
        body: {
          menteeId: selectedMentee,
          title: newGoal.title,
          description: newGoal.description,
          dueDate: newGoal.dueDate || undefined,
        },
      });
      setAddGoalOpen(false);
      setNewGoal({ title: '', description: '', dueDate: '' });
      await loadGoals();
    } catch (err) {
      setError(err?.message || 'Could not create goal');
    }
  };

  if (!user) return null;

  const selectedGoals = selectedMentee ? goals.filter((g) => menteeIdOf(g) === String(selectedMentee)) : [];
  const selectedName =
    mentees.find((m) => String(m.id || m._id) === String(selectedMentee))?.name ||
    goals.find((g) => menteeIdOf(g) === String(selectedMentee))?.mentee?.name ||
    '';

  return (
    <div className="page">
      <div className="page-header">
        <h2>Goals</h2>
        <p className="muted">Set, track, and achieve your mentoring milestones.</p>
      </div>

      {/* Mentee view */}
      {user.role === 'mentee' && (
        <section className="section">
          <h3>My Goals</h3>
          {goals.length === 0 ? (
            <EmptyState title="No goals assigned" body="Your mentor can assign goals for you." />
          ) : (
            <ul className="list-unstyled">
              {goals.map((g) => (
                <li key={g._id} className="card">
                  <div className="d-flex w-100 justify-content-between">
                    <h6>{g.title}</h6>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="muted small">{g.description || '—'}</p>
                  {g.dueDate && <p className="muted small">Due: {formatDate(g.dueDate)}</p>}
                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{ width: g.status === 'completed' ? '100%' : g.status === 'in_progress' ? '50%' : '0%' }}
                    />
                  </div>
                  <span className="progress-text">{g.status.replace('_', ' ')}</span>
                  <div className="mt-2">
                    <label className="muted xsmall">Update status: </label>
                    <select
                      className="input"
                      style={{ maxWidth: 220, display: 'inline-block' }}
                      value={g.status}
                      onChange={(e) => updateStatus(g._id, e.target.value)}
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Mentor view */}
      {user.role === 'mentor' && (
        <section className="section">
          <div className="row">
            <div className="card col-12 col-md-4">
              <h3>Select Mentee</h3>
              <div className="form-group">
                <select
                  onChange={(e) => {
                    setSelectedMentee(e.target.value);
                    setAddGoalOpen(false);
                  }}
                  className="input"
                  value={selectedMentee}
                >
                  <option value="">— Select mentee —</option>
                  {mentees.map((m) => (
                    <option key={m.id || m._id} value={m.id || m._id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <Button
                button-small
                button-primary
                w-100
                disabled={!selectedMentee}
                onClick={() => setAddGoalOpen((v) => !v)}
              >
                Add Goal
              </Button>
            </div>

            <div className="card col-12 col-md-8">
              <h3>{selectedMentee ? `Goals for ${selectedName}` : 'Select a mentee above'}</h3>
              {!selectedMentee ? (
                <EmptyState title="Pick a mentee" body="Choose a mentee to view and assign goals." />
              ) : selectedGoals.length === 0 ? (
                <EmptyState title="No goals yet" body="Add a goal for this mentee to get started." />
              ) : (
                <ul className="list-unstyled">
                  {selectedGoals.map((g) => (
                    <li key={g._id} className="mb-3">
                      <div className="d-flex w-100 justify-content-between">
                        <h6>{g.title}</h6>
                        <StatusBadge status={g.status} />
                      </div>
                      <p className="muted small">{g.description || '—'}</p>
                      {g.dueDate && <p className="muted small">Due: {formatDate(g.dueDate)}</p>}
                      <div className="d-flex gap-3 align-items-center mt-1">
                        <select
                          className="input"
                          style={{ maxWidth: 200 }}
                          value={g.status}
                          onChange={(e) => updateStatus(g._id, e.target.value)}
                        >
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <Button button-small button-danger onClick={() => removeGoal(g._id)}>Delete</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {addGoalOpen && selectedMentee && (
            <div className="card mt-3">
              <h3>Add Goal</h3>
              <form onSubmit={submitAddGoal}>
                {error && <p className="text-danger small">{error}</p>}
                <div className="form-group">
                  <label>Goal title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Goal title"
                    required
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Description"
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Due date</label>
                  <input
                    type="date"
                    className="input"
                    value={newGoal.dueDate}
                    onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
                  />
                </div>
                <div className="d-flex gap-3">
                  <button type="submit" className="button button-primary">Create</button>
                  <button type="button" className="button button-secondary" onClick={() => setAddGoalOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {/* Admin view */}
      {user.role === 'admin' && (
        <section className="section">
          <h3>All Goals</h3>
          <p className="muted small">Total: {goals.length}</p>
          <ul className="list-unstyled small">
            {goals.map((g) => (
              <li key={g._id} className="mb-1">
                <strong>{g.mentee?.name || 'Unknown'} → {g.title}</strong>{' '}
                <StatusBadge status={g.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
