import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisVectorStore } from '@langchain/redis'
import { createClient, RedisClientType } from 'redis'
import { OpenAIEmbeddings } from '@langchain/openai'
import { loadRagDocuments } from '../utils/load-rag-documents'

type SupportedStores = 'redis'

/**
 * Langchain-based Retrieval-Augmented Generation Provider.
 * Uses Redis as vector store and OpenAI for embeddings.
 */
@Injectable()
export class LangchainRagProvider implements OnModuleInit, OnModuleDestroy {
  private vectorStore: RedisVectorStore
  private redisClient: RedisClientType | undefined
  private readonly logger = new Logger(LangchainRagProvider.name)

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing LangchainRagProvider...')

    try {
      const activeProvider = this.configService.get<string>('appConfig.ragProvider')
      if (activeProvider !== 'langchain') {
        this.logger.log('RAG provider is not "langchain", skipping initialization.')
        return
      }

      const openaiApiKey = this.configService.get<string>('appConfig.openaiApiKey') || process.env.OPENAI_API_KEY

      if (!openaiApiKey) {
        this.logger.error(
          '❌ OPENAI_API_KEY not provided. LangChain RAG requires a valid OpenAI key to create embeddings.',
        )
        throw new Error('Missing OpenAI API Key for LangChain RAG provider.')
      }

      const embeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey })
      const vectorStoreProvider = this.configService.get<string>('appConfig.vectorStore') as SupportedStores

      if (vectorStoreProvider === 'redis') {
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
      } else {
        this.logger.error(`❌ Unsupported VECTOR_STORE: ${vectorStoreProvider}`)
        throw new Error(`Unsupported VECTOR_STORE: ${vectorStoreProvider}`)
      }

      const docsPath = this.configService.get<string>('appConfig.ragDocsPath') || './docs'
      this.logger.log(`[RAG] 📂 Loading documents from: ${docsPath}`)

      const docs = await loadRagDocuments(docsPath, this.logger)

      for (const doc of docs) {
        await this.addDocument(doc.id, doc.content)
      }

      this.logger.log(`✅ Seeded vector store with ${docs.length} documents.`)
    } catch (error) {
      this.logger.error(`💥 Error during LangchainRagProvider initialization: ${(error as Error).message}`)
    }
  }

  async addDocument(id: string, text: string): Promise<void> {
    try {
      this.logger.debug(`Adding document to vector store | id: ${id}`)
      await this.vectorStore.addDocuments([{ pageContent: text, metadata: { id } }])
      this.logger.verbose(`✅ Document "${id}" added to vector store.`)
    } catch (error) {
      this.logger.error(`❌ Failed to add document "${id}": ${(error as Error).message}`)
    }
  }

  async retrieveContext(query: string): Promise<string[]> {
    try {
      this.logger.debug(`🔎 Retrieving context for query: "${query}"`)
      const results = await this.vectorStore.similaritySearch(query, 3)
      this.logger.verbose(`✅ Context retrieved: ${results.length} result(s).`)
      return results.map((r) => r.pageContent)
    } catch (error) {
      this.logger.error(`❌ Error during similarity search: ${(error as Error).message}`)
      return []
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.redisClient) {
        this.logger.log('🔌 Disconnecting Redis client...')
        await this.redisClient.disconnect()
        this.logger.log('✅ Redis client disconnected.')
      }
    } catch (error) {
      this.logger.error(`❌ Error disconnecting Redis client: ${(error as Error).message}`)
    }
  }
}
