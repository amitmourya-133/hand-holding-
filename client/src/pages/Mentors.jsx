import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, StatCard, Badge, EmptyState, Progress, formatDate, mentorTypeLabel, mentorTypeTone, Avatar } from '../components/ui.jsx';

export default function Mentors() {
  const { user, loading } = useAuth();
  const [matches, setMatches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== 'mentee') {
      setMatches([]);
      return;
    }

    (async () => {
      setLoadingMatches(true);
      try {
        const d = await api('/matchings');
        setMatches(d.match || []);
        setMentors(d.mentees || []);
      } catch (err) {
        setError(err.message || 'Could not load mentor matches');
      } finally {
        setLoadingMatches(false);
      }
    })();
  }, [user, loading]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return null;
  if (user.role !== 'mentee') return <div>Matching not available for your role.</div>;

  return (
    <div className="page">
      <header className="page-header">
        <h2>Mentor Matching</h2>
        <p className="muted">Find your ideal mentor based on department, skills and availability</p>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Mentee matches section */}
      {matches.length > 0 && (
        <section className="section">
          <h3>Recommended Mentors for You</h3>
          <p className="muted small">Based on your department and skills</p>
          <div className="row row-cols-1 row-cols-lg-3 g-4">
            {matches.map((m) => (
              <div key={m.user.id || m.user._id} className="col">
                <div className="card h-100">
                  <div className="card-body">
                    <Avatar user={m.user} size={60} />
                    <h5 className="card-title mt-3">{m.user.name}</h5>
                    <p className="card-text small">
                      <Badge tone={mentorTypeTone(m.user.mentorType)} className="me-1">
                        {mentorTypeLabel(m.user.mentorType)}
                      </Badge>
                      {m.user.department && <span className="text-primary fw-normal">· {m.user.department}</span>}
                    </p>
                    <p className="card-text small">
                      {m.skillOverlap} skill overlap
                    </p>
                    <Badge tone="neutral" className="mt-2 small">
                      {m.matchScore > 3 ? 'Great match' : m.matchScore > 1 ? 'Good match' : 'Consider'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available mentors section - for mentors to see potential mentees */}
      {mentors.length > 0 && (
        <section className="section">
          <h3>Potential Mentees</h3>
          <p className="muted small">Mentees in your department or with matching skills</p>
          <div className="row row-cols-1 row-cols-lg-3 g-4">
            {mentors.map((m) => (
              <div key={m._id} className="col">
                <div className="card h-100">
                  <div className="card-body">
                    <Avatar user={{ name: m.name, color: m.color }} size={60} />
                    <h5 className="card-title mt-3">{m.name}</h5>
                    <p className="card-text small">
                      {m.department && <span className="text-primary fw-normal">· {m.department}</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty states */}
      {matches.length === 0 && user.role === 'mentee' && (
        <EmptyState
          title="No matches yet"
          body="Try adding skills to your profile or update your department to get better mentor recommendations."
          action={<Button tone="secondary" small>Update Profile</Button>}
        />
      )}

      {mentors.length === 0 && user.role === 'mentor' && (
        <EmptyState
          title="No potential mentees found"
          body="Mentees with matching skills or department will appear here as they join."
        />
      )}
    </div>
  );
}