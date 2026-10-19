import { test, expect } from '@playwright/test';

async function mockThumbnailUploads(page) {
  const center = { lat: 32.7767, lon: -96.797 };
  const elements = [
    { id: 1, tags: { highway: 'residential', name: 'Test Main Street' }, geometry: [
      { lat: center.lat + 0.0002, lon: center.lon - 0.003 }, { lat: center.lat + 0.0002, lon: center.lon + 0.003 },
    ] },
    { id: 2, tags: { highway: 'residential', name: 'Test Avenue' }, geometry: [
      { lat: center.lat - 0.003, lon: center.lon + 0.0003 }, { lat: center.lat + 0.003, lon: center.lon + 0.0003 },
    ] },
    { id: 3, tags: { highway: 'residential', name: 'Test Boulevard' }, geometry: [
      { lat: center.lat - 0.0006, lon: center.lon - 0.003 }, { lat: center.lat - 0.0006, lon: center.lon + 0.003 },
    ] },
    { id: 4, tags: { highway: 'residential', name: 'Test Fourth Street' }, geometry: [
      { lat: center.lat + 0.001, lon: center.lon - 0.003 }, { lat: center.lat + 0.001, lon: center.lon + 0.003 },
    ] },
  ];
  const uploadedFiles = [];

  await page.route('**/api/interpreter', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ elements: elements.map((way) => ({ type: 'way', ...way })) }),
  }));
  await page.route('**/api/public-improvements/suggestions/upload-url', async (route) => {
    const { filename } = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {
        uploadUrl: `https://uploads.test/${filename}`,
        publicUrl: `https://cdn.test/${filename}`,
      } }),
    });
  });
  await page.route('https://uploads.test/**', async (route) => {
    const request = route.request();
    uploadedFiles.push({
      contentType: request.headers()['content-type'],
      body: (await request.postDataBuffer()).toString('utf8'),
    });
    await route.fulfill({ status: 200 });
  });
  return uploadedFiles;
}

