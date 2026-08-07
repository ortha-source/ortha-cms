/**
 * Splits text into fixed-size pieces. Streaming the reply in small deltas is
 * what makes a consumer's reassembly genuinely exercised, rather than handed
 * one whole string that would hide an off-by-one.
 */
export function chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let index = 0; index < text.length; index += size) {
        chunks.push(text.slice(index, index + size));
    }
    return chunks;
}
