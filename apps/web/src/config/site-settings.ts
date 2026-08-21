import {
  storefrontMedia,
  type PublicNavigationDto,
  type PublicSiteSettingsDto,
} from "@thread/types";

export type SiteSettings = PublicSiteSettingsDto;

export const initialBusinessSettings: SiteSettings = {
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
  announcement: {
    enabled: true,
    text: "Explore the latest THREAD styles.",
  },
  footerGroups: [
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
  ],
  socialLinks: [],
};

export const initialNavigation: PublicNavigationDto = {
  version: 1,
  items: [
    {
      id: "men",
      label: "MEN",
      audience: "men",
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
      audience: "women",
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
      audience: "accessories",
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
            {
              id: "accessories-shipping",
              label: "Shipping & Delivery",
              href: "/shipping-delivery",
            },
          ],
        },
      ],
    },
  ],
};
