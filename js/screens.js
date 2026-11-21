// The four tabs and the sign-in screen. Each returns { el, update, destroy }.
// Parts with inputs are built once; update() only refreshes numbers, so typing is never interrupted.
import { t, dateText, weekdays, monthName } from './strings.js';
import * as L from './logic.js';
import { h, fill, num, toast, sheet, ask, crescent } from './ui.js';
import { peopleList, person, nameOf, setMe, applySize, save, addEntry } from './app.js';
import { openCounter } from './counter.js';
import { DAROODS, FIRST_YEAR } from './config.js';

const errText = { empty: 'err_empty', invalid: 'err_invalid', zero: 'err_zero', max: 'err_max' };
const myDays = (S) => L.flattenYears(S.years);
const yearsSoFar = (S) => { const out = []; for (let y = FIRST_YEAR; y <= Number(S.today.slice(0, 4)); y++) out.push(y); return out; };
const fmtTime = (ts) => (ts?.toDate ? ts.toDate() : null)?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) || '';
const card = (cls, ...kids) => h('section', { class: `card ${cls}` }, ...kids);
const label = (text) => h('h3', { class: 'label' }, crescent(12), h('span', {}, text));
const weekLabel = (wid) => { const a = L.isoWeekStart(wid); return t('week_range', { a: dateText(a), b: dateText(L.addDays(a, 6)) }); };

// ================= sign-in =================
export function signin(S) {
  const list = h('ul', { class: 'names', role: 'list' });
  const search = h('input', { type: 'search', class: 'field', placeholder: t('search'), 'aria-label': t('search'), autocomplete: 'off' });
  let joining = false;
  const draw = () => {
    drawJoin();
    if (joining) return; // the new name would show twice: in the list and on the button (Ahmed, 20 Nov)
    const q = L.nameKey(search.value);
    const rows = peopleList().filter(([, p]) => !p.managedBy && (!q || p.key.includes(q)))
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
    fill(list, ...rows.map(([pid, p]) => h('li', {}, h('button', { class: 'name-btn', onclick: () => pick(pid) }, p.name))));
    if (!rows.length) list.append(h('li', { class: 'muted' }, t(peopleList().some(([, p]) => !p.managedBy) ? 'no_match' : 'first_one')));
  };
  // One tap: the app asks again every time it is opened, so a wrong tap is fixed with Switch.
  const pick = (pid) => setMe(pid);
  search.addEventListener('input', draw);

  // Whatever is typed in the box is the name to join with: one tap, no second form (Ahmed, 20 Nov).
  const err = h('p', { class: 'error', role: 'alert' });
  const joinBtn = h('button', { class: 'btn gold block', onclick: () => join() });
  function drawJoin() {
    const name = L.cleanName(search.value);
    joinBtn.disabled = joining || !S.store; // names show before the database is ready; joining needs it
    joinBtn.textContent = joining ? t('joining') : !S.store ? t('connecting') : name && !L.nameError(name) ? t('join_as', { name }) : `+ ${t('im_new')}`;
  }
  async function join() {
    err.textContent = '';
    const name = L.cleanName(search.value);
    const bad = L.nameError(name);
    if (!name || bad) { err.textContent = t(name ? `name_${bad}` : 'type_name_first'); search.focus(); return; }
    if (joining || !S.store) return;
    joining = true;
    fill(list);
    drawJoin();
    try {
      setMe(await S.store.createPerson(name));
    } catch (x) {
      joining = false;
      draw();
      if (x.message === 'name-taken' && x.pid && person(x.pid)) {
        if (await ask(t('name_taken', { name: nameOf(x.pid) }), t('yes_me'))) setMe(x.pid);
      } else if (x.code === 'permission-denied') err.textContent = t('name_taken', { name }); // lost a race for the same name
      else err.textContent = t('err_save');
    }
  }
  search.addEventListener('input', () => { err.textContent = ''; drawJoin(); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); join(); } });

  draw();
  return {
    el: h('div', { class: 'screen signin' }, search, list, err, joinBtn),
    update: draw,
  };
}

