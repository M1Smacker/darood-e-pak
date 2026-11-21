// Full-screen tasbeeh counter. The count lives on the phone until Save, so closing the app,
// a call or a locked screen never loses it (Q31). The screen stays awake while it is open (Q72).
import { t, dateText } from './strings.js';
import * as L from './logic.js';
import { h, fill, num, toast, sheet, ask, choose, crescent } from './ui.js';
import { person, nameOf, addEntry } from './app.js';
import { DAROODS } from './config.js';

const KEY = (kind, pid) => `dp.ctr.${kind}.${pid}`;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* private mode: count still works this session */ } };

export function openCounter(S, kind, pid) {
  const key = KEY(kind, pid);
  let c = read(key);
  if (!c || !Number.isInteger(c.n) || c.n < 0 || !L.isDayKey(c.day)) c = { n: 0, day: S.today, target: 0 };
  if (c.n === 0) c.day = S.today;
  const keep = () => write(key, c.n ? c : { ...c, n: 0 });

  // ---- wake lock: re-taken when the phone comes back to this screen ----
  let lock = null;
  const wake = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { lock = null; } };
  const onVis = () => { if (!document.hidden) wake(); }; // the phone drops the lock when hidden
  wake();
  document.addEventListener('visibilitychange', onVis);

  const R = 46; const CIRC = 2 * Math.PI * R;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'ring'); svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(ns, 'circle');
  const arc = document.createElementNS(ns, 'circle');
  for (const [el, cls] of [[track, 'track'], [arc, 'arc']]) {
    el.setAttribute('cx', 50); el.setAttribute('cy', 50); el.setAttribute('r', R); el.setAttribute('class', cls);
    svg.append(el);
  }
  arc.setAttribute('stroke-dasharray', CIRC);
  arc.setAttribute('transform', 'rotate(-90 50 50)');

  const big = h('div', { class: 'count', 'aria-live': 'polite' });
  const sub = h('div', { class: 'count-sub' });
  const targets = h('div', { class: 'targets', role: 'group', 'aria-label': t('target') });
  const d = DAROODS[person(S.me)?.darood || 0];
  const text = d?.ar ? h('div', { class: 'darood' }, h('p', { class: 'ar', lang: 'ar', dir: 'rtl' }, d.ar),
    (document.documentElement.lang === 'ur' ? d.ur : d.en) ? h('p', { class: 'tr' }, document.documentElement.lang === 'ur' ? d.ur : d.en) : null) : null;

  function draw(pulse) {
    fill(big, num(c.n));
    const p = c.target ? Math.min(1, c.n / c.target) : 0;
    arc.setAttribute('stroke-dashoffset', CIRC * (1 - p));
    root.classList.toggle('reached', !!c.target && c.n >= c.target);
    sub.textContent = c.target ? (c.n >= c.target ? t('target_reached') : `${t('target')} ${L.fmt(c.target)}`) : t('tap_hint');
    fill(targets, ...[[0, t('none')], [100, '100'], [313, '313'], [1000, '1,000'], ['c', t('custom')]].map(([v, lab]) =>
      h('button', { class: (v === 'c' ? ![0, 100, 313, 1000].includes(c.target) : c.target === v) ? 'on' : '', 'aria-pressed': String(c.target === v), onclick: () => setTarget(v) }, lab)));
    if (pulse) { root.classList.remove('pulse'); void root.offsetWidth; root.classList.add('pulse'); }
  }
  async function setTarget(v) {
    if (v !== 'c') { c.target = v; keep(); return draw(); }
    const input = h('input', { class: 'field big', inputMode: 'numeric', 'aria-label': t('target'), value: c.target ? String(c.target) : '' });
    const s = sheet(t('target'), h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      const r = L.parseCount(input.value);
      if (r.n) { c.target = r.n; keep(); draw(); }
      s.close();
    } }, input, h('button', { class: 'btn gold block', type: 'submit' }, t('save_changes'))));
  }

  const tap = () => { if (c.n >= L.MAX_ENTRY) return; c.n++; keep(); draw(true); };
  const minus = () => { if (c.n > 0) { c.n--; keep(); draw(); } };

  async function doSave() {
    if (!c.n) { toast(t('save_nothing')); return; }
    if (kind === 'a' && L.ammiProgress(S.goal.start, S.goal.total).done) { toast(t('ammi_closed'), 'bad'); return; }
    let day = S.today;
    if (c.day !== S.today && L.withinWindow(c.day, S.today)) {
      day = await choose(t('save_to', { n: L.fmt(c.n) }),
        [[`${dateText(c.day)}`, c.day], [`${t('today')} (${dateText(S.today)})`, S.today]], t('started_on', { day: dateText(c.day) }));
      if (!day) return;
    }
    const n = c.n;
    addEntry({ pid, kind, n, day, byPid: S.me },
      pid === S.me ? t('saved', { n: L.fmt(n) }) : t('saved_for', { n: L.fmt(n), name: nameOf(pid) })).catch(() => {});
    c = { n: 0, day: S.today, target: c.target };
    keep();
    close();
  }
  async function reset() {
    if (c.n && await ask(t('reset_sure', { n: L.fmt(c.n) }), t('reset'), t('cancel'), { danger: true })) { c.n = 0; c.day = S.today; keep(); draw(); }
  }

  const controls = h('div', { class: 'ctr-controls' },
    h('button', { class: 'btn ghost', onclick: minus, 'aria-label': t('minus1') }, h('bdi', {}, t('minus1'))),
    h('button', { class: 'btn gold', onclick: doSave }, t('save')));
  const head = h('div', { class: 'ctr-head' },
    h('div', {}, h('strong', {}, t(kind === 'a' ? 'counter_ammi' : 'counter_title')),
      pid !== S.me ? h('span', { class: 'muted small' }, ` · ${nameOf(pid)}`) : null),
    h('div', { class: 'row gap' }, h('button', { class: 'link', onclick: reset }, t('reset')),
      h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: () => close() }, '✕')));
  const face = h('div', { class: 'ctr-face' }, svg, crescent(220, 'mark ghost-mark'), h('div', { class: 'ctr-num' }, big, sub));
  const root = h('div', { class: `counter ${kind === 'a' ? 'ammi' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('counter_title'), tabIndex: -1 },
    head, text, face, targets, controls);

  // The whole screen counts, except its buttons (Q31).
  root.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('button, select, input, a, .targets, .ctr-controls, .ctr-head')) return;
    tap();
  });
  const onKey = (e) => {
    if (document.getElementById('sheets').childElementCount) return;
    if (e.key === 'Escape') close();
    else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button, input, select')) { e.preventDefault(); tap(); }
  };
  addEventListener('keydown', onKey);
  const onHash = () => close();
  addEventListener('hashchange', onHash);

  function close() {
    keep();
    removeEventListener('keydown', onKey);
    removeEventListener('hashchange', onHash);
    document.removeEventListener('visibilitychange', onVis);
    lock?.release?.().catch(() => {});
    root.remove();
    document.body.classList.remove('counting');
  }

  document.body.append(root);
  document.body.classList.add('counting');
  draw();
  root.focus();
}
