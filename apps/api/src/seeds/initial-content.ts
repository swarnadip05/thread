import type { ContentPageRecord } from "../models/content-page.model.js";
import { storefrontMedia } from "@thread/types";

type SeedPage = Omit<ContentPageRecord, "createdAt" | "updatedAt">;

export const initialBusinessSettings = {
  brandName: "THREAD",
  legalName: "SNAP CART",
  addressLine1: "AB01 ADHARSHAPALLY ROAD",
  locality: "NEW TOWN",
  district: "NORTH 24 PARGANAS",
  city: "KOLKATA",
  postalCode: "700159",
  state: "WEST BENGAL",
  country: "India",
  phone: "+91 9073661067",
  whatsappNumber: "919073661067",
  email: "threadfashion.shop@gmail.com",
  gstin: "19FCSPM9252D1ZZ",
  foundedYear: 2025,
} as const;

export const initialNavigation = [
  {
    id: "men",
    label: "MEN",
    audience: "men" as const,
    active: true,
    sortOrder: 10,
    promotionalTile: {
      label: "Shop men's T-shirts",
      imageUrl: storefrontMedia.menMenu.src,
      alt: storefrontMedia.menMenu.alt,
      href: "/men",
    },
    groups: [
      {
        id: "men-topwear",
        heading: "Topwear",
        links: [
          { id: "men-tshirts", label: "T-Shirts", href: "/category/t-shirts?audience=men" },
          {
            id: "men-oversized",
            label: "Oversized T-Shirts",
            href: "/category/oversized-t-shirts?audience=men",
          },
          {
            id: "men-classic",
            label: "Classic Fit T-Shirts",
            href: "/category/classic-fit-t-shirts?audience=men",
          },
        ],
      },
      {
        id: "men-help",
        heading: "Find your fit",
        links: [
          { id: "men-size", label: "Size Guide", href: "/size-guide" },
          { id: "men-care", label: "Product Care", href: "/faq#product-care" },
        ],
      },
    ],
  },
  {
    id: "women",
    label: "WOMEN",
    audience: "women" as const,
    active: true,
    sortOrder: 20,
    promotionalTile: {
      label: "Shop women's T-shirts",
      imageUrl: storefrontMedia.womenMenu.src,
      alt: storefrontMedia.womenMenu.alt,
      href: "/women",
    },
    groups: [
      {
        id: "women-topwear",
        heading: "Topwear",
        links: [
          { id: "women-tshirts", label: "T-Shirts", href: "/category/t-shirts?audience=women" },
          {
            id: "women-classic",
            label: "Classic Fit T-Shirts",
            href: "/category/classic-fit-t-shirts?audience=women",
          },
        ],
      },
      {
        id: "women-help",
        heading: "Need help?",
        links: [
          { id: "women-size", label: "Size Guide", href: "/size-guide" },
          { id: "women-returns", label: "Returns & Exchanges", href: "/returns-exchanges" },
        ],
      },
    ],
  },
  {
    id: "accessories",
    label: "ACCESSORIES",
    audience: "accessories" as const,
    active: true,
    sortOrder: 30,
    groups: [
      {
        id: "accessories-explore",
        heading: "Explore",
        links: [
          { id: "accessories-about", label: "About THREAD", href: "/about" },
          { id: "accessories-faq", label: "FAQ", href: "/faq" },
        ],
      },
      {
        id: "accessories-support",
        heading: "Support",
        links: [
          { id: "accessories-contact", label: "Contact Us", href: "/contact" },
          { id: "accessories-shipping", label: "Shipping & Delivery", href: "/shipping-delivery" },
        ],
      },
    ],
  },
] as const;

export const initialFooterGroups = [
  {
    id: "support",
    title: "Support",
    links: [
      { id: "contact", label: "Contact Us", href: "/contact" },
      { id: "faq", label: "FAQ", href: "/faq" },
      { id: "shipping", label: "Shipping & Delivery", href: "/shipping-delivery" },
      { id: "returns", label: "Returns & Exchanges", href: "/returns-exchanges" },
      { id: "size-guide", label: "Size Guide", href: "/size-guide" },
    ],
  },
  {
    id: "company",
    title: "Company",
    links: [
      { id: "about", label: "About THREAD", href: "/about" },
      { id: "privacy", label: "Privacy Policy", href: "/privacy-policy" },
      { id: "terms", label: "Terms & Conditions", href: "/terms-conditions" },
    ],
  },
  {
    id: "shop",
    title: "Shop",
    links: [
      { id: "men", label: "Men", href: "/men" },
      { id: "women", label: "Women", href: "/women" },
      { id: "accessories", label: "Accessories", href: "/accessories" },
    ],
  },
] as const;

