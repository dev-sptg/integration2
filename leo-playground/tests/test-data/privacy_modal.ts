//import { ENV } from '../test-data/env';
//import { url } from 'node:inspector';
import baseURL from "../../playwright.config";
//import { count } from 'node:console';

export const privacyModalData = {
  title: "Privacy Policy & Terms of Use",
  content:
    "By continuing to use this website, you accept the Privacy Policy and Terms of Use.",
  privacyLink: {
    name: "Privacy Policy",
    href: "/privacy_policy",
    //url: `${pgURL}/privacy_policy`,
  },
  termsLink: {
    name: "Terms of Use",
    href: "/terms_of_use",
    //url: `${pgURL}/terms_of_use`,
  },
  acceptButton: {
    name: "Accept",
  },
};

export const privacyPageData = {
  url: `${baseURL.use?.baseURL}/privacy_policy`,
  //pg_url: baseURL,
  title: "Leo Playground",
  titleH1: "Provable Privacy Notice",
  titleH2: "Our Collection and Use of Personal Data",
  lastUpdated: "Last Updated: August 14, 2025",
  headerLinks: {
    count: 2,
    logo: {
      href: "https://leo-lang.org",
      img: {
        alt: "header-logo",
        src: "https://leo-lang.org/assets/logo.png",
      },
    },
    backToPlayground: { name: "Back to Playground", href: "./" },
  },
  footerLinks: {
    count: 7,
    leoVersion: {
      name: "Leo v.3.5.0",
      href: "https://github.com/ProvableHQ/leo",
    },
    privacyPolicy: { name: "Privacy Policy", href: "./privacy_policy" },
    termsOfUse: { name: "Terms of Use", href: "./terms_of_use" },
  },
};

export const termsPageData = {
  url: `${baseURL.use?.baseURL}/terms_of_use`,
  title: "Leo Playground",
  titleH1: "PROVABLE",
  titleH2: "Terms of Use",
  lastUpdated: "Last Modified: 8/19/2024",
  headerLinks: {
    count: 2,
    logo: {
      href: "https://leo-lang.org",
      img: {
        alt: "header-logo",
        src: "https://leo-lang.org/assets/logo.png",
      },
    },
    backToPlayground: { name: "Back to Playground", href: "./" },
  },
  footerLinks: {
    count: 7,
    leoVersion: {
      name: "Leo v.3.5.0",
      href: "https://github.com/ProvableHQ/leo",
    },
    privacyPolicy: { name: "Privacy Policy", href: "./privacy_policy" },
    termsOfUse: { name: "Terms of Use", href: "./terms_of_use" },
  },
};

export const welcomeModalData = {
  title: "Welcome to the Leo Playground!",
  content:
    "Leo is a statically-typed programming language built for writing private applications. It provides developers with familiar programming paradigms and powerful cryptographic primitives. Here you can try Leo and deploy and execute programs directly from the browser!",

  cancelButton: {
    name: "Skip",
  },

  acceptButton: {
    name: "Learn More",
  },
};
