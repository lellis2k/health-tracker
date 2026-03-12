/**
 * Returns today's date as a YYYY-MM-DD string in LOCAL time.
 * Using local date parts (not toISOString) avoids the UTC offset issue
 * where dates after 11pm UTC would return tomorrow's date.
 */
export function todayDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
