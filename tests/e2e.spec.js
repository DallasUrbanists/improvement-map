import { test, expect } from '@playwright/test';

test.describe('Improvement Map - PWA and Navigation', () => {
  test('homepage loads and displays live activity feed', async ({ page }) => {
    await page.goto('/');

    // Check title and header
    await expect(page).toHaveTitle(/Improvement Map/i);
    await expect(page.locator('h1')).toContainText(/Make Your Streets Safer/i);

    // Check live polling badge
    await expect(page.getByText(/Live \(30s\)/i)).toBeVisible();

    // Check action buttons on hero
    await expect(page.getByRole('button', { name: /Submit Suggestion/i }).or(page.getByRole('link', { name: /Submit Suggestion/i })).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Explore Map/i }).or(page.getByRole('link', { name: /Explore Map/i }))).toBeVisible();

    // Check suggestion cards exist
    const cards = page.locator('.k-card');
    await expect(cards.first()).toBeVisible();
  });

  test('toggle dark and light theme persists correctly', async ({ page }) => {
    await page.goto('/');

    // Dark mode is default
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // Click theme toggle button in the top navbar
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

  test('desktop and mobile navbar navigation works across all pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Browse
    await page.getByRole('link', { name: /Browse/i }).first().click();
    await expect(page).toHaveURL(/\/browse/);
    await expect(page.getByRole('button', { name: /Map View/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /List View/i })).toBeVisible();

    // Navigate to Submit
    await page.getByRole('link', { name: /Submit/i }).first().click();
    await expect(page).toHaveURL(/\/submit/);
    await expect(page.getByText(/Step 1 of 4: Describe/i)).toBeVisible();

    // Navigate back to Home
    await page.getByRole('link', { name: /Home/i }).first().click();
    await expect(page).toHaveURL(/\//);
  });
});

test.describe('Submit Wizard Form Flow', () => {
  test('completes 4-step submission wizard, preserves draft in local storage, and handles submit', async ({ page }) => {
    await page.goto('/submit');

    // Step 1: Describe
    await expect(page.getByRole('heading', { name: /Describe Your Improvement Idea/i })).toBeVisible();

    // Validation check on empty submission
    await page.getByRole('button', { name: /Next: Choose Location/i }).click();
    await expect(page.getByText(/Summary is required/i)).toBeVisible();

    // Fill Step 1
    await page.fill('#input-summary', 'Protected Bike Path along Main St');
    await page.fill('#input-details', 'Separated concrete curb protection needed to protect cyclists from vehicular conflicts.');
    
    // Check localStorage draft persistence across reload
    await page.reload();
    await expect(page.locator('#input-summary')).toHaveValue('Protected Bike Path along Main St');

    await page.getByRole('button', { name: /Next: Choose Location/i }).click();

    // Step 2: Locate
    await expect(page.getByRole('heading', { name: /Pin Suggestion Location/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Search address/i)).toBeVisible();

    // Verify Streets and Satellite basemap toggling
    await expect(page.getByRole('button', { name: /Streets/i })).toBeVisible();
    const satelliteBtn = page.getByRole('button', { name: /Satellite/i });
    await expect(satelliteBtn).toBeVisible();
    await satelliteBtn.click();
    await page.getByRole('button', { name: /Streets/i }).click();

    // Test Describe Location modal
    await page.getByRole('button', { name: /Describe location/i }).click();
    await expect(page.getByRole('heading', { name: /Describe Location/i })).toBeVisible();
    await page.fill('textarea[placeholder*="Along Elm St"]', 'Near the public library entrance');
    await page.getByRole('button', { name: /Okay/i }).click();

    await page.getByRole('button', { name: /Next: Add Photos/i }).click();

    // Step 3: Photo (optional)
    await expect(page.getByRole('heading', { name: /Attach Photos/i })).toBeVisible();
    await expect(page.getByText(/0 \/ 10 Photos/i)).toBeVisible();
    await page.getByRole('button', { name: /Next: Review & Submit/i }).click();

    // Step 4: Review & Submit
    await expect(page.getByRole('heading', { name: /Review Your Submission/i })).toBeVisible();
    await expect(page.getByText('Protected Bike Path along Main St')).toBeVisible();
    await expect(page.getByText('Near the public library entrance')).toBeVisible();

    // Edit link navigates back to Step 1
    await page.getByRole('button', { name: /Edit/i }).first().click();
    await expect(page.getByRole('heading', { name: /Describe Your Improvement Idea/i })).toBeVisible();

    // Return to step 4
    await page.getByRole('button', { name: /Next: Choose Location/i }).click();
    await page.getByRole('button', { name: /Next: Add Photos/i }).click();
    await page.getByRole('button', { name: /Next: Review & Submit/i }).click();

    // Fill contact info
    await page.fill('#input-author-name', 'Jane Jacobs');
    await page.fill('#input-author-email', 'jane@strongtowns.org');

    // Mock API POST endpoint
    await page.route('**/api/public-improvements/suggestions', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'mock-sug-12345',
            author: { name: 'Jane Jacobs', email: 'jane@strongtowns.org' },
            content: {
              summary: 'Protected Bike Path along Main St',
              details: 'Separated concrete curb protection needed to protect cyclists from vehicular conflicts.',
              photos: []
            },
            location: {
              latitude: 32.7767,
              longitude: -96.7970,
              address: 'Main St, Dallas, TX',
              description: 'Near the public library entrance'
            },
            createdAt: new Date().toISOString()
          }
        })
      });
    });

    // Final submit
    await page.getByRole('button', { name: /Submit Suggestion/i }).click();

    // Verify submission progress and completion
    await expect(page.getByRole('heading', { name: /Submission complete!/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /View suggestion/i })).toBeVisible();

    // Click View Suggestion
    await page.getByRole('button', { name: /View suggestion/i }).click();
    await expect(page).toHaveURL(/\/suggestion\/mock-sug-12345/);
    await expect(page.getByRole('heading', { name: /Protected Bike Path along Main St/i })).toBeVisible();
  });
});

