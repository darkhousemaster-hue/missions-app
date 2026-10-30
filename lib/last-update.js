// Remembers what the last update brought, whichever way it got here (the Updates
// page, the popup or update.sh): at every start, compare the commit we run with
// the one we ran last time. The commits in between are the update. Kept in the
// settings table, so the Updates page can still say it days later.
const { execFile } = require('child_process');

const git = (cwd, args) => new Promise(resolve => execFile('git', args,
  { cwd, timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
  (err, out) => resolve(err ? null : String(out).trim())));

async function versionAt(cwd, commit){
  const raw = await git(cwd, ['show', `${commit}:package.json`]);
  try { return raw ? 'v' + JSON.parse(raw).version : ''; } catch(e) { return ''; }
}

async function recordInstalled(appDir, db){
  const head = await git(appDir, ['rev-parse', 'HEAD']);
  if(!head) return;                                  // not a git checkout: nothing to say
  let prev = db.getSetting('installed_commit');
  if(prev === head) return;
  // The first start with this code has no stored commit yet: git's own log of
  // HEAD movements knows the one before the update. Entries that didn't move
  // HEAD (a checkout of the same branch, a stash) are skipped.
  if(!prev){
    const moves = await git(appDir, ['reflog', '-n', '50', '--format=%H']);
    prev = String(moves || '').split(/\r?\n/).map(s => s.trim()).find(h => h && h !== head) || null;
  }
  if(prev){
    const out = await git(appDir, ['log', `${prev}..${head}`, '--no-merges', '--format=%s']);
    const changes = String(out || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 60);
    if(changes.length){
      db.setSetting('last_update', JSON.stringify({
        at: Date.now(), from: await versionAt(appDir, prev), to: await versionAt(appDir, head), changes,
      }));
    }
  }
  db.setSetting('installed_commit', head);
}

function readLastUpdate(db){
  try {
    const v = JSON.parse(db.getSetting('last_update') || 'null');
    return v && Array.isArray(v.changes) ? v : null;
  } catch(e) { return null; }
}

module.exports = { recordInstalled, readLastUpdate };
