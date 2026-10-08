import type { PromotionTheme } from '@/hooks/usePromotion';

// Kenya is on East Africa Time (UTC+3) all year — no daylight saving — so
// campaign times are entered and shown as Nairobi time, whatever the admin's
// device clock says.
const EAT_OFFSET_MS = 3 * 3600_000;

/** ISO instant → "YYYY-MM-DDTHH:mm" in Nairobi, for <input type="datetime-local">. */
export const toNairobiInput = (iso: string) => new Date(new Date(iso).getTime() + EAT_OFFSET_MS).toISOString().slice(0, 16);
/** "YYYY-MM-DDTHH:mm" read as Nairobi time → ISO instant. */
export const fromNairobiInput = (v: string) => new Date(`${v}:00+03:00`).toISOString();
export const formatNairobi = (iso: string) =>
  new Date(iso).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const pad = (n: number) => String(n).padStart(2, '0');
type YMD = [number, number, number]; // month is 1–12
const wall = ([y, m, d]: YMD, h = 0, mi = 0) => `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
const shift = ([y, m, d]: YMD, days: number): YMD => {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
};
// n-th given weekday (0 = Sun) of a month.
const nthWeekday = (y: number, m: number, weekday: number, n: number): YMD => {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return [y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7];
};
// Easter Sunday (Gregorian), so Easter promotions land on the right dates each year.
const easter = (y: number): YMD => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return [y, month, day];
};

export interface PromoPreset {
  key: string;
  label: string;
  name: (year: number) => string;
  title: string;
  subtitle: string;
  announcement: string;
  ctaLabel: string;
  theme: PromotionTheme;
  /** Suggested product tag, offered as a one-click link target. */
  tag?: string;
  /** Start/end as Nairobi wall-clock strings for the occurrence in `year`. */
  range: (year: number) => { start: string; end: string };
}

// Wording is deliberately free of discount claims ("up to 40% off"): the banner
// can only honestly promise what Offers has actually set on the products.
export const PROMO_PRESETS: PromoPreset[] = [
  {
    key: 'black-friday', label: 'Black Friday', tag: 'black-friday', theme: 'night',
    name: (y) => `Black Friday ${y}`, title: 'Black Friday', subtitle: 'Special wholesale deals — while stock lasts.',
    announcement: 'Black Friday deals are live — shop now', ctaLabel: 'Shop Black Friday deals',
    range: (y) => { const fri = nthWeekday(y, 11, 5, 4); return { start: wall(shift(fri, -4)), end: wall(shift(fri, 3), 23, 59) }; },
  },
  {
    key: 'christmas', label: 'Christmas', tag: 'christmas', theme: 'festive',
    name: (y) => `Christmas ${y}`, title: 'Christmas gifts', subtitle: 'Wholesale prices on gifts for everyone on your list.',
    announcement: 'Christmas gifts at wholesale prices — order early', ctaLabel: 'Shop gifts',
    range: (y) => ({ start: wall([y, 12, 1]), end: wall([y, 12, 25], 23, 59) }),
  },
  {
    key: 'new-year', label: 'New Year', tag: 'new-year', theme: 'gold',
    name: (y) => `New Year ${y + 1}`, title: 'New year, new savings', subtitle: 'Start the year with wholesale prices.',
    announcement: 'New year, new savings — shop wholesale prices', ctaLabel: 'Start saving',
    range: (y) => ({ start: wall([y, 12, 26]), end: wall([y + 1, 1, 2], 23, 59) }),
  },
  {
    key: 'valentines', label: "Valentine's Day", tag: 'valentines', theme: 'festive',
    name: (y) => `Valentine's ${y}`, title: "Valentine's Day", subtitle: "Gifts they'll love, at wholesale prices.",
    announcement: "Valentine's gifts at wholesale prices", ctaLabel: 'Shop gifts',
    range: (y) => ({ start: wall([y, 2, 7]), end: wall([y, 2, 14], 23, 59) }),
  },
  {
    key: 'easter', label: 'Easter', tag: 'easter', theme: 'brand',
    name: (y) => `Easter ${y}`, title: 'Easter specials', subtitle: 'Wholesale prices for the long weekend.',
    announcement: 'Easter specials — wholesale prices', ctaLabel: 'Shop Easter specials',
    range: (y) => { const e = easter(y); return { start: wall(shift(e, -7)), end: wall(shift(e, 1), 23, 59) }; },
  },
  {
    key: 'mothers-day', label: "Mother's Day", tag: 'mothers-day', theme: 'festive',
    name: (y) => `Mother's Day ${y}`, title: "Mother's Day", subtitle: 'Treat Mum — at wholesale prices.',
    announcement: "Mother's Day gifts at wholesale prices", ctaLabel: 'Shop gifts',
    range: (y) => { const sun = nthWeekday(y, 5, 0, 2); return { start: wall(shift(sun, -7)), end: wall(sun, 23, 59) }; },
  },
  {
    key: 'back-to-school', label: 'Back to school', tag: 'back-to-school', theme: 'brand',
    name: (y) => `Back to school ${y}`, title: 'Back to school', subtitle: 'Get ready for the new term at wholesale prices.',
    announcement: 'Back to school — wholesale prices', ctaLabel: 'Shop now',
    range: (y) => ({ start: wall([y, 1, 2]), end: wall([y, 1, 18], 23, 59) }),
  },
  {
    key: 'flash', label: 'Flash sale (24h)', theme: 'night',
    name: () => 'Flash sale', title: 'Flash sale', subtitle: 'Today only — wholesale deals while the clock runs.',
    announcement: 'Flash sale — today only', ctaLabel: 'Shop the flash sale',
    range: () => {
      const start = new Date(Math.ceil((Date.now() + 5 * 60_000) / 3_600_000) * 3_600_000);
      return { start: toNairobiInput(start.toISOString()), end: toNairobiInput(new Date(start.getTime() + 24 * 3_600_000).toISOString()) };
    },
  },
];

/** The next occurrence of a preset that hasn't already ended. */
export function nextRange(preset: PromoPreset): { year: number; start: string; end: string } {
  const thisYear = new Date(Date.now() + EAT_OFFSET_MS).getUTCFullYear();
  for (const year of [thisYear, thisYear + 1]) {
    const r = preset.range(year);
    if (Date.parse(fromNairobiInput(r.end)) > Date.now()) return { year, ...r };
  }
  const year = thisYear + 1;
  return { year, ...preset.range(year) };
}
