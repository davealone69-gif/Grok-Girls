// Render the built app at phone size in headless Chrome and enumerate every
// VISIBLE interactive control, so duplication can be measured instead of guessed.
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const APP_URL = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
const OUT = process.env.AUDIT_OUT || new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'shell',
  executablePath: process.env.CHROME_BIN,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));

await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));

// get past anything modal (age gate etc.) by clicking the most affirmative button
async function dismissModals() {
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const txt = (el) => (el.innerText || el.getAttribute('aria-label') || '').toUpperCase();
      const cands = [...document.querySelectorAll('button, [role="button"], a')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 20 && r.top >= 0 && r.top < innerHeight;
      });
      const hit = cands.find(el => /ENTER|I AM 18|I'M 18|ACCEPT|AGREE|CONTINUE|OK\b|GOT IT|CLOSE/.test(txt(el)));
      if (hit) { hit.click(); return txt(hit).slice(0, 40); }
      return null;
    });
    if (!clicked) break;
    console.log('  dismissed modal via:', clicked);
    await new Promise(r => setTimeout(r, 1200));
  }
}
await dismissModals();

async function dump(tag) {
  const data = await page.evaluate(() => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const chain = el => {
      const parts = [];
      let n = el;
      while (n && n !== document.body && parts.length < 6) {
        const cls = (n.className && typeof n.className === 'string') ? '.' + n.className.trim().split(/\s+/).join('.') : '';
        parts.unshift(n.tagName.toLowerCase() + cls);
        n = n.parentElement;
      }
      return parts.slice(-4).join(' > ');
    };
    const out = [];
    for (const el of document.querySelectorAll('button, [role="button"], [role="tab"]')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05
        && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      if (!visible) continue;
      // is it actually on top of what it looks like? record centre + z-index
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      let occluded = false;
      try {
        const top = document.elementFromPoint(cx, cy);
        occluded = !(top === el || el.contains(top) || (top && top.contains(el)));
      } catch { /* ignore */ }
      const label = norm(el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || '');
      out.push({
        label: label || '<no-label>',
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        z: cs.zIndex, occluded, chain: chain(el)
      });
    }
    return out;
  });
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(data, null, 1));
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  return data;
}

function report(tag, data) {
  const groups = new Map();
  for (const d of data) {
    if (!groups.has(d.label)) groups.set(d.label, []);
    groups.get(d.label).push(d);
  }
  const dupes = [...groups.entries()].filter(([, v]) => v.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  console.log(`\n===== ${tag}: ${data.length} visible controls, ${groups.size} distinct labels, ${dupes.length} duplicated =====`);
  for (const [label, items] of dupes.slice(0, 25)) {
    console.log(`  x${items.length}  "${label}"`);
    for (const it of items) console.log(`        @${it.x},${it.y} ${it.w}x${it.h} occluded=${it.occluded} z=${it.z}  ${it.chain}`);
  }
  return { tag, total: data.length, distinct: groups.size, dupLabels: dupes.length };
}

const summary = [];
summary.push(report('01-initial', await dump('01-initial')));

// open the MORE sheet the way the user does (rail footer button)
const opened = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('button')].find(b =>
    /MORE|18\+/.test((b.innerText || '') + (b.getAttribute('title') || '')));
  if (hit) { hit.click(); return (hit.innerText || hit.getAttribute('title') || '').trim(); }
  return null;
});
console.log('\nopened more sheet via:', opened);
await new Promise(r => setTimeout(r, 1200));
summary.push(report('02-more-open', await dump('02-more-open')));

// open the inspector sheet the way the user does: tap HAIR STYLING inside MORE
const openedInspector = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('button.more-item')]
    .find(b => /HAIR/i.test((b.innerText || '') + (b.getAttribute('title') || '')));
  if (hit) { hit.click(); return (hit.innerText || hit.getAttribute('title') || '').trim(); }
  return null;
});
console.log('\nopened inspector via:', openedInspector);
await new Promise(r => setTimeout(r, 1400));
summary.push(report('03-inspector', await dump('03-inspector')));

fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
await browser.close();
console.log('\nscreenshots + dumps in', OUT);
