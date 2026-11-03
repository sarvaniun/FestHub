import { pipeline } from "@huggingface/transformers";

// The sentence-embedding model. all-MiniLM-L6-v2 turns any text into 384
// numbers. It runs locally inside Node (no API key); the first call
// downloads the model (~90 MB) and caches it, later calls are fast.
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

// Load the model once and reuse it for every request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

function getExtractor() {
    if (!extractorPromise) {
        extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL).catch((error: unknown) => {
            extractorPromise = null; // allow a retry next time
            throw error;
        });
    }
    return extractorPromise;
}

// text → 384 numbers. pooling "mean" averages the per-word vectors into
// one sentence vector; normalize makes its length 1, so cosine distance
// compares only the direction (= meaning).
export async function embed(text: string): Promise<number[]> {
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
}
