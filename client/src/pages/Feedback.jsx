import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { useLocation } from 'react-router-dom';
import { Badge, EmptyState, Stars, StatCard, formatDate } from '../components/ui.jsx';

function RateForm({ meeting, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please select a star rating (1-5)');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/feedback', {
        method: 'POST',
        body: { meetingId: meeting._id, rating, comment },
      });
      onDone();
    } catch (err) {
      setError(err?.message || 'Could not submit feedback');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-2" onSubmit={submit}>
      <div className="form-group">
        <label>Your rating</label>
        <Stars value={rating} size={22} onChange={setRating} />
      </div>
      <div className="form-group">
        <label>Comment (optional)</label>
        <textarea
          placeholder="What went well? What could be better?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="textarea"
          rows={2}
        />
      </div>
      {error && <p className="text-danger small">{error}</p>}
      <div className="d-flex gap-3">
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit Rating'}
        </button>
        <button type="button" className="button button-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Feedback() {
  const { user } = useAuth();
  const location = useLocation();

  const [feedbacks, setFeedbacks] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeMeeting, setActiveMeeting] = useState(null);

  const queryMeeting = new URLSearchParams(location.search).get('meetingId') || '';

  const load = async () => {
    try {
      const d = await api('/feedback');
      setFeedbacks(d.feedbacks || []);
      setPending(d.pendingSessions || []);
      if (queryMeeting) {
        const m = (d.pendingSessions || []).find((x) => String(x._id) === String(queryMeeting));
        if (m) setActiveMeeting(m);
      }
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  if (!user) return null;

  const avg =
    feedbacks.length > 0
      ? Math.round((feedbacks.reduce((a, b) => a + b.rating, 0) / feedbacks.length) * 10) / 10
      : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Feedback</h2>
        <p className="muted">Rate your sessions and view feedback received.</p>
      </div>

      {/* Mentee: rate a session */}
      {user.role === 'mentee' && (
        <section className="section">
          <h3>Rate a Session</h3>
          {pending.length === 0 ? (
            <EmptyState title="No sessions to rate" body="All your completed sessions have been rated." />
          ) : (
            <ul className="list-unstyled">
              {pending.map((m) => (
                <li key={m._id} className="card">
                  <div className="d-flex w-100 justify-content-between">
                    <div>
                      <h6>{m.title}</h6>
                      <small className="muted">{formatDate(m.date)} · with {m.mentor?.name || 'your mentor'}</small>
                    </div>
                    <Badge tone="green">completed</Badge>
                  </div>
                  {String(activeMeeting?._id) === String(m._id) ? (
                    <RateForm
                      meeting={m}
                      onDone={() => {
                        setActiveMeeting(null);
                        load();
                      }}
                    />
                  ) : (
                    <div className="mt-2">
                      <button className="button button-small button-primary" onClick={() => setActiveMeeting(m)}>
                        Rate this session
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {feedbacks.length > 0 && (
            <>
              <h3 className="mt-4">Your Past Ratings</h3>
              <ul className="list-unstyled">
                {feedbacks.map((f) => (
                  <li key={f._id} className="mb-2">
                    <div className="d-flex justify-content-between">
                      <strong className="small">{f.meeting?.title || 'Session'}</strong>
                      <Stars value={f.rating} />
                    </div>
                    {f.comment && <p className="muted small">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Mentor: feedback received */}
      {user.role === 'mentor' && (
        <section className="section">
          <h3>Feedback Received</h3>
          {feedbacks.length === 0 ? (
            <EmptyState title="No feedback yet" body="Mentees will rate your sessions after completion." />
          ) : (
            <>
              <StatCard label="Your Average Rating" value={`${avg}★`} sub={`from ${feedbacks.length} feedback(s)`} tone="amber" />
              <ul className="list-unstyled mt-3">
                {feedbacks.map((f) => (
                  <li key={f._id} className="card">
                    <div className="d-flex w-100 justify-content-between">
                      <div>
                        <h6>{f.meeting?.title || 'Unknown session'}</h6>
                        <small className="muted">
                          {formatDate(f.createdAt)} · by {f.mentee?.name || 'a mentee'}
                        </small>
                      </div>
                      <Stars value={f.rating} />
                    </div>
                    {f.comment && <p className="muted small mt-1">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Admin: overall feedback */}
      {user.role === 'admin' && (
        <section className="section">
          <h3>Overall Feedback</h3>
          <div className="row mb-3">
            <div className="col">
              <StatCard label="Average Rating" value={`${avg}★`} tone="amber" />
            </div>
            <div className="col">
              <StatCard label="Total Ratings" value={feedbacks.length} tone="blue" />
            </div>
          </div>
          {feedbacks.length === 0 ? (
            <EmptyState title="No feedback yet" body="Users will start rating sessions soon." />
          ) : (
            <ul className="list-unstyled small">
              {feedbacks.slice(0, 20).map((f) => (
                <li key={f._id} className="mb-1">
                  <strong>{f.mentee?.name || 'Someone'}</strong> rated {f.rating}★ for “{f.meeting?.title || 'a session'}”
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
