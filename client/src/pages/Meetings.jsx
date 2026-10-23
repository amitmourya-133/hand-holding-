import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, StatusBadge, formatDate } from '../components/ui.jsx';

export default function Meetings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { _id: userId } = user || {};
  const [meetings, setMeetings] = useState([]);
  const [filter, setFilter] = useState('upcoming');
  const [scheduling, setScheduling] = useState(false);
  const [partners, setPartners] = useState({ mentors: [], mentees: [] });
  const [error, setError] = useState('');

  const loadMeetings = async () => {
    try {
      const d = await api('/meetings?scope=all');
      setMeetings(d.meetings);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    loadMeetings();
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    (async () => {
      try {
        const d = await api('/users/connections?status=accepted');
        const mentors = d.connections.map((c) => c.mentor).filter((m) => m && String(m._id) !== String(user._id));
        const mentees = d.connections.map((c) => c.mentee).filter((m) => m && String(m._id) !== String(user._id));
        setPartners({ mentors, mentees });
      } catch {}
    })();
  }, [user]);

  const isProposer = (m) => String(m.proposedBy) === String(user?._id);
  const isParticipant = (m) =>
    String(m.mentor?._id || m.mentor) === String(user?._id) || String(m.mentee?._id || m.mentee) === String(user?._id);

  const respond = async (id, action) => {
    try {
      await api(`/meetings/${id}/respond`, { method: 'POST', body: { action } });
      await loadMeetings();
    } catch (err) {
      alert(err?.message || 'Could not respond');
    }
  };

  const complete = async (id) => {
    try {
      await api(`/meetings/${id}/complete`, { method: 'POST' });
      await loadMeetings();
    } catch (err) {
      alert(err?.message || 'Could not complete');
    }
  };

  const handleReschedule = async (meetingId) => {
    const date = window.prompt('Enter new date (ISO string, e.g., 2024-12-25T15:00):');
    if (!date) return;
    try {
      const resp = await api(`/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      if (resp.meeting) {
        alert('Meeting rescheduled successfully');
        await loadMeetings();
      } else {
        alert(resp.error || 'Failed to reschedule');
      }
    } catch (err) {
      alert(err?.message || 'Error rescheduling meeting');
    }
  };

  const now = Date.now();
  const visible = meetings.filter((m) => {
    const t = new Date(m.date).getTime();
    if (filter === 'upcoming') return t >= now && ['pending', 'accepted'].includes(m.status);
    if (filter === 'past') return t < now || ['completed', 'declined', 'cancelled'].includes(m.status);
    return true;
  });

  const submitSchedule = async (e) => {
    e.preventDefault();
    setError('');
    const form = new FormData(e.target);
    try {
      await api('/meetings', {
        method: 'POST',
        body: {
          mentorId: form.get('mentorId') || undefined,
          menteeId: form.get('menteeId') || undefined,
          title: form.get('title'),
          agenda: form.get('agenda') || '',
          date: form.get('date'),
          durationMin: Number(form.get('durationMin')) || 30,
          mode: form.get('mode') || 'online',
          placeOrLink: form.get('placeOrLink') || '',
        },
      });
      setScheduling(false);
      await loadMeetings();
    } catch (err) {
      setError(err?.message || 'Could not schedule meeting');
    }
  };

  if (!user) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Meetings</h2>
        <p className="muted">Schedule, join, and track your mentoring sessions.</p>
      </div>

      <div className="tabs">
        <button className={`tab ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
        <button className={`tab ${filter === 'past' ? 'active' : ''}`} onClick={() => setFilter('past')}>Past</button>
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
      </div>

      {user.role !== 'admin' && (
        <div className="card">
          <div className="d-flex justify-content-between align-items-center">
            <h3>Schedule a Meeting</h3>
            <button className="button button-small button-secondary" onClick={() => setScheduling((v) => !v)}>
              {scheduling ? 'Close' : 'Schedule'}
            </button>
          </div>

          {scheduling && (
            <form className="mt-3" onSubmit={submitSchedule}>
              {error && <p className="text-danger small">{error}</p>}
              {user.role === 'mentee' && (
                <div className="form-group">
                  <label>Mentor</label>
                  <select name="mentorId" className="input" required>
                    <option value="">Select mentor</option>
                    {partners.mentors.map((m) => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                  {partners.mentors.length === 0 && (
                    <p className="muted xsmall">No connected mentors yet — request one from Find Mentors.</p>
                  )}
                </div>
              )}
              {user.role === 'mentor' && (
                <div className="form-group">
                  <label>Mentee</label>
                  <select name="menteeId" className="input" required>
                    <option value="">Select mentee</option>
                    {partners.mentees.map((m) => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                  {partners.mentees.length === 0 && (
                    <p className="muted xsmall">No connected mentees yet — accept requests from My Mentees.</p>
                  )}
                </div>
              )}
              <div className="form-group">
                <label>Title</label>
                <input name="title" type="text" className="input" required placeholder="e.g., Career guidance session" />
              </div>
              <div className="form-group">
                <label>Agenda</label>
                <textarea name="agenda" className="textarea" rows={2} placeholder="What would you like to cover?" />
              </div>
              <div className="form-group">
                <label>Date & Time</label>
                <input name="date" type="datetime-local" className="input" required />
              </div>
              <div className="row">
                <div className="col">
                  <div className="form-group">
                    <label>Duration (min)</label>
                    <input name="durationMin" type="number" className="input" defaultValue={30} min={15} max={180} />
                  </div>
                </div>
                <div className="col">
                  <div className="form-group">
                    <label>Mode</label>
                    <select name="mode" className="input" defaultValue="online">
                      <option value="online">Online</option>
                      <option value="in_person">In Person</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Location / Link</label>
                <input name="placeOrLink" type="text" className="input" placeholder="Google Meet link or room number" />
              </div>
              <button type="submit" className="button button-primary w-full">Create Meeting</button>
            </form>
          )}
        </div>
      )}

      <div className="meetings-list">
        {visible.length === 0 ? (
          <EmptyState
            title={filter === 'past' ? 'No past meetings' : 'No meetings found'}
            body={filter === 'upcoming' ? 'Schedule a session with your mentor to get started.' : undefined}
          />
        ) : (
          <ul className="list-unstyled">
            {visible.map((m) => {
              const myProposal = isProposer(m);
              const mine = isParticipant(m);
              const canRespond = m.status === 'pending' && !myProposal && mine;
              const canComplete = m.status === 'accepted' && mine && user.role !== 'admin';
              const canGiveFeedback =
                m.status === 'completed' && user.role === 'mentee' &&
                String(m.mentee?._id || m.mentee) === String(user._id);

              return (
                <li key={m._id} className="meeting-card">
                  <div className="d-flex w-100 justify-content-between">
                    <div>
                      <h6>{m.title}</h6>
                      <p className="muted small">
                        {formatDate(m.date)} · {m.mode === 'in_person' ? 'In person' : 'Online'} · {m.durationMin} min
                      </p>
                      <p className="muted small">
                        Mentor: {m.mentor?.name || '—'} · Mentee: {m.mentee?.name || '—'}
                      </p>
                      {m.agenda && <p className="muted xsmall">{m.agenda}</p>}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={m.status} />
                      {m.status === 'pending' && myProposal && (
                        <p className="muted xsmall mt-1">Waiting for the other party to respond</p>
                      )}
                      <div className="mt-2">
                        {canRespond && (
                          <>
                            <Button button-small button-primary onClick={() => respond(m._id, 'accept')}>Accept</Button>{' '}
                            <Button button-small button-danger onClick={() => respond(m._id, 'decline')}>Decline</Button>
                          </>
                        )}
                        {canComplete && (
                          <Button button-small button-success onClick={() => complete(m._id)}>Mark Completed</Button>
                        )}
                        {canGiveFeedback && (
                          <Button button-small button-info onClick={() => navigate(`/feedback?meetingId=${m._id}`)}>
                            Give Feedback
                          </Button>
                        )}
                        {myProposal && (m.status === 'pending' || m.status === 'accepted') && (
                          <Button button-small button-info onClick={() => handleReschedule(m._id)}>Reschedule</Button>
                        )}
                        {m.placeOrLink && (
                          <div className="mt-1">
                            <a href={m.placeOrLink} target="_blank" rel="noopener noreferrer" className="link small">
                              Join session ↗
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}