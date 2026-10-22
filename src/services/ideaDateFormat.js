import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatIdeaShortDate(timestamp) {
  if (!timestamp) return 'Recently';
  try {
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

// Keep this aligned with the date displayed in Browse List rows.
export function formatIdeaCreationDate(timestamp) {
  if (!timestamp) return 'Recently';
  const createdAt = dayjs(timestamp);
  if (!createdAt.isValid()) return 'Recently';
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  return Date.now() - createdAt.valueOf() < twoWeeksMs
    ? createdAt.fromNow()
    : formatIdeaShortDate(timestamp);
}
