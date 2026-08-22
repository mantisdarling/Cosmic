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

  test('pushes shards with a mouse click and exposes a burst state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1800);

    const scene = page.locator('[data-anime-three-scene]');
    const hero = page.locator('.hero-container');
    const bounds = await hero.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) return;

    await page.mouse.click(bounds.x + bounds.width * .82, bounds.y + bounds.height * .28);
    await expect(scene).toHaveAttribute('data-burst-count', '1');
  });

  test('supports grabbing and throwing a live energy shard', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1800);

    const scene = page.locator('[data-anime-three-scene]');
    await expect(scene).toHaveAttribute('data-shard-point', /,/);
    const point = await scene.getAttribute('data-shard-point');
    expect(point).not.toBeNull();
    if (!point) return;
    const [x, y] = point.split(',').map(Number);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(scene).toHaveAttribute('data-grabbed', 'true');
    await page.mouse.move(x + 72, y + 38, { steps: 4 });
    await page.mouse.up();

    await expect(scene).toHaveAttribute('data-grabbed', 'false');
    await expect(scene).toHaveAttribute('data-throw-count', '1');
    const burstCount = Number(await scene.getAttribute('data-burst-count'));
    expect(burstCount).toBeGreaterThanOrEqual(2);
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
