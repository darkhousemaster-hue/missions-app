'use strict';
// ── lib/profanity.js ─────────────────────────────────────────────────────────
// Server-side team-name profanity / hate-speech filter. Authoritative: the
// player join endpoint calls isClean()/findProfanity() before a team is
// created, so it can't be bypassed by hitting the API directly.
//
// Matching policy: WORD-BOUNDARY (chosen deliberately to minimise false
// rejections on innocent names). A name is rejected when a banned term appears
// as a STANDALONE WORD — not merely as a substring of a larger word. So:
//     "Hate", "Team Hate", "HATEN"        → blocked
//     "Hateful", "Hateley", "Cocktail",   → allowed (bad word is only a
//     "Therapist", "Scunthorpe", "Class"     substring, not a whole word)
//
// Evasion handling — we still catch the common tricks, just without
// over-blocking:
//   • case folding + diacritic stripping (ä→a, é→e, ñ→n, ß→ss)
//   • leetspeak folding (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, …)
//   • per-word repeat collapsing ("fuuuck" → "fuck", "assss" → "ass")
//   • spaced/punctuated spellouts: if the whole name with separators removed
//     IS exactly one banned word ("f.u.c.k", "h a t e" → "fuck"/"hate") it's
//     blocked. Gluing distinct words ("hateyou") is NOT blocked — that's the
//     price of word-boundary mode, and the right call for a friendly app.
//
// Adding a term: drop the lowercase base form into the right language bucket.
// Plurals/inflections that share the stem are caught by repeat-collapse only,
// not by stemming — add explicit forms if you need them (e.g. "haten").

// Banned standalone words, grouped by language. Matched case-insensitively
// after normalization. Keep sorted-ish within a group for easy review.
const WORDS = [
  // ── English profanity ──
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'shite',
  'bitch', 'bastard', 'asshole', 'arsehole', 'ass', 'arse', 'dick', 'dickhead',
  'cunt', 'pussy', 'cock', 'wanker', 'bollocks', 'prick', 'slut', 'whore',
  'douche', 'douchebag', 'twat', 'jackass', 'dumbass', 'dipshit', 'damn',
  'goddamn', 'piss', 'crap', 'tit', 'tits', 'hoe', 'jizz', 'cum', 'cumshot',
  'sex', 'porn', 'anal', 'orgy', 'boobs',
  // ── German ──
  'arschloch', 'arsch', 'scheisse', 'scheiss', 'fotze', 'wichser',
  'hurensohn', 'schlampe', 'fick', 'ficken', 'fickt', 'hure', 'huren', 'nutte',
  'drecksau', 'huso', 'spasti', 'missgeburt', 'vollidiot', 'penner',
  'schwanz', 'schwanzlutscher', 'miststueck',
  // ── French ──
  'merde', 'putain', 'connard', 'connasse', 'salope', 'salaud', 'encule',
  'enculer', 'enfoire', 'batard', 'pute', 'couilles', 'nique', 'niquer',
  'foutre', 'bite', 'cul', 'chier', 'tafiole',
  // ── Italian ──
  'merda', 'cazzo', 'stronzo', 'stronza', 'puttana', 'troia', 'vaffanculo',
  'coglione', 'minchia', 'bastardo', 'fottiti', 'figa', 'fica', 'culo',
  // ── Spanish ──
  'mierda', 'joder', 'cabron', 'gilipollas', 'puta', 'pendejo', 'chinga',
  'chingar', 'verga', 'pinche', 'cojones', 'polla', 'follar', 'capullo',
  'hijoputa', 'hijodeputa', 'mamon', 'cono', 'caca', 'teta', 'tetas',
  // ── Hate / slurs (apply across ALL languages) ──
  // User explicitly requested hate terms including "hate" / "haten".
  // NOTE: "hateful" is intentionally NOT here — it's a normal dictionary
  // adjective (e.g. the film "The Hateful Eight") and would over-block in
  // word-boundary mode. The hostile standalone forms below suffice.
  'hate', 'haten', 'hater', 'hatred',
  'nazi', 'nazis', 'hitler', 'heil', 'siegheil', 'kkk', 'klux',
  'genocide', 'holocaust', 'lynch', 'terrorist', 'jihad',
  'nigger', 'nigga', 'niggers', 'coon', 'chink', 'gook', 'spic', 'wetback',
  'kike', 'paki', 'raghead', 'sandnigger', 'beaner', 'wop', 'jap',
  'faggot', 'fag', 'faggots', 'dyke', 'tranny', 'retard', 'retarded',
  'spastic', 'rape', 'rapist', 'pedo', 'pedophile', 'paedophile', 'molester',
  // German hate
  'judensau', 'untermensch', 'volksverraeter', 'neger', 'kanake', 'kraut',
  // French hate
  'negre', 'bougnoule', 'youpin', 'pede',
  // Italian hate
  'negro', 'frocio', 'terrone',
  // Spanish hate
  'sudaca', 'puto', 'maricon',
];

