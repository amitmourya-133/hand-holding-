import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Badge, EmptyState } from '../components/ui.jsx';
import { getSocket } from '../socket.js';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: conversationId } = useParams();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const partnerOf = (c) =>
    c.partner || c.participants?.find((p) => String(p._id || p) !== String(user?._id)) || null;

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const d = await api('/chat/conversations');
        setConversations(d.conversations);
      } catch {}
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const d = await api(`/chat/conversations/${conversationId}/messages`);
        setMessages(d.messages);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, conversationId]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onNew = (data) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => (prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]));
      } else {
        setConversations((prev) =>
          prev.map((c) => (c.id === data.conversationId ? { ...c, unread: (c.unread || 0) + 1 } : c))
        );
      }
    };
    s.on('message:new', onNew);
    return () => s.off('message:new', onNew);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;
    try {
      const d = await api(`/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { text: input },
      });
      setMessages((prev) => (prev.some((m) => m._id === d.message._id) ? prev : [...prev, d.message]));
      setInput('');
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: { text: d.message.text, at: d.message.createdAt }, unread: 0 }
            : c
        )
      );
    } catch (err) {
      alert(err?.message || 'Could not send message');
    }
  };

  if (!user) return null;

  const activeConv = conversations.find((c) => String(c.id) === String(conversationId));
  const activePartner = activeConv ? partnerOf(activeConv) : null;

  if (!conversationId) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Messages</h2>
          <p className="muted">Your conversations with mentors and mentees.</p>
        </div>

        {conversations.length === 0 ? (
          <EmptyState title="No conversations" body="Start by finding a mentor and requesting a connection, then click Chat." />
        ) : (
          <ul className="list-unstyled">
            {conversations.map((c) => {
              const partner = partnerOf(c);
              return (
                <li key={c.id} className="mb-3 meeting-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/messages/${c.id}`)}>
                  <div className="d-flex w-100 justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <Avatar user={partner || { name: '?' }} size={36} />
                      <div>
                        <h6>{partner?.name || 'Unknown'}</h6>
                        <small className="muted">{formatDate(c.updatedAt)}</small>
                      </div>
                    </div>
                    {c.unread > 0 && <span className="badge badge-blue">{c.unread} new</span>}
                  </div>
                  <p className="muted small mt-1">{c.lastMessage?.text || '—'}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Messages</h2>
        {activePartner && <Badge tone="green">{activePartner.name}</Badge>}
      </div>

      <div className="chat-layout">
        <div className="chat-sidebar">
          <h4>Conversations</h4>
          {conversations.map((c) => {
            const partner = partnerOf(c);
            const active = String(c.id) === String(conversationId);
            return (
              <div
                key={c.id}
                className="chat-item"
                onClick={() => navigate(`/messages/${c.id}`)}
                style={{ background: active ? '#eef2ff' : c.unread > 0 ? '#f8fafc' : 'transparent', borderBottom: '1px solid #e2e8f0' }}
              >
                <Avatar user={partner || { name: '?' }} size={32} />
                <span className={active ? '' : 'muted'}>{partner?.name || 'Unknown'}</span>
                {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
              </div>
            );
          })}
          {conversations.length === 0 && <p className="muted small p-3">No conversations yet.</p>}
        </div>

        <div className="chat-main">
          <div className="message-box" style={{ height: 'calc(100vh - 300px)', minHeight: 300, overflow: 'auto' }}>
            {loading ? (
              <div className="spinner" />
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" body="Start the conversation by sending the first message." />
            ) : (
              <ul className="list-unstyled">
                {messages.map((m) => {
                  const senderId = m.sender?._id || m.sender;
                  const mine = String(senderId) === String(user._id);
                  return (
                    <li key={m._id} className={`chat-message ${mine ? 'sender' : 'receiver'}`}>
                      <p>{m.text}</p>
                      <small>{formatDate(m.createdAt)}</small>
                    </li>
                  );
                })}
                <li ref={bottomRef} />
              </ul>
            )}
          </div>

          <form onSubmit={handleSend} className="chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              required
            />
            <button type="submit" className="button button-primary">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
