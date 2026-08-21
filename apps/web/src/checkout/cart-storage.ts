export interface StoredCartLine {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly observedUnitPricePaise?: number;
}

const CART_KEY = "thread:cart:v1";
const CHECKOUT_KEY = "thread:checkout:idempotency:v1";
const SESSION_KEY = "thread:checkout:session:v1";

export function readCart(): StoredCartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as StoredCartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: readonly StoredCartLine[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
  localStorage.removeItem(CHECKOUT_KEY);
  window.dispatchEvent(new Event("thread:cart-changed"));
}

export function clearCart(): void {
  writeCart([]);
}

export function checkoutIdempotencyKey(): string {
  const existing = localStorage.getItem(CHECKOUT_KEY);
  if (existing) return existing;
  const created = `checkout-${crypto.randomUUID()}`;
  localStorage.setItem(CHECKOUT_KEY, created);
  return created;
}

export function readCheckoutSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function storeCheckoutSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_KEY, sessionId);
}

export function clearCheckoutAttempt(): void {
  localStorage.removeItem(CHECKOUT_KEY);
  localStorage.removeItem(SESSION_KEY);
}
