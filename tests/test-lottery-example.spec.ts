import { expect, test } from "@playwright/test";
import {
  continueLoadExample,
  getExampleButton,
  waitForPageReady,
  waitForTerminalExecution,
} from "./common";

test("#8 test lottery example - transition play", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 7);
  expect(exampleButton).toBeTruthy();
  await exampleButton!.click();
  await continueLoadExample(page);

  await page.waitForTimeout(5000);

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});
