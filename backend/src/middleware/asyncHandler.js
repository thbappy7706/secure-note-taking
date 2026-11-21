/** Forwards rejected promises to Express's error handler. */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = asyncHandler;
