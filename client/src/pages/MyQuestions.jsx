import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, EmptyState, StatusBadge } from '../components/ui.jsx';

export default function MyQuestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'mentee') {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await api('/users/questions/mine');
        if (!cancelled) setQuestions(Array.isArray(resp.questions) ? resp.questions : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load your questions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role]);

  if (!user || user.role !== 'mentee') return null;
  if (loading) return <div className="page-loading">Loading your questions…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Questions</h2>
        <p className="muted">Questions you've posted for mentors</p>
      </div>

      {error && <p className="text-danger">{error}</p>}

      {questions.length === 0 ? (
        <EmptyState title="No questions yet" body="Post your first question from Ask Question." />
      ) : (
        <div>
          {questions.map((q) => {
            const accepted = Boolean(q.acceptedAnswer);
            return (
              <div key={q._id} className="card mb-3">
                <div className="card-header">
                  <h6>{q.title}</h6>
                  <small className="text-muted">
                    {q.subject || 'No subject'}
                  </small>
                </div>
                <div className="card-body">
                  <p className="card-text">{q.description || ''}</p>
                  <div className="mt-2">
                    <StatusBadge status={q.status} />
                    {accepted && <small className="text-success ms-2">Accepted answer selected</small>}
                  </div>
                </div>
                <div className="card-footer">
                  <Button
                    button-small
                    button-primary
                    onClick={() => navigate(`/question/${q._id}`)}
                  >
                    View Answers
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
