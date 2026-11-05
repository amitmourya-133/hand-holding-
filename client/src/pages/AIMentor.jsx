import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, Textarea, Spinner, StatusBadge } from '../components/ui.jsx';

export default function AIMentor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [error, setError] = useState('');
  const messageRef = useRef(null);

  // Check AI configuration on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const resp = await api('/users/ai/health');
        setAiConfigured(resp?.configured || false);
        if (!resp?.configured) {
          setError('AI mentor is not configured. Ask your admin to set the AI_PROVIDER_KEY environment variable.');
        }
      } catch (err) {
        setError('Could not check AI configuration.');
      }
    })();
  }, [user?.id]);

  const scrollToBottom = () => {
    try {
      messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {}
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    setLoading(true);
    setError('');

    try {
      const resp = await api('/users/ai/chat', {
        method: 'POST',
        body: {
          conversationId: '', // Start new conversation
          role: 'mentee',
          content: text,
        },
      });

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text, timestamp: new Date() },
        { role: 'ai', content: resp.aiReply, timestamp: new Date() },
      ]);
      setInput('');
      scrollToBottom();
    } catch (err) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Login to access AI Mentor</div>;
  }

  if (!aiConfigured) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>AI Mentor</h2>
        </div>
        <div className="card">
          <p className="muted">{error || 'AI mentor is not configured.'} </p>
          <p className="muted small">
            Ask your administrator to set the <code>AI_PROVIDER_KEY</code> environment variable
            to enable the AI mentorship service.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>AI Mentor</h2>
        <StatusBadge status={aiConfigured ? 'answered' : 'neutral'} />
      </div>

      <div className="chat-container">
        <div className="chat-messages" ref={messageRef}>
          {messages.map((msg, index) => (
            <div key={index} className={msg.role === 'ai' ? 'message ai-message' : 'message user-message'}>
              <div className="message-content">{msg.content}</div>
              <div className="message-meta">
                {msg.role === 'ai' ? 'AI Mentor' : 'You'} • {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          {loading && <div className="message ai-message"><Spinner className="spinner-small" /> Thinking...</div>}
        </div>
        <div className="chat-input">
          <Textarea
            placeholder="Type your question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          />
          <Button button-primary onClick={sendMessage} disabled={loading}>
            {loading ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}