import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Navigate, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, EmptyState } from '../components/ui.jsx';
import { StatusBadge } from '../components/ui.jsx';

export default function Connections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conns, setConns] = useState([]);
  const loadConns = async () => {
    try {
      const d = await api('/users/connections');
      setConns(d.connections);
    } catch {}
  };
  useEffect(() => {
    if (!user) return;
    loadConns();
  }, [user]);

  if (!user) return <Navigate to="/login" />;

  const openChat = async (partnerId) => {
    try {
      const d = await api('/chat/conversations', { method: 'POST', body: { partnerId } });
      navigate(`/messages/${d.id}`);
    } catch (err) {
      alert(err?.message || 'Could not open chat');
    }
  };

  const respond = async (id, action) => {
    try {
      await api(`/users/connections/${id}/respond`, { method: 'POST', body: { action } });
      await loadConns();
    } catch (err) {
      alert(err?.message || 'Could not respond');
    }
  };

  if (user.role === 'mentee') {
    return (
      <div className="page">
        <div className="page-header">
          <h2>My Mentors</h2>
        </div>
        <p className="muted">Mentors you are connected with.</p>

        {conns.length === 0 ? (
          <EmptyState title="No mentors connected" body="Request a mentor from the Find Mentors page to get started." />
        ) : (
          <ul className="list-unstyled">
            {conns
              .filter((c) => String(c.mentee?._id || c.mentee) === String(user._id) && c.status === 'accepted')
              .map((c) => {
                const mentor = c.mentor;
                return (
                  <li key={c._id} className="mb-3">
                    <div className="d-flex w-100 justify-content-between">
                      <h6>{mentor.name}</h6>
                      <Badge tone="green">Connected</Badge>
                    </div>
                    <p className="muted small">
                      {mentor.department || ''}{mentor.company ? ` · ${mentor.company}` : ''}
                    </p>
                    <div className="mt-2">
                      <Button button-small button-primary onClick={() => openChat(mentor._id)}>
                        Chat
                      </Button>
                      <Button button-small button-secondary onClick={() => navigate(`/meetings`)}>Schedule Meeting</Button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}

        <div className="mt-3">
          <h4>Request a New Mentor</h4>
          <p className="muted small">Browse mentors and send a request.</p>
          <Button button-primary onClick={() => navigate('/mentors')}>Find Mentors</Button>
        </div>
      </div>
    );
  }

  if (user.role === 'mentor') {
    const pending = conns.filter((c) => String(c.mentor?._id || c.mentor) === String(user._id) && c.status === 'pending');
    const accepted = conns.filter((c) => String(c.mentor?._id || c.mentor) === String(user._id) && c.status === 'accepted');

    return (
      <div className="page">
        <div className="page-header">
          <h2>Mentorship Requests</h2>
        </div>
        <p className="muted">Pending requests from mentees.</p>

        {/* Pending */}
        <div className="card">
          <h3>Pending Requests ({pending.length})</h3>
          {pending.length === 0 ? (
            <EmptyState title="No pending requests" body="Mentees can request you as a mentor." />
          ) : (
            <ul className="list-unstyled">
              {pending.map((c) => {
                const mentee = c.mentee;
                return (
                  <li key={c._id} className="mb-3">
                    <div className="d-flex w-100 justify-content-between">
                      <h6>{mentee.name}</h6>
                      <Badge tone="amber">Pending</Badge>
                    </div>
                    <p className="muted small">
                      {mentee.department || ''}{mentee.company ? ` · ${mentee.company}` : ''}
                    </p>
                    <div className="mt-2">
                      <Button button-small button-primary onClick={() => respond(c._id, 'accept')}>Accept</Button>
                      <Button button-small button-danger onClick={() => respond(c._id, 'decline')}>Decline</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Accepted mentees */}
        <div className="card mt-3">
          <h3>My Mentees ({accepted.length})</h3>
          {accepted.length === 0 ? (
            <EmptyState title="No mentees yet" body="Accept requests or request mentees to get started." />
          ) : (
            <ul className="list-unstyled">
              {accepted.map((c) => {
                const mentee = c.mentee;
                return (
                  <li key={c._id} className="mb-3">
                    <div className="d-flex w-100 justify-content-between">
                      <h6>{mentee.name}</h6>
                      <Badge tone="green">Connected</Badge>
                    </div>
                    <p className="muted small">
                      {mentee.department || ''}{mentee.company ? ` · ${mentee.company}` : ''}
                    </p>
                    <div className="mt-2">
                      <Button button-small button-primary onClick={() => openChat(mentee._id)}>Chat</Button>
                      <Button button-small button-secondary onClick={() => navigate(`/meetings`)}>Schedule Meeting</Button>
                      <Button button-small button-secondary onClick={() => navigate(`/goals`)}>Set Goals</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return null;
}