// ================= entering a number (Home: competition, Ammi Jaan: her goal) =================
function entryBox(S, kind) {
  const input = h('input', { class: 'field big', inputMode: 'numeric', autocomplete: 'off', enterKeyHint: 'done', placeholder: '0', 'aria-label': t('how_many') });
  const err = h('p', { class: 'error', role: 'alert' });
  const days = Array.from({ length: L.BACK_DAYS + 1 }, (_, i) => L.addDays(S.today, -i));
  const daySel = h('select', { class: 'field', 'aria-label': t('day_label') },
    days.map((d, i) => h('option', { value: d }, i === 0 ? t('today') : i === 1 ? t('yesterday') : dateText(d))));
  const managed = peopleList().filter(([, p]) => p.managedBy === S.me);
  const forSel = managed.length ? h('select', { class: 'field', 'aria-label': t('for_label') },
    h('option', { value: S.me }, `${t('me_word')} (${nameOf(S.me)})`), managed.map(([pid, p]) => h('option', { value: pid }, p.name))) : null;
  const forPid = () => forSel?.value || S.me;

  async function add(e) {
    e.preventDefault();
    err.textContent = '';
    const r = L.parseCount(input.value);
    if (r.error) { err.textContent = t(errText[r.error], { max: L.fmt(L.MAX_ENTRY) }); input.focus(); return; }
    const day = daySel.value;
    if (!L.withinWindow(day, S.today)) { err.textContent = t('err_day'); return; }
    if (kind === 'a' && L.ammiProgress(S.goal.start, S.goal.total).done) { err.textContent = t('ammi_closed'); return; }
    if (r.n > L.CONFIRM_OVER && !(await ask(t('sure_big', { n: L.fmt(r.n) }), t('yes_save'), t('no_fix')))) { input.focus(); return; }
    const pid = forPid();
    input.value = '';
    addEntry({ pid, kind, n: r.n, day, byPid: S.me },
      pid === S.me ? t('saved', { n: L.fmt(r.n) }) : t('saved_for', { n: L.fmt(r.n), name: nameOf(pid) })).catch(() => {});
  }

  return card(`entry ${kind === 'a' ? 'ammi' : ''}`,
    label(t(kind === 'a' ? 'add_ammi_title' : 'add_title')),
    h('form', { class: 'stack', onsubmit: add },
      h('div', { class: 'row gap' }, input, h('button', { class: 'btn gold', type: 'submit' }, t('add'))),
      err,
      h('div', { class: 'row gap wrap' },
        h('label', { class: 'mini' }, h('span', {}, t('day_label')), daySel),
        forSel && h('label', { class: 'mini' }, h('span', {}, t('for_label')), forSel))),
    h('button', { class: 'btn ghost block counter-btn', onclick: () => openCounter(S, kind, forPid()) }, crescent(18), ' ', t('tap_counter')));
}

function ammiBar(S) {
  const p = L.ammiProgress(S.goal.start, S.goal.total);
  return h('div', { class: 'ammi-bar' },
    h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.percent, 'aria-label': t('ammi_short') },
      h('i', { style: `inline-size:${p.percent}%` })),
    h('div', { class: 'row between small' }, h('span', {}, num(p.total), ' / ', num(L.AMMI_TARGET)), h('bdi', { class: 'num' }, `${p.percent}%`)));
}

// ================= Home =================
export function home(S) {
  const summary = h('div', { class: 'summary' });
  const todayList = h('ul', { class: 'entries' });
  let entries = [];
  const off = S.store.onDay({ pid: S.me, day: S.today }, (rows) => { entries = rows; draw(); }, () => {});

  function draw() {
    const days = myDays(S);
    const me = person(S.me);
    const board = L.rank(S.boards.w, nameOf);
    const mine = board.find((r) => r.pid === S.me);
    const todayN = days[S.today]?.b || 0;
    const st = L.streak(days, S.today);
    fill(summary, 
      h('div', { class: 'hello' }, h('p', { class: 'salaam' }, t('salaam', { name: me?.name || '' })),
        h('button', { class: 'btn ghost switch', onclick: () => setMe(null) }, t('switch_person'))),
      h('div', { class: 'tiles' },
        h('a', { class: 'tile', href: '#board' }, h('span', { class: 'k' }, t('this_week')),
          mine ? [h('strong', {}, h('bdi', { class: 'num' }, `#${mine.rank}`)), h('span', { class: 'v' }, t('of_count', { count: board.length })), h('span', { class: 'v' }, num(mine.n))]
            : h('span', { class: 'v small' }, t('not_ranked'))),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('today')), h('strong', {}, num(todayN)),
          me?.goal ? h('span', { class: 'v' }, t('goal_of', { goal: L.fmt(me.goal) })) : null,
          me?.goal ? h('div', { class: 'bar thin' }, h('i', { style: `inline-size:${Math.min(100, todayN / me.goal * 100)}%` })) : null),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('streak')), h('strong', {}, st === 1 ? t('day1') : t('days', { n: st })))),
      h('a', { class: 'card ammi mini-ammi', href: '#ammi' }, label(t('ammi_short')), ammiBar(S)));
    const mineToday = entries.filter((e) => !e.deleted && e.kind === 'b').sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
    fill(todayList, ...mineToday.map((e) => h('li', {},
      h('span', {}, num(e.n)), h('span', { class: 'muted small' }, fmtTime(e.at)),
      h('button', { class: 'link', onclick: async () => {
        if (await ask(t('delete_sure', { n: L.fmt(e.n) }), t('undo'), t('cancel'), { danger: true })) save(S.store.deleteEntry(e.id, e)).catch(() => {});
      } }, t('undo')))));
    todayList.previousElementSibling.hidden = !mineToday.length;
  }

  const el = h('div', { class: 'screen home' }, summary, entryBox(S, 'b'),
    h('h3', { class: 'label quiet' }, t('today_entries')), todayList);
  draw();
  return { el, update: draw, destroy: off };
}

