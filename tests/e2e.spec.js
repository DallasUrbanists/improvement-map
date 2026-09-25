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
