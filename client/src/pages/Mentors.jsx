import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, Badge, EmptyState, Avatar, mentorTypeLabel, mentorTypeTone } from '../components/ui.jsx';

export default function Mentors() {
  const { user, loading } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [connecting, setConnecting] = useState({});
  const [connectStatus, setConnectStatus] = useState({});

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== 'mentee') return;

    (async () => {
      setLoadingMentors(true);
      try {
        const d = await api('/users/mentors');
        setMentors(d.mentors || []);
      } catch (err) {
        setError(err.message || 'Could not load mentors');
      } finally {
        setLoadingMentors(false);
      }
    })();
  }, [user, loading]);

  const filteredMentors = mentors.filter((m) => {
    if (typeFilter && m.mentorType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q) ||
        (m.company || '').toLowerCase().includes(q) ||
        (m.skills || []).some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const sendRequest = async (mentorId) => {
    setConnecting((prev) => ({ ...prev, [mentorId]: true }));
    try {
      await api('/users/connections', { method: 'POST', body: { mentorId, note: '' } });
      setConnectStatus((prev) => ({ ...prev, [mentorId]: 'sent' }));
      // Update connection status in mentors list
      setMentors((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(mentorId) ? { ...m, connectionStatus: 'pending' } : m
        )
      );
    } catch (err) {
      if (err?.status === 409) {
        setConnectStatus((prev) => ({ ...prev, [mentorId]: 'already' }));
        setMentors((prev) =>
          prev.map((m) =>
            String(m.id || m._id) === String(mentorId) ? { ...m, connectionStatus: 'pending' } : m
          )
        );
      } else {
        setError(err?.message || 'Could not send request');
      }
    } finally {
      setConnecting((prev) => ({ ...prev, [mentorId]: false }));
    }
  };

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return null;
  if (user.role !== 'mentee') return <div>Mentor directory is available for mentees.</div>;

  return (
    <div className="page">
      <header className="page-header">
        <h2>Find Mentor</h2>
        <p className="muted">Browse all available mentors and request a connection</p>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Search and filter */}
      <div className="row mb-3" style={{ gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by name, department, company or skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ width: '180px' }}>
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="faculty">Faculty</option>
            <option value="alumni">Alumni</option>
            <option value="industry">Industry</option>
          </select>
        </div>
      </div>

      {loadingMentors ? (
        <div className="page-loading">Loading mentors…</div>
      ) : filteredMentors.length === 0 ? (
        <EmptyState
          title="No mentors found"
          body={search || typeFilter ? 'No mentors match your search. Try different filters.' : 'No mentors are available yet. Check back later.'}
        />
      ) : (
        <div className="row row-cols-1 row-cols-lg-3 g-4">
          {filteredMentors.map((m) => {
            const mentorId = m.id || m._id;
            const status = connectStatus[mentorId] || m.connectionStatus;
            return (
              <div key={mentorId} className="col">
                <div className="card h-100">
                  <div className="card-body">
                    <Avatar user={m} size={60} />
                    <h5 className="card-title mt-3">{m.name}</h5>
                    <p className="card-text small">
                      <Badge tone={mentorTypeTone(m.mentorType)}>
                        {mentorTypeLabel(m.mentorType) || 'Mentor'}
                      </Badge>
                      {m.department && <span className="text-primary fw-normal"> · {m.department}</span>}
                    </p>
                    {(m.designation || m.company) && (
                      <p className="card-text small muted">
                        {[m.designation, m.company].filter(Boolean).join(' at ')}
                      </p>
                    )}
                    {m.skills && m.skills.length > 0 && (
                      <p className="card-text small">
                        <strong>Skills:</strong> {m.skills.join(', ')}
                      </p>
                    )}
                    <div className="mt-2">
                      <Badge tone={m.availability === 'available' ? 'green' : m.availability === 'limited' ? 'amber' : 'red'}>
                        {m.availability || 'available'}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      {status === 'sent' || status === 'pending' ? (
                        <Badge tone="green">Request Sent</Badge>
                      ) : status === 'accepted' ? (
                        <Badge tone="green">Connected</Badge>
                      ) : status === 'declined' ? (
                        <Badge tone="red">Declined</Badge>
                      ) : (
                        <Button button-small button-primary onClick={() => sendRequest(mentorId)} disabled={connecting[mentorId]}>
                          {connecting[mentorId] ? 'Sending…' : 'Send Connection Request'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
      )}
    </div>
  );
}