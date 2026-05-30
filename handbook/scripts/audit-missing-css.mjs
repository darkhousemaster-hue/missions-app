// Diagnostic: list every literal class used in <HTML> that has NO matching
// `.class` selector in either an inline <style> block or app.css.
// Skips template-literal junk like `${...}`.
import { readFileSync } from 'node:fs';
const target = process.argv[2] || 'public/gm.html';
const html = readFileSync(target, 'utf8');
const ext  = readFileSync('public/css/app.css', 'utf8');
const inlineMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const css = (inlineMatch ? inlineMatch[1] : '') + '\n' + ext;

const used = new Set();
for (const m of html.matchAll(/class="([^"]+)"/g)) {
  for (const c of m[1].split(/\s+/)) {
    if (!c) continue;
    if (c.includes('${') || c.includes(':') || c.includes('?') || c.includes("'")) continue;
    used.add(c);
  }
}
const missing = [];
for (const c of used) {
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\.' + esc + '(?![\\w-])');
  if (!re.test(css)) missing.push(c);
}
missing.sort();
console.log(`[${target}] used=${used.size}, missing=${missing.length}`);
console.log(missing.join('\n'));
