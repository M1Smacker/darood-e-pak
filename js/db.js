// Every read and write of the app. Firebase modules are passed in (gstatic in the browser,
// npm in the node tests) so the tests run this exact code against the emulator.
//
// Shape (see firestore.rules):
//   meta/people            { [pid]: { name, key, managedBy?, before?, goal?, darood? } }
//   names/{key}            { pid }   unique-name lock
//   entries/{id}           { pid, kind 'b'|'a', n, day, at, by, byPid?, deleted?, ... }
//   years/{pid}_{yyyy}     { MMDD: { b, a } }
//   boards/w_2026-47, m_2026-11, all   { [pid]: n }
//   ammi/goal              { start, total }
//   ammiDays/{yyyy}        { MMDD: n }

import { boardKeys, nameKey, cleanName, MAX_ENTRY, AMMI_TARGET } from './logic.js';

const md = (day) => day.slice(5, 7) + day.slice(8, 10);

export function makeStore({ f, db, uid }) {
  const ref = (...p) => f.doc(db, ...p);
  const inc = (n) => f.increment(n);

  // The counter docs one entry touches, each moved by `delta`.
  // Each carries e: <entry id> so the rules can check it moved by exactly that entry.
  function counters(batch, id, e, delta) {
    const y = e.day.slice(0, 4);
    const put = (r, v) => batch.set(r, { ...v, e: id }, { merge: true });
    put(ref('years', `${e.pid}_${y}`), { [md(e.day)]: { [e.kind]: inc(delta) } });
    if (e.kind === 'b') {
      const k = boardKeys(e.day);
      for (const b of [k.w, k.m, 'all']) put(ref('boards', b), { [e.pid]: inc(delta) });
    } else {
      put(ref('ammi', 'goal'), { total: inc(delta) });
      put(ref('ammiDays', y), { [md(e.day)]: inc(delta) });
    }
  }

  const checkN = (n) => {
    if (!Number.isInteger(n) || n < 1 || n > MAX_ENTRY) throw new Error('bad-count');
  };

  return {
    uid,

    // Returns the commit promise. Offline it stays pending until the phone is back online;
    // the screens already show the change from the local cache.
    addEntry({ pid, kind, n, day, byPid }) {
      checkN(n);
      const batch = f.writeBatch(db);
      const e = { pid, kind, n, day };
      const data = { ...e, at: f.serverTimestamp(), by: uid };
      if (byPid && byPid !== pid) data.byPid = byPid;
      const r = f.doc(f.collection(db, 'entries'));
      batch.set(r, data);
      counters(batch, r.id, e, n);
      return batch.commit();
    },

    editEntry(id, e, n) {
      checkN(n);
      if (n === e.n) return Promise.resolve();
      const batch = f.writeBatch(db);
      batch.update(ref('entries', id), { n, prevN: e.n, editedBy: uid, editedAt: f.serverTimestamp() });
      counters(batch, id, e, n - e.n);
      return batch.commit();
    },

    deleteEntry(id, e) {
      const batch = f.writeBatch(db);
      batch.update(ref('entries', id), { deleted: true, delBy: uid, delAt: f.serverTimestamp() });
      counters(batch, id, e, -e.n);
      return batch.commit();
    },

    // Admin only (rules).
    restoreEntry(id, e) {
      const batch = f.writeBatch(db);
      batch.update(ref('entries', id), { deleted: false });
      counters(batch, id, e, e.n);
      return batch.commit();
    },

    // New family member. Fails (permission denied) if the name is taken: the names/ lock exists.
    async createPerson(name, { managedBy = null } = {}) {
      const clean = cleanName(name);
      const key = nameKey(clean);
      const taken = await f.getDoc(ref('names', key)).catch(() => null);
      if (taken?.exists()) { const err = new Error('name-taken'); err.pid = taken.data().pid; throw err; }
      const pid = f.doc(f.collection(db, 'entries')).id;
      const person = { name: clean, key };
      if (managedBy) person.managedBy = managedBy;
      const batch = f.writeBatch(db);
      batch.set(ref('names', key), { pid });
      batch.set(ref('meta', 'people'), { [pid]: person, _p: pid }, { merge: true });
      await batch.commit();
      return pid;
    },

    // Own settings: { before, goal, darood }. Admin may also pass name / managedBy.
    updatePerson(pid, changes) {
      const upd = { _p: pid }; // names the one person this write is about (rules)
      for (const [k, v] of Object.entries(changes)) upd[`${pid}.${k}`] = v === undefined ? f.deleteField() : v;
      return f.updateDoc(ref('meta', 'people'), upd);
    },

    async renamePerson(pid, oldKey, name) {
      const clean = cleanName(name);
      const key = nameKey(clean);
      const batch = f.writeBatch(db);
      if (key !== oldKey) {
        const taken = await f.getDoc(ref('names', key));
        if (taken.exists()) throw new Error('name-taken');
        batch.delete(ref('names', oldKey));
        batch.set(ref('names', key), { pid });
      }
      batch.update(ref('meta', 'people'), { [`${pid}.name`]: clean, [`${pid}.key`]: key });
      return batch.commit();
    },

    setAmmiStart(start) {
      if (!Number.isInteger(start) || start < 0 || start > AMMI_TARGET) throw new Error('bad-count');
      return f.setDoc(ref('ammi', 'goal'), { start }, { merge: true });
    },

    // ----- reading -----
    onPeople: (cb, err) => f.onSnapshot(ref('meta', 'people'), { includeMetadataChanges: true }, (s) => cb(s.data() || {}, s.metadata), err),
    onBoard: (board, cb, err) => f.onSnapshot(ref('boards', board), (s) => cb(s.data() || {}), err),
    onYear: (pid, year, cb, err) => f.onSnapshot(ref('years', `${pid}_${year}`), (s) => cb(s.data() || {}), err),
    onGoal: (cb, err) => f.onSnapshot(ref('ammi', 'goal'), (s) => cb(s.data() || {}), err),
    onAmmiYear: (year, cb, err) => f.onSnapshot(ref('ammiDays', String(year)), (s) => cb(s.data() || {}), err),
    onDay: (filters, cb, err) => f.onSnapshot(
      f.query(f.collection(db, 'entries'), ...Object.entries(filters).map(([k, v]) => f.where(k, '==', v))),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), err),

    async getYears(pid, years) {
      const out = {};
      await Promise.all(years.map(async (y) => { out[y] = (await f.getDoc(ref('years', `${pid}_${y}`))).data() || {}; }));
      return out;
    },
    async getAmmiYears(years) {
      const out = {};
      await Promise.all(years.map(async (y) => { out[y] = (await f.getDoc(ref('ammiDays', String(y)))).data() || {}; }));
      return out;
    },
    async getBoards() {
      const s = await f.getDocs(f.collection(db, 'boards'));
      return Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
    },

    // Admin activity log, newest first, 50 at a time.
    async getLog(after) {
      const q = [f.collection(db, 'entries'), f.orderBy('at', 'desc'), f.limit(50)];
      if (after) q.splice(2, 0, f.startAfter(after));
      const s = await f.getDocs(f.query(...q));
      return { rows: s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })), last: s.docs.at(-1) };
    },
    async allEntries() {
      const s = await f.getDocs(f.collection(db, 'entries'));
      return s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    },

    // Admin repair: recompute every running total from the entries themselves.
    // ponytail: entries saved while this runs can be missed; run it when the family is quiet, or twice.
    async rebuildTotals() {
      const entries = (await this.allEntries()).filter((e) => !e.deleted);
      const want = { years: {}, boards: {}, ammiDays: {} };
      let ammi = 0;
      const add = (col, id, key, n, sub) => {
        const d = (want[col][id] ||= {});
        if (sub) { d[key] ||= {}; d[key][sub] = (d[key][sub] || 0) + n; } else d[key] = (d[key] || 0) + n;
      };
      for (const e of entries) {
        const y = e.day.slice(0, 4);
        add('years', `${e.pid}_${y}`, md(e.day), e.n, e.kind);
        if (e.kind === 'b') {
          const k = boardKeys(e.day);
          for (const b of [k.w, k.m, 'all']) add('boards', b, e.pid, e.n);
        } else { ammi += e.n; add('ammiDays', y, md(e.day), e.n); }
      }
      const writes = [];
      for (const col of ['years', 'boards', 'ammiDays']) {
        const have = await f.getDocs(f.collection(db, col));
        const ids = new Set([...have.docs.map((d) => d.id), ...Object.keys(want[col])]);
        for (const id of ids) writes.push((b) => b.set(ref(col, id), want[col][id] || {}));
      }
      writes.push((b) => b.set(ref('ammi', 'goal'), { total: ammi }, { merge: true }));
      for (let i = 0; i < writes.length; i += 400) {
        const b = f.writeBatch(db);
        writes.slice(i, i + 400).forEach((w) => w(b));
        await b.commit();
      }
      return { entries: entries.length, docs: writes.length };
    },

    // Admin: fold one person into another (duplicate accounts). Totals are rebuilt after.
    async mergePeople(fromPid, toPid, people) {
      const from = people[fromPid]; const to = people[toPid];
      if (!from || !to || fromPid === toPid) throw new Error('bad-merge');
      const s = await f.getDocs(f.query(f.collection(db, 'entries'), f.where('pid', '==', fromPid)));
      for (let i = 0; i < s.docs.length; i += 400) {
        const b = f.writeBatch(db);
        s.docs.slice(i, i + 400).forEach((d) => b.update(d.ref, { pid: toPid }));
        await b.commit();
      }
      const managed = Object.entries(people).filter(([, p]) => p.managedBy === fromPid);
      const b = f.writeBatch(db);
      const upd = { [fromPid]: f.deleteField(), [`${toPid}.before`]: (to.before || 0) + (from.before || 0) };
      for (const [pid] of managed) upd[`${pid}.managedBy`] = toPid;
      b.update(ref('meta', 'people'), upd);
      b.delete(ref('names', from.key));
      await b.commit();
      return this.rebuildTotals();
    },

    // Admin: remove someone entirely (entries hidden, not destroyed, so a mistake can be undone by restore).
    async removePerson(pid, people) {
      const p = people[pid];
      const s = await f.getDocs(f.query(f.collection(db, 'entries'), f.where('pid', '==', pid)));
      for (let i = 0; i < s.docs.length; i += 400) {
        const b = f.writeBatch(db);
        s.docs.slice(i, i + 400).forEach((d) => b.update(d.ref, { deleted: true, delBy: uid, delAt: f.serverTimestamp() }));
        await b.commit();
      }
      const b = f.writeBatch(db);
      const upd = { [pid]: f.deleteField() };
      for (const [m, q] of Object.entries(people)) if (q.managedBy === pid) upd[`${m}.managedBy`] = f.deleteField();
      b.update(ref('meta', 'people'), upd);
      if (p?.key) b.delete(ref('names', p.key));
      await b.commit();
      return this.rebuildTotals();
    },
  };
}