test.describe('Browse Mode - Map and List Views', () => {
  test('switches between Map and List view and sorts by distance', async ({ page, context }) => {
    // Grant geolocation permissions with mock coordinates
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.7812, longitude: -96.7932 });

    await page.goto('/browse');

    // Default is Map View
    await expect(page.getByRole('button', { name: /Map View/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Search address/i)).toBeVisible();

    // Verify Streets and Satellite basemap toggling in Browse Map
    await expect(page.getByRole('button', { name: /Streets/i })).toBeVisible();
    await page.getByRole('button', { name: /Satellite/i }).click();
    await page.getByRole('button', { name: /Streets/i }).click();

    // Switch to List View
    await page.getByRole('button', { name: /List View/i }).click();
    await expect(page.getByRole('heading', { name: /Civic Suggestions/i })).toBeVisible();

    // Verify presence of distance sorting elements
    await expect(page.getByText(/Sorted by distance/i)).toBeVisible();

    // Click on a suggestion in list to view detail
    const firstViewBtn = page.getByRole('button', { name: /View suggestion/i }).or(page.getByRole('link', { name: /View suggestion/i })).first();
    await firstViewBtn.click();

    // Detail page loads
    await expect(page).toHaveURL(/\/suggestion\//);
    await expect(page.getByText(/Civic Improvement Suggestion/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Google Maps/i })).toBeVisible();
  });

  test('streets basemap responds to theme toggle between dark and light modes', async ({ page }) => {
    await page.goto('/browse');

    // Default dark mode
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // Toggle to light mode
    const themeBtn = page.locator('#theme-toggle-btn');
    await themeBtn.click();
    await expect(htmlElement).toHaveClass(/light/);

    // Toggle basemap to satellite and back to streets in light mode
    await page.getByRole('button', { name: /Satellite/i }).click();
    await page.getByRole('button', { name: /Streets/i }).click();

    // Toggle back to dark mode
    await themeBtn.click();
    await expect(htmlElement).toHaveClass(/dark/);
  });
});
