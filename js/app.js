// Start-up, shared state, live data and the tab router.
import { firebaseConfig, ADMIN_UID, EMU, FIRST_YEAR } from './config.js';
import { setLang, getLang, t, dateText } from './strings.js';
import { dayKey, boardKeys, isDayKey, withinWindow, fmt } from './logic.js';
import { makeStore } from './db.js';
import { h, fill, num, toast, sheet, ask } from './ui.js';
import { VERSION } from './version.js';
import * as screens from './screens.js';
import { mountAdmin } from './admin.js';

const SDK = 'https://www.gstatic.com/firebasejs/13.0.0';
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const params = new URLSearchParams(location.search);
const emu = local && params.has('emu');

const keep = (box) => (k, v) => { try { if (v === undefined) return box().getItem(k); if (v === null) box().removeItem(k); else box().setItem(k, v); } catch { return null; } };
const store = keep(() => localStorage);
// Who is using the app lasts only until it is closed: a parent's phone opens on the family list
// again, so a child picks their own name (Ahmed, 20 Nov).
const session = keep(() => sessionStorage);
store('dp.me', null); // versions before 0.2.0 remembered it for good
const json = (k) => { try { return JSON.parse(store(k)) || null; } catch { return null; } };

// Fonts load beside the app instead of in front of it (they held the start back 0.4 s).
document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Amiri&family=Cormorant+Garamond:wght@500;600;700&family=Figtree:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap' }));

// ---------- state ----------
export const S = {
  version: VERSION, emu,
  ready: false, error: null,
  uid: null, isAdmin: false, db: null,
  // The family list as last seen on this phone, so the names show at once while the database starts.
  people: json('dp.people') || {}, peopleLoaded: !!json('dp.people'),
  me: session('dp.me'),
  today: null,
  boards: { w: {}, m: {}, all: {} },
  years: {}, // mine: { 2026: { MMDD: { b, a } } }
  goal: {}, ammiYear: {},
  pending: 0,
  online: navigator.onLine,
};

// Day preview for testing: ?today=2026-12-31 on localhost only.
const fakeToday = local && isDayKey(params.get('today')) ? params.get('today') : null;
const todayNow = () => fakeToday || dayKey();
S.today = todayNow();

// People in the map, without the rules' bookkeeping field.
export const peopleList = () => Object.entries(S.people).filter(([k, v]) => k !== '_p' && v && typeof v === 'object');
export const person = (pid) => (pid && pid !== '_p' && typeof S.people[pid] === 'object' ? S.people[pid] : null);
export const nameOf = (pid) => person(pid)?.name || '?';

export function setMe(pid) {
  S.me = pid;
  session('dp.me', pid);
  listenMine();
  go(pid ? 'home' : 'signin');
}

// ---------- language and text size, remembered on this phone ----------
export function applyLang(l) {
  setLang(l);
  store('dp.lang', l);
  document.documentElement.lang = l === 'ur' ? 'ur' : 'en';
  document.documentElement.dir = l === 'ur' ? 'rtl' : 'ltr';
  document.title = t('app');
  drawChrome();
  rerender(true);
}
export function applySize(n) {
  store('dp.size', String(n));
  document.documentElement.dataset.size = n;
}

// ---------- saving: shown at once (local cache), confirmed or undone by the server later ----------
export function save(promise, okMsg) {
  S.pending++; drawSync();
  if (okMsg) toast(okMsg, 'ok');
  return Promise.resolve(promise)
    .catch((e) => {
      console.error(e);
      toast(e?.code === 'permission-denied' ? t('err_denied') : t('err_save'), 'bad');
      throw e;
    })
    .finally(() => { S.pending--; drawSync(); });
}

// ---------- outbox: a new entry stays written down on this phone until the database has it ----------
// Firestore keeps offline saves too, but it silently drops one the database refuses (a day that grew
// too old while the phone was offline), and a phone that signs in as someone else (the admin) strands
// them. So every new entry is also noted here, and checked against the database itself.
const BOX = 'dp.outbox';
const readBox = () => json(BOX) || {};
const putBox = (id, v) => { const b = readBox(); if (v) b[id] = v; else delete b[id]; store(BOX, Object.keys(b).length ? JSON.stringify(b) : null); drawUnsaved(); };
const inFlight = new Set();

export function addEntry(e, okMsg) {
  const p = S.store.addEntry(e);
  inFlight.add(p.id);
  putBox(p.id, { pid: e.pid, kind: e.kind, n: e.n, day: e.day, byPid: e.byPid, t: Date.now() });
  return save(p, okMsg)
    .then(() => putBox(p.id, null), () => checkEntry(p.id))
    .finally(() => inFlight.delete(p.id));
}

async function checkEntry(id) {
  try {
    const ok = await S.store.entrySaved(id);
    const item = readBox()[id];
    if (item) putBox(id, ok ? null : { ...item, failed: true });
  } catch { /* offline: checked again when the phone is back online */ }
}

