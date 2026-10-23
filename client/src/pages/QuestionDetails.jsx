import { useEffect, useState, useNavigate } from 'react';
import { useAuth, api } from '../api.js';
import { Button, EmptyState, Badge } from '../components/ui.jsx';

export default function QuestionDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const questionId = navigate().id || '';

  useEffect(() => {
    (async () => {
      try {
        const resp = await api(`/questions/${questionId}`);
        setQuestion(resp.question);
        const answerResp = await api('/answers', {
          method: 'GET',
        });
        setAnswers(answerResp.answers || []);
      } catch (err) {
        setError('Failed to load question');
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [questionId, user?.id]);

  if (loading) return <div className="page-loading">Loading question…</div>;
  if (error) return <div className="page">Error: {error}</div>;
  if (!question) return null;

  // Determine if current user can accept answer
  const canAccept = user && question && String(question.student?._id || question.student) === String(user._id);

  return (
    <div className="page">
      <div className="page-header">
        <h2>{question?.title}</h2>
        <p className="muted">
          by {question?.student?.name || 'Unknown'} · {question?.subject || 'No subject'}
        </p>
      </div>

      {question && (
        <div>
          <p className="card-text">{question?.description || ''}</p>
          <p className="text-muted small">
            Status: {question?.status?.toUpperCase() || 'open'}
          </p>
        </div>
      )}

      {answers.length > 0 && (
        <div className="mt-3">
          {answers.map((a) => (
            <div key={a._id} className="card mb-3">
              <div className="card-header">
                <div className="d-flex w-100 justify-content-between">
                  <span className="text-primary">
                    {a.mentor?.name || 'Unknown mentor'}
                  </span>
                  <Badge status="answered" />
                </div>
              </div>
              <div className="card-body">
                <p className="card-text">{a.text}</p>
              </div>
              {canAccept && (
                <Button button-small button-success onClick={() => {
                  api('/answers/' + a._id + '/accept', { method: 'POST' });
                }}>
                  Accept
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAccept && (
        <div className="mt-3">
          <Button button-primary onClick={() => navigate(`/answers/${answers[0]?._id}/accept`)}>
            Accept Answer
          </Button>
        </div>
      )}

      {!answers.length && <EmptyState title="No answers yet" body="Be the first mentor to answer this question." />}
    </div>
  );
}