// ================= Leaderboard =================
export function board(S) {
  let tab = 'w';
  const body = h('div', {});
  const seg = h('div', { class: 'seg', role: 'tablist' });
  const tabs = [['w', 'week'], ['m', 'month'], ['all', 'all_time']];

  function totals() {
    if (tab !== 'all') return S.boards[tab];
    const out = { ...S.boards.all };
    for (const [pid, p] of peopleList()) if (p.before) out[pid] = (Number(out[pid]) || 0) + p.before;
    return out;
  }
  function draw() {
    fill(seg, ...tabs.map(([k, label]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, t(label))));
    const rows = L.rank(totals(), nameOf).filter((r) => person(r.pid));
    if (!rows.length) { fill(body, h('p', { class: 'notice' }, t('empty_board'))); return; }
    const row = (r, cls = '') => h('li', { class: `${cls} ${r.pid === S.me ? 'me' : ''}` },
      h('span', { class: 'rank' }, h('bdi', {}, `#${r.rank}`)), h('span', { class: 'who' }, nameOf(r.pid), r.pid === S.me ? h('em', {}, ` · ${t('you')}`) : null), num(r.n, 'n'));
    const podium = rows.slice(0, 3);
    fill(body, 
      h('ol', { class: 'podium' }, podium.map((r, i) => h('li', { class: `p${i + 1} ${r.pid === S.me ? 'me' : ''}` },
        h('span', { class: 'medal' }, h('b', {}, h('bdi', {}, r.rank))),
        h('span', { class: 'who' }, nameOf(r.pid)), num(r.n, 'n')))),
      h('ol', { class: 'list' }, rows.slice(3).map((r) => row(r))),
      tab === 'all' ? h('p', { class: 'muted small' }, t('before_incl')) : null);
  }
  async function winners() {
    const list = h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('loading')));
    sheet(t('past_winners'), list);
    try {
      const all = await S.store.getBoards();
      const k = L.boardKeys(S.today);
      const done = Object.keys(all).filter((id) => /^[wm]_/.test(id) && id !== k.w && id !== k.m)
        .sort((a, b) => (a.slice(2) < b.slice(2) ? 1 : -1));
      const blocks = done.map((id) => {
        const top = L.rank(all[id], nameOf).filter((r) => person(r.pid)).slice(0, 3);
        if (!top.length) return null;
        const title = id[0] === 'w' ? weekLabel(id.slice(2)) : `${monthName(Number(id.slice(7)))} ${id.slice(2, 6)}`;
        return h('div', { class: 'winner' }, h('h4', {}, title),
          h('ol', {}, top.map((r) => h('li', {}, h('bdi', {}, `#${r.rank} `), nameOf(r.pid), ' ', num(r.n)))));
      }).filter(Boolean);
      fill(list, ...(blocks.length ? blocks : [h('p', { class: 'muted' }, t('no_winners'))]));
    } catch { fill(list, h('p', { class: 'error' }, t('load_error'))); }
  }
  draw();
  return { el: h('div', { class: 'screen board' }, seg, body, h('button', { class: 'btn ghost block', onclick: winners }, t('past_winners'))), update: draw };
}

