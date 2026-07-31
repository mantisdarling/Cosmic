import { test, expect } from '@playwright/test';

test.describe('Cosmic Home Page', () => {
  test('should load the homepage with expected titles', async ({ page }) => {
    await page.goto('/');
    
    // Check main headings
    await expect(page.locator('h1')).toContainText('Developer Roadmaps');
    
    // Check search placeholder
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search roadmaps — frontend, python, devops…');
  });

  test('should filter roadmaps using the search bar', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('#search-input');
    await searchInput.fill('python');
    
    // Wait for the UI to update
    await page.waitForTimeout(100);
    
    // Verify count shows a result
    const searchCount = page.locator('#search-count');
    await expect(searchCount).not.toBeEmpty();
    await expect(searchCount).toContainText('found');
  });

  test('should open keyboard shortcuts modal on pressing ?', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React to hydrate
    await page.waitForTimeout(1000);
    
    // Press '?'
    await page.keyboard.press('?');
    
    // Check modal visibility
    const modalHeading = page.locator('h2:has-text("Keyboard Shortcuts")');
    await expect(modalHeading).toBeVisible();
    
    // Press 'Escape' to close
    await page.keyboard.press('Escape');
    await expect(modalHeading).not.toBeVisible();
  });
});
