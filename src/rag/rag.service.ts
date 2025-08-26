import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AgentRag } from './interfaces/agent-rag.interface'
import { LangchainRagProvider } from './providers/langchain-rag.provider'
import { InMemoryRagProvider } from './providers/inmemory-rag.provider'

/**
 * Service that provides a unified interface for retrieval‑augmented generation.
 *
 * At runtime a concrete RAG provider (in‑memory or LangChain/Redis) is
 * selected based on configuration.  Consumers remain agnostic of the
 * underlying implementation and can rely on the `retrieveContext` and
 * `addDocument` methods defined in the `AgentRag` interface.
 */
@Injectable()
export class RagService implements AgentRag {
  private readonly agentRag: AgentRag
  private readonly logger = new Logger(RagService.name)

  constructor(
    configService: ConfigService,
    inMemoryProvider: InMemoryRagProvider,
    langchainProvider: LangchainRagProvider,
  ) {
    const provider = configService.get<string>('appConfig.ragProvider', 'inMemory')
    this.logger.log(`Using RAG provider: ${provider}`)
    this.agentRag = provider === 'langchain' ? langchainProvider : inMemoryProvider
  }

  /**
   * Delegates retrieval of context to the selected provider.
   *
   * @param query Query string to search for relevant context.
   * @returns A list of document contents relevant to the query.
   */
  async retrieveContext(query: string): Promise<string[]> {
    return this.agentRag.retrieveContext(query)
  }

  /**
   * Delegates addition of a document to the selected provider.
   *
   * @param id Unique identifier for the document.
   * @param text Document content.
   */
  async addDocument(id: string, text: string): Promise<void> {
    return this.agentRag.addDocument(id, text)
  }
}
