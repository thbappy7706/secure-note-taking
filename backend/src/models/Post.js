const { Schema, model, models } = require('mongoose');

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

/**
 * Index strategy:
 *
 * { author: 1, createdAt: -1, _id: -1 } -> the foreign field of the `$lookup` in
 * "posts belonging to a particular user". The equality prefix on `author` lets the
 * lookup probe only that user's posts, and the trailing fields support the
 * newest-first sort / skip / limit performed inside the lookup pipeline.
 * No other index is needed: posts are never queried by any other field.
 */
postSchema.index({ author: 1, createdAt: -1, _id: -1 });

module.exports = models.Post || model('Post', postSchema);
