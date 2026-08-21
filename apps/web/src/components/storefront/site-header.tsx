"use client";

import { IconButton } from "@thread/ui";
import type { PublicNavigationDto, PublicSiteSettingsDto } from "@thread/types";
import { Heart, Home, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { useAuth } from "@/auth/auth-provider";
import { readCart } from "@/checkout/cart-storage";
import { DesktopMegaNavigation } from "./desktop-mega-navigation";
import { MobileCategoryNavigation } from "./mobile-category-navigation";
import { SearchBox } from "../discovery/search-box";

const wishlistKey = "thread:wishlist:v1";
const legacySupportAnnouncement = "Customer support target: reply within 24 hours, Monday–Friday.";

function subscribeToCommerceIndicators(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("thread:cart-changed", onStoreChange);
  window.addEventListener("thread:wishlist-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("thread:cart-changed", onStoreChange);
    window.removeEventListener("thread:wishlist-changed", onStoreChange);
  };
}

function cartCount(): number {
  return readCart().reduce((total, line) => total + line.quantity, 0);
}

function wishlistCount(): number {
  try {
    const value = JSON.parse(localStorage.getItem(wishlistKey) ?? "[]") as unknown;
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

function BrandMark({ compact = false, name }: { compact?: boolean; name: string }) {
  return (
    <span
      aria-label={`${name} home`}
      className={
        compact ? "text-xl font-black tracking-[0.12em]" : "text-3xl font-black tracking-[0.16em]"
      }
    >
      {name}
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[0.6rem] font-black leading-none text-ink">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SiteHeader({
  navigation,
  settings,
}: {
  navigation: PublicNavigationDto;
  settings: PublicSiteSettingsDto;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const auth = useAuth();
  const { refresh, status: authStatus } = auth;
  const cartItems = useSyncExternalStore(subscribeToCommerceIndicators, cartCount, () => 0);
  const wishlistItems = useSyncExternalStore(subscribeToCommerceIndicators, wishlistCount, () => 0);
  const announcement =
    settings.announcement.text === legacySupportAnnouncement
      ? "Explore the latest THREAD styles."
      : settings.announcement.text;

  useEffect(() => {
    if (authStatus === "unknown") void refresh();
  }, [authStatus, refresh]);

  return (
    <>
      <div className="sticky top-0 z-header bg-paper shadow-subtle">
        <div className="hidden h-7 bg-charcoal text-[0.7rem] text-paper/75 lg:block">
          <div className="shell-container flex h-full items-center justify-between">
            <span>
              {settings.brandName} by {settings.legalName}
            </span>
            <div className="flex gap-6">
              <Link className="focus-ring rounded-sm hover:text-paper" href="/contact">
                Contact us
              </Link>
              <Link className="focus-ring rounded-sm hover:text-paper" href="/shipping-delivery">
                Shipping & delivery
              </Link>
            </div>
          </div>
        </div>
        <header className="border-b border-ink/10">
          <div className="shell-container hidden h-16 items-center gap-4 xl:gap-6 lg:flex">
            <Link className="focus-ring shrink-0 rounded-sm" href="/">
              <BrandMark name={settings.brandName} />
            </Link>
            <DesktopMegaNavigation items={navigation.items} />
            <div className="ml-auto w-full max-w-xs xl:max-w-md">
              <SearchBox placeholder={`Search ${settings.brandName}`} />
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Link
                aria-label={auth.user ? `Account for ${auth.user.name}` : "Account"}
                className="focus-ring flex min-h-11 items-center gap-2 rounded-full px-3 hover:bg-ink/7"
                href="/account"
              >
                <UserRound aria-hidden="true" className="size-5" />
                <span className="hidden max-w-24 truncate text-xs font-semibold 2xl:block">
                  {auth.user ? auth.user.name.split(" ")[0] : "Account"}
                </span>
              </Link>
              <Link
                aria-label={`Wishlist, ${wishlistItems} ${wishlistItems === 1 ? "item" : "items"}`}
                className="focus-ring relative grid size-11 place-items-center rounded-full hover:bg-ink/7"
                href="/account"
              >
                <Heart aria-hidden="true" className="size-5" />
                <CountBadge count={wishlistItems} />
              </Link>
              <Link
                aria-label={`Cart, ${cartItems} ${cartItems === 1 ? "item" : "items"}`}
                className="focus-ring relative grid size-11 place-items-center rounded-full hover:bg-ink/7"
                href="/checkout"
              >
                <ShoppingBag aria-hidden="true" className="size-5" />
                <CountBadge count={cartItems} />
              </Link>
            </div>
          </div>
          <div className="shell-container flex h-16 items-center gap-1 lg:hidden">
            <MobileCategoryNavigation
              items={navigation.items}
              onOpenChange={setMobileMenuOpen}
              open={mobileMenuOpen}
            >
              <IconButton aria-label="Open category menu">
                <Menu aria-hidden="true" className="size-5" />
              </IconButton>
            </MobileCategoryNavigation>
            <Link className="focus-ring rounded-sm" href="/">
              <BrandMark compact name={settings.brandName} />
            </Link>
            <div className="ml-auto flex items-center">
              <IconButton
                aria-expanded={searchOpen}
                aria-label={searchOpen ? "Close search" : "Open search"}
                onClick={() => setSearchOpen((open) => !open)}
              >
                {searchOpen ? (
                  <X aria-hidden="true" className="size-5" />
                ) : (
                  <Search aria-hidden="true" className="size-5" />
                )}
              </IconButton>
              <Link
                aria-label="Account"
                className="focus-ring grid size-11 place-items-center rounded-full hover:bg-ink/7"
                href="/account"
              >
                <UserRound aria-hidden="true" className="size-5" />
              </Link>
              <Link
                aria-label={`Cart, ${cartItems} ${cartItems === 1 ? "item" : "items"}`}
                className="focus-ring relative grid size-11 place-items-center rounded-full hover:bg-ink/7"
                href="/checkout"
              >
                <ShoppingBag aria-hidden="true" className="size-5" />
                <CountBadge count={cartItems} />
              </Link>
            </div>
          </div>
          {searchOpen ? (
            <div className="shell-container pb-3 lg:hidden">
              <SearchBox autoFocus placeholder={`Search ${settings.brandName}`} />
            </div>
          ) : null}
        </header>
        {settings.announcement.enabled && announcement ? (
          <div
            className="flex min-h-8 items-center justify-center bg-gold px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-ink sm:text-sm"
            role="status"
          >
            {announcement}
          </div>
        ) : null}
      </div>
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-header grid h-16 grid-cols-5 border-t border-ink/10 bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(17_17_17/0.08)] lg:hidden"
      >
        <QuickLink href="/" icon={<Home aria-hidden="true" />} label="Home" />
        <QuickButton
          icon={<Menu aria-hidden="true" />}
          label="Categories"
          onClick={() => setMobileMenuOpen(true)}
        />
        <QuickButton
          icon={<Search aria-hidden="true" />}
          label="Search"
          onClick={() => setSearchOpen(true)}
        />
        <QuickLink
          count={wishlistItems}
          href="/account"
          icon={<Heart aria-hidden="true" />}
          label="Wishlist"
        />
        <QuickLink
          count={cartItems}
          href="/checkout"
          icon={<ShoppingBag aria-hidden="true" />}
          label="Cart"
        />
      </nav>
    </>
  );
}

function QuickLink({
  count = 0,
  href,
  icon,
  label,
}: {
  count?: number;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      aria-label={`${label}${count ? `, ${count} items` : ""}`}
      className="focus-ring relative grid min-w-0 place-items-center content-center gap-0.5 rounded-sm text-[0.65rem] font-medium [&_svg]:size-5"
      href={href}
    >
      <span className="relative">
        {icon}
        <CountBadge count={count} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

function QuickButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={disabled ? `${label} — coming soon` : label}
      className="focus-ring grid min-w-0 place-items-center content-center gap-0.5 rounded-sm text-[0.65rem] font-medium disabled:opacity-40 [&_svg]:size-5"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
