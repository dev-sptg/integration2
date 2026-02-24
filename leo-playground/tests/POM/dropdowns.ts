import { Locator, Page } from "@playwright/test";

/****************************************************************/
/*****         Examples dropdown                            *****/
/****************************************************************/
export class ExamplesDropdown {
  readonly title: Locator;
  readonly items: Locator;

  constructor(page: Page) {
    this.title = page.locator("#examples-title");
    this.items = page
      .locator(".examples-list")
      .locator("> *")
      .filter({ visible: true });
  }

  async itemClick(item_name: string) {
    //const item = this.items.filter({ hasText: item_name });
    const item = this.items.getByText(item_name, { exact: true });
    await item.click();
  }
}