// ================= month calendar (Me: own days, Ammi Jaan: family days) =================
function calendar(getValue, { onDay, startMonth }) {
  let [y, m] = startMonth.split('-').map(Number);
  const box = h('div', { class: 'cal' });
  function draw(today) {
    const grid = L.monthGrid(y, m);
    const vals = grid.flat().filter(Boolean).map((k) => getValue(k));
    const max = Math.max(1, ...vals);
    const atStart = y === FIRST_YEAR && m === 1;
    const atEnd = `${y}-${String(m).padStart(2, '0')}` >= today.slice(0, 7);
    fill(box, 
      h('div', { class: 'cal-head' },
        h('button', { class: 'icon-btn flip', disabled: atStart, 'aria-label': '‹', onclick: () => { m--; if (!m) { m = 12; y--; } draw(today); } }, '‹'),
        h('strong', {}, `${monthName(m)} `, h('bdi', {}, y)),
        h('button', { class: 'icon-btn flip', disabled: atEnd, 'aria-label': '›', onclick: () => { m++; if (m > 12) { m = 1; y++; } draw(today); } }, '›')),
      h('div', { class: 'cal-grid' },
        weekdays().map((d) => h('span', { class: 'wd' }, d)),
        grid.flat().map((k) => {
          if (!k) return h('span', { class: 'blank' });
          const v = getValue(k);
          const lvl = v ? Math.min(4, Math.ceil(v / max * 4)) : 0;
          const kids = [h('span', { class: 'd' }, h('bdi', {}, Number(k.slice(8)))), v ? (v >= 100000 ? h('bdi', { class: 'num v' }, `${(v / 100000).toFixed(1)}L`) : num(v, 'v')) : null];
          return onDay && k <= today
            ? h('button', { class: `day l${lvl} ${k === today ? 'today' : ''}`, onclick: () => onDay(k), 'aria-label': `${dateText(k)}: ${L.fmt(v)}` }, kids)
            : h('span', { class: `day l${lvl} ${k === today ? 'today' : ''} ${k > today ? 'future' : ''}` }, kids);
        })));
  }
  return { el: box, draw };
}

// ================= Ammi Jaan =================
export function ammi(S) {
  let past = {}; // earlier years' family days, read once
  const years = yearsSoFar(S).filter((y) => y < Number(S.today.slice(0, 4)));
  S.store.getAmmiYears(years).then((d) => { past = d; draw(); }).catch(() => {});
  let mineAll = {};
  S.store.getYears(S.me, yearsSoFar(S)).then((d) => { mineAll = d; draw(); }).catch(() => {});
  let feed = [];
  const off = S.store.onDay({ kind: 'a', day: S.today }, (rows) => { feed = rows; draw(); }, () => {});

  const top = h('div', {});
  const lists = h('div', {});
  const famDays = () => L.flattenAmmi({ ...past, [S.today.slice(0, 4)]: S.ammiYear });
  const cal = calendar((k) => famDays()[k] || 0, { startMonth: S.today.slice(0, 7) });
  const entry = entryBox(S, 'a');

  function draw() {
    const start = Number(S.goal.start) || 0;
    const p = L.ammiProgress(start, S.goal.total);
    const days = famDays();
    const marks = L.milestones(start, days, L.AMMI_STEP);
    const doneDay = p.done ? marks.find((x) => x.at === L.AMMI_TARGET)?.day : null;
    const wk = L.weekStart(S.today);
    const share = Object.values(L.flattenYears({ ...mineAll, ...S.years })).reduce((s, v) => s + v.a, 0);
    fill(top, card('ammi hero-card',
      h('p', { class: 'eyebrow' }, t('ammi_short')),
      h('div', { class: 'big-total' }, num(p.total)),
      ammiBar(S),
      h('div', { class: 'row between' },
        h('div', {}, h('span', { class: 'k' }, t('remaining')), h('strong', {}, num(p.remaining))),
        h('div', {}, h('span', { class: 'k' }, t('week_total')), h('strong', {}, num(L.sumDays(Object.fromEntries(Object.entries(days).map(([k, n]) => [k, { a: n }])), 'a', wk, S.today)))),
        h('div', {}, h('span', { class: 'k' }, t('month_total')), h('strong', {}, num(L.sumDays(Object.fromEntries(Object.entries(days).map(([k, n]) => [k, { a: n }])), 'a', `${S.today.slice(0, 7)}-01`, S.today))))),
      p.done ? h('p', { class: 'done-line' }, crescent(16), ' ', doneDay ? t('complete', { day: dateText(doneDay, true) }) : t('complete_short')) : null,
      start ? h('p', { class: 'muted small' }, `${t('read_by_her')}: `, num(start)) : h('p', { class: 'muted small' }, t('start_unset')),
      marks.filter((x) => x.at < L.AMMI_TARGET).reverse().map((x) => h('p', { class: 'milestone' }, crescent(12), ' ', t('reached_on', { n: L.fmt(x.at), day: dateText(x.day, true) })))));
    entry.hidden = p.done;
    const rows = feed.filter((e) => !e.deleted).sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
    fill(lists, 
      card('', label(t('feed_today')), rows.length
        ? h('ul', { class: 'feed' }, rows.map((e) => h('li', {}, h('span', { class: 'who' }, nameOf(e.pid)), num(e.n), h('span', { class: 'muted small' }, fmtTime(e.at)))))
        : h('p', { class: 'muted' }, t('feed_empty'))),
      card('', label(t('family_cal')), cal.el),
      card('', label(t('my_share')), h('strong', { class: 'share' }, num(share))));
    cal.draw(S.today);
  }
  draw();
  return { el: h('div', { class: 'screen ammi-screen' }, top, entry, lists), update: draw, destroy: off };
}

