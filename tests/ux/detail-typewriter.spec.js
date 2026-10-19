import { test, expect } from './fixture.js';
for (const motion of ['no-preference', 'reduce']) {
  test(`detail heading typewriter with ${motion} motion`, async ({page}) => {
    await page.emulateMedia({reducedMotion:motion});
    await page.addInitScript(() => {
      window.__initialBylineFrames = [];
      window.__initialBylineObserver = new MutationObserver(() => {
        const byline = document.querySelector('.detail-marker-byline .detail-typewriter-visible');
        if (byline) window.__initialBylineFrames.push(byline.textContent);
      });
      window.__initialBylineObserver.observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto('/suggestion/2');
    const tray = page.locator('.submission-detail-tray');
    await expect(tray).toHaveAttribute('aria-busy','false');
    const heading = page.locator('.detail-marker-summary');
    const byline = page.locator('.detail-marker-byline');
    await expect(heading.locator('.sr-only')).toHaveText('Suggestion 2');
    await expect(byline.locator('.sr-only')).toHaveText('October 1 · Test Contributor');
    if (motion === 'no-preference') {
      await expect(heading.locator('.detail-typewriter-pending')).toHaveCSS('visibility','hidden');
    }
    await expect(heading.locator('.detail-typewriter-visible')).toHaveText('Suggestion 2');
    await expect(byline.locator('.detail-typewriter-visible')).toHaveText('October 1 · Test Contributor');
    await expect(heading.locator('.detail-typewriter-pending')).toHaveText('');
    const initialFrames = await page.evaluate(() => { window.__initialBylineObserver.disconnect(); return window.__initialBylineFrames; });
    if (motion === 'no-preference') expect(initialFrames.some(text => text.length > 0 && text.length < 'October 1 · Test Contributor'.length)).toBe(true);
    await page.evaluate(() => {
      window.__ux.hold = true;
      window.__outgoingFrames = [];
      window.__outgoingObserver = new MutationObserver(() => {
        const heading = document.querySelector('.detail-marker-summary');
        window.__outgoingFrames.push({
          text: heading?.querySelector('.detail-typewriter-visible')?.textContent || '',
          summary: heading?.querySelector('.sr-only')?.textContent,
          busy: document.querySelector('.submission-detail-tray')?.getAttribute('aria-busy'),
        });
      });
      window.__outgoingObserver.observe(document.querySelector('.detail-marker-summary'), { subtree: true, childList: true, characterData: true });
    });
    await page.getByRole('button',{name:'Next idea',exact:true}).click();
    await expect(tray).toHaveAttribute('aria-busy','true');
    // Release the response immediately: the outgoing animation must still gate entry.
    await page.evaluate(() => {window.__ux.hold = false;});
    await expect(tray).toHaveAttribute('aria-busy','false');
    const frames = await page.evaluate(() => { window.__outgoingObserver.disconnect(); return window.__outgoingFrames; });
    if (motion === 'no-preference') expect(frames.some(frame => frame.text.length > 0 && frame.text.length < 'Suggestion 2'.length && frame.summary === 'Suggestion 2' && frame.busy === 'true')).toBe(true);
    await expect.poll(async () => (await heading.locator('.detail-typewriter-visible').textContent()) === (await heading.locator('.sr-only').textContent())).toBe(true);
    await expect(byline.locator('.detail-typewriter-visible')).toHaveText('October 1 · Test Contributor');
  });
}
