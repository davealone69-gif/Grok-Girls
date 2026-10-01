/*
 * Replicates the patched Pollinations path in src/services/providers.ts and
 * exercises it live: host detection, URL construction, retry, throttle message.
 * Run: node tools/verify-keyless.mjs
 */
const KEYLESS_IMAGE_ENDPOINT = 'https://image.pollinations.ai';

function epNorm(endpoint) {
  return endpoint
    .replace(/\/+$/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');
}
function isPollinationsImage(p, mode, endpoint) {
  return (
    p === 'custom' &&
    mode === 'image' &&
    /^(image|gen)\.pollinations\.ai(\/(image|prompt))?$/i.test(epNorm(endpoint))
  );
}
// the pattern this replaced, for comparison
function oldDetection(endpoint) {
  return /(^|\.)gen\.pollinations\.ai\/image\/?$/i.test(endpoint.replace(/\/+$/, ''));
}

const cases = [
  ['https://image.pollinations.ai', true],
  ['https://image.pollinations.ai/', true],
  ['https://image.pollinations.ai/prompt', true],
  ['https://gen.pollinations.ai/image', true],
  ['https://gen.pollinations.ai/image/', true],
  ['http://localhost:7860', false],
  ['https://openrouter.ai/api/v1/chat/completions', false],
  ['https://generativelanguage.googleapis.com/v1beta/models/x:generateContent', false],
];

let fails = 0;
console.log('host detection (new vs the pattern it replaced):');
for (const [ep, want] of cases) {
  const got = isPollinationsImage('custom', 'image', ep);
  const old = oldDetection(ep);
  const mark = got === want ? 'PASS' : 'FAIL';
  if (got !== want) fails++;
  console.log(
    `  ${mark}  new=${String(got).padEnd(5)} old=${String(old).padEnd(5)}  ${ep}`
  );
}

// endpoint fallback wiring
const endpointFor = (saved, p, mode) =>
  saved || (p === 'custom' ? (mode === 'image' ? KEYLESS_IMAGE_ENDPOINT : '') : '');
console.log('\nendpoint resolution:');
console.log(`  custom/image, nothing saved -> ${endpointFor('', 'custom', 'image')}`);
console.log(`  custom/video, nothing saved -> "${endpointFor('', 'custom', 'video')}" (stays unconfigured)`);
console.log(`  custom/image, user override -> ${endpointFor('https://gen.pollinations.ai/image', 'custom', 'image')}`);

// live request using the app's exact URL shape + its retry rule
async function tryGenerate(prompt, seed) {
  const params = new URLSearchParams();
  params.set('model', 'flux');
  params.set('width', '512');
  params.set('height', '512');
  params.set('seed', String(seed));
  const endpoint = endpointFor('', 'custom', 'image');
  const imageUrl = `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(prompt)}?${params.toString()}`;
  let status = 0;
  let body = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(imageUrl, { method: 'GET' });
    status = r.status;
    if (r.ok) {
      body = await r.arrayBuffer();
      break;
    }
    if (status === 402 || status === 429) {
      if (attempt === 0) { await new Promise(res => setTimeout(res, 1500)); continue; }
    }
    break;
  }
  let msg = 'ok';
  if (status === 402 || status === 429) {
    msg = `Pollinations is rate-limited right now (HTTP ${status}). Wait a minute and press GENERATE again, or set an API key / endpoint in Settings.`;
  } else if (status === 401) {
    msg = 'Pollinations rejected the request (HTTP 401) - this host now requires a key. Add one in Settings.';
  }
  return { status, bytes: body ? body.byteLength : 0, type: body ? Buffer.from(body.slice(0, 3)).toString('hex') : '', msg };
}

console.log('\nlive generation attempts (keyless):');
for (const seed of [101, 202, 303]) {
  const r = await tryGenerate('a simple red cube on a white background', seed);
  const jpeg = r.type.startsWith('ffd8');
  console.log(
    `  seed ${seed}: HTTP ${r.status} | ${r.bytes} bytes | ${jpeg ? 'JPEG image' : 'not an image'}`
  );
  if (!jpeg) console.log(`     -> "${r.msg}"`);
}
process.exit(fails ? 1 : 0);
