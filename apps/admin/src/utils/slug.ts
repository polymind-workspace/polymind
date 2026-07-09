export function generateSlug(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
  const rand = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${rand}` : rand;
}
