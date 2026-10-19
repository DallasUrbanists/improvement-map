import { test, expect } from './fixture.js';
test.use({ reducedMotion: 'no-preference' });
test('map movement waits for outgoing text to finish', async ({ page }) => {
  await page.goto('/suggestion/2');
  const tray = page.locator('.submission-detail-tray');
  await expect(tray).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.detail-description')).not.toHaveClass(/detail-description-revealing/);
  await page.evaluate(() => {
    window.__navigationMotion = [];
    const setCenter = window.google.maps.Map.prototype.setCenter;
    window.google.maps.Map.prototype.setCenter = function (...args) {
      if (document.querySelector('.submission-detail-tray')?.getAttribute('aria-busy') === 'true') {
        const mapText = [...document.querySelectorAll('.detail-typewriter-visible')].map(el => el.textContent).join('').trim();
        const description = document.querySelector('.detail-description p')?.innerText.trim() || '';
        window.__navigationMotion.push({ mapText, description });
      }
      return setCenter.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Next idea', exact: true }).click();
  await expect(page).not.toHaveURL('/suggestion/2');
  await expect(tray).toHaveAttribute('aria-busy', 'false');
  const motion = await page.evaluate(() => window.__navigationMotion);
  expect(motion.length).toBeGreaterThan(0);
  expect(motion.every(frame => !frame.mapText && !frame.description)).toBe(true);
});
test('detail navigation locks loading and tooltips respect input', async ({page}, info) => {
  if (info.project.use.hasTouch) await page.setViewportSize({width:360,height:880});
  await page.goto('/suggestion/2');
  const tray = page.locator('.submission-detail-tray');
  await expect(tray).toHaveAttribute('aria-busy','false');
  const next = page.getByRole('button',{name:'Next idea',exact:true});
  const previous = page.getByRole('button',{name:'Previous idea',exact:true});
  const opacity = button => button.evaluate(el => getComputedStyle(el,'::after').opacity);
  if (!info.project.use.hasTouch) {
    await next.hover(); await expect.poll(() => opacity(next)).toBe('1');
    expect(await next.evaluate(el => parseFloat(getComputedStyle(el,'::after').bottom))).toBeGreaterThan(await next.evaluate(el => el.clientHeight));
    await page.mouse.move(0,0); await expect.poll(() => opacity(next)).toBe('0');
  }
  if (!info.project.use.hasTouch) {
    for (const name of ['Bookmark idea','Copy idea link','Refresh idea','Close Idea details']) {
      const button = page.getByRole('button',{name,exact:true});
      const owner = name === 'Copy idea link' ? page.locator('.detail-copy-link-action') : button;
      await button.hover();
      await expect.poll(() => opacity(owner)).toBe('1');
      expect(await owner.evaluate(el => parseFloat(getComputedStyle(el,'::after').bottom))).toBeGreaterThan(await owner.evaluate(el => el.clientHeight));
    }
    await expect(tray).toHaveCSS('overflow','visible');
    await page.screenshot({path:info.outputPath('header-tooltip.png')});
    await page.mouse.move(0,0);
  }
  await page.locator('summary').filter({hasText:'Photos'}).click();
  const original = page.url();
  await page.evaluate(() => {window.__ux.hold = true;});
  if (info.project.use.hasTouch) await next.tap(); else await next.click();
  await expect(tray).toHaveAttribute('aria-busy','true');
  await expect(next).toBeDisabled(); await expect(previous).toBeDisabled();
  await expect(tray.locator('.map-tray-content')).toHaveAttribute('inert','');
  await expect(page.locator('.map-toolbar')).toHaveAttribute('inert','');
  await expect.poll(() => opacity(next)).toBe('0');
  const heading = tray.locator('summary').filter({hasText:'Representatives'});
  await expect(heading).toHaveCSS('display','flex');
  expect(await heading.evaluate(el => getComputedStyle(el).color)).not.toBe('rgba(0, 0, 0, 0)');
  await expect(tray.locator('.detail-content-obscured').first()).toHaveCSS('opacity','0.85');
  const progress = () => tray.locator('.map-tray-header').evaluate(el => {
    const css = getComputedStyle(el,'::after');
    return {content:css.content, height:css.height, animation:css.animationName};
  });
  expect(await progress()).toMatchObject({height:'3px',animation:'detail-loading-progress'});
  await page.screenshot({path:info.outputPath('navigation-loading.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(async () => (await progress()).animation).toBe('none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(() => {window.__ux.hold = false;});
  await expect(tray).toHaveAttribute('aria-busy','false');
  expect(page.url()).not.toBe(original);
  expect((await progress()).content).toBe('none');
  if (info.project.use.hasTouch) await expect.poll(() => opacity(next)).toBe('0');
  await expect(tray.locator('details[open]')).toHaveCount(0);
  if (info.project.use.hasTouch) await previous.tap(); else await previous.click();
  await expect(page).toHaveURL(original);
  await expect(tray).toHaveAttribute('aria-busy','false');
  if (info.project.use.hasTouch) await expect.poll(() => opacity(previous)).toBe('0');
  await page.keyboard.press('Tab');
  await previous.focus();
  await expect.poll(() => opacity(previous)).toBe('1');
});
