import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { states } from '../tests/ux/catalog.js';

export default class UxReporter {
  reports = new Map();
  visited = new Map();

  onBegin(config) {
    this.projects = config.projects.map(project => project.name);
    this.suite = process.env.UX_SUITE || 'ux-all';
    try { this.expected = JSON.parse(process.env.UX_EXPECTED_STATES || JSON.stringify(Object.values(states).flat())); }
    catch { this.expected = Object.values(states).flat(); }
    this.expected = [...new Set(this.expected)];
    this.output = process.env.UX_REPORT_DIR || 'test-results/ux';
  }

  async onTestEnd(test, result) {
    const titlePath = typeof test.titlePath === 'function' ? test.titlePath() : test.titlePath;
    const identity = (titlePath || [test.title]).join(' › ');
    const project = test.parent.project()?.name;
    for (const annotation of result.annotations || []) {
      if (annotation.type !== 'visited-state') continue;
      const key = `${project}:${annotation.description}`;
      this.visited.set(key, [...(this.visited.get(key) || []), { suite: this.suite, test: identity, retry: result.retry, audited: false }]);
    }
    for (const attachment of result.attachments) {
      if (attachment.contentType !== 'application/json' || !attachment.path) continue;
      const report = JSON.parse(await readFile(attachment.path, 'utf8'));
      if (!report.state) continue;
      report.suite ||= this.suite;
      report.test ||= identity;
      report.retry ??= result.retry;
      const key = `${report.project}:${report.suite}:${identity}:${result.retry}:${report.state}`;
      this.reports.set(key, report);
    }
  }

  async onEnd(result) {
    const reports = [...this.reports.values()];
    const observed = new Map();
    for (const report of reports) {
      const key = `${report.project}:${report.state}`;
      observed.set(key, [...(observed.get(key) || []), { suite: report.suite, test: report.test, retry: report.retry, audited: true }]);
    }
    for (const [key, occurrences] of this.visited) observed.set(key, [...(observed.get(key) || []), ...occurrences]);
    const coverage = this.projects.map(project => {
      const actual = [...observed.entries()].filter(([key]) => key.startsWith(`${project}:`));
      const visited = actual.map(([key]) => key.slice(project.length + 1));
      return {
        suite: this.suite,
        project,
        expected: this.expected,
        visited: [...new Set(visited)],
        audited: [...new Set(reports.filter(report => report.project === project).map(report => report.state))],
        missing: this.expected.filter(state => !reports.some(report => report.project === project && report.state === state)),
        outsideScope: [],
      };
    });
    const findings = new Map();
    for (const report of reports) {
      const observations = [
        ...report.layout.map(item => ({ ...item, rule: item.kind })),
        ...report.accessibility.flatMap(rule => rule.nodes.map(node => ({ rule: rule.id, target: node.target.join(' '), impact: rule.impact, detail: node.failureSummary }))),
      ];
      for (const item of observations) {
        const id = `${report.state}:${item.rule}:${item.target}`;
        const entry = findings.get(id) || { id, ...item, occurrences: [] };
        entry.occurrences.push({ suite: report.suite, project: report.project, test: report.test, retry: report.retry, state: report.state });
        findings.set(id, entry);
      }
    }
    const summary = {
      suite: this.suite,
      status: result.status,
      mode: process.env.UX_SCAN === '0' ? 'feature (scans omitted)' : 'audit',
      scope: { expectedStates: this.expected, unselectedStates: Object.values(states).flat().filter(state => !this.expected.includes(state)) },
      coverage,
      reports: reports.map(({ state, project, suite, test, retry, visited, transitions, incomplete }) => ({ state, project, suite, test, retry, visited, transitions, incomplete })),
      findings: [...findings.values()],
    };
    await mkdir(this.output, { recursive: true });
    await writeFile(`${this.output}/ux-summary.json`, JSON.stringify(summary, null, 2));
    await writeFile(`${this.output}/ux-summary.md`, `# Usability audit: ${this.suite}\n\nResult: ${result.status}. Mode: ${summary.mode}.\n\n` + coverage.map(item => `- ${item.project}: ${item.audited.length}/${this.expected.length} expected states audited; ${item.visited.length} states visited. Missing: ${item.missing.join(', ') || 'none'}.`).join('\n') + `\n\n${findings.size} deduplicated observations. Unselected journey states: ${summary.scope.unselectedStates.join(', ') || 'none'}.\n`);
  }
}
