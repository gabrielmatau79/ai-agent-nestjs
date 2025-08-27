import { Logger } from '@nestjs/common'
import { ChatMessage, AgentMemory } from '../interfaces/memory.interface'

/**
 * In‑memory implementation of the AgentMemory interface.
 *
 * Stores message history in a local `Map` by session ID.  Ideal for
 * development or single‑instance deployments where persistence across
 * processes or machines is not required.
 */
export class InMemory implements AgentMemory {
  private readonly logger = new Logger(InMemory.name)
  private readonly windowSize: number
  private readonly memory: Map<string, ChatMessage[]> = new Map()

  /**
   * Creates an instance of the in‑memory memory store.
   *
   * @param windowSize Maximum number of messages to retain per session.
   */
  constructor(windowSize: number) {
    this.windowSize = windowSize
    this.logger.log(`InMemory store initialised with window size ${windowSize}`)
  }

  /**
   * Retrieves the message history for a specific session.
   *
   * @param sessionId Unique identifier for the session.
   * @returns A promise resolving to the session's chat history.
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const history = this.memory.get(sessionId) ?? []
    this.logger.debug(`Returning ${history.length} message(s) from session ${sessionId}`)
    return history
  }

  /**
   * Adds a message to the session's history.  If the history exceeds the
   * configured window size, the oldest messages are removed.
   *
   * @param sessionId Session identifier.
   * @param role Role of the message sender: 'user' or 'assistant'.
   * @param content Message content.
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const history = await this.getHistory(sessionId)
    history.push({ role, content })
    // Trim the history to fit within the window size.
    while (history.length > this.windowSize) {
      history.shift()
    }
    this.memory.set(sessionId, history)
    this.logger.debug(`Stored message for session ${sessionId}: [${role}] ${content}`)
  }

  /**
   * Clears the message history for a given session.
   *
   * @param sessionId Session identifier to clear history.
   */
  async clear(sessionId: string): Promise<void> {
    this.memory.delete(sessionId)
    this.logger.log(`Cleared memory for session ${sessionId}`)
  }
}
