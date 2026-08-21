/** A short-lived process cache for anonymous catalogue reads.
 * It deliberately stores only public DTOs and is cleared after catalogue writes.
 * Multi-instance deployments should replace this with a shared Redis-backed cache
 * and cross-instance invalidation.
 */
export class PublicCatalogueCache {
  private readonly values = new Map<string, { expiresAt: number; value: unknown }>();
  constructor(private readonly ttlMs = 60_000) {}

  async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const value = await factory();
    this.values.set(key, { expiresAt: Date.now() + this.ttlMs, value });
    return value;
  }

  invalidate(): void {
    this.values.clear();
  }
}
