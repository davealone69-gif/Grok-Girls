import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const eslintCli = resolve(repoRoot, 'tools/lint/node_modules/eslint/bin/eslint.js');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (!existsSync(eslintCli)) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installStatus = run(npm, ['--prefix', 'tools/lint', 'ci', '--no-audit', '--no-fund']);
  if (installStatus !== 0) process.exit(installStatus);
}

if (!existsSync(eslintCli)) {
  console.error(`ESLint was not installed at ${eslintCli}`);
  process.exit(1);
}

process.exit(run(process.execPath, [eslintCli, 'src', ...process.argv.slice(2)]));
