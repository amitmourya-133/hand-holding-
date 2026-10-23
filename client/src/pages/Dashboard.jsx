import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { StatCard, EmptyState, StatusBadge, Progress, formatDate, Stars, Badge } from '../components/ui.jsx';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const d = await api('/stats');
        setStats(d);
      } catch {
        /* ignore */
      }
    })();
  }, [user?.id]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return null;
  if (!stats) return <div>Loading stats…</div>;

  const { mentee, mentor, admin } = stats;

  return (
    <div className="page">
      <header className="page-header">
        <h2>Dashboard</h2>
        <p className="muted">Welcome, {user.name}</p>
      </header>

      {/* Mentee section */}
      {user.role === 'mentee' && mentee && (
        <section className="section">
          <div className="row">
            {/* Upcoming meetings */}
            <div className="card">
              <h3>Upcoming Sessions</h3>
              {mentee.upcomingMeetings.length === 0 ? (
                <EmptyState title="No upcoming sessions" body="Schedule a meeting with your mentor to get started." />
              ) : (
                <ul className="list-unstyled">
                  {mentee.upcomingMeetings.map((m) => (
                    <li key={m._id} className="mb-3">
                      <div className="d-flex w-100 justify-content-between">
                        <div>
                          <h6 className="mb-1">{m.title}</h6>
                          <small>{formatDate(m.date)} · {m.mode}</small>
                        </div>
                        <Badge tone="green" className="ms-2">{m.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Goals progress */}
            <div className="card">
              <h3>Goal Progress</h3>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${mentee.goalProgress.percent}%` }}></div>
              </div>
              <span className="progress-text">
                {mentee.goalProgress.done}/{mentee.goalProgress.total} goals completed ({mentee.goalProgress.percent}%)
              </span>
              {mentee.activeGoals.length === 0 ? (
                <EmptyState title="No active goals" body="Your mentor can assign goals for you." />
              ) : (
                <ul className="list-unstyled small">
                  {mentee.activeGoals.map((g) => (
                    <li key={g._id}>
                      <div className="d-flex w-100 justify-content-between">
                        <h6 className="mb-1">{g.title}</h6>
                        <small>{g.status.replace('_', ' ')}</small>
                      </div>
                      <div className="progress small">
                        <div className="progress-fill" style={{ width: g.status === 'completed' ? '100%' : '50%' }}></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent feedback */}
          <div className="card">
            <h3>Recent Feedback</h3>
            {mentee.recentFeedback.length === 0 ? (
              <EmptyState title="No feedback yet" body="After completed sessions, you can rate your mentor." />
            ) : (
              <ul className="list-unstyled small">
                {mentee.recentFeedback.map((f) => (
                  <li key={f._id}>
                    <div className="d-flex w-100 justify-content-between">
                      <h6 className="mb-1">{f.meeting?.title || 'Unknown session'}</h6>
                      <small>{formatDate(f.createdAt)}</small>
                    </div>
                    <Stars value={f.rating} />
                    {f.comment && <p className="mt-1 small">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Mentor section */}
      {user.role === 'mentor' && mentor && (
        <section className="section">
          <div className="row">
            {/* Mentees card */}
            <div className="card">
              <h3>My Mentees</h3>
              <p className="muted small">{mentor.mentees} mentee(s) connected</p>
            </div>

            {/* Pending connections */}
            <div className="card">
              <h3>Pending Requests</h3>
              {mentor.pendingConnections === 0 ? (
                <EmptyState title="No pending requests" body="Mentees can request you as a mentor." />
              ) : (
                <p className="muted small">{mentor.pendingConnections} pending</p>
              )}
            </div>

            {/* Upcoming meetings */}
            <div className="card">
              <h3>Upcoming Sessions</h3>
              {mentor.upcomingMeetings.length === 0 ? (
                <EmptyState title="No upcoming meetings" body="All set for today!" />
              ) : (
                <ul className="list-unstyled">
                  {mentor.upcomingMeetings.map((m) => (
                    <li key={m._id} className="mb-2">
                      <div className="d-flex w-100 justify-content-between">
                        <div>
                          <h6 className="mb-1">{m.title}</h6>
                          <small>{formatDate(m.date)}</small>
                        </div>
                        <Badge tone="green">{m.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Rating */}
            <div className="card">
              <h3>Your Rating</h3>
              <Stars value={mentor.rating?.avg || 0} count={mentor.rating?.count || 0} />
              <p className="muted small">Average from {mentor.rating?.count || 0} feedback(s)</p>
            </div>
          </div>

          {/* Goals */}
          <div className="card">
            <h3>Goals Overview</h3>
            <div className="row">
              <div className="col">
                <p className="muted small">Total: {mentor.goals.total}</p>
                <p className="muted small">Completed: {mentor.goals.completed}</p>
                <p className="muted small">In progress: {mentor.goals.inProgress}</p>
              </div>
              <div className="col">
                <Progress percent={mentor.goals.total ? Math.round((mentor.goals.completed / mentor.goals.total) * 100) : 0} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Admin section */}
      {user.role === 'admin' && admin && (
        <section className="section">
          <div className="row">
            <div className="card">
              <h3>Institution Overview</h3>
              <div className="row">
                <div className="col">
                  <StatCard label="Total Users" value={admin.users.total} tone="blue" />
                  <StatCard label="Mentees" value={admin.users.mentees} tone="green" />
                  <StatCard label="Mentors" value={admin.users.mentors} tone="purple" />
                  <StatCard label="Admins" value={admin.users.admins} tone="amber" />
                </div>
                <div className="col">
                  <StatCard label="Connections" value={admin.connections.total} tone="blue" />
                  <StatCard label="Pending" value={admin.connections.pending} tone="amber" />
                  <StatCard label="Accepted" value={admin.connections.accepted} tone="green" />
                  <StatCard label="Completed" value={admin.meetings.completed} tone="blue" />
                </div>
              </div>

              <div className="row mt-4">
                <div className="col">
                  <StatCard label="Meetings" value={admin.meetings.total} tone="blue" />
                  <StatCard label="Pending" value={admin.meetings.pending} tone="amber" />
                  <StatCard label="Accepted" value={admin.meetings.accepted} tone="green" />
                  <StatCard label="Completed" value={admin.meetings.completed} tone="blue" />
                </div>
                <div className="col">
                  <StatCard label="Goals" value={admin.goals.total} tone="blue" />
                  <StatCard label="Completed" value={admin.goals.completed} tone="green" />
                  <StatCard label="In Progress" value={admin.goals.inProgress} tone="amber" />
                  <StatCard label="Not Started" value={(admin.goals.total || 0) - (admin.goals.completed || 0) - (admin.goals.inProgress || 0)} tone="neutral" />
                </div>
              </div>

              <div className="row mt-4">
                <div className="col">
                  <StatCard label="Feedback Count" value={admin.feedback.count} tone="blue" />
                  <StatCard label="Avg Rating" value={`${admin.feedback.avg}★`} tone="amber" />
                </div>
                <div className="col">
                  <StatCard label="Messages" value={admin.messages} tone="blue" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}