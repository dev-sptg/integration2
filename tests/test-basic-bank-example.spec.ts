import { expect, test } from "@playwright/test";
import {
  continueLoadExample,
  getExampleButton,
  waitForPageReady,
  waitForTerminalExecution,
} from "./common";

test("#2 test basic bank example - transition issue", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 1);
  expect(exampleButton).toBeTruthy();
  await exampleButton!.click();
  await continueLoadExample(page);

  await page.waitForTimeout(5000);

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});