test.describe('Improvement Map - PWA and Navigation', () => {
  test('default landing page loads Browse page and displays map/list controls', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Browse Suggestions | Improvement Map/i);

    // Verify Browse page is loaded as default landing page with tab controls
    await expect(page.getByRole('link', { name: 'Streets' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Satellite' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'List' })).toBeVisible();

    // Verify top tabbar is present
    await expect(page.getByRole('link', { name: /Browse/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Submit/i }).first()).toBeVisible();
  });

  test('suggestion details view scrolls when content exceeds the viewport', async ({ page }) => {
  await page.route('**/api/public-improvements/suggestions/scroll-test', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'scroll-test',
          content: {
            summary: 'Long suggestion details',
            details: 'This detailed suggestion should remain scrollable. '.repeat(100),
            photos: [],
          },
          author: { name: 'Test Contributor' },
          location: { address: 'Dallas, TX' },
        },
      }),
    });
  });

  await page.goto('/suggestion/scroll-test');
  await expect(page.getByRole('heading', { name: 'Long suggestion details' })).toBeVisible();
  const scroller = page.locator('.view-panel');
  const scrollDimensions = await scroller.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scrollDimensions.scrollHeight).toBeGreaterThan(scrollDimensions.clientHeight);
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('theme follows system until a manual choice, then remembers that choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const htmlElement = page.locator('html');
  const menuButton = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(htmlElement).toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(htmlElement).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(htmlElement).toHaveClass(/dark/);

  await menuButton.click();
  await expect(page.getByRole('menuitemradio', { name: 'System theme' })).toHaveCount(0);
  await page.getByRole('menuitemradio', { name: 'Light theme' }).click();
  await expect(htmlElement).toHaveClass(/light/);

  await page.reload();
  await expect(htmlElement).toHaveClass(/light/);

  await expect.poll(() => page.evaluate(() => localStorage.getItem('improvement_map_theme'))).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(htmlElement).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(htmlElement).toHaveClass(/light/);

  await page.reload();
  await expect(htmlElement).toHaveClass(/light/);
  await menuButton.click();
  await page.getByRole('menuitemradio', { name: 'Dark theme' }).click();
  await expect(htmlElement).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(htmlElement).toHaveClass(/dark/);
});

  test('bottom tabbar navigation works across all pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Submit via top tabbar
    await page.getByRole('link', { name: /Submit/i }).first().click();
    await expect(page).toHaveURL(/\/submit/);
    const locationSearch = page.getByRole('textbox', { name: 'Search or edit suggestion location' });
    await expect(locationSearch).toBeVisible();
    await locationSearch.fill('Dallas City Hall');
    await expect(locationSearch).toHaveValue('Dallas City Hall');
    await expect(page.getByTestId('suggestion-location-crosshair')).toBeVisible();
    const pinAndContinue = page.getByTestId('pin-and-continue');
    await expect(pinAndContinue).toHaveText('Pin and continue');
    const buttonLayout = await page.evaluate(() => {
      const frame = document.querySelector('[data-testid="submit-map-frame"]');
      const crosshair = document.querySelector('[data-testid="suggestion-location-crosshair"]');
      const locationControl = document.querySelector('[data-testid="center-on-location-control"]');
      const button = document.querySelector('[data-testid="pin-and-continue"]');
      const frameBounds = frame.getBoundingClientRect();
      const crosshairBounds = crosshair.getBoundingClientRect();
      const locationButton = locationControl.querySelector('button, a');
      const buttonBounds = button.getBoundingClientRect();
      return {
        actualY: buttonBounds.top + buttonBounds.height / 2,
        expectedY: (crosshairBounds.top + crosshairBounds.height / 2 + locationButton.getBoundingClientRect().top) / 2,
        width: buttonBounds.width,
        frameWidth: frameBounds.width,
        background: getComputedStyle(button).backgroundColor,
        crosshairFill: crosshair.querySelector('circle').getAttribute('fill'),
      };
    });
    expect(Math.abs(buttonLayout.actualY - buttonLayout.expectedY)).toBeLessThan(2);
    expect(buttonLayout.width).toBeLessThan(buttonLayout.frameWidth);
    expect(buttonLayout.background).toBe('rgb(96, 165, 250)');
    expect(buttonLayout.crosshairFill).toBe('#60a5fa');
    const crosshairGroup = page.getByTestId('suggestion-location-crosshair').locator('g');
    await expect(crosshairGroup).toHaveAttribute('stroke', '#ffffff');

    await page.locator('#theme-menu-btn').click();
    await page.getByRole('menuitemradio', { name: 'Light theme' }).click();
    await expect(page.getByTestId('suggestion-location-crosshair').locator('circle').first()).toHaveAttribute('fill', '#1e3a8a');
    await expect(crosshairGroup).toHaveAttribute('stroke', '#ffffff');
    await page.getByText('Satellite', { exact: true }).click();
    await expect(crosshairGroup).toHaveAttribute('stroke', '#ffffff');
    await page.getByText('Streets', { exact: true }).click();
    await expect(crosshairGroup).toHaveAttribute('stroke', '#ffffff');
    await expect(page.getByText('Streets', { exact: true })).toBeVisible();
    await expect(page.getByText('Satellite', { exact: true })).toBeVisible();
    await expect(page.getByText('List', { exact: true })).toHaveCount(0);

    // Navigate back to Browse via top tabbar
    await page.getByRole('link', { name: /Browse/i }).first().click();
    await expect(page).toHaveURL(/\//);
    await expect(page.getByText('Streets', { exact: true })).toBeVisible();
    await expect(page.getByText('List', { exact: true })).toBeVisible();
  });
});

