// Small DOM helpers. Text always goes in as text (never innerHTML): names are typed by family
// members, and a name like <img onerror> must show as letters, not run.
import { t } from './strings.js';
import { fmt } from './logic.js';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// replaceChildren, but skipping null/false (replaceChildren would print "null").
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));

// A number that stays left-to-right and in the Latin digits face inside Urdu text.
export const num = (n, cls = '') => h('bdi', { class: `num ${cls}` }, fmt(n));

export function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  box.append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

// Bottom sheet. Returns { el, close }. Esc and the backdrop close it.
export function sheet(title, body, { onclose } = {}) {
  const root = document.getElementById('sheets');
  const prev = document.activeElement;
  let done = false;
  const close = () => {
    if (done) return; done = true;
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 220);
    removeEventListener('keydown', key);
    prev?.focus?.();
    onclose?.();
  };
  const key = (e) => { if (e.key === 'Escape') close(); };
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: close }, '✕')),
    body);
  const wrap = h('div', { class: 'sheet-wrap' }, h('div', { class: 'backdrop', onclick: close }), panel);
  root.append(wrap);
  addEventListener('keydown', key);
  requestAnimationFrame(() => panel.querySelector('input, button:not(.icon-btn)')?.focus());
  return { el: panel, close };
}

// Yes/no question. Resolves true / false.
export function ask(question, yes, no = t('cancel'), { danger = false } = {}) {
  return new Promise((resolve) => {
    let answer = false;
    const s = sheet(question, h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost', onclick: () => s.close() }, no),
      h('button', { class: `btn ${danger ? 'danger' : 'gold'}`, onclick: () => { answer = true; s.close(); } }, yes)),
    { onclose: () => resolve(answer) });
  });
}

// Pick one of several. Resolves the chosen value or null.
export function choose(question, options, note) {
  return new Promise((resolve) => {
    let answer = null;
    const s = sheet(question, h('div', { class: 'stack' },
      note && h('p', { class: 'muted' }, note),
      options.map(([label, value]) => h('button', { class: 'btn gold block', onclick: () => { answer = value; s.close(); } }, label))),
    { onclose: () => resolve(answer) });
  });
}

// The eight-point star (khatam) used across the app, as an SVG element.
export function star(size = 24, cls = 'star') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-12 -12 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true');
  for (const rot of [0, 45]) {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', -7.5); r.setAttribute('y', -7.5); r.setAttribute('width', 15); r.setAttribute('height', 15);
    r.setAttribute('transform', `rotate(${rot})`);
    svg.append(r);
  }
  return svg;
}
