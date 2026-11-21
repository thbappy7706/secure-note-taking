import { useState } from 'react';

import { apiRequest, setToken } from '../api';

function splitInterests(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AuthPanel({ onAuthenticated, notify }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body =
      mode === 'login'
        ? { email: form.get('email'), password: form.get('password') }
        : {
            name: form.get('name'),
            email: form.get('email'),
            password: form.get('password'),
            interests: splitInterests(form.get('interests')),
          };

    setBusy(true);
    try {
      const data = await apiRequest(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body,
        auth: false,
      });
      setToken(data.token);
      formElement.reset();
      onAuthenticated(
        data.user,
        mode === 'login' ? `Signed in as ${data.user.name}.` : 'Account created.'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card auth-card">
      <div className="tabs">
        <button
          type="button"
          className={mode === 'login' ? 'tab active' : 'tab'}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'tab active' : 'tab'}
          onClick={() => setMode('register')}
        >
          Register
        </button>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Name
            <input name="name" required autoComplete="name" maxLength={80} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {mode === 'register' && (
          <label>
            Interests <span className="hint">(comma separated, e.g. chess, reading)</span>
            <input name="interests" placeholder="chess, reading" />
          </label>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      {mode === 'register' && (
        <p className="hint">
          Registration always creates a regular user. Only an admin can create another admin.
        </p>
      )}
    </section>
  );
}
