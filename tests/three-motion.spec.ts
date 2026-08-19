import { test, expect } from '@playwright/test';

test.describe('Cosmic Three.js motion layer', () => {
  test('renders the 3D hero scene on capable desktop pointers', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1800);

    const scene = page.locator('[data-anime-three-scene]');
    const canvas = page.locator('#anime-three-canvas');
    await expect(scene).toBeVisible();
    await expect(canvas).toBeVisible();

    const runtime = await page.evaluate(() => {
      const element = document.querySelector<HTMLCanvasElement>('#anime-three-canvas');
      return { width: element?.width ?? 0, height: element?.height ?? 0 };
    });
    expect(runtime.width).toBeGreaterThan(0);
    expect(runtime.height).toBeGreaterThan(0);
  });

  test('keeps content available and hides 3D decoration on reduced mobile motion', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('.hero-primary')).toBeVisible();
    await expect(page.locator('[data-anime-three-scene]')).toHaveCSS('display', 'none');
  });
});