const page = (input: SeedPage): SeedPage => input;
export const initialContentPages: readonly SeedPage[] = [
  page({
    slug: "about",
    title: "About THREAD",
    eyebrow: "THREAD / SNAP CART",
    summary:
      "THREAD is a local fashion brand operated by SNAP CART in Kolkata and founded in 2025.",
    active: true,
    needsClientReview: false,
    reviewNotes: [],
    sections: [
      {
        id: "identity",
        heading: "Our identity",
        paragraphs: ["THREAD is operated by SNAP CART from New Town, Kolkata, West Bengal."],
        items: [],
      },
      {
        id: "contact",
        heading: "Business information",
        paragraphs: [
          "SNAP CART trades as THREAD. The legal business and contact details shown on this site are available in the footer and Contact page.",
        ],
        items: [],
      },
    ],
  }),
  page({
    slug: "contact",
    title: "Contact Us",
    eyebrow: "Customer support",
    summary:
      "Contact THREAD by phone, email or WhatsApp. Our support target is to reply within 24 hours, Monday–Friday.",
    active: true,
    needsClientReview: false,
    reviewNotes: [],
    sections: [
      {
        id: "support",
        heading: "How can we help?",
        paragraphs: [
          "Use the contact actions on this page for order questions, product information or general support.",
        ],
        items: [],
      },
    ],
  }),
  page({
    slug: "faq",
    title: "Frequently Asked Questions",
    eyebrow: "Help centre",
    summary:
      "Answers based on THREAD’s current shipping, returns, order-change and product-care information.",
    active: true,
    needsClientReview: false,
    reviewNotes: [],
    sections: [
      {
        id: "shipping",
        heading: "How long does delivery take?",
        paragraphs: [
          "Domestic shipping normally takes 3–7 business days. International shipping normally takes 7–21 business days, and customs or import charges remain the customer’s responsibility.",
        ],
        items: [],
      },
      {
        id: "changes",
        heading: "Can I change or cancel an order?",
        paragraphs: [
          "Request an order change or cancellation within one hour of placing the order, when fulfilment has not begun.",
        ],
        items: [],
      },
      {
        id: "returns",
        heading: "Can I return or exchange an item?",
        paragraphs: [
          "Unworn and unwashed items may be requested for return or exchange within seven days of delivery.",
        ],
        items: [],
      },
      {
        id: "product-care",
        heading: "How should I care for my item?",
        paragraphs: [
          "Wash inside out in cold water, hang dry or tumble dry on low heat, and never iron directly over a print.",
        ],
        items: [],
      },
    ],
  }),
  page({
    slug: "shipping-delivery",
    title: "Shipping & Delivery",
    eyebrow: "Delivery information",
    summary: "Current normal delivery windows for domestic and international THREAD orders.",
    active: true,
    needsClientReview: false,
    reviewNotes: [],
    sections: [
      {
        id: "domestic",
        heading: "Domestic shipping",
        paragraphs: ["Domestic shipping normally takes 3–7 business days."],
        items: [],
      },
      {
        id: "international",
        heading: "International shipping",
        paragraphs: [
          "International shipping normally takes 7–21 business days. Customs and import charges remain the customer’s responsibility.",
        ],
        items: [],
      },
      {
        id: "support",
        heading: "Need help?",
        paragraphs: ["Customer support aims to reply within 24 hours, Monday–Friday."],
        items: [],
      },
    ],
  }),
  page({
    slug: "returns-exchanges",
    title: "Returns & Exchanges",
    eyebrow: "Returns information",
    summary: "Current eligibility and timing for return or exchange requests.",
    active: true,
    needsClientReview: false,
    reviewNotes: [],
    sections: [
      {
        id: "eligibility",
        heading: "Eligibility",
        paragraphs: [
          "Unworn and unwashed items may be requested for return or exchange within seven days of delivery.",
        ],
        items: [],
      },
      {
        id: "order-changes",
        heading: "Order changes and cancellation",
        paragraphs: [
          "Request a change or cancellation within one hour of placing the order, when fulfilment has not begun.",
        ],
        items: [],
      },
    ],
  }),
  page({
    slug: "size-guide",
    title: "Size Guide",
    eyebrow: "Fit information",
    summary:
      "Review the supplied THREAD T-shirt measurement chart; its measurement unit and fit mapping still require client confirmation.",
    active: true,
    needsClientReview: true,
    reviewNotes: [
      "Confirm measurement units, garment measurement points and the products or fits covered by the supplied size-chart image.",
    ],
    sections: [
      {
        id: "pending",
        heading: "Using this chart",
        paragraphs: [
          "Compare the listed chest, length, sleeve, sleeve opening and shoulder measurements. Contact THREAD support before ordering if you need fit guidance.",
        ],
        items: [],
      },
    ],
  }),
  page({
    slug: "privacy-policy",
    title: "Privacy Policy",
    eyebrow: "Client-review draft",
    summary: "This legal page requires review and approval by SNAP CART before production launch.",
    active: true,
    needsClientReview: true,
    reviewNotes: [
      "Client or legal adviser must confirm data categories, processing purposes, retention periods, processors, cookies and customer rights before launch.",
    ],
    sections: [
      {
        id: "operator",
        heading: "Site operator",
        paragraphs: [
          "SNAP CART operates THREAD. Privacy questions can be sent to the business email shown on the Contact page.",
        ],
        items: [],
      },
      {
        id: "review",
        heading: "Pending confirmation",
        paragraphs: [
          "The complete privacy terms are being prepared for client review. No unconfirmed data-handling promises are stated here.",
        ],
        items: [],
      },
    ],
  }),
  page({
    slug: "terms-conditions",
    title: "Terms & Conditions",
    eyebrow: "Client-review draft",
    summary: "This legal page requires review and approval by SNAP CART before production launch.",
    active: true,
    needsClientReview: true,
    reviewNotes: [
      "Client or legal adviser must confirm complete website, sale, payment, liability, governing-law and dispute terms before launch.",
    ],
    sections: [
      {
        id: "current-policies",
        heading: "Current customer information",
        paragraphs: [
          "Current order-change, shipping and return information is available on the Shipping & Delivery and Returns & Exchanges pages.",
        ],
        items: [],
      },
      {
        id: "review",
        heading: "Pending confirmation",
        paragraphs: [
          "The complete terms are being prepared for client review. No unconfirmed legal or commercial promise is stated here.",
        ],
        items: [],
      },
    ],
  }),
];
