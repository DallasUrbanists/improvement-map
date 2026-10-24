import { execFileSync } from 'node:child_process';

export const branchBase = type => type === 'hotfix' ? 'main' : 'staging';
export const draftPrArgs = ['pr', 'create', '--draft', '--fill', '--base', 'staging'];

export function comparisonBase({ explicit, branch, exists }) {
  if (explicit) {
    if (!exists(explicit)) throw new Error(`Explicit comparison base does not exist: ${explicit}`);
    return explicit;
  }
  if (!branch) throw new Error('Detached or unidentified work requires an explicit comparison base.');
  const base = ['main', 'staging'].includes(branch) || branch.startsWith('hotfix/') ? 'main' : 'staging';
  for (const ref of [`origin/${base}`, base]) if (exists(ref)) return ref;
  throw new Error(`Missing ${base} comparison branch. Fetch origin/${base}${base === 'staging' ? ' after the staging bootstrap is complete' : ''}; main is never substituted for staging.`);
}

export function gitRefExists(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}
