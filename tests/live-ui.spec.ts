import { test, expect } from '@playwright/test';

test.describe('Studio Al-Qalam Live UI Tests', () => {
  // Slow down the test a bit so the user can see what's happening
  test.use({ actionTimeout: 20000 });

  test.beforeEach(async ({ page }) => {
    console.log('Navigating to dev server...');
    await page.goto('http://localhost:8080/');
    // Wait for the loading indicator to disappear (up to 25 seconds)
    await page.locator('text=লোড হচ্ছে…').waitFor({ state: 'hidden', timeout: 25000 }).catch(() => {});
    // Give an extra second for layout stabilization
    await page.waitForTimeout(1500);
  });

  test('Panel Toggle and Resize Visual Test', async ({ page }) => {
    // Left panel toggle
    const leftToggle = page.locator('button[title*="পেজ তালিকা"]');
    if (await leftToggle.isVisible()) {
      await leftToggle.click();
      await page.waitForTimeout(1000); // Visual pause
      await leftToggle.click();
      await page.waitForTimeout(1000);
    }

    // Resize divider drag
    const divider = page.locator('div[role="separator"]').first();
    if (await divider.isVisible()) {
      const box = await divider.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        // Drag it 150px to the right
        await page.mouse.move(box.x + 150, box.y + box.height / 2, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(1500); // Let the user see the resize
      }
    }
  });

  test('History Delete Test', async ({ page }) => {
    const historyBtn = page.locator('button[title="পরিবর্তনের ইতিহাস"]');
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await page.waitForTimeout(1000);
      
      const deleteBtn = page.locator('button:has-text("মুছুন")');
      if (await deleteBtn.isVisible()) {
        page.once('dialog', dialog => dialog.accept());
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        await expect(page.locator('text=কোনো ইতিহাস নেই')).toBeVisible();
      }
      // Close history
      await historyBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Reset All Overrides Test', async ({ page }) => {
    const propsTab = page.locator('button:has-text("প্রপার্টিজ")');
    if (await propsTab.isVisible()) {
      await propsTab.click();
      await page.waitForTimeout(500);
    }

    const resetBtn = page.locator('button:has-text("সব রিসেট করুন")');
    if (await resetBtn.isVisible()) {
      page.once('dialog', dialog => dialog.accept());
      await resetBtn.click();
      
      // Look for the loading overlay
      const loading = page.locator('text=রিসেট হচ্ছে…');
      await expect(loading).toBeVisible();
      await expect(loading).toBeHidden({ timeout: 15000 }); // Should disappear after rebuild
    }
  });
});
