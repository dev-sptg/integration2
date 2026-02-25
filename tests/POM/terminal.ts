import { Locator, Page, expect } from "@playwright/test";

export class Terminal {
  readonly terminal: Locator;
  readonly content: Locator;
  readonly rows: Locator;
  readonly resizer: Locator;
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.terminal = page.locator("#terminal").filter({ visible: true });
    this.content = this.terminal.locator(".xterm-rows");
    this.rows = this.content.locator("> *");
    this.resizer = page.locator(".terminal-resizer");
  }

  async setFocus() {
    await this.content.click();
    const xterm_focus = await this.content.evaluate((el) => el.className);
    //console.log('Terminal content class:', xterm_focus);
    expect(xterm_focus).toBe("xterm-rows xterm-focus");
  }

  async expectTerminalOutput(expected: string) {
    //await expect(this.content).toContainText('Output');
    await expect(this.content).toContainText(expected);
  }

  async waitForExecution() {
    await expect(this.rows.last()).toHaveText("$  ", { timeout: 10000 });
  }

  async resize() {
    const box = await this.resizer.boundingBox();
    if (!box) throw new Error("Element not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX, startY - 255, { steps: 10 });
    await this.page.mouse.up();
  }
}
