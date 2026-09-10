// Returns the number of business days remaining until the given deadline (ISO string).
// Returns 0 if the deadline has passed, null if no deadline.
export function businessDaysUntil(deadlineIso) {
  if (!deadlineIso) return null;
  const end = new Date(deadlineIso);
  const now = new Date();
  if (end <= now) return 0;
  let count = 0;
  const cur = new Date(now);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cur < endDay) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}