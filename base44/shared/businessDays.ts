// Calculates a date N business days from now (excluding weekends).
export function addBusinessDays(days, from) {
  from = from || new Date();
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}