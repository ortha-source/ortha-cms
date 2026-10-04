/** 32-bit FNV-1a over UTF-16 code units, from a given offset basis. */
export function fnv1a(text: string, basis: number): number {
    let hash = basis >>> 0;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}
