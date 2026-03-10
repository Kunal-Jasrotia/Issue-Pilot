import type { LLMProvider } from '@issuepilot/llm';
import { chunkRepository } from './chunker.js';
import { QdrantVectorStore } from './qdrant-store.js';

export interface IndexOptions {
  repoPath: string;
  repoId: string;
  qdrantUrl?: string;
  batchSize?: number;
  onProgress?: (indexed: number, total: number) => void;
}

export class CodeIndexer {
  private store: QdrantVectorStore;
  private provider: LLMProvider;

  constructor(provider: LLMProvider, qdrantUrl?: string) {
    this.provider = provider;
    this.store = new QdrantVectorStore(qdrantUrl);
  }

  async indexRepository(options: IndexOptions): Promise<void> {
    const { repoPath, repoId, batchSize = 20, onProgress } = options;

    await this.store.ensureCollection();

    // Remove old chunks for this repo
    await this.store.deleteByRepo(repoId);

    const chunks = await chunkRepository(repoPath);
    onProgress?.(0, chunks.length);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c) => `File: ${c.filePath}\n\n${c.content}`);

      if (!this.provider.embed) {
        throw new Error('LLM provider does not support embeddings. Use OpenAI or Ollama.');
      }

      const { embeddings } = await this.provider.embed({ text: texts });
      await this.store.upsertChunks(batch, embeddings, repoId);
      onProgress?.(Math.min(i + batchSize, chunks.length), chunks.length);
    }
  }

  async searchCode(query: string, repoId: string, topK = 10) {
    if (!this.provider.embed) {
      throw new Error('LLM provider does not support embeddings.');
    }
    const { embeddings } = await this.provider.embed({ text: query });
    const embedding = embeddings[0];
    if (!embedding) throw new Error('Failed to generate query embedding');
    return this.store.search(embedding, repoId, topK);
  }
}
