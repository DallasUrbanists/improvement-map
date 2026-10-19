import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

export async function inspectLayout(page) {
  return page.evaluate(() => {
    const findings = [];
    const width = innerWidth, height = innerHeight;
    if (document.documentElement.scrollWidth > width + 1) findings.push({ kind: 'overflow', target: 'document', width: document.documentElement.scrollWidth });
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), textarea, select')) {
      const r = el.getBoundingClientRect(), css = getComputedStyle(el);
      if (!r.width || !r.height || css.visibility === 'hidden' || el.closest('[inert]') || el.disabled) continue;
      // Scrollable content may be outside its viewport; assess it when scrolled
      // into view, not as a clipped fixed action.
      if (r.bottom <= 0 || r.top >= height) continue;
      const target = el.getAttribute('aria-label') || el.id || el.textContent.trim().slice(0, 80) || el.tagName;
      if (r.width < 44 || r.height < 44) findings.push({ kind: 'touch-target', target, width: r.width, height: r.height });
      if (r.left < -1 || r.right > width + 1) findings.push({ kind: 'clipped-control', target });
      if (r.top >= 0 && r.bottom <= height && r.left >= 0 && r.right <= width) {
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (top && !el.contains(top) && !top.contains(el) && !el.closest('.map-tray-content, .photo-swipe-viewer')) findings.push({ kind: 'obstructed-control', target });
      }
    }
    return findings;
  });
}

export async function assertDraft(page, key, expected, timeout = 8000) {
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), { timeout }).toMatchObject(expected);
}

export function audit(page, testInfo) {
  const visited = [];
  return async function checkpoint(state) {
    if (process.env.UX_SCAN === '0') {
      visited.push(state);
      testInfo.annotations.push({ type: 'visited-state', description: state });
      return;
    }
    await page.evaluate(() => document.fonts.ready);
    // Allow finite Vue/CSS transitions to settle before measuring.
    await page.waitForTimeout(250);
    const layout = await inspectLayout(page);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const accessibility = result.violations.map(({ id, impact, description, nodes }) => ({ id, impact, description, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
    visited.push(state);
    const report = { state, project: testInfo.project.name, visited, transitions: visited.slice(1).map((to, i) => [visited[i], to]), layout, accessibility, incomplete: result.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })) };
    const reportPath = testInfo.outputPath(`${state}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach(`${state}.json`, { path: reportPath, contentType: 'application/json' });
    const screenshotOptions = { animations: 'disabled', caret: 'hide' };
    // Fake maps are already deterministic; do not mask their parent because it
    // also contains app-owned zoom buttons and overlays we need to inspect.
    const screenshotPath = testInfo.outputPath(`${state}.png`);
    await page.screenshot({ ...screenshotOptions, path: screenshotPath });
    await testInfo.attach(`${state}.png`, { path: screenshotPath, contentType: 'image/png' });
    if (['browse-empty', 'detail-error', 'submit-review', 'review-invalid'].includes(state)) {
      expect.soft(accessibility.filter(rule => rule.id === 'color-contrast'), `${state}: approved contrast fixes`).toEqual([]);
    }
    const baseline = testInfo.snapshotPath(`${state}.png`);
    if (existsSync(baseline) || process.env.UX_VISUAL === '1') {
      await expect.soft(page).toHaveScreenshot(`${state}.png`, screenshotOptions);
    } else testInfo.annotations.push({ type: 'visual-review', description: `${state}: screenshot captured; baseline not yet approved for this platform/profile` });
    const actionable = layout.filter(x => x.kind !== 'touch-target');
    if (accessibility.length || layout.length) testInfo.annotations.push({ type: 'ux-finding', description: `${state}: ${accessibility.length} accessibility rules, ${actionable.length} layout issues, ${layout.length - actionable.length} small targets` });
    // Start in reporting mode. Strict mode is the explicit post-triage gate.
    if (process.env.UX_STRICT === '1') {
      // Explicit user decision, 2026-10-19: retain the map's zoom policy for now.
      // Keep this finding in every report; only its blocking status is deferred.
      expect.soft(accessibility.filter(rule => rule.id !== 'meta-viewport'), `${state}: accessibility`).toEqual([]);
      expect.soft(actionable, `${state}: layout`).toEqual([]);
    }
    return report;
  };
}
