import { execFileSync } from 'node:child_process';

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
if (branch !== 'main') {
  console.error('Version/tag commands are main-only. Promote the tested staging batch with a regular merge PR first.');
  process.exitCode = 1;
}
