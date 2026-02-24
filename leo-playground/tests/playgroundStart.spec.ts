import { expect, test } from "@playwright/test";
import { playground_open } from "./helpers/pg_open";
import { ModalWin, PrivecyTermsPages } from "./POM/privacy_terms";
import {
  privacyModalData,
  privacyPageData,
  termsPageData,
  welcomeModalData,
} from "./test-data/privacy_modal";

test.describe("Playground Start", () => {
  test("Privacy Policy and Terms of Use window", async ({ page }) => {
    await playground_open(page);
    const privacyModal = new ModalWin(page);
    await expect(privacyModal.modal).toBeVisible();
    await expect(privacyModal.title).toBeVisible();
    await expect(privacyModal.content).toBeVisible();
    await expect(privacyModal.privacyPolicyLink).toBeVisible();
    await expect(privacyModal.linkTermsOfUse).toBeVisible();
    await expect(privacyModal.acceptButton).toBeVisible();
    await privacyModal.expectTitle(privacyModalData.title);
    await privacyModal.expectContent(privacyModalData.content);
    await privacyModal.expectPrivacyPolicyLink(
      privacyModalData.privacyLink.name,
      privacyModalData.privacyLink.href
    );
    await privacyModal.expectTermsOfUseLink(
      privacyModalData.termsLink.name,
      privacyModalData.termsLink.href
    );

    await privacyModal.expectAcceptButton(privacyModalData.acceptButton.name);
    await privacyModal.expectCancelButtonHidden();

    // Click on "Privacy Policy" link and verify that "Privacy Policy" page is opened in new tab
    const [Tab2] = await Promise.all([
      page.waitForEvent("popup"),
      await privacyModal.privacyPolicyLink.click(),
    ]);
    const privacyPage = new PrivecyTermsPages(Tab2);
    await privacyPage.expectPageToBeVisible();
    await privacyPage.expectURL(privacyPageData.url);
    await privacyPage.expectTitle(privacyPageData.title);
    await privacyPage.expectHeaderLinksCount(privacyPageData.headerLinks.count);
    await privacyPage.expectLinkLogoHref(privacyPageData.headerLinks.logo.href);
    await privacyPage.expectLinkBackToPlaygroundHref(
      privacyPageData.headerLinks.backToPlayground.href
    );
    await privacyPage.expectTitleH1(privacyPageData.titleH1);
    await privacyPage.expectTitleH2(privacyPageData.titleH2);
    await privacyPage.expectLastUpdated(privacyPageData.lastUpdated);
    await privacyPage.expectFooterLinksCount(privacyPageData.footerLinks.count);
    await privacyPage.expectLeoVersionLink(
      privacyPageData.footerLinks.leoVersion.name,
      privacyPageData.footerLinks.leoVersion.href
    );
    await privacyPage.expectTermsOfUseLink(
      privacyPageData.footerLinks.termsOfUse.name,
      privacyPageData.footerLinks.termsOfUse.href
    );
    await privacyPage.expectPrivacyPolicyLink(
      privacyPageData.footerLinks.privacyPolicy.name,
      privacyPageData.footerLinks.privacyPolicy.href
    );
    await Tab2.close();

    // Click on "Terms of Use" link and verify that "Terms of Use" page is opened in new tab
    const [Tab3] = await Promise.all([
      page.waitForEvent("popup"),
      await privacyModal.linkTermsOfUse.click(),
    ]);
    const termsPage = new PrivecyTermsPages(Tab3);
    await termsPage.expectPageToBeVisible();
    await termsPage.expectURL(termsPageData.url);
    await termsPage.expectTitle(termsPageData.title);
    await termsPage.expectHeaderLinksCount(termsPageData.headerLinks.count);
    await termsPage.expectLinkLogoHref(termsPageData.headerLinks.logo.href);
    await termsPage.expectLinkBackToPlaygroundHref(
      termsPageData.headerLinks.backToPlayground.href
    );
    await termsPage.expectTitleH1(termsPageData.titleH1);
    await termsPage.expectTitleH2(termsPageData.titleH2);
    await termsPage.expectLastUpdated(termsPageData.lastUpdated);
    await termsPage.expectFooterLinksCount(termsPageData.footerLinks.count);
    await termsPage.expectLeoVersionLink(
      termsPageData.footerLinks.leoVersion.name,
      termsPageData.footerLinks.leoVersion.href
    );
    await termsPage.expectTermsOfUseLink(
      termsPageData.footerLinks.termsOfUse.name,
      termsPageData.footerLinks.termsOfUse.href
    );
    await termsPage.expectPrivacyPolicyLink(
      termsPageData.footerLinks.privacyPolicy.name,
      termsPageData.footerLinks.privacyPolicy.href
    );
    await Tab3.close();

    await privacyModal.acceptButton.click();
  });

  test("Welcome modal is displayed on first visit", async ({ page }) => {
    await playground_open(page);
    const privacyModal = new ModalWin(page);
    await privacyModal.expectAcceptButton(privacyModalData.acceptButton.name);
    await privacyModal.acceptButton.click();

    const welcomeModal = new ModalWin(page);
    await welcomeModal.expectTitle(welcomeModalData.title);
    await welcomeModal.expectContent(welcomeModalData.content);
    await welcomeModal.expectAcceptButton(welcomeModalData.acceptButton.name);
    await welcomeModal.expectCancelButton(welcomeModalData.cancelButton.name);
    await welcomeModal.cancelButton.click();
  });
});
