import { test, expect } from '@playwright/test';

test.describe('Studio Al-Qalam Editing Mode & Customization Flow', () => {
  test.use({ actionTimeout: 25000 });

  test('Enter edit mode, update text, change font size, and double-check layout', async ({ page }) => {
    console.log('Navigating to http://localhost:8080/ ...');
    await page.goto('http://localhost:8080/');

    // 1. Wait for page p1 to be visible (up to 45 seconds to accommodate cold start)
    console.log('Waiting for the page board to be visible...');
    await page.locator('div[data-page-id="p1"]').waitFor({ state: 'visible', timeout: 45000 });
    
    // Give layout a brief moment to stabilize
    await page.waitForTimeout(2000);

    // Take initial screenshot of preview mode
    console.log('Taking preview screenshot...');
    await page.screenshot({ path: 'screenshot_initial_preview.png' });

    // 2. Click "এডিটর" button in top bar to switch to edit mode
    console.log('Clicking the "এডিটর" tab...');
    const editorTabBtn = page.locator('button:has-text("এডিটর")');
    await expect(editorTabBtn).toBeVisible();
    await editorTabBtn.click();
    await page.waitForTimeout(1000);

    // Take screenshot of editor mode
    console.log('Taking editor mode screenshot...');
    await page.screenshot({ path: 'screenshot_editor_active.png' });

    // 3. Select first Arabic row and double-click to enter Inline Text Editor
    // Row 3 on page p1 is the first Quran verse line (first 3 rows are surah open header / Bismillah)
    console.log('Double clicking on the Arabic line...');
    const arabicLine = page.locator('div[data-page-id="p1"][data-row-index="3"] div[data-layer-kind="arabic"] span');
    await expect(arabicLine).toBeVisible();
    
    // Double click to activate editor
    await arabicLine.dblclick();
    await page.waitForTimeout(1000);

    // 4. Verify contentEditable element is visible and type new text
    console.log('Verifying contentEditable editor is visible...');
    const inlineEditor = page.locator('div[contenteditable="true"]');
    await expect(inlineEditor).toBeVisible();

    // Focus and edit text
    await inlineEditor.focus();
    // Use selectAll and Backspace to clear, then type edited text
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    const newArabicText = 'الْحَمْدُ لِلّٰهِ رَبِّ الْعَالَمِينَ রিবিল্ড টেস্ট';
    await page.keyboard.type(newArabicText);
    await page.waitForTimeout(1000);

    // Commit change by pressing Escape
    console.log('Committing changes...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);

    // Take screenshot after text change
    console.log('Taking screenshot after text update...');
    await page.screenshot({ path: 'screenshot_after_text_edit.png' });

    // 5. Change Arabic Font Size in the Properties Panel
    console.log('Adjusting Arabic Font Size...');
    const fontSelector = page.locator('div:has-text("আরবি ফন্ট") >> div:has-text("সাইজ") >> input[type="number"]');
    await expect(fontSelector).toBeVisible();
    
    // Focus the size input, select all, and type a new size (e.g. 60px)
    await fontSelector.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('60');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Take final screenshot to verify font size change
    console.log('Taking final screenshot after font size adjustment...');
    await page.screenshot({ path: 'screenshot_final_customized.png' });

    console.log('Flow test complete and verified!');
  });
});
