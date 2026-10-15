import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import {
  Button, StatCard, Badge, EmptyState, Progress, formatDate, mentorTypeTone,
  mentorTypeLabel, Avatar, Table, TableRow, TableCell, TableHeader,
} from '../components/ui.jsx';

export default function ProgressReports() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    (async () => {
      try {
        const d = await api('/progress');
        setReports(d);
      } catch (err) {
        setError(err.message || 'Could not load progress data');
      }
    })();
  }, [user, loading]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return null;
  if (!reports) return <div>Loading progress…</div>;

  const getRoleSection = (role) => {
    if (role === 'admin') {
      return (
        <section className="section">
          <h3>Institution-Wide Progress</h3>
          <p className="muted small">Administrative overview data</p>
          <StatCard label="Total Users" value={reports.admin.users.total || 0} tone="blue" />
          <StatCard label="Total Connections" value={reports.admin.connections.total || 0} tone="blue" />
          <StatCard label="Total Meetings" value={reports.admin.meetings.total || 0} tone="blue" />
          <StatCard label="Total Goals" value={reports.admin.goals.total || 0} tone="blue" />
          <StatCard label="Total Feedback" value={reports.admin.feedback.count || 0} tone="blue" />
        </section>
      );
    }

    if (role === 'mentor') {
      const { menteeGoals, menteeMeetings, menteeConnections } = reports.mentor || {};
      return (
        <section className="section">
          <h3>Your Mentorship Progress</h3>
          <p className="muted small">Track your mentees' progress</p>
          {menteeGoals && menteeGoals.length > 0 && (
            <StatCard label="Goals Assigned" value={menteeGoals.length} tone="purple" />
          )}
          {menteeMeetings && menteeMeetings.length > 0 && (
            <StatCard label="Upcoming Meetings" value={menteeMeetings.length} tone="blue" />
          )}
          {menteeConnections !== undefined && (
            <StatCard label="Pending Connections" value={menteeConnections} tone="amber" />
          )}
        </section>
      );
    }

    if (role === 'mentee') {
      const { menteeGoals, menteeMeetings, menteeFeedback, menteeConnections } = reports.mentee || {};
      return (
        <section className="section">
          <h3>Your Personal Progress</h3>
          <p className="muted small">Your goals, meetings, feedback and connections</p>
          {menteeGoals && menteeGoals.length > 0 && (
            <StatCard label="Your Goals" value={menteeGoals.length} tone="green" />
          )}
          {menteeMeetings && menteeMeetings.length > 0 && (
            <StatCard label="Your Meetings" value={menteeMeetings.length} tone="blue" />
          )}
          {menteeFeedback && menteeFeedback.length > 0 && (
            <StatCard label="Feedback Received" value={menteeFeedback.length} tone="amber" />
          )}
          {menteeConnections !== undefined && (
            <StatCard label="Your Connections" value={menteeConnections.length} tone="purple" />
          )}
        </section>
      );
    }

    return null;
  };

  const roleSection = getRoleSection(user.role);

  return (
    <div className="page">
      <header className="page-header">
        <h2>Progress Reports & Analytics</h2>
        <p className="muted">Track mentorship progress with real data</p>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {exporting && (
        <div className="alert alert-success">
          <span className="spinner me-2" /> Generating report... please wait.
        </div>
      )}

      {roleSection}

      {/* CSV Export section for all roles */}
      {reports && !exporting && (
        <section className="section mt-4">
          <h3>Export Progress Data</h3>
          <p className="muted small">Download CSV reports for your role</p>
          <div className="row row-cols-1 row-cols-lg-3 g-3 mt-3">
            {user.role === 'admin' && (
              <div>
                <Button small tone="primary" onClick={() => setExporting(true)} style={{ width: '100%' }}>
                  Export Admin Progress CSV
                </Button>
              </div>
            )}
            {user.role === 'mentor' && (
              <div>
                <Button small tone="primary" onClick={() => setExporting(true)} style={{ width: '100%' }}>
                  Export Mentor Progress CSV
                </Button>
              </div>
            )}
            {user.role === 'mentee' && (
              <div>
                <Button small tone="primary" onClick={() => setExporting(true)} style={{ width: '100%' }}>
                  Export Mentee Progress CSV
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Empty state when no reports yet */}
      {!reports && !error && user.role && (
        <EmptyState
          title="No progress data yet"
          body="Data will appear once you have interactions, meetings, or feedback in the system."
        />
      )}
    </div>
  );
}