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

  await page.route(/\/api\/interpreter|\/__overpass(?:-kumi)?(?:\?|$)/, (route) => route.fulfill({
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

  await seedDescribe(page);
  await page.goto('/submit');
  const details = page.locator('#input-details');
  await details.fill('One two');
  await expect(page.getByRole('button', { name: 'Auto improve' })).toHaveCount(0);
  await details.fill('Their is a meeting tomorow.');
  await page.getByRole('button', { name: 'Auto improve' }).click();
  await expect(page.getByRole('menuitem', { name: 'Fix grammar and spelling' })).toBeInViewport();
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

  await seedDescribe(page);
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

  await seedDescribe(page);
  await page.goto('/submit');
  const details = page.locator('#input-details');
  await details.fill('Please improve this crossing for everyone.');
  await page.getByRole('button', { name: 'Auto improve' }).click();
  const menu = page.locator('#auto-improve-menu');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  })).toBe(true);
  await page.getByRole('menuitem', { name: 'Improve clarity and structure' }).click();

  const dialog = page.getByRole('dialog', { name: 'Accept rewrite of message?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply rewrite' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details).toHaveValue(rewrite);
  await expect(page.getByRole('button', { name: /Next/i })).toBeInViewport();
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
  // Offline thumbnail generation and photo conversion finish before submission.
  await expect(page.getByRole('heading', { name: 'Submission complete!' })).toBeVisible({ timeout: 15000 });
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

  await seedDescribe(page);
  await page.goto('/submit');
  const details = page.locator('#input-details');
  const recordButton = page.getByRole('button', { name: 'Record' });
  const autoImprove = page.getByRole('button', { name: 'Auto improve' });
  await details.fill('Existing description today');
  await expect(recordButton).toHaveText('Record');
  await expect(autoImprove).toBeVisible();
  await recordButton.click();
  const stopButton = page.getByRole('button', { name: 'Stop recording' });
  await expect(autoImprove).toHaveCount(0);
  expect(await page.evaluate(() => window.speechStartRequested)).toBe(true);

  await page.evaluate(() => {
    window.mockSpeechRecognition.onresult({ results: [[{ transcript: 'Spoken details.' }]] });
  });
  await expect(details).toHaveValue('Existing description today\nSpoken details.');
  await expect(stopButton).toBeInViewport();

  await stopButton.click();
  await expect(recordButton).toBeVisible();
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
  await expect(page.locator('#input-details')).toBeEditable();
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


async function seedDescribe(page) {
  await page.addInitScript(() => localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({
    step: 3, details: '', photos: [], location: { latitude: 32.78, longitude: -96.8, address: 'Dallas, TX' },
  })));
}
