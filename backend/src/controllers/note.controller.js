const Note = require('../models/Note');
const ApiError = require('../utils/ApiError');
const { getPagination, paginated } = require('../utils/pagination');
const { requireString, optionalString, toObjectId } = require('../utils/validate');

const OWNER_FIELDS = 'name email';

function isOwner(note, userId) {
  const ownerId = note.owner && note.owner._id ? note.owner._id : note.owner;
  return String(ownerId) === String(userId);
}

function assertCanAccess(note, user) {
  if (user.role !== 'admin' && !isOwner(note, user._id)) {
    throw ApiError.forbidden('You do not have permission to access this note');
  }
}

/**
 * GET /api/notes
 * Users see their own notes. Admins see every note, optionally narrowed with
 * ?userId=<id>. Both orderings are served by schema indexes.
 */
async function listNotes(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  let filter = { owner: req.user._id };

  if (req.user.role === 'admin') {
    filter = {};
    if (req.query.userId !== undefined) {
      filter.owner = toObjectId(req.query.userId, 'userId');
    }
  } else if (req.query.userId !== undefined && req.query.userId !== String(req.user._id)) {
    throw ApiError.forbidden('You can only view your own notes');
  }

  const [total, notes] = await Promise.all([
    Note.countDocuments(filter),
    Note.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('owner', OWNER_FIELDS),
  ]);

  res.json(paginated(notes, { page, limit, total }));
}

/** GET /api/notes/:id */
async function getNote(req, res) {
  const note = await Note.findById(toObjectId(req.params.id, 'note id')).populate(
    'owner',
    OWNER_FIELDS
  );
  if (!note) throw ApiError.notFound('Note not found');

  assertCanAccess(note, req.user);
  res.json({ note });
}

/** POST /api/notes */
async function createNote(req, res) {
  const body = req.body || {};
  const title = requireString(body.title, 'title', { max: 200 });
  const content = requireString(body.content, 'content', { max: 20000 });

  const note = await Note.create({ owner: req.user._id, title, content });
  res.status(201).json({ note });
}

/** PATCH /api/notes/:id */
async function updateNote(req, res) {
  const body = req.body || {};
  const title = optionalString(body.title, 'title', { max: 200 });
  const content = optionalString(body.content, 'content', { max: 20000 });

  if (title === undefined && content === undefined) {
    throw ApiError.badRequest('Provide at least one of title or content to update');
  }

  const note = await Note.findById(toObjectId(req.params.id, 'note id'));
  if (!note) throw ApiError.notFound('Note not found');
  assertCanAccess(note, req.user);

  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  await note.save();

  res.json({ note });
}

/** DELETE /api/notes/:id */
async function deleteNote(req, res) {
  const note = await Note.findById(toObjectId(req.params.id, 'note id'));
  if (!note) throw ApiError.notFound('Note not found');
  assertCanAccess(note, req.user);

  await note.deleteOne();
  res.json({ message: 'Note deleted' });
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote };
