import { Locator, Page, expect } from "@playwright/test";

export class EditorArea {
  readonly editor: Locator;
  readonly viewLines: Locator;

  constructor(page: Page) {
    this.editor = page.locator("#tab-editors-area").filter({ visible: true });
    this.viewLines = this.editor.locator(".view-lines");
  }

  async expectEditorFirstLine(expectedText: string) {
    await expect(this.viewLines.first()).toBeVisible();
    await expect(this.viewLines.first()).toHaveText(expectedText);
  }
}
