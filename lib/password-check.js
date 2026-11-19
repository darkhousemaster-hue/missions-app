'use strict';
// Password checks off the main thread. bcrypt is slow on purpose (about half a
// second on a Raspberry Pi), and checked inline it held up every other request
// while it ran, so a stream of wrong passwords could freeze every live game.
// One worker thread does the checks one after another. When too many are
// already waiting, a new one is answered "wrong" at once instead of piling up.
const bcrypt = require('bcryptjs');

const QUEUE_MAX = 8;          // checks waiting or running at once
const MAX_LENGTH = 4096;      // bcrypt reads 72 bytes; no real password is longer
const TIMEOUT_MS = 30000;     // a check that never comes back counts as wrong

const WORKER_CODE = `
const { parentPort, workerData } = require('worker_threads');
const bcrypt = require(workerData.bcryptPath);
parentPort.on('message', ({ id, pw, hashes }) => {
  let ok = false;
  for (const h of hashes) {
    try { if (bcrypt.compareSync(pw, h)) { ok = true; break; } } catch (e) {}
  }
  parentPort.postMessage({ id, ok });
});`;

let worker = null, noWorker = false, seq = 0, busy = 0;
const pending = new Map();    // id -> resolve

function startWorker() {
  const { Worker } = require('worker_threads');
  const w = new Worker(WORKER_CODE, { eval: true, workerData: { bcryptPath: require.resolve('bcryptjs') } });
  w.on('message', ({ id, ok }) => { const done = pending.get(id); if (done) { pending.delete(id); idle(); done(!!ok); } });
  const gone = () => {
    if (worker !== w) return;
    worker = null;
    for (const done of pending.values()) done(false);
    pending.clear();
  };
  w.on('error', gone);
  w.on('exit', gone);
  // The worker holds the process open only while a check waits for it (see
  // run), so a script that has finished can still end. Unref after the
  // listeners: attaching a message listener holds the process open again.
  w.unref();
  return w;
}
function idle() { if (worker && !pending.size) worker.unref(); }

// The same answer on the main thread, in bcryptjs's short slices, for a
// platform that cannot start the worker.
async function compareHere(pw, hashes) {
  for (const h of hashes) {
    try { if (await bcrypt.compare(pw, h)) return true; } catch (e) {}
  }
  return false;
}

function run(pw, hashes) {
  if (!worker && !noWorker) { try { worker = startWorker(); } catch (e) { noWorker = true; } }
  if (!worker) return compareHere(pw, hashes);
  return new Promise(resolve => {
    const id = ++seq;
    pending.set(id, resolve);
    setTimeout(() => { if (pending.delete(id)) { idle(); resolve(false); } }, TIMEOUT_MS).unref();
    worker.ref();
    worker.postMessage({ id, pw, hashes });
  });
}

// Resolves true when pw matches one of the bcrypt hashes. Never rejects.
function check(pw, hashes) {
  if (typeof pw !== 'string' || !pw || pw.length > MAX_LENGTH) return Promise.resolve(false);
  const list = (hashes || []).filter(h => typeof h === 'string' && h);
  if (!list.length || busy >= QUEUE_MAX) return Promise.resolve(false);
  busy++;
  return run(pw, list).catch(() => false).finally(() => { busy--; });
}

module.exports = { check };
