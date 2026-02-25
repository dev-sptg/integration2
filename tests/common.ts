import { Page, expect } from "@playwright/test";

export const waitForPageReady = async (page: Page) => {
  await page.goto("/");

  // Listen for all console logs
  //   page.on("console", (msg) => console.log(msg.text())); // For dev debug

  await expect(page).toHaveTitle(/Leo Playground/);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await page.waitForFunction(() => !!window.playgroundTerminal);

  // Close walkthrough modal
  if ((await page.locator(".modal-dialog:not(.hidden)").count()) > 0) {
    await page.keyboard.press("Escape");
  }
};

export const waitForTerminalExecution = async (page: Page) => {
  const timeoutMs = Number(
    process.env["PLAYWRIGHT_TERMINAL_TIMEOUT_MS"] ?? 20000
  );
  const startTime = Date.now();

  const terminalInput = page.locator(".xterm textarea").first();
  if ((await terminalInput.count()) > 0) {
    await terminalInput.focus();
  }
  await page.keyboard.press("Enter");

  while (Date.now() - startTime < timeoutMs) {
    if (page.isClosed()) {
      throw new Error(
        "Page was closed while waiting for terminal execution result."
      );
    }

    try {
      const status = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const terminal = window.playgroundTerminal;
        if (!terminal) {
          return "pending";
        }

        terminal.selectAll();
        const text = terminal.getSelection();
        console.log(text);
        if (text.includes("Error")) {
          return "error";
        }

        if (text.includes("Leo ✅ Compiled")) {
          return "success";
        }

        return "pending";
      });

      if (status === "error") {
        return true;
      }

      if (status === "success") {
        return false;
      }
    } catch (error) {
      if (page.isClosed()) {
        throw new Error("Page was closed while reading terminal output.");
      }

      throw error;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    `Terminal execution did not finish within ${timeoutMs}ms. Consider increasing PLAYWRIGHT_TERMINAL_TIMEOUT_MS.`
  );
};

export const getExampleButton = async (page: Page, index: number) => {
  await page.hover("#examples-title");
  const exampleButtons = await page.$$(
    ".dropdown-content.examples-list .example-buttons"
  );
  return exampleButtons?.at(index);
};

export const continueLoadExample = async (page: Page) => {
  await page
    .locator("#modal-dialog-accept-button", { hasText: "Continue" })
    .click();
};
