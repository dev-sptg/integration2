import { expect, test } from "@playwright/test";
import {
  continueLoadExample,
  getExampleButton,
  waitForPageReady,
  waitForTerminalExecution,
} from "./common";

test("#10 test simple token example - transition mint", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 9);
  expect(exampleButton).toBeTruthy();
  await exampleButton!.click();
  await continueLoadExample(page);

  await page.waitForTimeout(5000);

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});
