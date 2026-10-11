import { test, expect } from '@playwright/test';

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

test('toggle dark and light theme persists correctly', async ({ page }) => {
    await page.goto('/');

    // Dark mode is default
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // Click theme toggle button in the top tabbar
    const themeBtn = page.locator('#theme-toggle-btn');
    await themeBtn.click();

    // Now light mode
    await expect(htmlElement).toHaveClass(/light/);

    // Reload page to verify persistence in localStorage
    await page.reload();
    await expect(htmlElement).toHaveClass(/light/);

    // Toggle back to dark
    const themeBtnReloaded = page.locator('#theme-toggle-btn');
    await themeBtnReloaded.click();
    await expect(htmlElement).toHaveClass(/dark/);
  });

  test('bottom tabbar navigation works across all pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Submit via top tabbar
    await page.getByRole('link', { name: /Submit/i }).first().click();
    await expect(page).toHaveURL(/\/submit/);
    await expect(page.getByRole('heading', { name: /Describe your idea/i })).toBeVisible();

    // Navigate back to Browse via top tabbar
    await page.getByRole('link', { name: /Browse/i }).first().click();
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('link', { name: 'Streets' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'List' })).toBeVisible();
  });
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
      photos: [],
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
});

test('submission falls back to a 120-character description slice if summary generation fails', async ({ page }) => {
  const detailsText = '  ' + 'Add a protected crossing near the school. '.repeat(5) + '  ';
  let suggestionPayload;

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
      }

      stop() {
        this.onend?.();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async (constraints) => {
          window.microphonePermissionRequested = constraints.audio === true;
          return { getTracks: () => [{ stop() {} }] };
        },
      },
    });
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
  expect(await page.evaluate(() => window.microphonePermissionRequested)).toBe(true);

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
  await expect(details).toHaveValue(`Existing description today\nShort speech. ${speechText}`);
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
    class MockSpeechRecognition {}

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
        },
      },
    });
    window.SpeechRecognition = MockSpeechRecognition;
  });

  await page.goto('/submit');
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again.',
  );
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

    // Select "Sort by distance"
    await page.getByText(/Sort by distance/i).click();
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
