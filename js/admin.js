// Admin (#admin), Ahmed only. English only: it is his screen.
import * as L from './logic.js';
import { h, fill, num, toast, sheet, ask } from './ui.js';
import { peopleList, person, nameOf, save } from './app.js';
import { editEntry } from './screens.js';
import { dateText } from './strings.js';

const when = (ts) => { const d = ts?.toDate?.(); return d ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '…'; };

export function mountAdmin(S) {
  const el = h('div', { class: 'screen admin', lang: 'en', dir: 'ltr' });
  if (!S.isAdmin) { el.append(login(S)); return { el }; }

  const startIn = h('input', { class: 'field', inputMode: 'numeric', value: S.goal.start ? String(S.goal.start) : '', placeholder: "Ammi Jaan's own count" });
  const peopleBox = h('div', {});
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
        e.deleted ? h('em', { class: 'small' }, ` deleted by phone …${String(e.delBy || '').slice(-4)}`) : null),
      h('div', { class: 'muted small' }, `for ${dateText(e.day, true)} · typed ${when(e.at)} · phone …${String(e.by).slice(-4)}`,
        e.byPid && e.byPid !== e.pid ? ` · by ${nameOf(e.byPid)}` : ''),
      h('div', { class: 'row gap' },
        e.deleted
          ? h('button', { class: 'link', onclick: () => save(S.store.restoreEntry(e.id, e), 'Restored').then(() => loadLog()).catch(() => {}) }, 'Restore')
          : [h('button', { class: 'link', onclick: () => editEntry(S, e) }, 'Edit'),
            h('button', { class: 'link danger', onclick: async () => { if (await ask(`Delete ${L.fmt(e.n)} by ${nameOf(e.pid)}?`, 'Delete', 'Cancel', { danger: true })) save(S.store.deleteEntry(e.id, e), 'Deleted').then(() => loadLog()).catch(() => {}); } }, 'Delete')]));
    return li;
  }
  const moreBtn = h('button', { class: 'btn ghost block', onclick: () => loadLog(true) }, 'Older entries');

  function drawPeople() {
    const rows = peopleList().sort((a, b) => a[1].name.localeCompare(b[1].name));
    fill(peopleBox, h('p', { class: 'muted small' }, `${rows.length} people`),
      h('ul', { class: 'log' }, rows.map(([pid, p]) => h('li', {},
        h('div', {}, h('strong', {}, p.name), p.managedBy ? h('span', { class: 'muted small' }, ` · managed by ${nameOf(p.managedBy)}`) : null,
          p.before ? h('span', { class: 'muted small' }, ` · before app ${L.fmt(p.before)}`) : null),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'link', onclick: () => rename(pid, p) }, 'Rename'),
          p.managedBy ? h('button', { class: 'link', onclick: async () => { if (await ask(`Make ${p.name} a normal name anyone can tap?`, 'Convert')) save(S.store.updatePerson(pid, { managedBy: undefined }), 'Converted').catch(() => {}); } }, 'Convert to own account') : null,
          h('button', { class: 'link', onclick: () => merge(pid, p) }, 'Merge into…'),
          h('button', { class: 'link danger', onclick: async () => {
            if (await ask(`Remove ${p.name}? Their entries are hidden (restorable from the log) and totals are rebuilt.`, 'Remove', 'Cancel', { danger: true })) {
              save(S.store.removePerson(pid, S.people), `Removed ${p.name}`).then(() => loadLog()).catch(() => {});
            }
          } }, 'Remove'))))));
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
    const mgr = h('select', { class: 'field' }, peopleList().filter(([, p]) => !p.managedBy).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([q, r]) => h('option', { value: q }, r.name)));
    const err = h('p', { class: 'error' });
    const s = sheet('New managed profile', h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const bad = L.nameError(input.value);
      if (bad) { err.textContent = `Name ${bad}`; return; }
      try { await S.store.createPerson(input.value, { managedBy: mgr.value }); s.close(); toast('Profile added', 'ok'); } catch (x) { err.textContent = x.message === 'name-taken' ? 'That name is taken' : 'Failed'; }
    } }, h('p', { class: 'muted' }, 'For kids and elders without a phone. The manager enters their counts.'), input, h('label', { class: 'mini' }, h('span', {}, 'Managed by'), mgr), err, h('button', { class: 'btn gold block' }, 'Add')));
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
    h('section', { class: 'card' }, h('h3', { class: 'label' }, "Ammi Jaan's starting number"),
      h('p', { class: 'muted small' }, 'Her own count before she passed away (from Chachu Hamid).'),
      h('form', { class: 'row gap', onsubmit: async (e) => {
        e.preventDefault();
        const r = L.parseCount(startIn.value, { max: L.AMMI_TARGET, zero: true });
        if (r.n == null) { toast('Whole number up to 1,00,00,000', 'bad'); return; }
        if (await ask(`Set her starting number to ${L.fmt(r.n)}?`, 'Set')) save(S.store.setAmmiStart(r.n), 'Saved').catch(() => {});
      } }, startIn, h('button', { class: 'btn gold' }, 'Set'))),
    h('section', { class: 'card' }, h('h3', { class: 'label' }, 'People'),
      h('button', { class: 'btn ghost block', onclick: addManaged }, '+ Managed profile (kid / elder)'), peopleBox),
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