// Leetspeak / homoglyph fold map applied per character.
const LEET = {
  '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '9':'g',
  '@':'a', '$':'s', '!':'i', '|':'i', '£':'l', '€':'e',
};

// Strip combining marks (after NFD) so accented letters fold to ASCII.
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Fold a raw string to lowercase ASCII letters with leet mapping, keeping
// non-letters as-is (so callers can decide how to split). ß→ss handled first.
function fold(input) {
  let s = String(input || '').toLowerCase().replace(/ß/g, 'ss');
  s = stripDiacritics(s);
  s = s.split('').map(c => (LEET[c] !== undefined ? LEET[c] : c)).join('');
  return s;
}

// Collapse 3+ repeats of a letter down to a single one ("fuuuck"→"fuck",
// "assss"→"ass"). Done at single-collapse because banned forms have no
// intentional double letters that 3+ would be needed to preserve... except a
// few ("bollocks","couilles","cojones"): those still match because the user's
// real input rarely triples letters AND we test the un-collapsed token too.
function collapse(token) {
  return token.replace(/(.)\1{2,}/g, '$1');
}

// Built-in match sets (precomputed once). `collapsed` folds 3+ repeats; `raw`
// keeps legit double letters (e.g. "bollocks").
const BUILTIN_COLLAPSED = new Set(WORDS.map(w => collapse(fold(w))));
const BUILTIN_RAW       = new Set(WORDS.map(w => fold(w)));

// Build a {collapsed, raw} set pair from the built-ins plus any GM-supplied
// custom words. Custom words are folded the same way so they catch the same
// evasions (leetspeak, accents, spacing). Cached by the exact custom input so
// repeated calls with the same settings don't rebuild.
let _customCacheKey = null;
let _customSets = null;
function buildSets(extraWords) {
  const extras = Array.isArray(extraWords) ? extraWords : [];
  // Normalise custom entries: trim, drop blanks, fold to comparable form.
  const cleaned = extras.map(w => fold(String(w))).filter(w => w.length > 0);
  if (cleaned.length === 0) return { collapsed: BUILTIN_COLLAPSED, raw: BUILTIN_RAW };
  const key = cleaned.slice().sort().join('\n');
  if (key === _customCacheKey && _customSets) return _customSets;
  const collapsed = new Set(BUILTIN_COLLAPSED);
  const raw = new Set(BUILTIN_RAW);
  for (const w of cleaned) { raw.add(w); collapsed.add(collapse(w)); }
  _customCacheKey = key;
  _customSets = { collapsed, raw };
  return _customSets;
}

function inSets(sets, tok) {
  if (!tok) return false;
  if (sets.raw.has(tok)) return true;
  const c = collapse(tok);
  return sets.collapsed.has(c) || sets.raw.has(c);
}
function tokenMatches(sets, tok) {
  if (!tok) return false;
  if (inSets(sets, tok)) return true;
  // Suffix tolerance: catch simple plurals/inflections without stemming the
  // whole dictionary. "connards"→"connard", "bitches"→"bitch", "asses"→"ass".
  // Only strip when the remainder is long enough to stay specific (≥3) so we
  // don't turn short innocent tokens into banned stems.
  if (tok.length >= 5 && tok.endsWith('es') && inSets(sets, tok.slice(0, -2))) return true;
  if (tok.length >= 4 && tok.endsWith('s')  && inSets(sets, tok.slice(0, -1))) return true;
  return false;
}

// Returns the offending banned word (truthy) or null. `extraWords` is an
// optional array of GM-configured custom words merged with the built-in list.
function findProfanity(name, extraWords) {
  const sets = buildSets(extraWords);
  const folded = fold(name);

  // 1) Whole-word tokens: split on any run of non-letters.
  for (const tok of folded.split(/[^a-z]+/)) {
    if (tokenMatches(sets, tok)) return tok;
  }

  // 2) Spaced/punctuated spellout: the ENTIRE name with separators removed,
  //    only if it reduces to exactly one banned word ("f.u.c.k", "h-a-t-e").
  //    This does NOT match glued multi-word strings, preserving word-boundary
  //    semantics (so "hateful" stays clean).
  const squashed = folded.replace(/[^a-z]/g, '');
  if (tokenMatches(sets, squashed)) return squashed;

  return null;
}

function isClean(name, extraWords) {
  return findProfanity(name, extraWords) === null;
}

// Parse a GM-entered list (newline- and/or comma-separated) into clean tokens.
function parseWordList(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map(w => w.trim())
    .filter(Boolean);
}

module.exports = { isClean, findProfanity, fold, parseWordList };
