import { expect, test } from "@playwright/test";
import {
  continueLoadExample,
  getExampleButton,
  waitForPageReady,
  waitForTerminalExecution,
} from "./common";

test("#1 test auction example - transition place_bid", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 0);
  expect(exampleButton).toBeTruthy();
  await exampleButton!.click();
  await continueLoadExample(page);

  await page.waitForTimeout(5000);

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});
