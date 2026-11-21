const User = require('../models/User');
const Post = require('../models/Post');
const ApiError = require('../utils/ApiError');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { requireString, toObjectId } = require('../utils/validate');

/** POST /api/posts - any authenticated user can publish a post. */
async function createPost(req, res) {
  const body = req.body || {};
  const title = requireString(body.title, 'title', { max: 200 });
  const content = requireString(body.content, 'content', { max: 20000 });

  const post = await Post.create({ author: req.user._id, title, content });
  res.status(201).json({ post });
}

/**
 * GET /api/users/:id/posts
 *
 * Scenario 2: all posts belonging to one user, newest first, paginated.
 * A single aggregation pipeline with $lookup is used. The $lookup foreign field
 * (`author`) is backed by Post's { author, createdAt, _id } index, which also
 * serves the sort/skip/limit executed inside the lookup sub-pipeline.
 * The second $lookup only counts the same posts so pagination metadata stays
 * accurate without leaving the pipeline.
 */
async function listPostsByUser(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const userId = toObjectId(req.params.id, 'user id');
  const postsCollection = Post.collection.name;

  const [result] = await User.aggregate([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: postsCollection,
        localField: '_id',
        foreignField: 'author',
        as: 'posts',
        pipeline: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { author: 1, title: 1, content: 1, createdAt: 1, updatedAt: 1 } },
        ],
      },
    },
    {
      $lookup: {
        from: postsCollection,
        localField: '_id',
        foreignField: 'author',
        as: 'postCount',
        pipeline: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        posts: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$postCount.count', 0] }, 0] },
      },
    },
  ]);

  if (!result) throw ApiError.notFound('User not found');

  res.json({
    user: { _id: result._id, name: result.name, email: result.email },
    data: result.posts,
    pagination: paginationMeta({ page, limit, total: result.total }),
  });
}

module.exports = { createPost, listPostsByUser };
