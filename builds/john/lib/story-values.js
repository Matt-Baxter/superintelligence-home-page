// Shared bounds for source-provided scalar values. Attention is not research evidence.
function attention(value) { if (!['number','string'].includes(typeof value)) return 0; const n = Number(value); return Number.isFinite(n) ? Math.min(2147483647, Math.max(0, Math.trunc(n))) : 0; }
function hype(value) { if (!['number','string'].includes(typeof value) || String(value).trim() === '') return null; const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null; }
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|[T ])/i.test(value)) return NaN;
  const day = value.slice(0, 10), calendar = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return NaN;
  let text = value.replace(' ', 'T'); if (text.length === 10) text += 'T00:00:00';
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) text += 'Z';
  return Date.parse(text);
}
function publication(value) { const t = timestamp(value); return Number.isFinite(t) ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(t).toISOString()) : null; }
module.exports = { attention, hype, timestamp, publication };
