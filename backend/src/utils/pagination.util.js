function parsePagination(query, { maxLimit = 100, defaultLimit = 20 } = {}) {
  const limit = Math.min(Number.parseInt(query.limit, 10) || defaultLimit, maxLimit);
  const offset = Math.max(Number.parseInt(query.offset, 10) || 0, 0);

  return { limit, offset };
}

module.exports = {
  parsePagination,
};
