import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AgentRag } from './interfaces/agent-rag.interface'
import { LangchainRagProvider } from './providers/langchain-rag.provider'
import { InMemoryRagProvider } from './providers/inmemory-rag.provider'

/**
 * Service for Retrieval Augmented Generation (RAG).
 * Provides methods to store and retrieve relevant context documents for LLM queries.
 */
@Injectable()
export class RagService implements AgentRag {
  private agentRag: AgentRag

  constructor(configService: ConfigService, vectorStore: InMemoryRagProvider, langchain: LangchainRagProvider) {
    const provider = configService.get<string>('appConfig.ragProvider', 'inMemory')
    console.log(`***RAGPROVIDER: ${provider}`)
    this.agentRag = provider === 'langchain' ? langchain : vectorStore
  }

  async retrieveContext(query: string): Promise<string[]> {
    return this.agentRag.retrieveContext(query)
  }
  async addDocument(id: string, text: string) {
    return this.agentRag.addDocument(id, text)
  }
}
