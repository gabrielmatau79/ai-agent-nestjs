import { Logger } from '@nestjs/common'
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages'
import { BaseChatMemory, type InputValues, type OutputValues, type MemoryVariables } from 'langchain/memory'
import { MemoryService } from './memory.service'
import { ChatMessage } from './interfaces/memory.interface'

/**
 * Adapter between LangChain memory and the app MemoryService.
 * Uses a sessionId to load and persist chat history.
 */
export class LangchainSessionMemory extends BaseChatMemory {
  private readonly logger = new Logger(LangchainSessionMemory.name)

  constructor(
    private readonly memoryService: MemoryService,
    private readonly sessionId: string,
  ) {
    super()
  }

  /**
   * Keys exposed to the prompt (must match MessagesPlaceholder name).
   */
  get memoryKeys(): string[] {
    return ['chat_history']
  }

  /**
   * Loads chat history from MemoryService and maps it to LangChain messages.
   */
  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    this.logger.debug(`[loadMemoryVariables] sessionId=${this.sessionId} inputKeys=${Object.keys(values).join(',')}`)
    const history: ChatMessage[] = await this.memoryService.getHistory(this.sessionId)
    const messages: BaseMessage[] = history.map((message, index) => {
      this.logger.debug(
        `[loadMemoryVariables] [${index}] role=${message.role} content="${
          message.content.length > 100 ? `${message.content.slice(0, 100)}...` : message.content
        }"`,
      )
      return message.role === 'user' ? new HumanMessage(message.content) : new AIMessage(message.content)
    })

    return { chat_history: messages }
  }

  /**
   * Persists input/output messages into MemoryService.
   */
  async saveContext(input: InputValues, output: OutputValues): Promise<void> {
    const userInput = (input.input ?? input.question ?? '') as string
    const aiOutput = (output.output ?? output.response ?? '') as string

    this.logger.debug(
      `[saveContext] sessionId=${this.sessionId} input="${userInput.slice(0, 120)}${
        userInput.length > 120 ? '...' : ''
      }" output="${aiOutput.slice(0, 120)}${aiOutput.length > 120 ? '...' : ''}"`,
    )

    if (userInput) {
      await this.memoryService.addMessage(this.sessionId, 'user', userInput)
    }
    if (aiOutput) {
      await this.memoryService.addMessage(this.sessionId, 'assistant', aiOutput)
    }
  }

  async clear(): Promise<void> {
    this.logger.debug(`[clear] Clearing memory for sessionId=${this.sessionId}`)
    await this.memoryService.clear(this.sessionId)
  }
}
