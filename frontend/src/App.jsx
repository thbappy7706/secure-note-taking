import { useCallback, useEffect, useState } from 'react';

import { apiRequest, getToken, setToken } from './api';
import AdminPanel from './components/AdminPanel';
import AuthPanel from './components/AuthPanel';
import NotesPanel from './components/NotesPanel';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!getToken()) return undefined;
    let cancelled = false;
    apiRequest('/users/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notify = useCallback((text, type = 'success') => {
    setNotice({ text, type });
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    setNotice({ text: 'Signed out.', type: 'success' });
  }, []);

  function handleAuthenticated(nextUser, message) {
    setUser(nextUser);
    setNotice({ text: message, type: 'success' });
  }

  if (booting) return <p className="centered">Loading…</p>;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Secure Notes</h1>
          <p className="hint">React 19 · Node 22 · Express · MongoDB</p>
        </div>
        <div className="topbar-right">
          {user ? (
            <>
              <span>
                {user.name} <span className="badge">{user.role}</span>
              </span>
              <button type="button" className="secondary" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <span className="hint">Not signed in</span>
          )}
        </div>
      </header>

      {notice && (
        <div className={`notice ${notice.type}`} role="status">
          {notice.text}
          <button type="button" className="link" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </div>
      )}

      {!user ? (
        <AuthPanel onAuthenticated={handleAuthenticated} notify={notify} />
      ) : (
        <main className="panels">
          <NotesPanel notify={notify} onUnauthorized={handleLogout} />
          {user.role === 'admin' && (
            <AdminPanel notify={notify} onUnauthorized={handleLogout} />
          )}
        </main>
      )}
    </div>
  );
}
