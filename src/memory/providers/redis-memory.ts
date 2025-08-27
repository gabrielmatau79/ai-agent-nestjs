import { OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common'
import { ChatMessage, AgentMemory } from '../interfaces/memory.interface'
import { createClient, RedisClientType } from 'redis'

/**
 * Redis‑based implementation of the AgentMemory interface.
 *
 * Stores chat messages per session using Redis lists with optional window
 * size trimming.  Implements NestJS lifecycle hooks for graceful startup and
 * shutdown.
 */
export class RedisMemory implements AgentMemory, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisMemory.name)
  private readonly windowSize: number
  private readonly redis: RedisClientType

  /**
   * Constructs a RedisMemory instance.
   *
   * @param windowSize Maximum number of messages to keep in history per session.
   * @param redisUrl Redis connection URL (e.g., redis://localhost:6379).
   */
  constructor(windowSize: number, redisUrl: string) {
    this.windowSize = windowSize
    this.redis = createClient({ url: redisUrl })
    this.logger.log(`RedisMemory initialised with window size ${windowSize}`)
  }

  /**
   * Lifecycle hook to connect to Redis when the module starts.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect()
      this.logger.log('✅ Connected to Redis')
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis', (error as Error).stack)
      throw error
    }
  }

  /**
   * Lifecycle hook to gracefully disconnect from Redis on shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit()
      this.logger.log('Redis connection closed')
    } catch (error) {
      this.logger.warn('⚠️ Error closing Redis connection', (error as Error).stack)
    }
  }

  /**
   * Builds the Redis key for a given session ID.
   *
   * @param sessionId Unique identifier for the user/session.
   * @returns A Redis key string.
   */
  private key(sessionId: string): string {
    return `chat:history:${sessionId}`
  }

  /**
   * Retrieves the message history for a given session.
   *
   * @param sessionId Unique identifier for the session.
   * @returns Array of chat messages.
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const data = await this.redis.lRange(this.key(sessionId), 0, -1)
      const messages = data.map((json) => JSON.parse(json) as ChatMessage)
      this.logger.debug(`Fetched ${messages.length} message(s) from session ${sessionId}`)
      return messages
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve history for session ${sessionId}`, (error as Error).stack)
      return []
    }
  }

  /**
   * Adds a new message to the Redis list for a session.  Automatically trims
   * the list to maintain the window size and sets a time‑to‑live (TTL) of
   * four hours on the key.
   *
   * @param sessionId Session identifier.
   * @param role Role of the message sender: 'user' or 'assistant'.
   * @param content Message content.
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const msg = JSON.stringify({ role, content })
    try {
      const key = this.key(sessionId)
      await this.redis.rPush(key, msg)
      await this.redis.lTrim(key, -this.windowSize, -1)
      await this.redis.expire(key, 60 * 60 * 4) // 4 hours TTL
      this.logger.debug(`Stored message for session ${sessionId}: ${content}`)
    } catch (error) {
      this.logger.error(`❌ Failed to add message for session ${sessionId}`, (error as Error).stack)
    }
  }

  /**
   * Clears all messages for a given session.
   *
   * @param sessionId Session identifier to clear history.
   */
  async clear(sessionId: string): Promise<void> {
    try {
      await this.redis.del(this.key(sessionId))
      this.logger.log(`Cleared memory for session ${sessionId}`)
    } catch (error) {
      this.logger.warn(`⚠️ Failed to clear session ${sessionId}`, (error as Error).stack)
    }
  }
}
