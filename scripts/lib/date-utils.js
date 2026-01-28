// scripts/lib/date-utils.js
// Small, dependency-free helpers to keep date handling consistent.

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function safeParseToMs(value) {
  if (!value) return NaN;
  if (typeof value === 'number') return value;

  // Handle common case: YYYY-MM-DD (from filenames)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Interpret as UTC midnight for consistency.
    return Date.parse(`${value}T00:00:00.000Z`);
  }

  // Prefer explicit UTC if missing timezone.
  // If string already contains Z or an offset (+/-HH:MM), keep as-is.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return Date.parse(`${value}Z`);
  }

  return Date.parse(value);
}

function isWithinRange(dateValue, start, end) {
  const ms = safeParseToMs(dateValue);
  if (!Number.isFinite(ms)) return false;
  return ms >= start.getTime() && ms <= end.getTime();
}

module.exports = {
  toIsoDate,
  safeParseToMs,
  isWithinRange,
};