test('photo step uses sticky segmented controls and a bounded swipe viewer', async ({ page }) => {
  await page.addInitScript(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      setTimeout(() => originalToBlob.call(this, callback, type, quality), 250);
    };
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({
      step: 2,
      photos: [
        { id: 'photo-1', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'First photo' },
        { id: 'photo-2', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'Second photo' },
      ],
    }));
  });
  await page.goto('/submit');

  const controls = page.getByTestId('photo-step-controls');
  const viewer = page.getByTestId('photo-swipe-viewer');
  await expect(controls).toBeVisible();
  await expect(page.getByTestId('photo-action-segment')).toHaveClass(/border/);
  await expect(page.getByTestId('photo-navigation-segment')).toHaveClass(/border/);
  await expect(page.getByRole('button', { name: 'Upload photos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(page.getByTestId('photo-navigation-segment').getByRole('button').nth(1)).toBeVisible();
  await expect(viewer.locator('img')).toHaveCount(2);

  const layout = await page.evaluate(() => {
    const controls = document.querySelector('[data-testid="photo-step-controls"]');
    const viewer = document.querySelector('[data-testid="photo-swipe-viewer"]');
    return {
      footerPosition: getComputedStyle(controls).position,
      viewerHeight: viewer.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      viewerLeft: viewer.getBoundingClientRect().left,
      viewerWidth: viewer.getBoundingClientRect().width,
      firstSlideWidth: viewer.firstElementChild.getBoundingClientRect().width,
      viewerClientWidth: viewer.clientWidth,
      viewerScrollWidth: viewer.scrollWidth,
      scrollbarWidth: getComputedStyle(viewer).scrollbarWidth,
    };
  });
  expect(layout.footerPosition).toBe('sticky');
  expect(layout.viewerHeight).toBeLessThanOrEqual(layout.viewportHeight * 0.5 + 1);
  expect(layout.viewerLeft).toBeLessThanOrEqual(1);
  expect(layout.viewerWidth).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.firstSlideWidth).toBeLessThan(layout.viewerWidth);
  expect(layout.viewerScrollWidth).toBeGreaterThan(layout.viewerClientWidth);
  expect(layout.scrollbarWidth).toBe('none');

  const previousPhoto = page.getByRole('button', { name: 'Previous photo' });
  const nextPhoto = page.getByRole('button', { name: 'Next photo' });
  await expect(previousPhoto).toBeDisabled();
  await nextPhoto.click();
  await expect(page.getByText('2 / 2')).toBeVisible();
  await expect(nextPhoto).toBeDisabled();
  await previousPhoto.click();
  await expect(page.getByText('1 / 2')).toBeVisible();

  await viewer.evaluate((element) => {
    element.scrollLeft = element.clientWidth;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByText('2 / 2')).toBeVisible();

  const controlsTop = (await controls.boundingBox()).y;
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'uploaded.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'),
  });
  const toast = page.getByTestId('photo-processing-toast');
  await expect(toast).toBeVisible();
  const toastStyle = await toast.evaluate((element) => ({
    position: getComputedStyle(element).position,
    top: getComputedStyle(element).top,
  }));
  expect(toastStyle.position).toBe('fixed');
  expect(toastStyle.top).toBe('16px');
  await toast.dispatchEvent('pointerdown', { pointerId: 1, clientX: 120, clientY: 100 });
  await toast.dispatchEvent('pointerup', { pointerId: 1, clientX: 40, clientY: 100 });
  await expect(toast).toHaveCount(0);
  expect((await controls.boundingBox()).y).toBe(controlsTop);
  await expect(page.getByText('3 / 3')).toBeVisible();
});