let checking = false;
async function checkOutbox() {
  if (checking || !S.store) return;
  checking = true;
  try {
    const ids = Object.keys(readBox()).filter((id) => !inFlight.has(id));
    if (ids.length) {
      await S.store.waitForPending().catch(() => {}); // saves still queued from before go first
      for (const id of ids) if (!inFlight.has(id)) await checkEntry(id);
    }
  } finally { checking = false; }
}

function drawUnsaved() {
  const bar = document.getElementById('unsaved');
  const failed = Object.values(readBox()).filter((x) => x.failed);
  bar.hidden = !failed.length || !S.store;
  bar.textContent = t('unsaved_bar');
}

function openUnsaved() {
  const list = h('ul', { class: 'entries' });
  const s = sheet(t('unsaved_title'), h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('unsaved_sub')), list));
  const draw = () => {
    const rows = Object.entries(readBox()).filter(([, x]) => x.failed);
    if (!rows.length) return s.close();
    fill(list, ...rows.map(([id, x]) => {
      const day = withinWindow(x.day, S.today) ? x.day : S.today;
      return h('li', { class: 'unsaved-row' },
        h('span', {}, h('strong', {}, nameOf(x.pid)), ' ', num(x.n), ' ',
          h('span', { class: `tag ${x.kind}` }, t(x.kind === 'a' ? 'tab_ammi' : 'tab_board')),
          h('span', { class: 'muted small block' }, dateText(x.day, true), day !== x.day ? ` ${t('unsaved_moves')}` : '')),
        h('span', { class: 'row gap' },
          h('button', { class: 'btn gold', onclick: () => {
            putBox(id, { ...x, failed: false });
            addEntry({ id, pid: x.pid, kind: x.kind, n: x.n, day, byPid: x.byPid }, t('saved', { n: fmt(x.n) })).catch(() => {}).finally(draw);
            draw();
          } }, t('save_again')),
          h('button', { class: 'link danger', onclick: async () => {
            if (await ask(t('unsaved_remove_sure', { n: fmt(x.n), name: nameOf(x.pid) }), t('remove'), t('cancel'), { danger: true })) { putBox(id, null); draw(); }
          } }, t('remove'))));
    }));
  };
  draw();
}

// ---------- live data ----------
let unsub = { shared: [], mine: [], day: [] };
const stop = (k) => { unsub[k].forEach((u) => u()); unsub[k] = []; };
const loadErr = (e) => { console.error(e); S.error = t('load_error'); rerender(); };

function listenShared() {
  stop('shared');
  const st = S.store;
  unsub.shared.push(st.onPeople((p, meta) => {
    S.people = p; S.peopleLoaded = !meta.fromCache || Object.keys(p).length > 0;
    if (!meta.fromCache) store('dp.people', JSON.stringify(Object.fromEntries(peopleList().map(([k, v]) => [k, { name: v.name, key: v.key, managedBy: v.managedBy }]))));
    if (S.me && S.peopleLoaded && !meta.fromCache && !person(S.me)) setMe(null); // removed or merged away
    rerender();
  }, loadErr));
  unsub.shared.push(st.onGoal((g) => { S.goal = g; rerender(); }, loadErr));
  listenDay();
}

// Things that depend on today's date: re-made when the day changes.
function listenDay() {
  stop('day');
  const st = S.store;
  const k = boardKeys(S.today);
  for (const [slot, id] of [['w', k.w], ['m', k.m], ['all', 'all']]) {
    unsub.day.push(st.onBoard(id, (b) => { S.boards[slot] = b; rerender(); }, loadErr));
  }
  unsub.day.push(st.onAmmiYear(S.today.slice(0, 4), (d) => { S.ammiYear = d; rerender(); }, loadErr));
  listenMine();
}

function listenMine() {
  stop('mine');
  S.years = {};
  if (!S.me || !S.store) return;
  const y = Number(S.today.slice(0, 4));
  for (const year of [y - 1, y].filter((v) => v >= FIRST_YEAR)) {
    unsub.mine.push(S.store.onYear(S.me, year, (d) => { S.years = { ...S.years, [year]: d }; rerender(); }, loadErr));
  }
}

