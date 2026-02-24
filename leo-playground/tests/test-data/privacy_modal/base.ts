import baseURL from "../../../playwright.config";

export const basePrivacyModal = {
  title: "Privacy Policy & Terms of Use",
  content:
    "By continuing to use this website, you accept the Privacy Policy and Terms of Use.",
  privacyLink: {
    name: "Privacy Policy",
    href: "/privacy_policy",
    url: `${baseURL}/privacy_policy`,
  },
  termsLink: {
    name: "Terms of Use",
    href: "/terms_of_use",
    url: `${baseURL}/terms_of_use`,
  },
  acceptButton: {
    name: "Accept",
  },
};
