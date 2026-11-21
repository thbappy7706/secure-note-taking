/**
 * End-to-end smoke test against a real MongoDB instance.
 *
 *   MONGO_URI="mongodb://127.0.0.1:27017/secure_note_taking_test" npm test
 *
 * It boots the Express app on an ephemeral port, exercises authentication,
 * RBAC, note CRUD, pagination, both aggregation scenarios and the index set,
 * then drops the test database. Set JWT_SECRET in the environment (or .env).
 */
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../src/app');
const config = require('../src/config');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

const collectionNames = [
  User.collection.name,
  Note.collection.name,
  Post.collection.name,
];

let server;
let baseUrl;

async function request(method, path, { token, body, headers: extraHeaders } = {}) {
  const headers = { ...(extraHeaders || {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data, headers: response.headers };
}

function check(label) {
  console.log(`  ok - ${label}`);
}

function findIndex(indexes, key) {
  return indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(key));
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || config.mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
  await mongoose.connection.db.dropDatabase();
  await Promise.all([User.init(), Note.init(), Post.init()]);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`Testing against ${mongoose.connection.name} on ${baseUrl}`);

  // ---------- health & CORS ----------
  const health = await request('GET', '/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');
  check('health endpoint responds');

  const preflight = await fetch(`${baseUrl}/api/notes`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(preflight.headers.get('access-control-allow-methods'), /PATCH/);
  check('CORS preflight allows the configured frontend origin');

  const blockedOrigin = await request('GET', '/health', {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(blockedOrigin.status, 403);
  check('CORS blocks unknown browser origins');

  // ---------- auth & registration ----------
  const aliceRegistration = await request('POST', '/auth/register', {
    body: {
      name: 'Alice',
      email: 'Alice@Example.com',
      password: 'Password123!',
      interests: ['Chess', 'reading', 'chess'],
    },
  });
  assert.equal(aliceRegistration.status, 201);
  assert.equal(aliceRegistration.data.user.email, 'alice@example.com');
  assert.equal(aliceRegistration.data.user.role, 'user');
  assert.equal(aliceRegistration.data.user.passwordHash, undefined);
  assert.deepEqual(aliceRegistration.data.user.interests, ['chess', 'reading']);
  assert.ok(aliceRegistration.data.token);
  const alice = aliceRegistration.data.user;
  const aliceToken = aliceRegistration.data.token;
  check('registration lowercases email, normalises interests, hides hash, issues a token');

  const duplicate = await request('POST', '/auth/register', {
    body: { name: 'Alice 2', email: 'alice@example.com', password: 'Password123!' },
  });
  assert.equal(duplicate.status, 409);
  check('duplicate email rejected with 409');

  const selfElevate = await request('POST', '/auth/register', {
    body: { name: 'Mallory', email: 'mallory@example.com', password: 'Password123!', role: 'admin' },
  });
  assert.equal(selfElevate.status, 201);
  assert.equal(selfElevate.data.user.role, 'user');
  check('registration cannot self-assign the admin role');

  const badLogin = await request('POST', '/auth/login', {
    body: { email: 'alice@example.com', password: 'wrong-password' },
  });
  assert.equal(badLogin.status, 401);
  assert.match(badLogin.data.error.message, /Invalid email or password/);
  check('wrong password rejected with 401');

  const aliceLogin = await request('POST', '/auth/login', {
    body: { email: 'ALICE@example.com', password: 'Password123!' },
  });
  assert.equal(aliceLogin.status, 200);
  assert.ok(aliceLogin.data.token);
  check('login works and is case-insensitive for email');

  const tampered = await request('GET', '/users/me', { token: `${aliceToken}x` });
  assert.equal(tampered.status, 401);
  const anonymous = await request('GET', '/notes');
  assert.equal(anonymous.status, 401);
  check('missing / tampered tokens rejected with 401');

  const bobRegistration = await request('POST', '/auth/register', {
    body: {
      name: 'Bob',
      email: 'bob@example.com',
      password: 'Password123!',
      interests: ['chess', 'gaming'],
    },
  });
  assert.equal(bobRegistration.status, 201);
  const bob = bobRegistration.data.user;
  const bobToken = bobRegistration.data.token;

  const passwordTooShort = await request('POST', '/auth/register', {
    body: { name: 'Short', email: 'short@example.com', password: 'short' },
  });
  assert.equal(passwordTooShort.status, 400);
  check('short passwords rejected');

  // ---------- notes CRUD & ownership ----------
  const createdNotes = [];
  for (let i = 1; i <= 3; i += 1) {
    const created = await request('POST', '/notes', {
      token: aliceToken,
      body: { title: `Alice note ${i}`, content: `Secret content ${i}` },
    });
    assert.equal(created.status, 201);
    createdNotes.push(created.data.note);
  }
  check('user can create notes');

  const alicePage1 = await request('GET', '/notes?page=1&limit=2', { token: aliceToken });
  assert.equal(alicePage1.status, 200);
  assert.equal(alicePage1.data.pagination.total, 3);
  assert.equal(alicePage1.data.pagination.totalPages, 2);
  assert.equal(alicePage1.data.pagination.hasNextPage, true);
  assert.equal(alicePage1.data.data.length, 2);
  const alicePage2 = await request('GET', '/notes?page=2&limit=2', { token: aliceToken });
  assert.equal(alicePage2.data.data.length, 1);
  assert.equal(alicePage2.data.pagination.hasPrevPage, true);
  assert.notEqual(alicePage1.data.data[0]._id, alicePage2.data.data[0]._id);
  check('pagination returns disjoint pages with accurate metadata');

  const clamped = await request('GET', '/notes?limit=5000', { token: aliceToken });
  assert.equal(clamped.data.pagination.limit, 100);
  const invalidPage = await request('GET', '/notes?page=0', { token: aliceToken });
  assert.equal(invalidPage.status, 400);
  check('limit is clamped and invalid page numbers fail with 400');

  const bobList = await request('GET', '/notes', { token: bobToken });
  assert.equal(bobList.data.pagination.total, 0);
  const bobRead = await request('GET', `/notes/${createdNotes[0]._id}`, { token: bobToken });
  assert.equal(bobRead.status, 403);
  const bobUpdate = await request('PATCH', `/notes/${createdNotes[0]._id}`, {
    token: bobToken,
    body: { title: 'Hacked' },
  });
  assert.equal(bobUpdate.status, 403);
  check("another user cannot list, read or modify someone else's notes");

  const bobWrongFilter = await request('GET', `/notes?userId=${alice._id}`, { token: bobToken });
  assert.equal(bobWrongFilter.status, 403);

  const updated = await request('PATCH', `/notes/${createdNotes[0]._id}`, {
    token: aliceToken,
    body: { title: 'Renamed note' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.note.title, 'Renamed note');
  assert.equal(updated.data.note.content, 'Secret content 1');
  check('partial note update keeps untouched fields');

  const deleted = await request('DELETE', `/notes/${createdNotes[2]._id}`, { token: aliceToken });
  assert.equal(deleted.status, 200);
  const afterDelete = await request('GET', '/notes', { token: aliceToken });
  assert.equal(afterDelete.data.pagination.total, 2);
  check('user can delete their own note');

  const missing = await request('GET', `/notes/${new mongoose.Types.ObjectId()}`, { token: aliceToken });
  assert.equal(missing.status, 404);

  // ---------- RBAC ----------
  const forbiddenUsers = await request('GET', '/users', { token: aliceToken });
  assert.equal(forbiddenUsers.status, 403);
  const forbiddenCreateUser = await request('POST', '/users', {
    token: aliceToken,
    body: { name: 'X', email: 'x@example.com', password: 'Password123!' },
  });
  assert.equal(forbiddenCreateUser.status, 403);
  check('regular users cannot use admin user-management endpoints');

  const adminPasswordHash = await User.hashPassword('AdminPass123!');
  const adminUser = await User.create({
    name: 'Admin',
    email: 'admin@example.com',
    passwordHash: adminPasswordHash,
    role: 'admin',
  });
  const adminLogin = await request('POST', '/auth/login', {
    body: { email: 'admin@example.com', password: 'AdminPass123!' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;

  const me = await request('GET', '/users/me', { token: adminToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.role, 'admin');

  // ---------- admin user management ----------
  const userList = await request('GET', '/users?page=1&limit=2', { token: adminToken });
  assert.equal(userList.status, 200);
  assert.equal(userList.data.pagination.total, 4);
  assert.equal(userList.data.data.length, 2);
  assert.ok(userList.data.data.every((user) => user.passwordHash === undefined));
  check('admin lists users with pagination and no password hashes');

  const createdUser = await request('POST', '/users', {
    token: adminToken,
    body: {
      name: 'Carol',
      email: 'carol@example.com',
      password: 'Password123!',
      role: 'user',
      interests: ['chess', 'hiking'],
    },
  });
  assert.equal(createdUser.status, 201);
  assert.equal(createdUser.data.user.role, 'user');
  const carol = createdUser.data.user;

  const updatedUser = await request('PATCH', `/users/${carol._id}`, {
    token: adminToken,
    body: { name: 'Carol Updated', interests: ['hiking'] },
  });
  assert.equal(updatedUser.status, 200);
  assert.equal(updatedUser.data.user.name, 'Carol Updated');
  assert.deepEqual(updatedUser.data.user.interests, ['hiking']);
  check('admin can create and update users');

  const badRole = await request('PATCH', `/users/${carol._id}`, {
    token: adminToken,
    body: { role: 'superadmin' },
  });
  assert.equal(badRole.status, 400);
  check('invalid roles rejected');

  // ---------- admin note access ----------
  const allNotes = await request('GET', '/notes?limit=10', { token: adminToken });
  assert.equal(allNotes.status, 200);
  assert.equal(allNotes.data.pagination.total, 2);
  assert.ok(allNotes.data.data[0].owner.email);

  const aliceNotesAdmin = await request('GET', `/notes?userId=${alice._id}`, { token: adminToken });
  assert.equal(aliceNotesAdmin.data.pagination.total, 2);
  const bobNotesAdmin = await request('GET', `/notes?userId=${bob._id}`, { token: adminToken });
  assert.equal(bobNotesAdmin.data.pagination.total, 0);
  check('admin views all notes and filters by owner');

  const noteCreatedByAdmin = await request('POST', '/notes', {
    token: adminToken,
    body: { title: 'Admin note', content: 'Admin content' },
  });
  assert.equal(noteCreatedByAdmin.status, 201);
  await request('DELETE', `/notes/${noteCreatedByAdmin.data.note._id}`, { token: adminToken });

  // ---------- scenario 1: group users by interests ----------
  const grouped = await request('GET', '/users/grouped-by-interests?limit=10', { token: adminToken });
  assert.equal(grouped.status, 200);
  assert.equal(grouped.data.pagination.total, 4);
  const byInterest = Object.fromEntries(grouped.data.data.map((group) => [group.interest, group.userCount]));
  assert.deepEqual(byInterest, { chess: 2, gaming: 1, hiking: 1, reading: 1 });
  assert.equal(grouped.data.data[0].interest, 'chess');
  const groupedPage2 = await request('GET', '/users/grouped-by-interests?page=2&limit=2', { token: adminToken });
  assert.equal(groupedPage2.data.data.length, 2);
  assert.equal(groupedPage2.data.pagination.total, 4);
  assert.equal(groupedPage2.data.pagination.hasNextPage, false);
  check('interest grouping aggregation paginates and counts correctly');

  // ---------- scenario 2: posts by user via $lookup ----------
  for (let i = 1; i <= 2; i += 1) {
    const post = await request('POST', '/posts', {
      token: aliceToken,
      body: { title: `Alice post ${i}`, content: `Public post ${i}` },
    });
    assert.equal(post.status, 201);
  }
  const bobPost = await request('POST', '/posts', {
    token: bobToken,
    body: { title: 'Bob post', content: 'Bob public post' },
  });
  assert.equal(bobPost.status, 201);

  const alicePosts = await request('GET', `/users/${alice._id}/posts?page=1&limit=1`, { token: bobToken });
  assert.equal(alicePosts.status, 200);
  assert.equal(alicePosts.data.user.name, 'Alice');
  assert.equal(alicePosts.data.pagination.total, 2);
  assert.equal(alicePosts.data.data.length, 1);
  assert.equal(alicePosts.data.data[0].title, 'Alice post 2');
  assert.equal(alicePosts.data.data[0].author, alice._id);
  const alicePostsPage2 = await request('GET', `/users/${alice._id}/posts?page=2&limit=1`, { token: bobToken });
  assert.equal(alicePostsPage2.data.data[0].title, 'Alice post 1');
  assert.equal(alicePostsPage2.data.pagination.hasNextPage, false);
  check('$lookup returns a user\'s posts sorted newest first, paginated');

  const bobPostsSeenByAlice = await request('GET', `/users/${bob._id}/posts`, { token: aliceToken });
  assert.equal(bobPostsSeenByAlice.data.pagination.total, 1);
  check('posts of a user are visible to other authenticated users');

  const unknownUserPosts = await request('GET', `/users/${new mongoose.Types.ObjectId()}/posts`, {
    token: aliceToken,
  });
  assert.equal(unknownUserPosts.status, 404);

  // ---------- cascade delete ----------
  const deleteSelf = await request('DELETE', `/users/${adminUser._id}`, { token: adminToken });
  assert.equal(deleteSelf.status, 400);

  const deleteBob = await request('DELETE', `/users/${bob._id}`, { token: adminToken });
  assert.equal(deleteBob.status, 200);
  assert.equal(deleteBob.data.deleted.posts, 1);
  const bobAfterDelete = await request('GET', '/users/me', { token: bobToken });
  assert.equal(bobAfterDelete.status, 401);
  check('admin deletes a user, their posts, and the session token stops working');

  // ---------- indexes ----------
  const userIndexes = await User.collection.indexes();
  const noteIndexes = await Note.collection.indexes();
  const postIndexes = await Post.collection.indexes();

  const emailIndex = findIndex(userIndexes, { email: 1 });
  assert.ok(emailIndex, 'missing user email index');
  assert.equal(emailIndex.unique, true);
  assert.ok(findIndex(userIndexes, { createdAt: -1, _id: -1 }), 'missing admin user listing index');
  assert.ok(findIndex(userIndexes, { interests: 1 }), 'missing interests index');
  assert.ok(findIndex(noteIndexes, { owner: 1, createdAt: -1, _id: -1 }), 'missing owner notes index');
  assert.ok(findIndex(noteIndexes, { createdAt: -1, _id: -1 }), 'missing all-notes index');
  assert.ok(findIndex(postIndexes, { author: 1, createdAt: -1, _id: -1 }), 'missing post author index');
  check('all required indexes exist, including the unique email index');

  assert.equal(userIndexes.length, 4, 'unexpected extra user index');
  assert.equal(noteIndexes.length, 3, 'unexpected extra note index');
  assert.equal(postIndexes.length, 2, 'unexpected extra post index');
  check('no indexes beyond the documented minimal set');

  // The owner-scoped notes list must be an index scan, not a collection scan.
  const plan = await Note.find({ owner: alice._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .explain('executionStats');
  const planJson = JSON.stringify(plan.queryPlanner.winningPlan);
  assert.match(planJson, /IXSCAN/);
  assert.match(planJson, /owner_1_createdAt_-1__id_-1/);
  assert.doesNotMatch(planJson, /COLLSCAN/);
  assert.doesNotMatch(planJson, /"stage":"SORT"/);
  check('notes-by-owner query is an index scan with no in-memory sort');

  // The admin list must also be an index scan.
  const adminPlan = await Note.find({}).sort({ createdAt: -1, _id: -1 }).limit(20).explain();
  assert.match(JSON.stringify(adminPlan.queryPlanner.winningPlan), /IXSCAN/);
  check('all-notes query uses the createdAt index');

  console.log('\nAll checks passed.');
}

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.connection.close();
  }
}

main()
  .then(cleanup)
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('\nFAILED:', error);
    await cleanup();
    process.exit(1);
  });
