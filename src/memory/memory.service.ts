import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChatMessage, AgentMemory } from './interfaces/memory.interface'
import { InMemory } from './providers/in-memory'
import { RedisMemory } from './providers/redis-memory'

/**
 * MemoryService acts as an abstraction layer over different persistence
 * mechanisms for chat history.
 *
 * At runtime it selects either an in‑process map or a Redis‑backed store
 * depending on configuration.  This allows the application to scale from
 * development to production without changing business logic.  Messages are
 * truncated to a configurable window size to bound memory growth.
 */
@Injectable()
export class MemoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryService.name)
  private memory: AgentMemory
  private readonly agentMemoryType: string
  private readonly agentMemoryWindow: number
  private readonly redisUrl: string | undefined

  constructor(private readonly configService: ConfigService) {
    // Determine the type of memory store to use; default to in‑memory.
    this.agentMemoryType = this.configService.get<string>('appConfig.agentMemoryType', 'memory')
    // Limit the number of messages retained per session; default to 10 if not set.
    this.agentMemoryWindow = this.configService.get<number>('appConfig.agentMemoryWindow', 10)
    this.redisUrl = this.configService.get<string>('appConfig.redisUrl')
    // Instantiate the appropriate memory provider.
    if (this.agentMemoryType === 'redis') {
      const url = this.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379'
      this.logger.log(`Using RedisMemory with window size ${this.agentMemoryWindow}`)
      this.memory = new RedisMemory(this.agentMemoryWindow, url)
    } else {
      this.logger.log(`Using InMemory with window size ${this.agentMemoryWindow}`)
      this.memory = new InMemory(this.agentMemoryWindow)
    }
  }

  /**
   * Lifecycle hook invoked once the module has been initialized.  If the
   * underlying memory provider implements `onModuleInit`, it will be called.
   */
  async onModuleInit(): Promise<void> {
    if (typeof (this.memory as Partial<OnModuleInit>).onModuleInit === 'function') {
      this.logger.log('Initializing memory provider...')
      await (this.memory as unknown as OnModuleInit).onModuleInit()
      this.logger.log('✅ Memory provider initialized')
    }
  }

  /**
   * Lifecycle hook invoked during graceful shutdown.  If the underlying
   * provider implements `onModuleDestroy`, it will be called.
   */
  async onModuleDestroy(): Promise<void> {
    if (typeof (this.memory as Partial<OnModuleDestroy>).onModuleDestroy === 'function') {
      this.logger.log('♻️ Shutting down memory provider...')
      await (this.memory as unknown as OnModuleDestroy).onModuleDestroy()
      this.logger.log('Memory provider shut down')
    }
  }

  /**
   * Retrieves the chat history for a given session.
   *
   * @param sessionId Session identifier.
   * @returns Promise resolving to an array of chat messages.
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    this.logger.debug(`Fetching history for session: ${sessionId}`)
    return this.memory.getHistory(sessionId)
  }

  /**
   * Adds a message to the chat history.
   *
   * @param sessionId Session identifier.
   * @param role Role of the sender: 'user' or 'assistant'.
   * @param content Message content.
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    this.logger.debug(`Storing message in session ${sessionId}: [${role}] ${content}`)
    return this.memory.addMessage(sessionId, role, content)
  }

  /**
   * Clears all stored messages for a session.
   *
   * @param sessionId Session identifier.
   */
  async clear(sessionId: string): Promise<void> {
    this.logger.debug(`Clearing memory for session: ${sessionId}`)
    return this.memory.clear(sessionId)
  }
}
