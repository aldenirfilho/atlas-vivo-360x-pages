/* Helpers also exercised in Node; no network or dependencies. */
(() => {
  'use strict';
  const epoch = '1970-01-01T00:00:00.000Z';
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
  const isoDate = value => {
    if (typeof value !== 'string') return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!parts) return null;
    const [year,month,day,hour,minute,second] = parts.slice(1).map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
    if (month < 1 || month > 12 || day < 1 || day > days[month-1] || hour > 23 || minute > 59 || second > 59) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  };
  const empty = () => ({schemaVersion:1, favorites:[], favoriteStates:{}, notes:{}});
  function favoriteStates(state) {
    const states = Object.fromEntries(Object.entries(state.favoriteStates || {}).map(([id,operation]) => [id,{...operation}]));
    for (const id of state.favorites) if (!Object.hasOwn(states,id)) states[id] = {saved:true, changedAt:epoch, changeId:'legacy'};
    return states;
  }
  const selectedFavorites = states => Object.keys(states).filter(id => states[id].saved).sort();
  function newerFavorite(left, right) {
    if (!left) return {...right};
    const delta = Date.parse(right.changedAt) - Date.parse(left.changedAt);
    if (delta > 0 || (delta === 0 && right.changeId > left.changeId)) return {...right};
    if (delta === 0 && right.changeId === left.changeId && !right.saved) return {...right};
    return {...left};
  }
  // Returns a new notebook. A false operation is retained so stale tabs cannot restore it.
  function setFavorite(state, id, selected, operation = {}) {
    if (!validId(id) || id === '__proto__' || typeof selected !== 'boolean') throw new Error('Operação de favorito inválida.');
    const states = favoriteStates(state);
    const changedAt = operation.changedAt === undefined
      ? new Date(Math.max(Date.now(), Date.parse(states[id]?.changedAt || epoch) + 1)).toISOString()
      : isoDate(operation.changedAt);
    const changeId = operation.changeId ?? globalThis.crypto?.randomUUID?.() ?? `favorite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!changedAt || !validId(changeId)) throw new Error('Operação de favorito inválida.');
    states[id] = {saved:selected, changedAt, changeId};
    return {...state, favoriteStates:states, favorites:selectedFavorites(states)};
  }
  function validateBackup(value, validIds) {
    const fail = () => { throw new Error('Backup incompatível. Use um arquivo exportado pelo Atlas Vivo v0.1.'); };
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.favorites) || !value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes)) fail();
    const allowed = new Set(validIds), result = empty();
    if (value.favorites.length > validIds.length || Object.keys(value.notes).length > validIds.length) fail();
    for (const id of value.favorites) { if (typeof id !== 'string' || !allowed.has(id)) fail(); }
    if (value.favoriteStates !== undefined) {
      if (!value.favoriteStates || typeof value.favoriteStates !== 'object' || Array.isArray(value.favoriteStates) || Object.keys(value.favoriteStates).length > validIds.length) fail();
      for (const [id,operation] of Object.entries(value.favoriteStates)) {
        if (!allowed.has(id) || !operation || typeof operation !== 'object' || Array.isArray(operation) || typeof operation.saved !== 'boolean' || !validId(operation.changeId)) fail();
        const changedAt = isoDate(operation.changedAt);
        if (!changedAt) fail();
        result.favoriteStates[id] = {saved:operation.saved, changedAt, changeId:operation.changeId};
      }
    }
    result.favoriteStates = favoriteStates({...result, favorites:value.favorites});
    result.favorites = selectedFavorites(result.favoriteStates);
    let count = 0;
    for (const [id, records] of Object.entries(value.notes)) {
      if (!allowed.has(id) || !Array.isArray(records)) fail();
      result.notes[id] = [];
      for (const record of records) {
        if (++count > 500 || !record || typeof record.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(record.id) || typeof record.text !== 'string' || !record.text.trim() || record.text.length > 4000 || typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.date) || !Number.isFinite(Date.parse(record.date))) fail();
        if (record.originId !== undefined && (typeof record.originId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(record.originId))) fail();
        result.notes[id].push({id:record.id, date:record.date, text:record.text, ...(record.originId ? {originId:record.originId} : {})});
      }
    }
    return result;
  }
  function merge(current, incoming) {
    const next = empty();
    const currentFavorites = favoriteStates(current), incomingFavorites = favoriteStates(incoming);
    for (const id of [...new Set([...Object.keys(currentFavorites), ...Object.keys(incomingFavorites)])].sort()) {
      next.favoriteStates[id] = incomingFavorites[id] ? newerFavorite(currentFavorites[id], incomingFavorites[id]) : {...currentFavorites[id]};
    }
    next.favorites = selectedFavorites(next.favoriteStates);
    for (const id of new Set([...Object.keys(current.notes), ...Object.keys(incoming.notes)])) {
      const existing = (current.notes[id] || []).map(n => ({...n}));
      for (const note of incoming.notes[id] || []) {
        if (!existing.some(n => (n.originId || n.id) === (note.originId || note.id) && n.text === note.text && n.date === note.date)) {
          const conflict = existing.some(n => n.id === note.id);
          let newId = note.id, i = 1;
          while (existing.some(n => n.id === newId)) newId = `${note.id.slice(0,100)}-merge${i++}`;
          existing.push({...note, id:conflict ? newId : note.id, ...(conflict ? {originId:note.originId || note.id} : {})});
        }
      }
      next.notes[id] = existing;
    }
    return next;
  }
  globalThis.AtlasNotebook = {empty, validateBackup, merge, setFavorite};
})();
