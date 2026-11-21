const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const ApiError = require('../utils/ApiError');
const { getPagination, paginationMeta, paginated } = require('../utils/pagination');
const {
  requireString,
  optionalString,
  requireEmail,
  requirePassword,
  parseInterests,
  toObjectId,
} = require('../utils/validate');

/** GET /api/users/me */
async function getMe(req, res) {
  res.json({ user: req.user });
}

/** GET /api/users - admin only, paginated. */
async function listUsers(req, res) {
  const { page, limit, skip } = getPagination(req.query);

  const [total, users] = await Promise.all([
    User.countDocuments(),
    User.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .select('name email role interests createdAt updatedAt'),
  ]);

  res.json(paginated(users, { page, limit, total }));
}

/** POST /api/users - admin only. The only way to create another admin. */
async function createUser(req, res) {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 80 });
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const interests = parseInterests(body.interests);
  const role = body.role === undefined ? 'user' : body.role;

  if (!User.ROLES.includes(role)) {
    throw ApiError.badRequest(`role must be one of: ${User.ROLES.join(', ')}`);
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, interests, role });

  res.status(201).json({ user });
}

/** PATCH /api/users/:id - admin only. */
async function updateUser(req, res) {
  const body = req.body || {};
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  if (body.name !== undefined) user.name = requireString(body.name, 'name', { max: 80 });
  if (body.email !== undefined) user.email = requireEmail(body.email);
  if (body.interests !== undefined) user.interests = parseInterests(body.interests);
  if (body.role !== undefined) {
    if (!User.ROLES.includes(body.role)) {
      throw ApiError.badRequest(`role must be one of: ${User.ROLES.join(', ')}`);
    }
    user.role = body.role;
  }
  if (body.password !== undefined) {
    user.passwordHash = await User.hashPassword(requirePassword(body.password));
  }

  await user.save();
  res.json({ user });
}

/** DELETE /api/users/:id - admin only. Removes the account and its content. */
async function deleteUser(req, res) {
  const id = toObjectId(req.params.id, 'user id');
  if (id.equals(req.user._id)) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) throw ApiError.notFound('User not found');

  const [notes, posts] = await Promise.all([
    Note.deleteMany({ owner: id }),
    Post.deleteMany({ author: id }),
  ]);

  res.json({
    message: 'User deleted',
    deleted: { notes: notes.deletedCount, posts: posts.deletedCount },
  });
}

/**
 * GET /api/users/grouped-by-interests - admin only.
 *
 * Scenario 1: users grouped by interests, with pagination.
 * Exactly one collection.aggregate() call is used; the total number of groups is
 * computed inside the same pipeline with $facet, so no extra query is needed.
 * The multikey { interests: 1 } index backs the array traversal ($unwind) and
 * the grouping key, and no document fields beyond interests are read for the key.
 */
async function usersGroupedByInterests(req, res) {
  const { page, limit, skip } = getPagination(req.query);

  const [result] = await User.aggregate([
    { $unwind: '$interests' },
    { $group: { _id: '$interests', count: { $sum: 1 } } },
    // Deterministic tie-break so pagination stays stable across requests.
    { $sort: { count: -1, _id: 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        _id: 0,
        groups: {
          $map: {
            input: '$data',
            as: 'group',
            in: { interest: '$$group._id', userCount: '$$group.count' },
          },
        },
        total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
      },
    },
  ]);

  const groups = result ? result.groups : [];
  const total = result ? result.total : 0;
  res.json({ data: groups, pagination: paginationMeta({ page, limit, total }) });
}

module.exports = {
  getMe,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  usersGroupedByInterests,
};
