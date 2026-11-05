import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, EmptyState, StatusBadge, Textarea } from '../components/ui.jsx';

export default function QuestionDetails() {
  const { user } = useAuth();
  const { id: questionId } = useParams();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [questionResp, answerResp] = await Promise.all([
      api(`/users/questions/${questionId}`),
      api(`/users/questions/${questionId}/answers`),
    ]);
    setQuestion(questionResp.question);
    setAnswers(Array.isArray(answerResp.answers) ? answerResp.answers : []);
  }, [questionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load question');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) return <div className="page-loading">Loading question…</div>;

  if (error) {
    return (
      <div className="page">
        <p className="text-danger">{error}</p>
        <Link to={user?.role === 'mentor' ? '/open-questions' : '/my-questions'} className="link">
          Back to questions
        </Link>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="page">
        <EmptyState title="Question not found" body="It may have been removed." />
      </div>
    );
  }

  const owner = String(question.student?._id || question.student) === String(user?._id);
  const solved = question.status === 'solved';
  const canAnswer = ['mentor', 'admin'].includes(user?.role) && !solved;
  const canAccept = owner && !solved;
  const acceptedAnswerId = String(question.acceptedAnswer?._id || question.acceptedAnswer || '');

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!answerText.trim()) return;
    setSubmitting(true);
    setActionError('');
    try {
      await api('/users/answers', {
        method: 'POST',
        body: { questionId, text: answerText.trim() },
      });
      setAnswerText('');
      await load();
    } catch (err) {
      setActionError(err?.message || 'Could not submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptAnswer = async (answerId) => {
    setActionError('');
    try {
      await api(`/users/answers/${answerId}/accept`, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err?.message || 'Could not accept answer');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>{question.title}</h2>
        <p className="muted">
          by {question.student?.name || 'Unknown'} · {question.subject || 'No subject'}
        </p>
      </div>

      <div>
        <p className="card-text">{question.description || ''}</p>
        <p className="text-muted small">Status: <StatusBadge status={question.status} /></p>
      </div>

      {actionError && <p className="text-danger small">{actionError}</p>}

      {answers.length > 0 ? (
        <div className="mt-3">
          {answers.map((a) => {
            const isAccepted = String(a._id) === acceptedAnswerId;
            return (
              <div key={a._id} className="card mb-3">
                <div className="card-header">
                  <div className="d-flex w-100 justify-content-between">
                    <span className="text-primary">{a.mentor?.name || 'Unknown mentor'}</span>
                    {isAccepted ? (
                      <span className="badge badge-green">Accepted</span>
                    ) : (
                      <span className="badge badge-neutral">Answer</span>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  <p className="card-text">{a.text}</p>
                </div>
                {canAccept && !isAccepted && (
                  <div className="card-footer">
                    <Button button-small button-success onClick={() => acceptAnswer(a._id)}>
                      Accept Answer
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No answers yet" body="Be the first mentor to answer this question." />
      )}

      {canAnswer && (
        <div className="card mt-3">
          <h3>Your Answer</h3>
          <form onSubmit={submitAnswer} className="mt-2">
            <Textarea
              label="Answer"
              rows={4}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Share your guidance with the student"
              required
            />
            <Button type="submit" button-primary disabled={submitting || !answerText.trim()}>
              {submitting ? 'Submitting…' : 'Submit Answer'}
            </Button>
          </form>
        </div>
      )}

      {solved && (
        <p className="muted small mt-3">This question has been solved and is closed to new answers.</p>
      )}
    </div>
  );
}
