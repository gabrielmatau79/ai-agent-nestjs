import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OpenAI } from 'openai'

import { AgentRag } from '../interfaces/agent-rag.interface'
import { loadRagDocuments } from '../utils/load-rag-documents'

/**
 * Calculates cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
  return dot / (normA * normB)
}

/**
 * In-memory provider for RAG (Retrieval-Augmented Generation).
 *
 * Stores documents in memory, generates embeddings (OpenAI or local),
 * and supports semantic similarity search.
 */
@Injectable()
export class InMemoryRagProvider implements AgentRag, OnModuleInit {
  private readonly logger = new Logger(InMemoryRagProvider.name)
  private openai: OpenAI
  private docs: { id: string; text: string; embedding: number[] }[] = []
  private llmProvider: string

  /**
   * Constructs the provider with config for LLM provider (OpenAI or local).
   *
   * @param configService - Provides access to environment variables.
   */
  constructor(private configService: ConfigService) {
    this.llmProvider = this.configService.get<string>('appConfig.llmProvider', 'ollama')

    if (this.llmProvider === 'openai') {
      const openaiApiKey = this.configService.get<string>('appConfig.openaiApiKey')
      if (!openaiApiKey) {
        this.logger.error('OpenAI API key is missing but llmProvider is set to "openai".')
        throw new Error('OPENAI_API_KEY not configured.')
      }

      this.openai = new OpenAI({ apiKey: openaiApiKey })
    }

    this.logger.log(`🧠 Using embeddings provider: "${this.llmProvider}"`)
  }

  /**
   * On initialization, optionally load and embed documents from disk.
   * Controlled by the presence of `appConfig.ragDocsPath`.
   */
  async onModuleInit(): Promise<void> {
    const docsPath = this.configService.get<string>('appConfig.ragDocsPath')
    if (!docsPath) {
      this.logger.warn('⚠️ No ragDocsPath configured. Skipping document loading.')
      return
    }

    this.logger.log(`📂 Loading RAG documents from: ${docsPath}`)

    try {
      const rawDocs = await loadRagDocuments(docsPath, this.logger)

      for (const doc of rawDocs) {
        const embedding = await this.embed(doc.content)
        this.docs.push({ id: doc.id, text: doc.content, embedding })
        this.logger.debug(`✅ Document embedded: ${doc.id}`)
      }

      this.logger.log(`📥 ${this.docs.length} document(s) loaded into memory`)
    } catch (error) {
      this.logger.error('❌ Failed to load and embed RAG documents', (error as Error).stack)
    }
  }

  /**
   * Generates an embedding for the given text.
   *
   * Uses OpenAI if configured, otherwise applies a simple local embedding strategy.
   *
   * @param text - The raw input to embed.
   * @returns An embedding vector.
   */
  async embed(text: string): Promise<number[]> {
    try {
      if (this.llmProvider === 'openai') {
        const res = await this.openai.embeddings.create({
          input: text,
          model: 'text-embedding-ada-002',
        })
        return res.data[0].embedding
      } else {
        // Simple local embedding fallback
        return text.split('').map((char) => (char.charCodeAt(0) % 17) / 17)
      }
    } catch (error) {
      this.logger.error('🔻 Failed to generate embedding', (error as Error).stack)
      throw error
    }
  }

  /**
   * Adds a document to the in-memory store with generated embedding.
   *
   * @param id - Unique identifier for the document.
   * @param text - Content of the document.
   */
  async addDocument(id: string, text: string) {
    try {
      const embedding = await this.embed(text)
      this.docs.push({ id, text, embedding })
      this.logger.debug(`📄 Document "${id}" added to memory`)
    } catch (error) {
      this.logger.error(`❌ Failed to add document "${id}"`, (error as Error).stack)
    }
  }

  /**
   * Finds top-k most similar documents based on cosine similarity.
   *
   * @param text - Query string to match against existing documents.
   * @param topK - Number of results to return (default 3).
   * @returns List of scored documents.
   */
  async query(text: string, topK = 3): Promise<{ id: string; text: string; score: number }[]> {
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

      this.logger.debug(`🔍 Retrieved ${results.length} similar document(s)`)
      return results
    } catch (error) {
      this.logger.error('❌ Failed to query similar documents', (error as Error).stack)
      return []
    }
  }

  /**
   * Retrieves the most relevant documents for a given user query.
   *
   * @param query - User input to find context for.
   * @returns List of document texts relevant to the query.
   */
  async retrieveContext(query: string): Promise<string[]> {
    const results = await this.query(query, 3)
    return results.map((r) => r.text)
  }
}
