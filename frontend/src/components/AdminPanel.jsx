import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../api';

const EMPTY_USER = { name: '', email: '', password: '', role: 'user', interests: '' };

function splitInterests(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminPanel({ notify, onUnauthorized }) {
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [editingUserId, setEditingUserId] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userBusy, setUserBusy] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesPagination, setNotesPagination] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  const [postForm, setPostForm] = useState({ title: '', content: '' });
  const [lookupId, setLookupId] = useState('');
  const [posts, setPosts] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleError = useCallback(
    (error) => {
      if (error.status === 401) onUnauthorized();
      else notify(error.message, 'error');
    },
    [notify, onUnauthorized]
  );

  const loadUsers = useCallback(
    async (page = 1) => {
      setUsersLoading(true);
      try {
        const data = await apiRequest(`/users?page=${page}&limit=5`);
        setUsers(data.data);
        setUserPagination(data.pagination);
      } catch (error) {
        handleError(error);
      } finally {
        setUsersLoading(false);
      }
    },
    [handleError]
  );

  const loadNotes = useCallback(
    async (page = 1, owner = '') => {
      setNotesLoading(true);
      try {
        const query = new URLSearchParams({ page: String(page), limit: '10' });
        if (owner.trim()) query.set('userId', owner.trim());
        const data = await apiRequest(`/notes?${query.toString()}`);
        setNotes(data.data);
        setNotesPagination(data.pagination);
      } catch (error) {
        handleError(error);
      } finally {
        setNotesLoading(false);
      }
    },
    [handleError]
  );

  useEffect(() => {
    loadUsers(1);
    loadNotes(1, '');
  }, [loadUsers, loadNotes]);

  function startEditUser(user) {
    setEditingUserId(user._id);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      interests: (user.interests || []).join(', '),
    });
  }

  function resetUserForm() {
    setEditingUserId(null);
    setUserForm(EMPTY_USER);
  }

  async function submitUser(event) {
    event.preventDefault();
    setUserBusy(true);
    const body = {
      name: userForm.name,
      email: userForm.email,
      role: userForm.role,
      interests: splitInterests(userForm.interests),
    };
    if (userForm.password) body.password = userForm.password;

    try {
      if (editingUserId) {
        await apiRequest(`/users/${editingUserId}`, { method: 'PATCH', body });
        notify('User updated.');
      } else {
        await apiRequest('/users', { method: 'POST', body });
        notify('User created.');
      }
      const page = editingUserId ? userPagination?.page ?? 1 : 1;
      resetUserForm();
      await loadUsers(page);
    } catch (error) {
      handleError(error);
    } finally {
      setUserBusy(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.email} and all their notes and posts?`)) return;
    try {
      await apiRequest(`/users/${user._id}`, { method: 'DELETE' });
      notify('User deleted.');
      const page = users.length === 1 && userPagination?.page > 1 ? userPagination.page - 1 : userPagination?.page ?? 1;
      await loadUsers(page);
      await loadNotes(notesPagination?.page ?? 1, ownerFilter);
    } catch (error) {
      handleError(error);
    }
  }

  async function loadGroups() {
    try {
      const data = await apiRequest('/users/grouped-by-interests?limit=20');
      setGroups(data.data);
      setGroupsLoaded(true);
    } catch (error) {
      handleError(error);
    }
  }

  async function publishPost(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/posts', { method: 'POST', body: postForm });
      setPostForm({ title: '', content: '' });
      notify('Post published.');
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function lookupPosts(event) {
    event.preventDefault();
    setPosts(null);
    try {
      const data = await apiRequest(
        `/users/${encodeURIComponent(lookupId.trim())}/posts?limit=10`
      );
      setPosts(data);
    } catch (error) {
      handleError(error);
    }
  }

  return (
    <>
      <section className="card">
        <h2>Admin · users</h2>

        <form className="grid-form" onSubmit={submitUser}>
          <label>
            Name
            <input
              value={userForm.name}
              onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={userForm.email}
              onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
              required
            />
          </label>
          <label>
            {editingUserId ? 'New password (optional)' : 'Password'}
            <input
              type="password"
              value={userForm.password}
              onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              required={!editingUserId}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            Role
            <select
              value={userForm.role}
              onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label>
            Interests
            <input
              value={userForm.interests}
              onChange={(event) => setUserForm({ ...userForm, interests: event.target.value })}
              placeholder="chess, reading"
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={userBusy}>
              {editingUserId ? 'Save user' : 'Create user'}
            </button>
            {editingUserId && (
              <button type="button" className="secondary" onClick={resetUserForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {usersLoading ? (
          <p className="hint">Loading users…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Interests</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="badge">{user.role}</span>
                    </td>
                    <td>{(user.interests || []).join(', ') || '—'}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => startEditUser(user)}
                      >
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => deleteUser(user)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {userPagination && (
          <div className="pager">
            <button
              type="button"
              className="secondary"
              disabled={!userPagination.hasPrevPage}
              onClick={() => loadUsers(userPagination.page - 1)}
            >
              Previous
            </button>
            <span className="hint">
              Page {userPagination.page} of {userPagination.totalPages || 1}
            </span>
            <button
              type="button"
              className="secondary"
              disabled={!userPagination.hasNextPage}
              onClick={() => loadUsers(userPagination.page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Admin · all notes</h2>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            loadNotes(1, ownerFilter);
          }}
        >
          <input
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            placeholder="Filter by owner user id (optional)"
          />
          <button type="submit">Load</button>
        </form>

        {notesLoading ? (
          <p className="hint">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="hint">No notes found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Title</th>
                  <th>Content</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr key={note._id}>
                    <td>
                      {note.owner ? (
                        <>
                          {note.owner.name}
                          <br />
                          <span className="hint">{note.owner.email}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{note.title}</td>
                    <td className="content-cell">{note.content}</td>
                    <td>{new Date(note.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {notesPagination && (
          <div className="pager">
            <button
              type="button"
              className="secondary"
              disabled={!notesPagination.hasPrevPage}
              onClick={() => loadNotes(notesPagination.page - 1, ownerFilter)}
            >
              Previous
            </button>
            <span className="hint">
              Page {notesPagination.page} of {notesPagination.totalPages || 1} ·{' '}
              {notesPagination.total} notes
            </span>
            <button
              type="button"
              className="secondary"
              disabled={!notesPagination.hasNextPage}
              onClick={() => loadNotes(notesPagination.page + 1, ownerFilter)}
            >
              Next
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Admin · users grouped by interests</h2>
        <button type="button" onClick={loadGroups}>
          Load interest groups
        </button>
        {groupsLoaded &&
          (groups.length === 0 ? (
            <p className="hint">No interests recorded.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Interest</th>
                    <th>Users</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.interest}>
                      <td>{group.interest}</td>
                      <td>{group.userCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      <section className="card">
        <h2>Admin · posts</h2>
        <div className="two-column">
          <form className="stack" onSubmit={publishPost}>
            <h3>Publish as me</h3>
            <label>
              Title
              <input
                value={postForm.title}
                onChange={(event) => setPostForm({ ...postForm, title: event.target.value })}
                required
                maxLength={200}
              />
            </label>
            <label>
              Content
              <textarea
                value={postForm.content}
                onChange={(event) => setPostForm({ ...postForm, content: event.target.value })}
                required
                rows={3}
              />
            </label>
            <button type="submit" disabled={busy}>
              Publish post
            </button>
          </form>

          <div>
            <form className="inline-form" onSubmit={lookupPosts}>
              <input
                value={lookupId}
                onChange={(event) => setLookupId(event.target.value)}
                placeholder="User id"
                required
              />
              <button type="submit">Load their posts</button>
            </form>

            {posts && (
              <>
                <p className="hint">
                  {posts.user.name} has {posts.pagination.total} post(s).
                </p>
                {posts.data.length === 0 ? (
                  <p className="hint">No posts yet.</p>
                ) : (
                  <ul className="list compact">
                    {posts.data.map((post) => (
                      <li key={post._id} className="item">
                        <div>
                          <h3>{post.title}</h3>
                          <p className="content">{post.content}</p>
                          <p className="hint">{new Date(post.createdAt).toLocaleString()}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
