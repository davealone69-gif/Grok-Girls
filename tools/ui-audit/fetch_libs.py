#!/usr/bin/env python3
"""Resolve chrome-headless-shell's missing shared libraries from the Debian
trixie Packages index (exact filenames, so no version guessing) into a private
sysroot. No root needed."""
import glob, gzip, io, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
SYSROOT = os.path.join(HERE, 'sysroot')
DEBS = os.path.join(HERE, 'debs')
MIRROR = 'http://deb.debian.org/debian'
INDEX = f'{MIRROR}/dists/trixie/main/binary-amd64/Packages.gz'

WANT = [
    'libnspr4', 'libnss3', 'libatk1.0-0t64', 'libatk-bridge2.0-0t64',
    'libatspi2.0-0t64', 'libxdamage1', 'libxkbcommon0', 'libasound2t64',
    'libxres1',
]

os.makedirs(DEBS, exist_ok=True)
os.makedirs(SYSROOT, exist_ok=True)

print('fetching trixie Packages index ...')
raw = subprocess.run(['curl', '-sSL', INDEX], capture_output=True).stdout
text = gzip.GzipFile(fileobj=io.BytesIO(raw)).read().decode('utf-8', 'replace')
files = {}
for block in text.split('\n\n'):
    name = re.search(r'^Package: (.+)$', block, re.M)
    fn = re.search(r'^Filename: (.+)$', block, re.M)
    ver = re.search(r'^Version: (.+)$', block, re.M)
    if name and fn and name.group(1) in WANT:
        files.setdefault(name.group(1), []).append((ver.group(1) if ver else '0', fn.group(1)))
print('index parsed:', {k: [v[0] for v in vv] for k, vv in files.items()})

for pkg in WANT:
    if pkg not in files:
        print(f'  MISS-IN-INDEX {pkg}')
        continue
    ver, fn = files[pkg][-1]
    dest = os.path.join(DEBS, os.path.basename(fn))
    if not os.path.exists(dest) or os.path.getsize(dest) < 1000:
        r = subprocess.run(['curl', '-sSL', '-o', dest, f'{MIRROR}/{fn}'], capture_output=True, text=True)
        if r.returncode != 0:
            print(f'  DL-FAIL {pkg}: {r.stderr[:100]}')
            continue
    x = subprocess.run(['dpkg-deb', '-x', dest, SYSROOT], capture_output=True, text=True)
    print(f'  {"OK  " if x.returncode == 0 else "FAIL"} {pkg:24s} {ver} ({os.path.getsize(dest):,} B)')

cache = os.environ.get('PUPPETEER_CACHE_DIR', '/tmp/puppeteer-chrome')
matches = sorted(glob.glob(os.path.join(
    cache, 'chrome-headless-shell', '*', 'chrome-headless-shell-linux64', 'chrome-headless-shell')))
if not matches:
    print('\nchrome-headless-shell is not downloaded yet (run run_audit.sh) '
          '- nothing to ldd-check, the debs above are extracted and ready.')
    raise SystemExit(0)
sh = matches[0]
libdirs = sorted({dp for dp, _, fs in os.walk(SYSROOT) for f in fs if f.endswith('.so') or '.so.' in f})
env = dict(os.environ, LD_LIBRARY_PATH=':'.join(libdirs))
out = subprocess.run(['ldd', sh], capture_output=True, text=True, env=env)
bad = [l.strip() for l in (out.stdout + out.stderr).splitlines() if 'not found' in l]
print(f'\nstill unresolved: {len(bad)}')
for b in bad:
    print('   ', b)
print('\nLD_LIBRARY_PATH=' + env['LD_LIBRARY_PATH'])