// The day turns over while the app is open, or it comes back from the background on a new day.
function checkDay() {
  const now = todayNow();
  if (now === S.today) return;
  S.today = now;
  listenDay();
  rerender(true);
}
setInterval(checkDay, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
addEventListener('online', () => { S.online = true; drawSync(); checkOutbox(); });
addEventListener('offline', () => { S.online = false; drawSync(); });

// ---------- router ----------
const TABS = ['home', 'board', 'ammi', 'me'];
let view = null; let viewName = null;

export function go(name) {
  if (location.hash.slice(1) !== name) location.hash = name;
  else route();
}

// force: build the screen again even if it is the one showing (new language, new day).
function route(force = false) {
  let name = location.hash.slice(1) || 'home';
  if (name !== 'admin' && !TABS.includes(name)) name = 'home';
  if (name !== 'admin' && !S.error && S.peopleLoaded && !person(S.me)) name = 'signin';
  // Same screen, already built: refresh it in place, so nothing typed into it is lost.
  if (force !== true && name === viewName && view?.update) return view.update();
  mount(name);
}
addEventListener('hashchange', () => route());

function mount(name) {
  const main = document.getElementById('view');
  view?.destroy?.();
  viewName = name;
  if (S.error) view = { el: h('div', { class: 'notice' }, S.error) };
  else if (name === 'signin' ? !S.peopleLoaded : !S.ready || (!S.peopleLoaded && name !== 'admin')) view = { el: h('div', { class: 'notice' }, t('loading')) };
  else if (name === 'admin') view = mountAdmin(S);
  else view = screens[name](S);
  main.replaceChildren(view.el);
  main.focus({ preventScroll: true });
  scrollTo(0, 0);
  drawTabs();
}

let queued = false;
export function rerender(full = false) {
  if (full) { if (viewName) route(true); return; }
  if (queued) return;
  queued = true;
  // A timer, not requestAnimationFrame: rAF stops while the page is hidden, and data arriving in
  // the background would then leave the screen on "Loading".
  setTimeout(() => {
    queued = false;
    // Data arrived for a screen that was still waiting: build it properly now.
    const waiting = !view?.update;
    if (waiting || (viewName !== 'admin' && viewName !== 'signin' && !person(S.me))) return route(true);
    view.update();
  }, 0);
}

// ---------- chrome: header, tabs, sync pill ----------
function drawChrome() {
  const lang = document.getElementById('lang');
  lang.replaceChildren(
    h('button', { class: getLang() === 'en' ? 'on' : '', lang: 'en', 'aria-pressed': String(getLang() === 'en'), onclick: () => applyLang('en') }, 'EN'),
    h('button', { class: getLang() === 'ur' ? 'on' : '', lang: 'ur', 'aria-pressed': String(getLang() === 'ur'), onclick: () => applyLang('ur') }, 'اردو'));
  document.getElementById('title').textContent = t('app');
  drawTabs();
  drawSync();
  drawUnsaved();
}

const ICONS = {
  home: 'M3 11 12 3l9 8v10h-6v-6H9v6H3z',
  board: 'M4 21V11h4v10zm6 0V5h4v16zm6 0v-7h4v7z',
  ammi: 'M12 2l2.4 4.2L19 5l-1.2 4.8L22 12l-4.2 2.2L19 19l-4.6-1.2L12 22l-2.4-4.2L5 19l1.2-4.8L2 12l4.2-2.2L5 5l4.6 1.2z',
  me: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4.4 3.6-7 8-7s8 2.6 8 7z',
};
function drawTabs() {
  const nav = document.getElementById('tabs');
  nav.hidden = !person(S.me) || viewName === 'signin';
  nav.replaceChildren(...TABS.map((name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONS[name]); svg.append(p);
    return h('a', { href: `#${name}`, class: viewName === name ? 'on' : '', 'aria-current': viewName === name ? 'page' : null }, svg, h('span', {}, t(`tab_${name}`)));
  }));
}

function drawSync() {
  const pill = document.getElementById('sync');
  const msg = !S.online ? t('offline') : S.pending ? t('syncing') : '';
  pill.textContent = msg;
  pill.hidden = !msg;
}

// ---------- start ----------
async function boot() {
  applySize(Number(store('dp.size')) || 1);
  applyLang(store('dp.lang') || 'en');
  route(); // the family list saved on this phone shows now, before the database is ready
  const config = emu ? EMU.config : firebaseConfig;
  const adminUid = emu ? EMU.adminUid : ADMIN_UID;
  if (!config) { S.error = t('not_setup'); S.ready = true; return route(); }
  let fb;
  try {
    const [app, auth, fs] = await Promise.all(['app', 'auth', 'firestore'].map((m) => import(`${SDK}/firebase-${m}.js`)));
    fb = { app, auth, fs };
  } catch {
    S.error = t('offline_first'); S.ready = true; return route();
  }
  const { app, auth: a, fs: f } = fb;
  const fapp = app.initializeApp(config);
  const db = f.initializeFirestore(fapp, {
    localCache: emu ? f.memoryLocalCache() : f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }),
  });
  const auth = a.getAuth(fapp);
  if (emu) {
    f.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    a.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  S.fb = { f, a, auth, db };
  a.onAuthStateChanged(auth, (user) => {
    if (!user) {
      a.signInAnonymously(auth).catch((e) => { console.error(e); S.error = t('load_error'); S.ready = true; route(); });
      return;
    }
    S.uid = user.uid;
    S.isAdmin = user.uid === adminUid;
    S.store = makeStore({ f, db, uid: user.uid });
    S.ready = true;
    listenShared();
    route();
    drawUnsaved(); // ones already known from an earlier time, even if this phone is offline now
    checkOutbox();
  });
}

if ('serviceWorker' in navigator && (!local || params.has('sw'))) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const bar = document.getElementById('update');
          bar.hidden = false;
          bar.onclick = () => { w.postMessage('skip'); };
        }
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

document.getElementById('unsaved').onclick = openUnsaved;
boot();
