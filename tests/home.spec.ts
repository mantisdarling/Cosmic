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

  test('should clear combined search and Favorites filters', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#search-input');
    const favoritesButton = page.locator('#favorites-filter-btn');
    await searchInput.fill('python');
    await favoritesButton.click();

    const clearButton = page.locator('#clear-filters');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    await expect(searchInput).toHaveValue('');
    await expect(favoritesButton).toHaveAttribute('aria-pressed', 'false');
    await expect(clearButton).not.toBeVisible();
    await expect(page.locator('#role-count')).toHaveText('15 roadmaps');
  });

  test('should open keyboard shortcuts modal on pressing ?', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Press '?'
    await page.keyboard.press('?');
    
    // Check modal visibility
    const modalHeading = page.locator('h2:has-text("Keyboard Shortcuts")');
    await expect(modalHeading).toBeVisible();
    
    // Press 'Escape' to close
    await page.keyboard.press('Escape');
    await expect(modalHeading).not.toBeVisible();
  });

  test('should launch the Frostwarden circuit and cast an ice ability', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#frost-heading')).toContainText('Frostwarden: Frostbound Circuit');
    await expect(page.locator('.frost-roster-card.frost')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#frostbound-canvas')).toBeVisible();

    await page.locator('#frost-launch').click();
    await expect(page.locator('#frost-status')).toContainText('Circuit live');

    await page.locator('#frostbound-arena').focus();
    await page.keyboard.press('2');
    await expect(page.locator('#frost-status')).toContainText('Glacial Lock');
  });

  test('should open AI generator panel and successfully redirect to custom roadmap', async ({ page }) => {
    // Intercept /api/ai and mock custom roadmap response
    await page.route('**/api/ai', async route => {
      const json = {
        text: JSON.stringify({
          id: 'test-custom',
          title: 'Test Custom Roadmap',
          description: 'A mock roadmap generated for testing',
          icon: '🚀',
          color: '#F5A623',
          nodes: [
            { id: 'test-root', label: 'Test Root Node', parentId: null, status: 'todo', type: 'root' },
            { id: 'test-sub1', label: 'Test Sub Node 1', parentId: 'test-root', status: 'todo', type: 'topic' }
          ]
        })
      };
      await route.fulfill({ json });
    });

    await page.goto('/');

    // Click "Generate with AI" button
    const generateBtn = page.locator('#ai-generate-btn');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Verify panel appears
    const aiPanel = page.locator('#ai-generator-panel');
    await expect(aiPanel).toBeVisible();

    // Type a topic and submit
    const topicInput = page.locator('#ai-topic-input');
    await topicInput.fill('Quantum Coding');
    const submitBtn = page.locator('#ai-submit-btn');
    await submitBtn.click();

    // Verify it redirects to /roadmap/custom and shows the custom roadmap
    await page.waitForURL('**/roadmap/custom');
    await expect(page.locator('#custom-header-title')).toContainText('Test Custom Roadmap');

    // Verify custom nodes render in React Flow
    await expect(page.locator('.react-flow__node:has-text("Test Root Node")')).toBeVisible();
  });
});
