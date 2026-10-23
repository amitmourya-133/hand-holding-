import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, EmptyState, Badge } from '../components/ui.jsx';

export default function MyQuestions() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role !== 'mentee') return null;

  useEffect(() => {
    (async () => {
      try {
        const resp = await api('/questions/mentor');
        // Filter questions where the student is the current user
        const myQuestions = resp.questions.filter(
          (q) => String(q.student?._id || q.student) === String(user._id)
        );
        setQuestions(myQuestions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  if (loading) return <div className="page-loading">Loading your questions…</div>;
  if (!user) return null;

  const emptyState =
    questions.length === 0
      ? <EmptyState title="No questions yet" body="Post your first question above." />
      : null;

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Questions</h2>
        <p className="muted">Questions you've posted for mentors</p>
      </div>

      {emptyState || (
        <div>
          {questions.map((q) => (
            <div key={q._id} className="card mb-3">
              <div className="card-header">
                <h6>{q.title}</h6>
                <small className="text-muted">
                  {q.subject || 'No subject'} · {q.status.toUpperCase()}
                </small>
              </div>
              <div className="card-body">
                <p className="card-text">{q.description || ''}</p>
                <div className="mt-2">
                  <Badge status={q.status} />
                  {q.acceptedAnswer && (
                    <small className="text-primary">
                      Accepted answer present
                    </small>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EmptyState
        title="No questions found"
        body="Post your first question using the form above."
      />
    </div>
  );
}