// ================= Me =================
export function me(S) {
  let all = {}; // every year of my days, read once; this year and last stay live in S.years
  S.store.getYears(S.me, yearsSoFar(S)).then((d) => { all = d; draw(); }).catch(() => {});
  const days = () => L.flattenYears({ ...all, ...S.years });
  const stats = h('div', {});
  const cal = calendar((k) => days()[k]?.b || 0, { startMonth: S.today.slice(0, 7), onDay: (k) => dayDetail(S, k) });

  // settings inputs are built once
  const p0 = person(S.me) || {};
  const goalIn = h('input', { class: 'field', inputMode: 'numeric', value: p0.goal ? String(p0.goal) : '', placeholder: t('goal_none'), 'aria-label': t('daily_goal') });
  const saveNum = (input, field, max) => () => {
    const r = L.parseCount(input.value, { max, zero: true });
    const val = input.value.trim() === '' ? 0 : r.n;
    const was = person(S.me)?.[field] || 0;
    if (val == null) { toast(t(r.error === 'max' ? 'err_max' : 'err_invalid', { max: L.fmt(max) }), 'bad'); input.value = was ? String(was) : ''; return; }
    if (val === was) return;
    save(S.store.updatePerson(S.me, { [field]: val }), t('saved', { n: L.fmt(val) })).catch(() => {});
  };
  goalIn.addEventListener('change', saveNum(goalIn, 'goal', L.MAX_ENTRY));
  const daroodSel = h('select', { class: 'field', 'aria-label': t('darood_choice'), onchange: () => save(S.store.updatePerson(S.me, { darood: Number(daroodSel.value) })).catch(() => {}) },
    DAROODS.map((d, i) => h('option', { value: i, selected: (p0.darood || 0) === i }, d.name)));
  const sizes = h('div', { class: 'seg' });
  const drawSizes = () => fill(sizes, ...[1, 2, 3].map((n) => h('button', {
    class: Number(document.documentElement.dataset.size) === n ? 'on' : '', 'aria-pressed': String(Number(document.documentElement.dataset.size) === n),
    onclick: () => { applySize(n); drawSizes(); } }, 'A', '+'.repeat(n - 1))));
  drawSizes();

  function draw() {
    const d = days();
    const me = person(S.me);
    if (!me) return;
    const b = L.bests(d, 'b');
    const total = Object.values(d).reduce((s, v) => s + v.b, 0);
    const wk = L.weekStart(S.today);
    const marks = L.milestones(me.before || 0, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.b])), L.ME_STEP);
    fill(stats, 
      h('div', { class: 'me-head' }, h('h1', {}, me.name),
        h('button', { class: 'btn ghost switch', onclick: () => setMe(null) }, t('switch_person'))),
      h('div', { class: 'tiles' },
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('all_time_total')), h('strong', {}, num(total + (me.before || 0))),
          me.before ? h('span', { class: 'v' }, t('incl_before', { n: L.fmt(me.before) })) : null),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('this_week')), h('strong', {}, num(L.sumDays(d, 'b', wk, S.today)))),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('streak')), h('strong', {}, (() => { const s = L.streak(d, S.today); return s === 1 ? t('day1') : t('days', { n: s }); })())),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('best_day')), b.day ? [h('strong', {}, num(b.day.n)), h('span', { class: 'v' }, dateText(b.day.day, true))] : h('strong', {}, '·')),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('best_week')), b.week ? [h('strong', {}, num(b.week.n)), h('span', { class: 'v' }, weekLabel(b.week.week))] : h('strong', {}, '·')),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, t('daily_goal')), me.goal ? [h('strong', {}, num(d[S.today]?.b || 0)), h('span', { class: 'v' }, t('goal_of', { goal: L.fmt(me.goal) }))] : h('span', { class: 'v' }, t('goal_none')))),
      marks.length ? card('', label(t('milestones')), marks.slice().reverse().map((x) => h('p', { class: 'milestone' }, crescent(12), ' ', t('passed_on', { n: L.fmt(x.at), day: dateText(x.day, true) })))) : null);
    cal.draw(S.today);
  }

  const el = h('div', { class: 'screen me' }, stats, card('', cal.el),
    card('settings', label(t('settings')),
      h('label', { class: 'set' }, h('span', {}, t('daily_goal')), goalIn),
      h('label', { class: 'set' }, h('span', {}, t('darood_choice')), daroodSel),
      h('div', { class: 'set' }, h('span', {}, t('text_size')), sizes),
      h('details', { class: 'set' }, h('summary', {}, t('install')), h('p', {}, t('install_ios')), h('p', {}, t('install_android'))),
      S.isAdmin ? h('a', { class: 'btn ghost block', href: '#admin' }, t('admin')) : null,
      h('p', { class: 'muted small center' }, t('version', { v: S.version }))));
  draw();
  return { el, update: draw };
}

