import { test, expect } from '@playwright/test';

test.describe('Roadmap Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('should render roadmap nodes correctly', async ({ page }) => {
    // Go to a known roadmap like frontend
    await page.goto('/roadmap/frontend');
    
    // Wait for nodes to mount
    await page.waitForSelector('.react-flow__node');

    // Check if any nodes are rendered
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThan(0);

    // The route shell must give the React Flow canvas a real viewport height.
    const canvasHeight = await page.locator('.canvas-wrap').evaluate((element) => element.getBoundingClientRect().height);
    expect(canvasHeight).toBeGreaterThan(200);
  });

  test('should open topic panel when a node is clicked', async ({ page }) => {
    await page.goto('/roadmap/frontend');

    // Wait for nodes to mount
    await page.waitForSelector('.react-flow__node');

    // Click the first valid topic node (not root)
    const firstTopicNode = page.locator('.react-flow__node:not([data-id="fe-root"])').first();
    await firstTopicNode.click({ force: true });

    // Verify TopicPanel opens
    const asidePanel = page.locator('aside[role="complementary"]');
    await expect(asidePanel).toBeVisible();
    
    // Check if the tabs are visible
    await expect(page.locator('button:has-text("Content")')).toBeVisible();
    await expect(page.locator('button:has-text("AI Tutor")')).toBeVisible();
    await expect(page.locator('button:has-text("Quiz")')).toBeVisible();
    await expect(page.locator('button:has-text("Challenge")')).toBeVisible();
  });

  test('should reject tampered custom roadmap storage', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('custom_roadmap_data', JSON.stringify({
        id: 'custom',
        title: '<img src=x onerror=alert(1)>',
        description: 'tampered',
        icon: 'x',
        color: '#F5A623',
        nodes: [
          { id: 'root', label: 'Root', parentId: null, status: 'todo', type: 'root' },
          { id: 'child', label: 'Child', parentId: 'missing-parent', status: 'todo', type: 'topic' },
        ],
      }));
    });
    await page.goto('/roadmap/custom');
    await expect(page.getByText('The generated roadmap format was invalid. Please try generating it again.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('custom_roadmap_data'))).toBeNull();
  });

  test('should run an AI coding challenge and persist study notes for a topic', async ({ page }) => {
    let challengeRequests = 0;
    await page.route('**/api/ai', async route => {
      const request = route.request();
      const payload = request.postDataJSON?.() as { action?: string } | null;
      if (payload?.action !== 'challenge') {
        await route.continue();
        return;
      }
      challengeRequests += 1;
      await route.fulfill({
        json: {
          text: JSON.stringify({
            title: 'Normalize a topic queue',
            brief: 'Return the topic labels in a stable order.',
            functionName: 'solve',
            starterCode: 'function solve(items) {\\n  return items.map((item) => item.label);\\n}',
            tests: [
              { input: [[{ label: 'HTML' }, { label: 'CSS' }]], expected: ['HTML', 'CSS'] },
              { input: [[{ label: 'React' }]], expected: ['React'] },
              { input: [[]], expected: [] },
            ],
            hint: 'Map each item to its label.',
          }),
        },
      });
    });

    await page.goto('/roadmap/frontend');
    await page.waitForSelector('.react-flow__node');
    await page.locator('.react-flow__node:not([data-id="fe-root"])').first().click({ force: true });
    await page.getByRole('button', { name: 'Challenge' }).click();
    await expect(page.getByText('Live JavaScript lab')).toBeVisible();
    await page.locator('#challenge-code').fill('function solve(items) { return items.map((item) => item.label); }');
    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(page.locator('[role="status"]')).toContainText('3/3 tests passing');

    await page.getByRole('button', { name: 'Content' }).click();
    const notes = page.locator('#topic-notes');
    await notes.fill('Use map to project each roadmap topic into a label.');
    await page.getByRole('button', { name: 'Close panel' }).click();
    await page.locator('.react-flow__node:not([data-id="fe-root"])').first().click({ force: true });
    await expect(page.locator('#topic-notes')).toHaveValue('Use map to project each roadmap topic into a label.');
    await page.getByRole('button', { name: 'Challenge' }).click();
    await expect(page.getByText('Normalize a topic queue')).toBeVisible();
    expect(challengeRequests).toBe(1);
  });
});
