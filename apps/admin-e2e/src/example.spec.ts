import { test, expect } from '@playwright/test';

test('app shell loads', async ({ page }) => {
    const response = await page.goto('/');

    // No plugins contribute routes yet — just assert the shell serves.
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('#root')).toBeAttached();
});