test('description and review steps use sticky segmented navigation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({
      step: 3,
      details: 'This improvement would make the crossing safer.',
    }));
  });
  await page.goto('/submit');

  const detailsLayout = await page.locator('#input-details').evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    minHeight: getComputedStyle(element).minHeight,
    flexGrow: getComputedStyle(element).flexGrow,
    parentDisplay: getComputedStyle(element.parentElement).display,
  }));
  expect(detailsLayout.minHeight).toBe('160px');
  expect(detailsLayout.flexGrow).toBe('1');
  expect(detailsLayout.parentDisplay).toBe('flex');
  expect(detailsLayout.height).toBeGreaterThan(160);

  const details = page.locator('#input-details');
  await details.fill('A longer description '.repeat(300));
  await expect.poll(() => details.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(detailsLayout.height);
  const expandedLayout = await details.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(expandedLayout.scrollHeight).toBeLessThanOrEqual(expandedLayout.clientHeight);

  const descriptionNavigation = page.getByTestId('step-three-navigation');
  await expect(descriptionNavigation).toBeVisible();
  await expect(descriptionNavigation).toHaveClass(/sticky/);
  await expect(descriptionNavigation.locator('.k-segmented')).toHaveClass(/border/);
  await descriptionNavigation.getByRole('button').nth(1).click();

  await expect(page.getByRole('heading', { name: 'Review submission' })).toBeVisible();
  const reviewNavigation = page.getByTestId('step-four-navigation');
  await expect(reviewNavigation).toBeVisible();
  await expect(reviewNavigation).toHaveClass(/sticky/);
  await expect(reviewNavigation.locator('.k-segmented')).toHaveClass(/border/);
  await expect(reviewNavigation.getByRole('button').nth(1)).toContainText('Submit');
});

test('auto improve menu appears only after three words and leaves options inactive', async ({ page }) => {
  await page.goto('/submit');
  const details = page.locator('#input-details');
  const autoImprove = page.getByRole('button', { name: 'Auto improve' });

  await details.fill('One two');
  await expect(autoImprove).toHaveCount(0);
  await details.fill('One two three.');
  await expect(autoImprove).toBeVisible();
  await expect(autoImprove).toHaveClass(/cursor-pointer/);
  await autoImprove.click();
  await expect(page.getByRole('menu')).toHaveClass(/top-full/);

  const grammarOption = page.getByRole('menuitem', { name: 'Fix grammar and spelling' });
  await expect(grammarOption).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Improve clarity and structure' })).toBeVisible();
  await grammarOption.click();
  await expect(details).toHaveValue('One two three.');
});

test('grammar assistance replaces the description after a successful response', async ({ page }) => {
  let requestBody;
  let releaseResponse;
  await page.route('**/api/assist/grammar', async (route) => {
    requestBody = route.request().postDataJSON();
    await new Promise((resolve) => {
      releaseResponse = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { text: 'There is a meeting tomorrow.' } }),
    });
  });

  await page.goto('/submit');
  const details = page.locator('#input-details');
  await details.fill('Their is a meeting tomorow.');
  await page.getByRole('button', { name: 'Auto improve' }).click();
  await page.getByRole('menuitem', { name: 'Fix grammar and spelling' }).click();

  const loadingMessage = page.getByRole('status').filter({ hasText: 'Fixing grammar and spelling' });
  await expect(loadingMessage).toBeVisible();
  await expect(details).toBeDisabled();
  await expect(page.getByRole('button', { name: /Next/i })).toBeDisabled();
  await expect.poll(() => requestBody).toEqual({ text: 'Their is a meeting tomorow.' });
  releaseResponse();

  await expect(details).toHaveValue('There is a meeting tomorrow.');
  await expect(loadingMessage).toHaveCount(0);
});

test('clarity assistance previews a rewrite and discard preserves the original text', async ({ page }) => {
  let requestData;
  let releaseResponse;
  await page.route('**/api/assist/clarity', async (route) => {
    requestData = {
      method: route.request().method(),
      body: route.request().postDataJSON(),
    };
    await new Promise((resolve) => {
      releaseResponse = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { text: 'A clearer suggested rewrite.' } }),
    });
  });

  await page.goto('/submit');
  const details = page.locator('#input-details');
  const originalText = 'Please improve this crossing for everyone.';
  await details.fill(originalText);
  await page.getByRole('button', { name: 'Auto improve' }).click();
  await page.getByRole('menuitem', { name: 'Improve clarity and structure' }).click();

  const loadingOverlay = page.getByRole('status').filter({ hasText: 'Improving clarity and structure' });
  await expect(loadingOverlay).toBeVisible();
  await expect(details).toBeDisabled();
  await expect(page.getByRole('button', { name: /Next/i })).toBeDisabled();
  await expect.poll(() => requestData).toEqual({ method: 'POST', body: { text: originalText } });
  releaseResponse();

  const dialog = page.getByRole('dialog', { name: 'Accept rewrite of message?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('A clearer suggested rewrite.');
  await expect(details).toHaveValue(originalText);
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details).toHaveValue(originalText);
});

