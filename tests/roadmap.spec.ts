import { test, expect } from '@playwright/test';

test.describe('Roadmap Viewer', () => {
  test('should render roadmap nodes correctly', async ({ page }) => {
    // Go to a known roadmap like frontend
    await page.goto('/roadmap/frontend');
    
    // Check if React Flow is mounted
    const reactFlowContainer = page.locator('.react-flow');
    await expect(reactFlowContainer).toBeVisible();

    // Check if any nodes are rendered
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('should open topic panel when a node is clicked', async ({ page }) => {
    await page.goto('/roadmap/frontend');

    // Wait for nodes to mount
    await page.waitForSelector('.react-flow__node');

    // Click the first valid topic node (not root)
    const firstTopicNode = page.locator('.react-flow__node:not([data-id="frontend-root"])').first();
    await firstTopicNode.click();

    // Verify TopicPanel opens
    const asidePanel = page.locator('aside[role="complementary"]');
    await expect(asidePanel).toBeVisible();
    await expect(asidePanel).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)'); // fully translated to 0
    
    // Check if the tabs are visible
    await expect(page.locator('button:has-text("📄 Content")')).toBeVisible();
    await expect(page.locator('button:has-text("✦ AI Tutor")')).toBeVisible();
    await expect(page.locator('button:has-text("🎯 Quiz")')).toBeVisible();
  });
});
