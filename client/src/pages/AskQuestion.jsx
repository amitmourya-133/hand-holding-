import { useContext, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Navigate } from 'react-router-dom';
import { Button, Input, Textarea, EmptyState } from '../components/ui.jsx';

export default function AskQuestion() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.role !== 'mentee') return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() && !description.trim()) {
      setError('Please enter a title or description');
      return;
    }
    setLoading(true);
    try {
      const resp = await api('/questions', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          subject: subject.trim() || '',
        },
      });
      if (resp.ok) {
        setTitle('');
        setDescription('');
        setSubject('');
        // Navigate back or stay - let's go to my questions
        navigate('/my-questions');
      } else {
        setError(resp.error || 'Failed to post question');
      }
    } catch (err) {
      setError(err?.message || 'Failed to post question');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-loading">Posting question…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Ask a Question</h2>
        <p className="muted">Share your academic question with eligible mentors</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="input-group">
          <label>Question Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Java mein inheritance kya hota hai?"
            required
          />
        </div>

        <div className="input-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please provide details about your question"
            rows={3}
          /></div>

        <div className="input-group">
          <label>Subject / Topic</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Java, DSA, Inheritance"
          />
        </div>

        {error && <p className="text-danger small">{error}</p>}

        <div className="mt-3">
          <Button button-primary type="submit" disabled={!title.trim()}>
            {loading ? 'Posting…' : 'Post Question'}
          </Button>
          <Button button-link onClick={() => navigate('/my-questions')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}