test('applying a clarity rewrite updates the textarea and scrolls Next into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  const rewrite = 'A clear rewrite sentence. '.repeat(120);
  await page.route('**/api/assist/clarity', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { text: rewrite } }),
    });
  });

  await page.goto('/submit');
  const details = page.locator('#input-details');
  await details.fill('Please improve this crossing for everyone.');
  await page.getByRole('button', { name: 'Auto improve' }).click();
  await page.getByRole('menuitem', { name: 'Improve clarity and structure' }).click();

  const dialog = page.getByRole('dialog', { name: 'Accept rewrite of message?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply rewrite' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details).toHaveValue(rewrite);
  await expect(page.getByRole('button', { name: /Next/i })).toBeInViewport();
});

test('auto improve menu opens upward when there is limited space below', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await page.goto('/submit');
  await page.locator('#input-details').fill('A longer description '.repeat(300));

  const scrollContainer = page.locator('.overflow-y-auto').first();
  await scrollContainer.evaluate((container) => {
    container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight - 100);
  });

  await page.getByRole('button', { name: 'Auto improve' }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveClass(/bottom-full/);

  const menuBounds = await menu.evaluate((element) => {
    const container = element.parentElement.closest('.overflow-y-auto').getBoundingClientRect();
    const menu = element.getBoundingClientRect();
    const visibleTop = Math.max(0, container.top);
    const visibleBottom = Math.min(window.innerHeight, container.bottom);
    return {
      topVisible: menu.top >= visibleTop - 1,
      bottomVisible: menu.bottom <= visibleBottom + 1,
    };
  });
  expect(menuBounds).toEqual({ topVisible: true, bottomVisible: true });
});

test('submission uses an AI-generated imperative summary with required limits', async ({ page }) => {
  const detailsText = '  Add a protected bike lane on Oak Street near the library. Include safe crossings at each intersection.  ';
  const generatedSummary = 'Install a protected bike lane on Oak Street near the library.';
  let summaryRequest;
  let suggestionPayload;
  const uploadedFiles = await mockThumbnailUploads(page);

  await page.route('**/api/assist/summarize', async (route) => {
    summaryRequest = {
      method: route.request().method(),
      body: route.request().postDataJSON(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { text: generatedSummary } }),
    });
  });
  await page.route('**/api/public-improvements/suggestions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    suggestionPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'summary-test-suggestion' } }),
    });
  });
  await page.addInitScript((details) => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({
      step: 4,
      details,
      location: { latitude: 32.7767, longitude: -96.797, address: 'Dallas, TX' },
      photos: [{ id: 'existing-photo', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'User photo' }],
      author: { name: 'Test User', email: 'test@example.com' },
    }));
  }, detailsText);

  await page.goto('/submit');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'Submission complete!' })).toBeVisible();
  await expect.poll(() => summaryRequest).toEqual({
    method: 'POST',
    body: {
      text: detailsText.trim(),
      type: 'imperative',
      max_sentences: 1,
      max_characters: 120,
    },
  });
  expect(suggestionPayload.content.summary).toBe(generatedSummary);
  expect(suggestionPayload.content.details).toBe(detailsText.trim());
  expect(suggestionPayload.content.photos.map(({ url }) => url)).toEqual([
    'https://cdn.test/location-diagram.svg',
    'https://cdn.test/photo-1.webp',
  ]);
  expect(suggestionPayload.content.photos[0].caption).toBe('Location diagram');
  expect(suggestionPayload.content.photos[1].caption).toBe('User photo');
  expect(uploadedFiles[0].contentType).toBe('image/svg+xml');
  expect(uploadedFiles[0].body).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
});

