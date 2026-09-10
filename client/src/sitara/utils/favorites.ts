// Sitara OS — customer favorites (local-first)
// Saved places live on-device; no account needed to start collecting.
// Shape matches discovery cards so shelves render without mapping.
export interface Favorite {
  id: string;
  source: string;
  name: string;
  image: string;
  rating: number;
  price?: string;
  category?: string;
}

const KEY = 'sitara:favorites:v1';

function read(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: Favorite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode etc. — favorites just don't persist */
  }
}

export function getFavorites(): Favorite[] {
  return read();
}

export function isFavorite(id: string, source?: string): boolean {
  return read().some((f) => f.id === id && (!source || f.source === source));
}

export function toggleFavorite(fav: Favorite): boolean {
  const list = read();
  const i = list.findIndex((f) => f.id === fav.id && f.source === fav.source);
  if (i >= 0) {
    list.splice(i, 1);
    write(list);
    return false;
  }
  list.unshift(fav);
  write(list.slice(0, 100));
  return true;
}
