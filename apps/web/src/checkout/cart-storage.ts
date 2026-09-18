export interface StoredCartLine {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly observedUnitPricePaise?: number | undefined;
  readonly size?: string | undefined;
  readonly colour?: string | undefined;
  readonly imageUrl?: string | undefined;
  readonly mrpPaise?: number | undefined;
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

export function updateCartQuantity(variantId: string, quantity: number): void {
  const current = readCart();
  if (quantity <= 0) {
    writeCart(current.filter((line) => line.variantId !== variantId));
  } else {
    writeCart(
      current.map((line) =>
        line.variantId === variantId ? { ...line, quantity: Math.min(10, quantity) } : line,
      ),
    );
  }
}

export function removeFromCart(variantId: string): void {
  const current = readCart();
  writeCart(current.filter((line) => line.variantId !== variantId));
}

export function getCartTotalPaise(lines?: readonly StoredCartLine[]): number {
  const list = lines ?? readCart();
  return list.reduce((total, item) => total + (item.observedUnitPricePaise ?? 0) * item.quantity, 0);
}

export function getCartCount(lines?: readonly StoredCartLine[]): number {
  const list = lines ?? readCart();
  return list.reduce((total, item) => total + item.quantity, 0);
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
