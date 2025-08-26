import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisVectorStore } from '@langchain/redis'
import { createClient, RedisClientType } from 'redis'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Document } from '@langchain/core/documents'
import { AgentRag } from '../interfaces/agent-rag.interface'
import { loadRagDocuments } from '../utils/load-rag-documents'

/**
 * Retrieval‑Augmented Generation provider based on LangChain.
 *
 * This implementation uses an embeddings model to convert documents into vectors
 * and stores them in a Redis vector store.  It supports seeding the vector
 * store with local documents at startup and retrieving context strings for a
 * given query via cosine similarity search.  All configuration is driven
 * through the NestJS `ConfigService`.
 */
@Injectable()
export class LangchainRagProvider implements AgentRag, OnModuleInit, OnModuleDestroy {
  private vectorStore: RedisVectorStore
  private redisClient: RedisClientType | undefined
  private readonly logger = new Logger(LangchainRagProvider.name)

  constructor(private readonly configService: ConfigService) {}

  /**
   * Lifecycle hook that initializes the vector store and seeds it with documents.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing LangchainRagProvider...')
    const activeProvider = this.configService.get<string>('appConfig.ragProvider')
    if (activeProvider !== 'langchain') {
      this.logger.log('RAG provider is not "langchain", skipping initialization.')
      return
    }
    try {
      const openaiApiKey = this.configService.get<string>('appConfig.openaiApiKey') || process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        this.logger.error(
          '❌ OPENAI_API_KEY not provided. LangChain RAG requires a valid OpenAI key to create embeddings.',
        )
        throw new Error('Missing OpenAI API Key for LangChain RAG provider.')
      }
      const embeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey })
      const vectorStoreProvider = this.configService.get<string>('appConfig.vectorStore') as 'redis' | undefined
      if (vectorStoreProvider !== 'redis') {
        this.logger.error(`❌ Unsupported VECTOR_STORE: ${vectorStoreProvider}`)
        throw new Error(`Unsupported VECTOR_STORE: ${vectorStoreProvider}`)
      }
      const redisUrl = this.configService.get<string>('appConfig.redisUrl') || process.env.REDIS_URL
      const redisIndexName = this.configService.get<string>('appConfig.vectorIndexName') || 'agent-ia'
      this.logger.log(`Connecting to Redis at ${redisUrl} with index ${redisIndexName}...`)
      this.redisClient = createClient({ url: redisUrl }) as RedisClientType
      await this.redisClient.connect()
      this.logger.debug('✅ Redis client connected.')
      this.vectorStore = new RedisVectorStore(embeddings, {
        redisClient: this.redisClient,
        indexName: redisIndexName,
      })
      this.logger.log('✅ Redis vector store initialized.')
      // Seed the vector store with documents if a path is provided.
      const docsPath = this.configService.get<string>('appConfig.ragDocsPath') || './docs'
      this.logger.log(`[RAG] Loading documents from: ${docsPath}`)
      const docs = await loadRagDocuments(docsPath, this.logger)
      for (const doc of docs) {
        await this.addDocument(doc.id, doc.content)
      }
      this.logger.log(`✅ Seeded vector store with ${docs.length} document(s).`)
    } catch (error) {
      this.logger.error(`Error during LangchainRagProvider initialization: ${(error as Error).message}`)
    }
  }

  /**
   * Adds a document to the vector store.  The document is embedded using
   * the configured embeddings model and persisted in Redis.
   *
   * @param id Unique identifier for the document.
   * @param text The document content.
   */
  async addDocument(id: string, text: string): Promise<void> {
    try {
      this.logger.debug(`Adding document to vector store | id: ${id}`)
      const doc: Document = { pageContent: text, metadata: { id } }
      await this.vectorStore.addDocuments([doc])
      this.logger.verbose(`✅ Document "${id}" added to vector store.`)
    } catch (error) {
      this.logger.error(`❌ Failed to add document "${id}": ${(error as Error).message}`)
    }
  }

  /**
   * Retrieves context documents most similar to a given query.  Returns up to
   * three documents' content in order of similarity.
   *
   * @param query User query to search for relevant context.
   * @returns List of document contents.
   */
  async retrieveContext(query: string): Promise<string[]> {
    try {
      this.logger.debug(`Retrieving context for query: "${query}"`)
      const results = await this.vectorStore.similaritySearch(query, 3)
      this.logger.verbose(`✅ Context retrieved: ${results.length} result(s).`)
      return results.map((r) => r.pageContent)
    } catch (error) {
      this.logger.error(`❌ Error during similarity search: ${(error as Error).message}`)
      return []
    }
  }

  /**
   * Lifecycle hook that gracefully closes the Redis connection.
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.redisClient) return
    try {
      this.logger.log('Disconnecting Redis client...')
      await this.redisClient.disconnect()
      this.logger.log('✅ Redis client disconnected.')
    } catch (error) {
      this.logger.error(`❌ Error disconnecting Redis client: ${(error as Error).message}`)
    }
  }
}
