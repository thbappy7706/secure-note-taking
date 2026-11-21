function notFound(req, res) {
  res.status(404).json({
    error: { message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'An account with that email already exists';
    details = Object.keys(err.keyValue || {}).map((field) => ({ field, message: 'must be unique' }));
  }

  if (status >= 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }

  const body = { error: { message } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