test('submission falls back to a 120-character description slice if summary generation fails', async ({ page }) => {
  const detailsText = '  ' + 'Add a protected crossing near the school. '.repeat(5) + '  ';
  let suggestionPayload;
  await mockThumbnailUploads(page);

  await page.route('**/api/assist/summarize', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Summary service unavailable.' }),
    });
  });
  await page.route('**/api/public-improvements/suggestions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    suggestionPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'summary-fallback-suggestion' } }),
    });
  });
  await page.addInitScript((details) => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({
      step: 4,
      details,
      location: { latitude: 32.7767, longitude: -96.797, address: 'Dallas, TX' },
      photos: [],
      author: { name: 'Test User', email: 'test@example.com' },
    }));
  }, detailsText);

  await page.goto('/submit');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'Submission complete!' })).toBeVisible();
  expect(suggestionPayload.content.summary).toBe(detailsText.trim().slice(0, 120));
});

test('speech-to-text recording appends recognized words to the idea', async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      start() {
        window.mockSpeechRecognition = this;
        window.speechStartRequested = true;
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {}
    }

    window.SpeechRecognition = MockSpeechRecognition;
  });

  await page.goto('/submit');
  const details = page.locator('#input-details');
  const recordButton = page.getByRole('button', { name: 'Record' });
  const autoImprove = page.getByRole('button', { name: 'Auto improve' });
  await details.fill('Existing description today');
  await expect(recordButton).toHaveText('Record');
  await expect(autoImprove).toBeVisible();
  await expect(recordButton).toHaveClass(/bg-zinc-100/);
  await recordButton.click();
  const stopButton = page.getByRole('button', { name: 'Stop recording' });
  await expect(autoImprove).toHaveCount(0);
  await expect(stopButton).toHaveClass(/bg-red-600/);
  await expect(stopButton).toHaveClass(/animate-pulse/);
  expect(await page.evaluate(() => window.speechStartRequested)).toBe(true);

  await page.evaluate(() => {
    const button = document.querySelector('#input-details').parentElement.querySelector('button');
    const scrollIntoView = button.scrollIntoView.bind(button);
    window.scrollIntoViewCalls = 0;
    button.scrollIntoView = (...args) => {
      window.scrollIntoViewCalls += 1;
      return scrollIntoView(...args);
    };
  });
  await page.evaluate(() => {
    window.mockSpeechRecognition.onresult({ results: [[{ transcript: 'Short speech.' }]] });
  });
  await expect(details).toHaveValue('Existing description today\nShort speech.');
  expect(await page.evaluate(() => window.scrollIntoViewCalls)).toBe(0);

  const speechText = 'Spoken details. '.repeat(400);
  await page.evaluate((transcript) => {
    window.mockSpeechRecognition.onresult({
      results: [[{ transcript: `Short speech. ${transcript}` }]],
    });
  }, speechText);
  await expect(details).toHaveValue(`Existing description today\nShort speech. ${speechText.trim()}`);
  expect(await page.evaluate(() => window.scrollIntoViewCalls)).toBeGreaterThan(0);
  const textareaLayout = await details.evaluate((textarea) => {
    const container = textarea.closest('.overflow-y-auto');
    const button = textarea.parentElement.querySelector('button');
    const containerBounds = container.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    return {
      contentFits: textarea.scrollHeight <= textarea.clientHeight,
      overflowY: getComputedStyle(textarea).overflowY,
      buttonVisible: buttonBounds.top >= containerBounds.top - 1 && buttonBounds.bottom <= containerBounds.bottom + 1,
    };
  });
  expect(textareaLayout).toEqual({ contentFits: true, overflowY: 'hidden', buttonVisible: true });

  await stopButton.click();
  await expect(recordButton).toBeVisible();
  await expect(recordButton).toHaveClass(/bg-zinc-100/);
  await expect(autoImprove).toBeVisible();
});