// A day of my own entries: change or delete inside the 7-day window.
function dayDetail(S, day) {
  const list = h('ul', { class: 'entries' });
  const open = L.withinWindow(day, S.today);
  const s = sheet(dateText(day, true), h('div', { class: 'stack' }, open ? null : h('p', { class: 'muted' }, t('locked_old')), list),
    { onclose: () => off() });
  const off = S.store.onDay({ pid: S.me, day }, (rows) => {
    rows.sort((a, b) => (a.at?.seconds || 0) - (b.at?.seconds || 0));
    fill(list, ...rows.map((e) => h('li', { class: e.deleted ? 'gone' : '' },
      h('span', { class: `tag ${e.kind}` }, e.kind === 'a' ? t('tab_ammi') : t('tab_board')), num(e.n), h('span', { class: 'muted small' }, fmtTime(e.at)),
      e.deleted ? h('em', { class: 'small' }, t('deleted_word')) : e.prevN ? h('em', { class: 'small' }, t('edited_word')) : null,
      open && !e.deleted ? h('span', { class: 'row gap' },
        h('button', { class: 'link', onclick: () => editEntry(S, e) }, t('edit')),
        h('button', { class: 'link danger', onclick: async () => {
          if (await ask(t('delete_sure', { n: L.fmt(e.n) }), t('delete'), t('cancel'), { danger: true })) save(S.store.deleteEntry(e.id, e)).catch(() => {});
        } }, t('delete'))) : null)));
    if (!rows.length) list.append(h('li', { class: 'muted' }, '·'));
  }, () => {});
  return s;
}

export function editEntry(S, e) {
  const input = h('input', { class: 'field big', inputMode: 'numeric', value: String(e.n), 'aria-label': t('how_many') });
  const err = h('p', { class: 'error', role: 'alert' });
  const s = sheet(t('edit_title'), h('form', { class: 'stack', onsubmit: async (ev) => {
    ev.preventDefault();
    const r = L.parseCount(input.value);
    if (r.error) { err.textContent = t(errText[r.error], { max: L.fmt(L.MAX_ENTRY) }); return; }
    if (r.n > L.CONFIRM_OVER && r.n !== e.n && !(await ask(t('sure_big', { n: L.fmt(r.n) }), t('yes_save'), t('no_fix')))) return;
    s.close();
    save(S.store.editEntry(e.id, e, r.n), t('saved', { n: L.fmt(r.n) })).catch(() => {});
  } }, input, err, h('button', { class: 'btn gold block', type: 'submit' }, t('save_changes'))));
}

