import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, EmptyState, StatusBadge } from '../components/ui.jsx';

export default function OpenQuestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !['mentor', 'admin'].includes(user.role)) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await api('/users/questions/mentor');
        if (!cancelled) setQuestions(Array.isArray(resp.questions) ? resp.questions : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load open questions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role]);

  if (!user || !['mentor', 'admin'].includes(user.role)) return null;
  if (loading) return <div className="page-loading">Loading open questions…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Open Questions</h2>
        <p className="muted">Questions available for mentors to answer</p>
      </div>

      {error && <p className="text-danger">{error}</p>}

      {questions.length === 0 ? (
        <EmptyState
          title="No open questions"
          body="All questions have been answered or there are no new questions."
        />
      ) : (
        <div>
          {questions.map((q) => (
            <div key={q._id} className="card mb-3">
              <div className="card-header">
                <h6>{q.title}</h6>
                <small className="text-muted">
                  by {q.student?.name || 'Unknown student'} · {q.subject || 'No subject'}
                </small>
              </div>
              <div className="card-body">
                <p className="card-text">{q.description || ''}</p>
                <div className="mt-2">
                  <StatusBadge status={q.status} />
                </div>
              </div>
              <div className="card-footer">
                <Button button-small button-primary onClick={() => navigate(`/question/${q._id}`)}>
                  Answer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