test('speech-to-text explains when microphone permission is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({
      step: 3,
      details: 'Test microphone recording permissions.',
    }));
    class MockSpeechRecognition {
      start() {
        this.onerror?.({ error: 'not-allowed' });
      }

      abort() {}
    }

    window.SpeechRecognition = MockSpeechRecognition;
  });

  await page.goto('/submit');
  await page.getByRole('button', { name: 'Record' }).click();
  const microphoneToast = page.getByTestId('microphone-error-toast');
  await expect(microphoneToast).toBeVisible();
  await expect(page.locator('#input-details')).toHaveAttribute(
    'placeholder',
    'If recording is unavailable, tap the text box and use your keyboard’s microphone for dictation.',
  );
  await expect(microphoneToast).toHaveText(
    'Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again.',
  );
  const toastPosition = await microphoneToast.evaluate((element) => ({
    position: getComputedStyle(element).position,
    top: getComputedStyle(element).top,
  }));
  expect(toastPosition).toEqual({ position: 'fixed', top: '16px' });
  await microphoneToast.dispatchEvent('pointerdown', { pointerId: 2, clientX: 120, clientY: 100 });
  await microphoneToast.dispatchEvent('pointerup', { pointerId: 2, clientX: 120, clientY: 20 });
  await expect(microphoneToast).toHaveCount(0);
});

