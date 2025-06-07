import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ChatMessage, AgentMemory } from './interfaces/memory.interface'
import { InMemory } from './providers/in-memory'
import { RedisMemory } from './providers/redis-memory'

/**
 * MemoryService acts as a runtime memory abstraction for chat sessions.
 *
 * Depending on configuration, it delegates to either:
 * - `InMemory` for local ephemeral storage (Map)
 * - `RedisMemory` for persistent distributed storage
 *
 * Set backend via `appConfig.agentMemoryType` in environment variables: `'memory' | 'redis'`
 */
@Injectable()
export class MemoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryService.name)
  private memory: AgentMemory
  private agentMemoryType: string
  private agentMemoryWindow: number
  private redisUrl: string

  /**
   * Constructs the MemoryService and initializes the correct memory provider.
   *
   * @param configService - Injected NestJS ConfigService for loading runtime environment values.
   */
  constructor(private configService: ConfigService) {
    this.agentMemoryType = this.configService.get<string>('appConfig.agentMemoryType')
    this.agentMemoryWindow = this.configService.get<number>('appConfig.agentMemoryWindow')
    this.redisUrl = this.configService.get<string>('appConfig.redisUrl')

    if (this.agentMemoryType === 'redis' && this.redisUrl) {
      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
      this.logger.log(`🧠 Using RedisMemory with window size ${this.agentMemoryWindow}`)
      this.memory = new RedisMemory(this.agentMemoryWindow, redisUrl)
    } else {
      this.logger.log(`🧠 Using InMemory with window size ${this.agentMemoryWindow}`)
      this.memory = new InMemory(this.agentMemoryWindow)
    }
  }

  /**
   * NestJS lifecycle hook: called once the module has been initialized.
   * Invokes memory provider's `onModuleInit` if it implements it.
   */
  async onModuleInit() {
    if (typeof (this.memory as Partial<OnModuleInit>).onModuleInit === 'function') {
      this.logger.log('📦 Initializing memory provider...')
      await (this.memory as unknown as OnModuleInit).onModuleInit()
      this.logger.log('✅ Memory provider initialized')
    }
  }

  /**
   * NestJS lifecycle hook: called during graceful shutdown.
   * Invokes memory provider's `onModuleDestroy` if it implements it.
   */
  async onModuleDestroy() {
    if (typeof (this.memory as Partial<OnModuleDestroy>).onModuleDestroy === 'function') {
      this.logger.log('♻️ Shutting down memory provider...')
      await (this.memory as unknown as OnModuleDestroy).onModuleDestroy()
      this.logger.log('🛑 Memory provider shut down')
    }
  }

  /**
   * Retrieves the chat history for a given session.
   *
   * @param sessionId - The session identifier.
   * @returns Promise resolving to an array of ChatMessages.
   */
  getHistory(sessionId: string): Promise<ChatMessage[]> {
    this.logger.debug(`📖 Fetching history for session: ${sessionId}`)
    return this.memory.getHistory(sessionId)
  }

  /**
   * Adds a new message to the memory store.
   *
   * @param sessionId - The session identifier.
   * @param role - 'user' or 'assistant'.
   * @param content - Message content to store.
   */
  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    this.logger.debug(`💬 Storing message in session ${sessionId}: [${role}] ${content}`)
    return this.memory.addMessage(sessionId, role, content)
  }

  /**
   * Clears all stored messages for the given session.
   *
   * @param sessionId - The session identifier.
   */
  clear(sessionId: string): Promise<void> {
    this.logger.debug(`🧹 Clearing memory for session: ${sessionId}`)
    return this.memory.clear(sessionId)
  }
}
