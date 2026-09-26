import { DateTime } from 'luxon';
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const clock = value => value === 1440 ? '24:00' : `${String(Math.floor(value/60)).padStart(2, '0')}:${String(value%60).padStart(2, '0')}`;
export function toMinute(value) {
  const [h, m] = value.split(':').map(Number);
  return h*60+m;
}
export function localISO(value, zone) {
  const dt = DateTime.fromISO(value, { zone });
  if (!dt.isValid || dt.toFormat("yyyy-MM-dd'T'HH:mm") !== value) throw new Error('Invalid local time (possibly a daylight-saving clock change)');
  if (dt.getPossibleOffsets().length > 1) throw new Error('This time repeats during a daylight-saving transition. Choose an unambiguous boundary.');
  return dt.toISO();
}
export function label(value, zone) {
  return DateTime.fromISO(value).setZone(zone).toFormat('ccc, LLL d · HH:mm ZZZZ');
}
export function monday(zone) { return DateTime.now().setZone(zone).startOf('week').toISODate(); }
