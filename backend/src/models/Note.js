const { Schema, model, models } = require('mongoose');

const noteSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
 * 1. { owner: 1, createdAt: -1, _id: -1 } -> a user listing their own notes.
 *    `owner` is an equality match, the rest supports the newest-first sort without
 *    an in-memory sort stage. Also serves the owner prefix for admin filtering by
 *    `?userId=` and for cascade deletes on user removal.
 * 2. { createdAt: -1, _id: -1 } -> an admin listing every user's notes, newest first.
 *    A compound index leading with `owner` cannot support that sort when no owner
 *    is specified, so this second index is required.
 *
 * Fetching one note is served by the default _id index.
 */
noteSchema.index({ owner: 1, createdAt: -1, _id: -1 });
noteSchema.index({ createdAt: -1, _id: -1 });

module.exports = models.Note || model('Note', noteSchema);
