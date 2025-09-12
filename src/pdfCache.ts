import { LRUCache } from 'lru-cache';

export class PdfCache {
    private cache: LRUCache<string, string>;

    constructor(maxSize: number = 50) {
        this.cache = new LRUCache({
            max: maxSize,
            ttl: 1000 * 60 * 30,
            updateAgeOnGet: true,
            sizeCalculation: (value) => {
                return Math.ceil(value.length * 0.75);
            },
            maxSize: 50 * 1024 * 1024
        });
    }

    get(key: string): string | undefined {
        return this.cache.get(key);
    }

    set(key: string, value: string): void {
        this.cache.set(key, value);
    }

    clear(): void {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            calculatedSize: this.cache.calculatedSize,
            remainingTTL: this.cache.getRemainingTTL.bind(this.cache)
        };
    }
}