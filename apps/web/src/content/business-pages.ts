import type { ContentPageDto } from "@thread/types";

const updatedAt = "2026-07-26T00:00:00.000Z";
const page = (value: Omit<ContentPageDto, "updatedAt">): ContentPageDto => ({
  ...value,
  updatedAt,
});

export const fallbackContentPages: Readonly<Record<string, ContentPageDto>> = {
  about: page({
    slug: "about",
    title: "About THREAD",
    eyebrow: "THREAD / SNAP CART",
    summary:
      "THREAD is a local fashion brand operated by SNAP CART in Kolkata and founded in 2025.",
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
          "SNAP CART trades as THREAD. Legal and contact details are available in the footer and Contact page.",
        ],
        items: [],
      },
    ],
  }),
  contact: page({
    slug: "contact",
    title: "Contact Us",
    eyebrow: "Customer support",
    summary:
      "Contact THREAD by phone, email or WhatsApp. Our support target is to reply within 24 hours, Monday–Friday.",
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
  faq: page({
    slug: "faq",
    title: "Frequently Asked Questions",
    eyebrow: "Help centre",
    summary:
      "Answers based on THREAD’s current shipping, returns, order-change and product-care information.",
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
  "shipping-delivery": page({
    slug: "shipping-delivery",
    title: "Shipping & Delivery",
    eyebrow: "Delivery information",
    summary: "Current normal delivery windows for domestic and international THREAD orders.",
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
  "returns-exchanges": page({
    slug: "returns-exchanges",
    title: "Returns & Exchanges",
    eyebrow: "Returns information",
    summary: "Current eligibility and timing for return or exchange requests.",
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
  "size-guide": page({
    slug: "size-guide",
    title: "Size Guide",
    eyebrow: "Fit information",
    summary:
      "Review the supplied THREAD T-shirt measurement chart; its measurement unit and fit mapping still require client confirmation.",
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
  "privacy-policy": page({
    slug: "privacy-policy",
    title: "Privacy Policy",
    eyebrow: "Client-review draft",
    summary: "This legal page requires review and approval by SNAP CART before production launch.",
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
  "terms-conditions": page({
    slug: "terms-conditions",
    title: "Terms & Conditions",
    eyebrow: "Client-review draft",
    summary: "This legal page requires review and approval by SNAP CART before production launch.",
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
};
