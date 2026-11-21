const ApiError = require('./ApiError');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value, field, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw ApiError.badRequest(`${field} must be a positive integer`);
  }
  return parsed;
}

/**
 * Reads `page` and `limit` from the query string.
 * The limit is clamped to MAX_LIMIT so a client cannot force an unbounded scan.
 */
function getPagination(query = {}) {
  const page = parsePositiveInt(query.page, 'page', 1);
  const requestedLimit = parsePositiveInt(query.limit, 'limit', DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta({ page, limit, total }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function paginated(data, { page, limit, total }) {
  return { data, pagination: paginationMeta({ page, limit, total }) };
}

module.exports = { getPagination, paginationMeta, paginated, DEFAULT_LIMIT, MAX_LIMIT };
