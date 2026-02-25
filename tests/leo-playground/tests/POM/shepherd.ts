import { Locator, Page, expect } from '@playwright/test';
export class SHEPHERD {
  readonly shepherd: Locator;
  readonly arrow: Locator;
  readonly header: Locator;
  readonly title: Locator;
  readonly footer: Locator;
  readonly nextButton: Locator;
  readonly understoodButton: Locator;
  readonly shepherd_icon: Locator;
  readonly activityBar: Locator;
  readonly shepherd_target: Locator;
  
  constructor(page: Page) {
    this.shepherd = page.locator('.shepherd-has-title.shepherd-element.onboarding.shepherd-enabled').filter({visible:true});
    this.arrow = this.shepherd.locator('.shepherd-arrow').filter({ visible: true });
    this.header = this.shepherd.locator('.shepherd-header').filter({ visible: true });
    this.title = page.locator('.shepherd-title').filter({ visible: true });
    this.footer = page.locator('.shepherd-footer').filter({ visible: true });
    this.nextButton = this.footer.getByText('Next');
    this.understoodButton = this.footer.getByText('Understood');
    this.activityBar = page.locator('#activity-bar');
    this.shepherd_icon = this.activityBar.locator('.tab-item.shepherd-target').filter({ visible: true });
    this.shepherd_target = page.locator('.shepherd-target').filter({ visible: true });
  }

    /** Assert: Shepherd title */
  async expectShepherdTitle(expected: string) {
    await expect(this.title).toHaveText(expected);
  



  }

    /** Assert: Shepherd target */
  async expectShepherdTarget( target: string ) {
    const count = await this.shepherd_icon.count();
    //expect icon of shepherd target
    if (count == 1) {
      await expect(this.shepherd_icon).toBeVisible();
      const content = await this.shepherd_icon.evaluate(el =>
        getComputedStyle(el, '::before').content
      );
      const char = content.replace(/"/g, '');
      const actualHex = char.codePointAt(0)?.toString(16);
      expect(actualHex).toBe(target.toLowerCase());
      //console.log(`Shepherd target codicon: ${actualHex}, expected: ${target}`);
    } else {
      await expect(this.shepherd_icon).toHaveCount(0);
      await expect(this.shepherd_target).toContainText(target);
      //console.log(`Expected Shepherd target: ${target}`)
    }  
  }
}