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
  });
});
