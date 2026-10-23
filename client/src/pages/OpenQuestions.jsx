import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, EmptyState, Badge } from '../components/ui.jsx';

export default function OpenQuestions() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role !== 'mentor') return null;

  useEffect(() => {
    (async () => {
      try {
        const resp = await api('/questions/mentor');
        setQuestions(resp.questions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  if (loading) return <div className="page-loading">Loading open questions…</div>;
  if (!user) return null;

  const emptyState =
    questions.length === 0
      ? <EmptyState title="No open questions" body="No eligible questions at this time." />
      : null;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Open Questions</h2>
        <p className="muted">Questions available for mentors to answer</p>
      </div>

      {emptyState || (
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
                  <Badge status={q.status} />
                  {q.acceptedAnswer && (
                    <small className="text-primary">
                      Accepted answer
                    </small>
                  )}
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

      <EmptyState
        title="No open questions"
        body="All questions have been answered or there are no new questions."
      />
    </div>
  );
}