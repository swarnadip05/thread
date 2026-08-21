export class NavigationCache<T> {
  private value: T | null = null;
  private expiresAt = 0;
  private pending: Promise<T> | null = null;
  constructor(private readonly ttlMs: number) {}

  async get(loader: () => Promise<T>): Promise<T> {
    if (this.value !== null && Date.now() < this.expiresAt) return structuredClone(this.value);
    if (!this.pending)
      this.pending = loader()
        .then((value) => {
          this.value = structuredClone(value);
          this.expiresAt = Date.now() + this.ttlMs;
          return value;
        })
        .finally(() => {
          this.pending = null;
        });
    return structuredClone(await this.pending);
  }
  invalidate(): void {
    this.value = null;
    this.expiresAt = 0;
  }
}
