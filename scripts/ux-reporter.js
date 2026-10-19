import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { states } from '../tests/ux/catalog.js';

export default class UxReporter {
  reports = new Map();
  onBegin(config) { this.projects = config.projects.map(p => p.name); }
  async onTestEnd(test, result) {
    for (const attachment of result.attachments) {
      if (attachment.contentType !== 'application/json' || !attachment.path) continue;
      const report = JSON.parse(await readFile(attachment.path, 'utf8'));
      if (report.state) this.reports.set(`${report.project}:${report.state}`, report);
    }
  }
  async onEnd(result) {
    const expected = Object.values(states).flat();
    const reports = [...this.reports.values()];
    const coverage = this.projects.map(project => ({ project,
      visited: reports.filter(r => r.project === project).map(r => r.state),
      missing: expected.filter(state => !this.reports.has(`${project}:${state}`)),
    }));
    const findings = new Map();
    for (const report of reports) {
      const observations = [
        ...report.layout.map(item => ({ ...item, rule: item.kind })),
        ...report.accessibility.flatMap(rule => rule.nodes.map(node => ({ rule: rule.id, target: node.target.join(' '), impact: rule.impact, detail: node.failureSummary }))),
      ];
      for (const item of observations) {
        const id = `${report.state}:${item.rule}:${item.target}`;
        const entry = findings.get(id) || { id, ...item, occurrences: [] };
        entry.occurrences.push({ project: report.project, state: report.state });
        findings.set(id, entry);
      }
    }
    const summary = { status: result.status, mode: process.env.UX_SCAN === '0' ? 'feature (scans omitted)' : 'audit', coverage, findings: [...findings.values()] };
    await mkdir('test-results/ux', { recursive: true });
    await writeFile('test-results/ux/summary.json', JSON.stringify(summary, null, 2));
    await writeFile('test-results/ux/summary.md', `# Usability audit\n\nResult: ${result.status}. Mode: ${summary.mode}.\n\n` + coverage.map(c => `- ${c.project}: ${c.visited.length}/${expected.length} audited states. Missing: ${c.missing.join(', ') || 'none'}.`).join('\n') + `\n\n${findings.size} deduplicated observations; these require triage, not automatic UX changes. See summary.json and the HTML report.\n`);
  }
}
