import { expect, Page, test } from "@playwright/test";
import { ModalWin } from "../POM/privacy_terms";

export async function playground_open(page: Page) {
  test.setTimeout(60000);
  await page.goto("/");
  const spinner = page.locator("#cover-spinner");
  await expect(spinner).toBeVisible();
  await spinner.waitFor({ state: "hidden" });
}

export async function playground_full_open(page: Page) {
  test.setTimeout(60000);
  await page.goto("/");
  const spinner = page.locator("#cover-spinner");
  await expect(spinner).toBeVisible();
  await spinner.waitFor({ state: "hidden" });

  const modalWin = new ModalWin(page);
  await expect(modalWin.acceptButton).toHaveText("Accept");
  await modalWin.acceptButton.click();
  await expect(modalWin.cancelButton).toHaveText("Skip");
  await modalWin.cancelButton.click();
}
