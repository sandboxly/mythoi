export function slugify(name) {
  const s = (name || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return s || 'character';
}
