import { ChatMessage, AgentMemory } from '../interfaces/memory.interface'

/**
 * In-memory implementation of the AgentMemory interface.
 *
 * Stores message history in a local Map object by session ID.
 * Ideal for development or single-instance applications.
 */
export class InMemory implements AgentMemory {
  private readonly windowSize: number
  private readonly memory: Map<string, ChatMessage[]> = new Map()

  /**
   * Creates an instance of the InMemory memory store.
   *
   * @param windowSize - Maximum number of messages to retain per session.
   */
  constructor(windowSize: number) {
    this.windowSize = windowSize
  }

  /**
   * Retrieves the message history for a specific session.
   *
   * @param sessionId - Unique identifier for the session.
   * @returns A Promise resolving to the session's chat history.
   */
  getHistory(sessionId: string): Promise<ChatMessage[]> {
    const history = this.memory.get(sessionId) ?? []
    return Promise.resolve(history)
  }

  /**
   * Adds a message to the session's history.
   * If the history exceeds the window size, oldest messages are removed.
   *
   * @param sessionId - Session identifier.
   * @param role - Role of the message sender: 'user' or 'assistant'.
   * @param content - The message content.
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const history = await this.getHistory(sessionId)
    history.push({ role, content })

    // Trim the history to fit the window size
    while (history.length > this.windowSize) {
      history.shift()
    }

    this.memory.set(sessionId, history)
  }

  /**
   * Clears the message history for a given session.
   *
   * @param sessionId - The session identifier.
   * @returns A Promise that resolves when the session is cleared.
   */
  clear(sessionId: string): Promise<void> {
    this.memory.delete(sessionId)
    return Promise.resolve()
  }
}
