let counter = 0;

/**
 * Sortable prefixed id: `<prefix>_<base36 timestamp><base36 counter><random>`.
 * Prefixes: usr_ ses_ ans_ res_ tem_ tmm_
 */
export function createId(prefix: string): string {
  counter = (counter + 1) % 1296; // two base36 chars
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${seq}${random}`;
}
