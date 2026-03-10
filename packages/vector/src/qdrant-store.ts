import { QdrantClient } from '@qdrant/js-client-rest';
import type { CodeChunk } from './chunker.js';

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
}

const VECTOR_SIZE = 1536; // OpenAI text-embedding-3-small / nomic-embed-text

export class QdrantVectorStore {
  private client: QdrantClient;
  private collectionName: string;

  constructor(url = 'http://localhost:6333', collectionName = 'code_chunks') {
    this.client = new QdrantClient({ url });
    this.collectionName = collectionName;
  }

  async ensureCollection(vectorSize = VECTOR_SIZE): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: { size: vectorSize, distance: 'Cosine' },
        optimizers_config: { default_segment_number: 2 },
        replication_factor: 1,
      });
    }
  }

  async upsertChunks(
    chunks: CodeChunk[],
    embeddings: number[][],
    repoId: string
  ): Promise<void> {
    const points = chunks.map((chunk, i) => ({
      id: this.hashId(`${repoId}:${chunk.id}`),
      vector: embeddings[i] ?? [],
      payload: {
        repoId,
        filePath: chunk.filePath,
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language,
        chunkId: chunk.id,
      },
    }));

    // Upsert in batches of 100
    for (let i = 0; i < points.length; i += 100) {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.slice(i, i + 100),
      });
    }
  }

  async search(
    queryEmbedding: number[],
    repoId: string,
    topK = 10
  ): Promise<SearchResult[]> {
    const result = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit: topK,
      filter: {
        must: [{ key: 'repoId', match: { value: repoId } }],
      },
      with_payload: true,
    });

    return result.map((hit) => ({
      chunk: {
        id: (hit.payload?.['chunkId'] as string) ?? '',
        filePath: (hit.payload?.['filePath'] as string) ?? '',
        content: (hit.payload?.['content'] as string) ?? '',
        startLine: (hit.payload?.['startLine'] as number) ?? 0,
        endLine: (hit.payload?.['endLine'] as number) ?? 0,
        language: (hit.payload?.['language'] as string) ?? '',
      },
      score: hit.score,
    }));
  }

  async deleteByRepo(repoId: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      wait: true,
      filter: {
        must: [{ key: 'repoId', match: { value: repoId } }],
      },
    });
  }

  private hashId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
