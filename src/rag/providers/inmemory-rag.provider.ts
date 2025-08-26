import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OpenAIEmbeddings } from '@langchain/openai'
import { AgentRag } from '../interfaces/agent-rag.interface'
import { loadRagDocuments } from '../utils/load-rag-documents'

/**
 * Calculates cosine similarity between two embedding vectors.
 *
 * @param a First vector.
 * @param b Second vector.
 * @returns Cosine similarity score between 0 and 1.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
  return dot / (normA * normB)
}

/**
 * In‑memory Retrieval‑Augmented Generation provider.
 *
 * This provider stores documents in memory and generates embeddings using
 * OpenAI when configured.  A simple deterministic embedding fallback is
 * provided when no API key is configured, ensuring the system can still
 * function albeit with less semantic precision.  Documents are compared via
 * cosine similarity to retrieve the most relevant context.
 */
@Injectable()
export class InMemoryRagProvider implements AgentRag, OnModuleInit {
  private readonly logger = new Logger(InMemoryRagProvider.name)
  private embeddings: OpenAIEmbeddings | undefined
  private docs: { id: string; text: string; embedding: number[] }[] = []
  private readonly llmProvider: string

  constructor(private readonly configService: ConfigService) {
    this.llmProvider = this.configService.get<string>('appConfig.llmProvider', 'ollama')
    // Initialise OpenAI embeddings only when required to avoid unnecessary API calls.
    if (this.llmProvider === 'openai') {
      const apiKey = this.configService.get<string>('appConfig.openaiApiKey')
      if (!apiKey) {
        this.logger.error('OpenAI API key is missing but llmProvider is set to "openai".')
        throw new Error('OPENAI_API_KEY not configured.')
      }
      this.embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey, modelName: 'text-embedding-ada-002' })
    }
    this.logger.log(`Using embeddings provider: "${this.llmProvider}"`)
  }

  /**
   * Lifecycle hook that loads and embeds documents from disk if configured.
   */
  async onModuleInit(): Promise<void> {
    const docsPath = this.configService.get<string>('appConfig.ragDocsPath')
    if (!docsPath) {
      this.logger.warn('⚠️ No ragDocsPath configured. Skipping document loading.')
      return
    }
    this.logger.log(`Loading RAG documents from: ${docsPath}`)
    try {
      const rawDocs = await loadRagDocuments(docsPath, this.logger)
      for (const doc of rawDocs) {
        const embedding = await this.embed(doc.content)
        this.docs.push({ id: doc.id, text: doc.content, embedding })
        this.logger.debug(`✅ Document embedded: ${doc.id}`)
      }
      this.logger.log(`${this.docs.length} document(s) loaded into memory`)
    } catch (error) {
      this.logger.error('❌ Failed to load and embed RAG documents', (error as Error).stack)
    }
  }

  /**
   * Generates an embedding for the given text.  Uses OpenAI when configured,
   * otherwise falls back to a simple char‑code based embedding.
   *
   * @param text Input to embed.
   * @returns A numeric embedding vector.
   */
  async embed(text: string): Promise<number[]> {
    try {
      if (this.llmProvider === 'openai' && this.embeddings) {
        const result = await this.embeddings.embedQuery(text)
        return result
      }
      // Simple deterministic embedding fallback based on character codes.  Not
      // semantically meaningful, but deterministic and fast.
      return text.split('').map((char) => (char.charCodeAt(0) % 17) / 17)
    } catch (error) {
      this.logger.error('Failed to generate embedding', (error as Error).stack)
      throw error
    }
  }

  /**
   * Adds a document to the in‑memory store with generated embedding.
   *
   * @param id Unique document identifier.
   * @param text Document content.
   */
  async addDocument(id: string, text: string): Promise<void> {
    try {
      const embedding = await this.embed(text)
      this.docs.push({ id, text, embedding })
      this.logger.debug(`Document "${id}" added to memory`)
    } catch (error) {
      this.logger.error(`❌ Failed to add document "${id}"`, (error as Error).stack)
    }
  }

  /**
   * Finds the top‑k most similar documents based on cosine similarity.
   *
   * @param text Query string to match against existing documents.
   * @param topK Number of results to return (default 3).
   * @returns List of scored documents.
   */
  private async query(text: string, topK = 3): Promise<{ id: string; text: string; score: number }[]> {
    try {
      const embedding = await this.embed(text)
      const results = this.docs
        .map((doc) => ({
          id: doc.id,
          text: doc.text,
          score: cosineSimilarity(embedding, doc.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
      this.logger.debug(`Retrieved ${results.length} similar document(s)`)
      return results
    } catch (error) {
      this.logger.error('❌ Failed to query similar documents', (error as Error).stack)
      return []
    }
  }

  /**
   * Retrieves the most relevant document contents for a given user query.
   *
   * @param query User input to find context for.
   * @returns List of document texts relevant to the query.
   */
  async retrieveContext(query: string): Promise<string[]> {
    const results = await this.query(query, 3)
    return results.map((r) => r.text)
  }
}
