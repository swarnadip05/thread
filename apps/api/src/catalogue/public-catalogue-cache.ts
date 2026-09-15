/**
 * Optional process cache for anonymous catalogue reads.
 *
 * The composed API deliberately uses the zero-TTL default, so catalogue data is
 * always read from MongoDB. Callers that explicitly opt into a positive TTL must
 * provide complete invalidation for every product, inventory, and category write.
 */
export class PublicCatalogueCache {
  private readonly values = new Map<string, { expiresAt: number; value: unknown }>();
  constructor(private readonly ttlMs = 0) {}

  async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    if (this.ttlMs <= 0) return factory();
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
