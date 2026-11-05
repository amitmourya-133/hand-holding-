import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button } from '../components/ui.jsx';

// Jitsi domain configurable via VITE_JITSI_DOMAIN env var, defaulting to meet.jit.si
const JITSI_DOMAIN = (import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si').replace(/\/+$/, '');

let scriptLoaded = false;
let scriptLoading = false;
const scriptCallbacks = [];

function loadJitsiScript() {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    if (scriptLoaded) {
      resolve();
      return;
    }
    if (scriptLoading) {
      scriptCallbacks.push({ resolve, reject });
      return;
    }
    scriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      scriptCallbacks.forEach((cb) => cb.resolve());
      scriptCallbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      const err = new Error('Failed to load Jitsi Meet script');
      reject(err);
      scriptCallbacks.forEach((cb) => cb.reject(err));
      scriptCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function VideoCall() {
  const { id } = useParams();
  const navigate = useNavigate();
  const jitsiContainerRef = useRef(null);
  const apiRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meetingInfo, setMeetingInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Verify authorization with backend
        const data = await api(`/meetings/${id}/join`, { method: 'POST' });
        if (cancelled) return;
        setMeetingInfo(data);

        // 2. Load Jitsi script
        await loadJitsiScript();
        if (cancelled) return;

        // 3. Create Jitsi meeting
        if (!jitsiContainerRef.current) return;

        const options = {
          roomName: data.roomName,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          userInfo: {
            displayName: 'Participant',
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
              'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            ],
          },
        };

        const jitsiApi = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);
        apiRef.current = jitsiApi;

        jitsiApi.addEventListener('videoConferenceJoined', () => {
          setLoading(false);
        });

        jitsiApi.addEventListener('readyToClose', () => {
          cleanup();
          navigate('/meetings');
        });

        jitsiApi.addEventListener('errorOccurred', (err) => {
          console.error('Jitsi error:', err);
          setError('A video call error occurred. Please try again.');
          setLoading(false);
        });

        // Fallback: if videoConferenceJoined doesn't fire, hide loading after timeout
        setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, 5000);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Failed to start video call');
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function cleanup() {
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch {
        // ignore disposal errors
      }
      apiRef.current = null;
    }
  }

  function handleEndCall() {
    cleanup();
    navigate('/meetings');
  }

  return (
    <div className="page video-call-page">
      <div className="page-header">
        <h2>Video Call{meetingInfo ? ` — ${meetingInfo.title}` : ''}</h2>
        <Button button-small button-danger onClick={handleEndCall}>End Call</Button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="page-loading">
          <div className="spinner" />
          <p>Connecting to video call...</p>
        </div>
      )}

      <div
        ref={jitsiContainerRef}
        className="jitsi-container"
        style={{
          width: '100%',
          height: loading ? '0' : 'calc(100vh - 200px)',
          minHeight: loading ? '0' : '400px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}