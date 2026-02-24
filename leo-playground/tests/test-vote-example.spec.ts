import { expect, test } from "@playwright/test";
import {
  continueLoadExample,
  getExampleButton,
  waitForPageReady,
  waitForTerminalExecution,
} from "./common";

test.skip("#26 test vote example - transition propose", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 12);
  await exampleButton?.click();
  await continueLoadExample(page);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});

test.skip("#27 test vote example - transition new_ticket", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 12);
  await exampleButton?.click();
  await continueLoadExample(page);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});

test.skip("#28 test vote example - transition agree", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 12);
  await exampleButton?.click();
  await continueLoadExample(page);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});

test("#14 test vote example - transition new_ticket", async ({ page }) => {
  await waitForPageReady(page);
  const exampleButton = await getExampleButton(page, 13);
  expect(exampleButton).toBeTruthy();
  await exampleButton!.click();
  await continueLoadExample(page);

  await page.waitForTimeout(5000);

  const hasError = await waitForTerminalExecution(page);

  // console.log("hasError", hasError); // For dev debug
  expect(hasError).toBeFalsy();
});
