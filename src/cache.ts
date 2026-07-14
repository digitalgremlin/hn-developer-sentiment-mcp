interface TtlLruCacheOptions {
  capacity: number;
  ttlMs: number;
  clock: () => number;
}

type Entry<V> = {
  value: V;
  expires: number;
};

export class TtlLruCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly clock: () => number;

  constructor(opts: TtlLruCacheOptions) {
    this.capacity = opts.capacity;
    this.ttlMs = opts.ttlMs;
    this.clock = opts.clock;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.clock() >= entry.expires) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.clock() + this.ttlMs });
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
