import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../api';

const PAGE_SIZE = 5;
const EMPTY_FORM = { title: '', content: '' };

export default function NotesPanel({ notify, onUnauthorized }) {
  const [notes, setNotes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleError = useCallback(
    (error) => {
      if (error.status === 401) onUnauthorized();
      else notify(error.message, 'error');
    },
    [notify, onUnauthorized]
  );

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      try {
        const data = await apiRequest(`/notes?page=${targetPage}&limit=${PAGE_SIZE}`);
        setNotes(data.data);
        setPagination(data.pagination);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  function startEdit(note) {
    setEditingId(note._id);
    setForm({ title: note.title, content: note.content });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await apiRequest(`/notes/${editingId}`, { method: 'PATCH', body: form });
        notify('Note updated.');
      } else {
        await apiRequest('/notes', { method: 'POST', body: form });
        notify('Note created.');
      }
      const page = editingId ? pagination?.page ?? 1 : 1;
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load(page);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    try {
      await apiRequest(`/notes/${note._id}`, { method: 'DELETE' });
      notify('Note deleted.');
      const page = notes.length === 1 && pagination?.page > 1 ? pagination.page - 1 : pagination?.page ?? 1;
      await load(page);
    } catch (error) {
      handleError(error);
    }
  }

  return (
    <section className="card">
      <h2>
        My notes {pagination && <span className="hint">({pagination.total} total)</span>}
      </h2>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
            maxLength={200}
          />
        </label>
        <label>
          Content
          <textarea
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            required
            rows={4}
            maxLength={20000}
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={busy}>
            {editingId ? 'Save changes' : 'Add note'}
          </button>
          {editingId && (
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="hint">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="hint">No notes yet.</p>
      ) : (
        <ul className="list">
          {notes.map((note) => (
            <li key={note._id} className="item">
              <div>
                <h3>{note.title}</h3>
                <p className="content">{note.content}</p>
                <p className="hint">Updated {new Date(note.updatedAt).toLocaleString()}</p>
              </div>
              <div className="actions">
                <button type="button" className="secondary" onClick={() => startEdit(note)}>
                  Edit
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(note)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination && (
        <div className="pager">
          <button
            type="button"
            className="secondary"
            disabled={!pagination.hasPrevPage}
            onClick={() => load(pagination.page - 1)}
          >
            Previous
          </button>
          <span className="hint">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={!pagination.hasNextPage}
            onClick={() => load(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