test.describe('Browse Mode - Active Tab and Map View Persistence', () => {
  test('persists active tabs to local storage across page refresh', async ({ page }) => {
    await page.goto('/');

    const streetsTab = page.getByRole('link', { name: 'Streets' });
    const satelliteTab = page.getByRole('link', { name: 'Satellite' });
    const listTab = page.getByRole('link', { name: 'List' });

    await expect(streetsTab).toBeVisible();
    await expect(satelliteTab).toBeVisible();
    await expect(listTab).toBeVisible();

    // Switch to Satellite tab
    await satelliteTab.click();
    let storedTab = await page.evaluate(() => localStorage.getItem('improvement_map_browse_tab'));
    expect(storedTab).toBe('satellite');

    // Reload page and verify Satellite is still stored and active
    await page.reload();
    storedTab = await page.evaluate(() => localStorage.getItem('improvement_map_browse_tab'));
    expect(storedTab).toBe('satellite');

    // Switch to List tab
    await listTab.click();
    await expect(page.getByRole('heading', { name: /Submissions/i })).toBeVisible();
    storedTab = await page.evaluate(() => localStorage.getItem('improvement_map_browse_tab'));
    expect(storedTab).toBe('list');

    // Reload page and verify List tab is still active and visible
    await page.reload();
    await expect(page.getByRole('heading', { name: /Submissions/i })).toBeVisible();
    storedTab = await page.evaluate(() => localStorage.getItem('improvement_map_browse_tab'));
    expect(storedTab).toBe('list');

    // Switch back to Streets tab
    await page.getByRole('link', { name: 'Streets' }).click();
    storedTab = await page.evaluate(() => localStorage.getItem('improvement_map_browse_tab'));
    expect(storedTab).toBe('streets');

    // Reload page and verify Streets tab is still stored
    await page.reload();
    storedTab = await page.evaluate(() => localStorage.getItem('improvement_map_browse_tab'));
    expect(storedTab).toBe('streets');
  });

  test('persists map view on pan/zoom and restores on refresh, and center button clears saved view', async ({ page }) => {
    await page.goto('/');

    // Set a custom map view in local storage simulating user pan/zoom
    const customView = { lat: 37.7749, lng: -122.4194, zoom: 15 };
    await page.evaluate((view) => {
      localStorage.setItem('improvement_map_view', JSON.stringify(view));
    }, customView);

    // Reload page to verify saved view is preserved in localStorage
    await page.reload();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_view')));
    expect(saved).toEqual(customView);

    // Click "Center on my location" button
    const centerBtn = page.getByTitle(/Center on my location/i);
    await expect(centerBtn).toBeVisible();
    await centerBtn.click();

    // Verify saved view is removed from local storage
    const viewAfterCenter = await page.evaluate(() => localStorage.getItem('improvement_map_view'));
    expect(viewAfterCenter).toBeNull();

    // Reload page and verify saved view is still null (default behavior resumed)
    await page.reload();
    const viewAfterReload = await page.evaluate(() => localStorage.getItem('improvement_map_view'));
    expect(viewAfterReload).toBeNull();
  });

  test('persists sort mode and scroll position in Browse > List view', async ({ page }) => {
    await page.goto('/');

    // Go to List tab
    await page.getByRole('link', { name: 'List' }).click();
    await expect(page.getByRole('heading', { name: /Submissions/i })).toBeVisible();

    // Default sort mode is 1 (new)
    let sortMode = await page.evaluate(() => localStorage.getItem('improvement_map_browse_sort'));
    expect(sortMode === '1' || sortMode === null).toBeTruthy();

    // Select "Nearest to me"
    await page.getByText(/Nearest to me/i).click();
    sortMode = await page.evaluate(() => localStorage.getItem('improvement_map_browse_sort'));
    expect(sortMode).toBe('2');

    // Simulate scroll down in list view
    await page.evaluate(() => {
      const listEl = document.querySelector('.bg-slate-300.dark\\:bg-slate-700');
      if (listEl) {
        listEl.scrollTop = 150;
        listEl.dispatchEvent(new Event('scroll'));
      }
    });

    const scrollPos = await page.evaluate(() => localStorage.getItem('improvement_map_browse_list_scroll'));
    expect(Number(scrollPos)).toBeGreaterThan(0);

    // Refresh page and verify sort mode and scroll retention
    await page.reload();
    await expect(page.getByRole('heading', { name: /Submissions/i })).toBeVisible();
    const reloadedSort = await page.evaluate(() => localStorage.getItem('improvement_map_browse_sort'));
    expect(reloadedSort).toBe('2');
  });

  test('persists author name and email across page reload and form reset', async ({ page }) => {
    await page.goto('/submit');

    // Fill in Step 1
    await page.fill('#input-summary', 'Community Garden Setup');
    await page.fill('#input-details', 'Requesting garden plots and water hookups.');
    await page.getByRole('button', { name: /Next/i }).click();

    // Step 2 -> Step 3
    await page.getByRole('button', { name: /Next/i }).click();

    // Step 3 -> Step 4
    await page.getByRole('button', { name: /Next/i }).click();

    // Step 4: Fill in name and email
    await page.fill('#input-author-name', 'Alex Mercer');
    await page.fill('#input-author-email', 'alex@mercer.dev');

    // Verify localStorage author profile
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_author_profile')));
    expect(profile).toEqual({ name: 'Alex Mercer', email: 'alex@mercer.dev' });

    // Refresh page
    await page.reload();

    // Check value directly
    await expect(page.locator('#input-author-name')).toHaveValue('Alex Mercer');
    await expect(page.locator('#input-author-email')).toHaveValue('alex@mercer.dev');
  });

  test('persists infoWindow open state and map view on marker click and clears on infoWindow close', async ({ page }) => {
    await page.goto('/');

    const suggestionId = 'suggestion-test-1';
    await page.evaluate((id) => {
      localStorage.setItem('improvement_map_active_infowindow_suggestion_id', id);
    }, suggestionId);

    // Verify localStorage retains active infowindow id
    let storedActiveId = await page.evaluate(() => localStorage.getItem('improvement_map_active_infowindow_suggestion_id'));
    expect(storedActiveId).toBe('suggestion-test-1');

    // Reload page
    await page.reload();
    storedActiveId = await page.evaluate(() => localStorage.getItem('improvement_map_active_infowindow_suggestion_id'));
    expect(storedActiveId).toBe('suggestion-test-1');

    // Simulate closing infowindow
    await page.evaluate(() => {
      localStorage.removeItem('improvement_map_active_infowindow_suggestion_id');
    });
    storedActiveId = await page.evaluate(() => localStorage.getItem('improvement_map_active_infowindow_suggestion_id'));
    expect(storedActiveId).toBeNull();
  });
});
