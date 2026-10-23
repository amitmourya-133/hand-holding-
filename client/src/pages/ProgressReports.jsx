import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, apiBlob } from '../api.js';
import { Button, StatCard, EmptyState } from '../components/ui.jsx';

export default function ProgressReports() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    (async () => {
      setLoadingReports(true);
      setError('');
      try {
        const d = await api('/progress');
        if (!cancelled) setReports(d);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load progress data');
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return null;

  const downloadCSV = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await apiBlob('/progress/csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `handholding-${user.role}-progress.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not export CSV');
    } finally {
      setExporting(false);
    }
  };

  const renderRoleSection = () => {
    if (!reports) return null;

    if (user.role === 'admin' && reports.admin) {
      const { users, connections, meetings, goals, feedback } = reports.admin;
      return (
        <section className="section">
          <h3>Institution-Wide Progress</h3>
          <p className="muted small">Administrative overview data</p>
          <StatCard label="Total Users" value={users.total} tone="blue" />
          <StatCard label="Total Connections" value={connections.total} tone="blue" />
          <StatCard label="Total Meetings" value={meetings.total} tone="blue" />
          <StatCard label="Total Goals" value={goals.total} tone="blue" />
          <StatCard label="Total Feedback" value={feedback.count} sub={`Avg rating ${feedback.avg}`} tone="blue" />
        </section>
      );
    }

    if (user.role === 'mentor' && reports.mentor) {
      const { menteeGoals = [], menteeMeetings = [], menteeConnections = 0 } = reports.mentor;
      return (
        <section className="section">
          <h3>Your Mentorship Progress</h3>
          <p className="muted small">Track your mentees' progress</p>
          <StatCard label="Goals Assigned" value={menteeGoals.length} tone="purple" />
          <StatCard label="Upcoming Meetings" value={menteeMeetings.length} tone="blue" />
          <StatCard label="Pending Connections" value={menteeConnections} tone="amber" />
        </section>
      );
    }

    if (user.role === 'mentee' && reports.mentee) {
      const { menteeGoals = [], menteeMeetings = [], menteeFeedback = [], menteeConnections = [] } = reports.mentee;
      return (
        <section className="section">
          <h3>Your Personal Progress</h3>
          <p className="muted small">Your goals, meetings, feedback and connections</p>
          <StatCard label="Your Goals" value={menteeGoals.length} tone="green" />
          <StatCard label="Upcoming Meetings" value={menteeMeetings.length} tone="blue" />
          <StatCard label="Feedback Received" value={menteeFeedback.length} tone="amber" />
          <StatCard label="Your Connections" value={menteeConnections.length} tone="purple" />
        </section>
      );
    }

    return null;
  };

  return (
    <div className="page">
      <header className="page-header">
        <h2>Progress Reports &amp; Analytics</h2>
        <p className="muted">Track mentorship progress with real data</p>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {loadingReports && !reports && <div className="muted">Loading progress…</div>}

      {renderRoleSection()}

      {reports && (
        <section className="section mt-4">
          <h3>Export Progress Data</h3>
          <p className="muted small">Download a CSV report for your role</p>
          <Button tone="primary" disabled={exporting} onClick={downloadCSV}>
            {exporting ? 'Generating…' : `Export ${user.role} progress CSV`}
          </Button>
        </section>
      )}

      {!loadingReports && !reports && !error && (
        <EmptyState
          title="No progress data yet"
          body="Data will appear once you have interactions, meetings, or feedback in the system."
        />
      )}
    </div>
  );
}
