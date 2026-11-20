// Admin (#admin), Ahmed only. English only: it is his screen.
import * as L from './logic.js';
import { h, fill, num, toast, sheet, ask } from './ui.js';
import { peopleList, person, nameOf, save } from './app.js';
import { editEntry } from './screens.js';
import { dateText } from './strings.js';

const BEFORE_MAX = 100000000; // 10 Crore, the rules' limit for one person's earlier total
const byName = (a, b) => a[1].name.localeCompare(b[1].name);
// A number box that checks itself: returns the number, or null after saying what is wrong.
function readNum(input, max, what) {
  const r = L.parseCount(input.value.trim() === '' ? '0' : input.value, { max, zero: true });
  if (r.n == null) { toast(`${what}: a whole number up to ${L.fmt(max)}`, 'bad'); input.focus(); return null; }
  return r.n;
}
const numIn = (value, placeholder) => h('input', { class: 'field', inputMode: 'numeric', autocomplete: 'off', value: value ? String(value) : '', placeholder });

const when = (ts) => { const d = ts?.toDate?.(); return d ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '…'; };

export function mountAdmin(S) {
  const el = h('div', { class: 'screen admin', lang: 'en', dir: 'ltr' });
  if (!S.isAdmin) { el.append(login(S)); return { el }; }

  const startIn = numIn(S.goal.start, 'e.g. 3242000');
  const ammiNow = h('div', { class: 'stack' });
  function drawAmmi() {
    const start = Number(S.goal.start) || 0; const fam = Number(S.goal.total) || 0;
    if (document.activeElement !== startIn && !startIn.value && start) startIn.value = String(start);
    fill(ammiNow, h('dl', { class: 'figures' },
      h('dt', {}, 'Read by Ammi Jaan herself'), h('dd', {}, num(start)),
      h('dt', {}, 'Added by the family in the app'), h('dd', {}, num(fam)),
      h('dt', {}, 'Total shown to everyone'), h('dd', {}, h('strong', {}, num(start + fam)), ' of ', num(L.AMMI_TARGET))));
  }
  const peopleBox = h('div', {});
  const peopleFind = h('input', { class: 'field', type: 'search', placeholder: 'Find a name', autocomplete: 'off', oninput: () => drawPeople() });
  const logBox = h('ul', { class: 'log' });
  let cursor = null;

  async function loadLog(more) {
    try {
      const { rows, last } = await S.store.getLog(more ? cursor : null);
      cursor = last;
      if (!more) fill(logBox, );
      logBox.append(...rows.map(logRow));
      moreBtn.hidden = rows.length < 50;
    } catch (e) { console.error(e); toast('Could not load the log', 'bad'); }
  }
  function logRow(e) {
    const li = h('li', { class: e.deleted ? 'gone' : '' },
      h('div', {}, h('strong', {}, nameOf(e.pid)), ' ', h('span', { class: `tag ${e.kind}` }, e.kind === 'a' ? 'Ammi Jaan' : 'Board'), ' ', num(e.n),
        e.prevN ? h('em', { class: 'small' }, ` (was ${L.fmt(e.prevN)})`) : null,
        e.movedTo ? h('em', { class: 'small' }, ' moved') : e.deleted ? h('em', { class: 'small' }, ` deleted by phone …${String(e.delBy || '').slice(-4)}`) : null,
        e.movedFrom ? h('em', { class: 'small' }, ' (moved here)') : null),
      h('div', { class: 'muted small' }, `for ${dateText(e.day, true)} · typed ${when(e.at)} · phone …${String(e.by).slice(-4)}`,
        e.byPid && e.byPid !== e.pid ? ` · by ${nameOf(e.byPid)}` : ''),
      h('div', { class: 'row gap' },
        e.movedTo ? null : e.deleted
          ? h('button', { class: 'link', onclick: () => save(S.store.restoreEntry(e.id, e), 'Restored').then(() => loadLog()).catch(() => {}) }, 'Restore')
          : [h('button', { class: 'link', onclick: () => editEntry(S, e) }, 'Edit'),
            h('button', { class: 'link', onclick: () => moveTo(e) }, 'Move to…'),
            h('button', { class: 'link danger', onclick: async () => { if (await ask(`Delete ${L.fmt(e.n)} by ${nameOf(e.pid)}?`, 'Delete', 'Cancel', { danger: true })) save(S.store.deleteEntry(e.id, e), 'Deleted').then(() => loadLog()).catch(() => {}); } }, 'Delete')]));
    return li;
  }
  // Typed under the wrong name (a parent's own account): give it to the person who read it.
  function moveTo(e) {
    const sel = h('select', { class: 'field' }, peopleList().filter(([q]) => q !== e.pid).sort(byName).map(([q, r]) => h('option', { value: q }, r.name)));
    const s = sheet(`Move ${L.fmt(e.n)} (${dateText(e.day, true)})`, h('form', { class: 'stack', onsubmit: (ev) => {
      ev.preventDefault();
      s.close();
      save(S.store.moveEntry(e.id, e, sel.value), `Moved to ${nameOf(sel.value)}`).then(() => loadLog()).catch(() => {});
    } }, h('p', { class: 'muted' }, `From ${nameOf(e.pid)} to:`), sel, h('button', { class: 'btn gold block' }, 'Move')));
  }
  const moreBtn = h('button', { class: 'btn ghost block', onclick: () => loadLog(true) }, 'Older entries');

  function drawPeople() {
    drawAmmi();
    const all = peopleList().sort(byName);
    const q = L.nameKey(peopleFind.value);
    const rows = all.filter(([, p]) => !q || p.key.includes(q));
    fill(peopleBox, h('p', { class: 'muted small' }, `${all.length} people`),
      h('ul', { class: 'log' }, rows.map(([pid, p]) => h('li', {},
        h('div', {}, h('strong', {}, p.name), p.managedBy ? h('span', { class: 'muted small' }, ` · managed by ${nameOf(p.managedBy)}`) : null),
        h('div', { class: 'muted small' }, 'Before the app ', num(p.before || 0), ' · in the app ', num(S.boards.all[pid] || 0),
          ' · all time ', h('strong', {}, num((p.before || 0) + (Number(S.boards.all[pid]) || 0)))),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'link', onclick: () => setBefore(pid, p) }, 'Before the app'),
          h('button', { class: 'link', onclick: () => rename(pid, p) }, 'Rename'),
          p.managedBy ? h('button', { class: 'link', onclick: async () => { if (await ask(`Make ${p.name} a normal name anyone can tap?`, 'Convert')) save(S.store.updatePerson(pid, { managedBy: undefined }), 'Converted').catch(() => {}); } }, 'Convert to own account') : null,
          h('button', { class: 'link', onclick: () => merge(pid, p) }, 'Merge into…'),
          h('button', { class: 'link danger', onclick: async () => {
            if (await ask(`Remove ${p.name}? Their entries are hidden (restorable from the log) and totals are rebuilt.`, 'Remove', 'Cancel', { danger: true })) {
              save(S.store.removePerson(pid, S.people), `Removed ${p.name}`).then(() => loadLog()).catch(() => {});
            }
          } }, 'Remove'))))));
  }
  // Their total from the family's own records, from before the app. Counts in All time.
  function setBefore(pid, p) {
    const input = numIn(p.before, '0');
    const s = sheet(`${p.name}: read before the app`, h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      const n = readNum(input, BEFORE_MAX, 'Before the app');
      if (n == null) return;
      s.close();
      if (n !== (p.before || 0)) save(S.store.updatePerson(pid, { before: n }), `${p.name}: ${L.fmt(n)} before the app`).catch(() => {});
    } }, h('p', { class: 'muted' }, 'From the family\'s records. It is added to their All time total; it does not change any week or month.'), input,
      h('button', { class: 'btn gold block' }, 'Save')));
  }
  function addMember() {
    const input = h('input', { class: 'field', placeholder: 'Full name' });
    const before = numIn(0, 'Read before the app (optional)');
    const err = h('p', { class: 'error' });
    const s = sheet('New member', h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const bad = L.nameError(input.value);
      if (bad) { err.textContent = `Name ${bad}`; return; }
      const n = readNum(before, BEFORE_MAX, 'Before the app');
      if (n == null) return;
      try { await S.store.createPerson(input.value, { before: n }); s.close(); toast(`Added ${L.cleanName(input.value)}`, 'ok'); } catch (x) { err.textContent = x.message === 'name-taken' ? 'That name is taken' : 'Failed'; }
    } }, h('p', { class: 'muted' }, 'They will find their name in the list and tap it.'), input, h('label', { class: 'mini' }, h('span', {}, 'Read before the app'), before), err, h('button', { class: 'btn gold block' }, 'Add')));
  }
  function rename(pid, p) {
    const input = h('input', { class: 'field', value: p.name });
    const err = h('p', { class: 'error' });
    const s = sheet(`Rename ${p.name}`, h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const bad = L.nameError(input.value);
      if (bad) { err.textContent = `Name ${bad}`; return; }
      try { await S.store.renamePerson(pid, p.key, input.value); s.close(); toast('Renamed', 'ok'); } catch (x) { err.textContent = x.message === 'name-taken' ? 'That name is taken' : 'Failed'; }
    } }, input, err, h('button', { class: 'btn gold block' }, 'Save')));
  }
  function merge(pid, p) {
    const sel = h('select', { class: 'field' }, peopleList().filter(([q]) => q !== pid).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([q, r]) => h('option', { value: q }, r.name)));
    const s = sheet(`Merge ${p.name} into…`, h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const to = sel.value;
      if (!(await ask(`Move all of ${p.name}'s entries to ${nameOf(to)} and delete ${p.name}?`, 'Merge', 'Cancel', { danger: true }))) return;
      s.close();
      save(S.store.mergePeople(pid, to, S.people), 'Merged').then(() => loadLog()).catch(() => {});
    } }, h('p', { class: 'muted' }, 'For duplicate accounts of the same person. Totals are rebuilt after.'), sel, h('button', { class: 'btn gold block' }, 'Merge')));
  }
  function addManaged() {
    const input = h('input', { class: 'field', placeholder: 'Full name, e.g. Nana Abbu' });
    const mgr = h('select', { class: 'field' }, peopleList().filter(([, p]) => !p.managedBy).sort(byName).map(([q, r]) => h('option', { value: q }, r.name)));
    const before = numIn(0, 'Read before the app (optional)');
    const err = h('p', { class: 'error' });
    const s = sheet('New managed profile', h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const bad = L.nameError(input.value);
      if (bad) { err.textContent = `Name ${bad}`; return; }
      const n = readNum(before, BEFORE_MAX, 'Before the app');
      if (n == null) return;
      try { await S.store.createPerson(input.value, { managedBy: mgr.value, before: n }); s.close(); toast('Profile added', 'ok'); } catch (x) { err.textContent = x.message === 'name-taken' ? 'That name is taken' : 'Failed'; }
    } }, h('p', { class: 'muted' }, 'For kids and elders without a phone. The manager enters their counts.'), input, h('label', { class: 'mini' }, h('span', {}, 'Managed by'), mgr),
      h('label', { class: 'mini' }, h('span', {}, 'Read before the app'), before), err, h('button', { class: 'btn gold block' }, 'Add')));
  }

  async function csv() {
    toast('Preparing…');
    try {
      const rows = (await S.store.allEntries()).sort((a, b) => (a.at?.seconds || 0) - (b.at?.seconds || 0));
      // A cell starting with = + - @ would run as a formula in Excel: prefix it.
      const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
      const lines = [['typed_at', 'day', 'name', 'part', 'count', 'deleted', 'was', 'phone', 'entered_by'].join(',')];
      for (const e of rows) {
        lines.push([e.at?.toDate?.().toISOString() || '', e.day, nameOf(e.pid), e.kind === 'a' ? 'Ammi Jaan' : 'Board', e.n,
          e.deleted ? 'yes' : '', e.prevN || '', String(e.by).slice(-6), e.byPid ? nameOf(e.byPid) : ''].map(cell).join(','));
      }
      const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })), download: `darood-e-pak-${S.today}.csv` });
      document.body.append(a); a.click(); a.remove();
    } catch (e) { console.error(e); toast('Export failed', 'bad'); }
  }

  el.append(
    h('h1', {}, 'Admin'),
    h('section', { class: 'card ammi' }, h('h3', { class: 'label' }, "Ammi Jaan's Darood"),
      ammiNow,
      h('p', { class: 'muted small' }, 'Her own count, read by her before she passed away. Change it here any time; the family\'s entries are kept separately and are not touched. To fix one family entry, use Edit in the activity log below.'),
      h('form', { class: 'row gap', onsubmit: async (e) => {
        e.preventDefault();
        const n = readNum(startIn, L.AMMI_TARGET, 'Her count');
        if (n == null) return;
        if (await ask(`Set Ammi Jaan's own count to ${L.fmt(n)}?`, 'Set')) save(S.store.setAmmiStart(n), 'Saved').catch(() => {});
      } }, startIn, h('button', { class: 'btn gold' }, 'Set'))),
    h('section', { class: 'card' }, h('h3', { class: 'label' }, 'People'),
      h('p', { class: 'muted small' }, '"Before the app" is each person\'s total from the family\'s records. The app carries on from it.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn gold', onclick: addMember }, '+ Member'),
        h('button', { class: 'btn ghost', onclick: addManaged }, '+ Kid / elder without a phone')),
      peopleFind, peopleBox),
    h('section', { class: 'card' }, h('h3', { class: 'label' }, 'Activity log'),
      h('button', { class: 'btn ghost', onclick: () => loadLog() }, 'Refresh'), logBox, moreBtn),
    h('section', { class: 'card' }, h('h3', { class: 'label' }, 'Tools'),
      h('button', { class: 'btn ghost block', onclick: csv }, 'Download everything (CSV)'),
      h('button', { class: 'btn ghost block', onclick: async () => {
        if (await ask('Recount every total from the entries? Best when nobody is saving right now.', 'Rebuild')) {
          save(S.store.rebuildTotals().then((r) => toast(`Rebuilt from ${r.entries} entries`, 'ok'))).catch(() => {});
        }
      } }, 'Rebuild totals'),
      h('button', { class: 'btn danger block', onclick: () => S.fb.a.signOut(S.fb.auth) }, 'Sign out of admin')));
  drawPeople();
  loadLog();
  return { el, update: drawPeople };
}

function login(S) {
  const email = h('input', { class: 'field', type: 'email', autocomplete: 'username', placeholder: 'Email' });
  const pw = h('input', { class: 'field', type: 'password', autocomplete: 'current-password', placeholder: 'Password' });
  const err = h('p', { class: 'error', role: 'alert' });
  const signedIn = S.fb?.auth?.currentUser;
  return h('section', { class: 'card' }, h('h1', {}, 'Admin'),
    signedIn && !signedIn.isAnonymous ? h('p', { class: 'error' }, 'This account is not the admin.') : null,
    h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await S.fb.a.signInWithEmailAndPassword(S.fb.auth, email.value.trim(), pw.value); }
      catch (x) { err.textContent = x.code === 'auth/too-many-requests' ? 'Too many tries. Wait a few minutes.' : 'Wrong email or password.'; }
    } }, email, pw, err, h('button', { class: 'btn gold block' }, 'Sign in')),
    h('a', { class: 'btn ghost block', href: '#home' }, 'Back to the app'));
}
