import { Locator, Page, expect } from "@playwright/test";

/****************************************************************/
/*****    Modal window "Privacy Policy & Terms of Use"      *****/
/****************************************************************/
export class ModalWin {
  readonly modal: Locator;
  readonly title: Locator;
  readonly content: Locator;
  readonly privacyPolicyLink: Locator;
  readonly linkTermsOfUse: Locator;
  readonly acceptButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.modal = page.locator(".modal-dialog").filter({ visible: true });
    this.title = this.modal.locator(".title");
    this.content = this.modal.locator(".content");
    this.privacyPolicyLink = this.content.locator("a").first();
    this.linkTermsOfUse = this.content.locator("a").last();
    //this.AcceptButton = this.modal.locator('.button', { hasText: 'Accept' });
    this.acceptButton = this.modal.locator(".accept");
    this.cancelButton = this.modal.locator(".cancel");
  }

  async expectTitle(expected: string) {
    await expect(this.title).toHaveText(expected);
  }

  async expectContent(expected: string) {
    await expect(this.content).toHaveText(expected);
  }

  async expectPrivacyPolicyLink(expectedName: string, expectedHref: string) {
    await expect(this.privacyPolicyLink).toHaveText(expectedName);
    await expect(this.privacyPolicyLink).toHaveAttribute("href", expectedHref);
  }

  async expectTermsOfUseLink(expectedName: string, expectedHref: string) {
    await expect(this.linkTermsOfUse).toHaveText(expectedName);
    await expect(this.linkTermsOfUse).toHaveAttribute("href", expectedHref);
  }

  async expectAcceptButton(expectedName: string) {
    await expect(this.acceptButton).toHaveText(expectedName);
    await expect(this.acceptButton).toHaveCSS("opacity", "1");
    const rectAcceptButton = await this.acceptButton.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
      };
    });
    expect(rectAcceptButton.width).toBeGreaterThan(0);
    expect(rectAcceptButton.height).toBeGreaterThan(0);
  }

  async expectCancelButton(expectedName: string) {
    await expect(this.cancelButton).toHaveText(expectedName);
    await expect(this.cancelButton).toHaveCSS("opacity", "1");
    const rectCancelButton = await this.cancelButton.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
      };
    });
    expect(rectCancelButton.width).toBeGreaterThan(0);
    expect(rectCancelButton.height).toBeGreaterThan(0);
  }

  async expectCancelButtonHidden() {
    await expect(this.cancelButton).toHaveText("");
    const text = (await this.cancelButton.textContent())?.trim() ?? "";
    expect(text).toBe("");
  }
}

/******************************************************/
/*****    Privacy Policy and Terms of Use pages   *****/
/******************************************************/
export class PrivecyTermsPages {
  readonly page: Page;
  readonly titleH1: Locator;
  readonly titleH2: Locator;
  readonly lastUpdated: Locator;
  readonly headerLinks: Locator;
  readonly linkLogo: Locator;
  readonly linkBack_to_Playground: Locator;
  readonly footer: Locator;
  readonly footerLinks: Locator;
  readonly leoVersionLink: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titleH1 = page.locator("h1").nth(0);
    this.titleH2 = page.locator("h2").nth(0);
    this.lastUpdated = page.locator("p").nth(0);
    this.headerLinks = page.locator("#header-container a");
    this.linkLogo = this.headerLinks.nth(0);
    this.linkBack_to_Playground = this.headerLinks.nth(1);
    this.footer = page.locator("#footer-container").filter({ visible: true });
    this.footerLinks = this.footer.locator("a");
    this.leoVersionLink = this.footerLinks.nth(0);
    this.termsLink = this.footerLinks.nth(1);
    this.privacyLink = this.footerLinks.nth(2);
  }

  async expectURL(expectedURL: string) {
    await expect(this.page).toHaveURL(expectedURL);
  }

  async expectTitle(expected: string) {
    await expect(this.page).toHaveTitle(expected);
  }

  async expectPageToBeVisible() {
    await expect(this.titleH1).toBeVisible();
    await expect(this.titleH2).toBeVisible();
    await expect(this.lastUpdated).toBeVisible();
    await expect(this.linkLogo).toBeVisible();
    await expect(this.linkBack_to_Playground).toBeVisible();
    await expect(this.footer).toBeVisible();
  }

  async expectHeaderLinksCount(expectedCount: number) {
    await expect(this.headerLinks).toHaveCount(expectedCount);
  }

  async expectLinkLogoHref(expectedHref: string) {
    await expect(this.linkLogo).toHaveAttribute("href", expectedHref);
  }

  async expectLinkBackToPlaygroundHref(expectedHref: string) {
    await expect(this.linkBack_to_Playground).toHaveAttribute(
      "href",
      expectedHref
    );
  }

  async expectTitleH1(expected: string) {
    await expect(this.titleH1).toHaveText(expected);
  }

  async expectTitleH2(expected: string) {
    await expect(this.titleH2).toHaveText(expected);
  }

  async expectLastUpdated(expected: string) {
    await expect(this.lastUpdated).toHaveText(expected);
  }

  async expectFooterLinksCount(expectedCount: number) {
    await expect(this.footerLinks).toHaveCount(expectedCount);
  }

  async expectLeoVersionLink(expectedName: string, expectedHref: string) {
    await expect(this.leoVersionLink).toHaveText(expectedName);
    await expect(this.leoVersionLink).toHaveAttribute("href", expectedHref);
  }

  async expectTermsOfUseLink(expectedName: string, expectedHref: string) {
    await expect(this.termsLink).toHaveText(expectedName);
    await expect(this.termsLink).toHaveAttribute("href", expectedHref);
  }

  async expectPrivacyPolicyLink(expectedName: string, expectedHref: string) {
    await expect(this.privacyLink).toHaveText(expectedName);
    await expect(this.privacyLink).toHaveAttribute("href", expectedHref);
  }
}
