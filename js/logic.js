// Pure rules of the app: dates, numbers, ranks, streaks. No Firebase, no DOM, so node can test it.

export const MAX_ENTRY = 100000; // one entry can never be more than 1 Lakh
export const CONFIRM_OVER = 5000; // ask "are you sure?" above this
export const BACK_DAYS = 7; // today plus 7 days back can be added to or fixed
export const AMMI_TARGET = 10000000; // 1 Crore
export const AMMI_STEP = 1000000; // a quiet line every 10 Lakh
export const ME_STEP = 100000; // a quiet line every Lakh

const pad = (n) => String(n).padStart(2, '0');

// The phone's own date (Q11). Never toISOString(): that is UTC and would be yesterday in Kuwait at 2 am.
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Date arithmetic in UTC on purpose: local time would skip or repeat a day across daylight saving.
const toUTC = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromUTC = (t) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
export const isDayKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && fromUTC(toUTC(k)) === k;
export const addDays = (key, n) => { const t = toUTC(key); t.setUTCDate(t.getUTCDate() + n); return fromUTC(t); };
export const weekday = (key) => (toUTC(key).getUTCDay() + 6) % 7; // Monday 0 ... Sunday 6 (Q32)

// ISO 8601 week, Monday start. 1 Jan can belong to the previous year's week 52/53, so the year
// in the key is the week's own year, not the date's.
export function isoWeek(key) {
  const thursday = addDays(key, 3 - weekday(key));
  const y = Number(thursday.slice(0, 4));
  const week = Math.floor((toUTC(thursday) - Date.UTC(y, 0, 1)) / 864e5 / 7) + 1;
  return `${y}-${pad(week)}`;
}
export const weekStart = (key) => addDays(key, -weekday(key));
export const monthKey = (key) => key.slice(0, 7);
export const boardKeys = (key) => ({ w: `w_${isoWeek(key)}`, m: `m_${monthKey(key)}` });

export const withinWindow = (key, today, back = BACK_DAYS) =>
  isDayKey(key) && key <= today && key >= addDays(today, -back);

// Digits as people may type them: Western, Urdu/Persian (۱۲۳), Arabic (١٢٣); commas of any kind.
// { max, zero }: settings use a bigger maximum and allow 0 (clearing a goal).
export function parseCount(raw, { max = MAX_ENTRY, zero = false } = {}) {
  const s = String(raw ?? '')
    .replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 0x06f0)
    .replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 0x0660)
    .replace(/[\s,،٬'’]/g, '');
  if (!s) return { error: 'empty' };
  if (!/^\d+$/.test(s)) return { error: 'invalid' };
  const n = Number(s);
  if (n === 0 && !zero) return { error: 'zero' };
  if (n > max) return { error: 'max' };
  return { n };
}

const inFmt = new Intl.NumberFormat('en-IN');
export const fmt = (n) => inFmt.format(Math.round(Number(n) || 0)); // 1,00,00,000 (Q28)

// Names: shown as typed (tidied), compared by a key that treats look-alike spellings as one.
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;
export const cleanName = (s) => String(s ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
export function nameError(s) {
  const n = cleanName(s);
  if ([...n].length < 2) return 'short';
  if ([...n].length > 40) return 'long';
  if (!/\p{L}/u.test(n)) return 'letters';
  return null;
}
export const nameKey = (s) => cleanName(s).toLowerCase()
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ه/g, 'ہ') // Arabic vs Urdu keyboard letters
  .replace(/[ً-ٰٟ]/g, '') // harakat
  .replace(/[/.]/g, '').replace(/ /g, '-');

// Competition ranking: 5,000 and 5,000 are both #2, the next is #4 (Q76). Zeros are hidden (Q54).
export function rank(totals, nameOf = (p) => p) {
  const rows = Object.entries(totals || {})
    .map(([pid, n]) => ({ pid, n: Number(n) || 0 }))
    .filter((r) => r.n > 0 && r.pid !== 'e')
    .sort((a, b) => b.n - a.n || String(nameOf(a.pid)).localeCompare(String(nameOf(b.pid))));
  rows.forEach((r, i) => { r.rank = i && rows[i - 1].n === r.n ? rows[i - 1].rank : i + 1; });
  return rows;
}

// Year docs keep days as { MMDD: { b, a } }. Flatten many years into { 'YYYY-MM-DD': { b, a } }.
export function flattenYears(docs) {
  const out = {};
  for (const [year, d] of Object.entries(docs || {})) {
    for (const [md, v] of Object.entries(d || {})) {
      const key = `${year}-${md.slice(0, 2)}-${md.slice(2)}`;
      if (isDayKey(key)) out[key] = { b: Math.max(0, Number(v?.b) || 0), a: Math.max(0, Number(v?.a) || 0) };
    }
  }
  return out;
}

// Any Darood that day, for anyone, keeps the streak alive (Q77, Q78). Today not read yet does not
// break it: the day is not over.
export function streak(days, today) {
  const read = (k) => ((days[k]?.b || 0) + (days[k]?.a || 0)) > 0;
  let k = read(today) ? today : addDays(today, -1);
  let n = 0;
  while (read(k)) { n++; k = addDays(k, -1); }
  return n;
}

export function bests(days, field = 'b') {
  let day = null; const weeks = {};
  for (const [k, v] of Object.entries(days)) {
    const n = v[field] || 0;
    if (!n) continue;
    if (!day || n > day.n) day = { day: k, n };
    const w = isoWeek(k);
    weeks[w] = (weeks[w] || 0) + n;
  }
  let week = null;
  for (const [w, n] of Object.entries(weeks)) if (!week || n > week.n) week = { week: w, n };
  return { day, week };
}

export const sumDays = (days, field, from, to) =>
  Object.entries(days).reduce((s, [k, v]) => (k >= from && k <= to ? s + (v[field] || 0) : s), 0);

// Milestones passed while a running total grows day by day: [{ at: 1000000, day }].
export function milestones(base, dayTotals, step) {
  const out = [];
  let total = base;
  for (const k of Object.keys(dayTotals).sort()) {
    const next = total + dayTotals[k];
    for (let m = (Math.floor(total / step) + 1) * step; m <= next; m += step) out.push({ at: m, day: k });
    total = next;
  }
  return out;
}

// Month grid, Monday first: weeks of 7 cells, null outside the month.
export function monthGrid(y, m) {
  const first = `${y}-${pad(m)}-01`;
  const cells = Array(weekday(first)).fill(null);
  for (let k = first; monthKey(k) === first.slice(0, 7); k = addDays(k, 1)) cells.push(k);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Ammi Jaan: the shown total is her own count plus the family's additions.
export function ammiProgress(start, added, target = AMMI_TARGET) {
  const total = (Number(start) || 0) + (Number(added) || 0);
  return { total, remaining: Math.max(0, target - total), percent: Math.min(100, Math.floor(total * 1000 / target) / 10), done: total >= target };
}

// Monday of ISO week "2026-47" (the week containing 4 January is week 1).
export function isoWeekStart(id) {
  const [y, w] = id.split('-').map(Number);
  return addDays(weekStart(`${y}-01-04`), (w - 1) * 7);
}

// ammiDays docs { MMDD: n } by year -> { 'YYYY-MM-DD': n }
export function flattenAmmi(docs) {
  const out = {};
  for (const [year, d] of Object.entries(docs || {})) {
    for (const [md, v] of Object.entries(d || {})) {
      const key = `${year}-${md.slice(0, 2)}-${md.slice(2)}`;
      if (isDayKey(key) && Number(v) > 0) out[key] = Number(v);
    }
  }
  return out;
}
