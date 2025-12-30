import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { AIMessage, BaseMessage } from '@langchain/core/messages'
import type { DynamicTool } from '@langchain/core/tools'
import type { Runnable } from '@langchain/core/runnables'
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents'
import { ChatOpenAI } from '@langchain/openai'
import { ChatOllama } from '@langchain/ollama'

import { detectLanguage } from '../common/utils/lang-detect.util'
import { ToolsService } from './tools/tools.service'
import { MemoryService } from '../memory/memory.service'
import { LangchainSessionMemory } from '../memory/langchain-session-memory'

export interface LlmGenerateOptions {
  sessionId: string
  userLang?: string
}

/**
 * LlmService
 *
 * Centralizes LLM configuration with LangChain AgentExecutor, including
 * prompt templates, tool-calling, and session memory handling.
 */
@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name)
  private readonly agentPrompt: string
  private readonly providerName: string
  private readonly llm: ChatOpenAI | ChatOllama
  private readonly tools: DynamicTool[]
  private readonly toolPrompt: ChatPromptTemplate
  private readonly fallbackPrompt: ChatPromptTemplate
  private agent: Runnable | null = null

  /**
   * Constructs the LLM service and prepares the tool-calling agent.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: ToolsService,
    private readonly memoryService: MemoryService,
  ) {
    this.agentPrompt = this.configService.get<string>('appConfig.agentPrompt') ?? ''
    this.providerName = this.configService.get<string>('appConfig.llmProvider') ?? 'openai'
    this.logger.log(`Initializing LlmService with provider: ${this.providerName}`)
    this.llm = this.instantiateLlm(this.providerName)

    this.tools = this.toolsService.getTools()
    const systemPrompt = this.buildSystemPrompt()
    this.toolPrompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ])
    this.fallbackPrompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['user', '{input}'],
    ])

    this.trySetupToolAgent()
  }

  onModuleInit() {
    try {
      const names = this.tools.map((t) => t.name).join(', ')
      this.logger.log(`Tools initialized: ${this.tools.length} tool(s) available to the LLM`)
      if (names.length > 0) this.logger.log(`Tools: ${names}`)
    } catch (e) {
      this.logger.error(`Failed to initialize tools on module init: ${(e as Error).message}`)
    }
  }

  /**
   * Generates a response from the configured LLM provider using an AgentExecutor
   * with memory + tools when available.
   */
  async generate(userMessage: string, options?: LlmGenerateOptions): Promise<string> {
    const userLang = options?.userLang ?? detectLanguage(userMessage)
    if (!options?.userLang) this.logger.log(`Detected user language: ${userLang}`)

    const input = {
      input: userMessage,
      today: new Date().toISOString().split('T')[0],
      user_lang: userLang,
    }

    try {
      if (this.agent && options?.sessionId) {
        const memory = new LangchainSessionMemory(this.memoryService, options.sessionId)
        const executor = new AgentExecutor({
          agent: this.agent,
          tools: this.tools,
          memory,
        })

        const result = await executor.invoke(input)
        return this.extractResponseText(result)
      }

      const messages = await this.fallbackPrompt.formatMessages(input)
      const response = await this.llm.invoke(messages)
      return this.extractResponseText(response)
    } catch (error) {
      this.logger.error(`Error during LLM generation: ${(error as Error).message}`, (error as Error).stack)
      throw error
    }
  }

  private buildSystemPrompt(): string {
    const basePrompt = this.agentPrompt.trim().length > 0 ? this.agentPrompt.trim() : 'You are a helpful AI assistant.'
    return [
      `Today's date is: {today}.`,
      basePrompt,
      'Use the rag_retriever tool to search the knowledge base when relevant.',
      'Respond in {user_lang} unless explicitly asked otherwise.',
    ].join('\n')
  }

  private trySetupToolAgent(): void {
    if (!this.tools.length) {
      this.logger.log('No tools configured, skipping agent setup.')
      return
    }
    if (this.providerName === 'ollama') {
      this.logger.warn('Ollama tool-calling may be limited; falling back to prompt-only mode.')
      return
    }
    try {
      this.agent = createToolCallingAgent({
        llm: this.llm,
        tools: this.tools,
        prompt: this.toolPrompt,
      })
      this.logger.log(`Tool-enabled agent initialized with ${this.tools.length} tool(s).`)
    } catch (error) {
      this.logger.error(`Failed to build tool agent: ${(error as Error).message}`)
    }
  }

  private instantiateLlm(provider: string): ChatOpenAI | ChatOllama {
    if (provider === 'ollama') {
      const endpoint = this.configService.get<string>('appConfig.ollamaEndpoint', 'http://localhost:11434')
      const model = this.configService.get<string>('appConfig.ollamaModel', 'llama3')
      this.logger.log(`ChatOllama initialization with endpoint: ${endpoint}, default model: ${model}`)
      return new ChatOllama({ baseUrl: endpoint, model })
    }

    const apiKey = this.configService.get<string>('appConfig.openaiApiKey')
    if (!apiKey) {
      this.logger.error('❌ OPENAI_API_KEY not set in environment variables!')
      throw new Error('OPENAI_API_KEY not set')
    }
    const model = this.configService.get<string>('appConfig.openaiModel') ?? 'gpt-3.5-turbo'
    this.logger.log(`ChatOpenAI initialization with apiKey: ${apiKey ? '*****' : 'undefined'}, model: ${model}`)
    return new ChatOpenAI({ openAIApiKey: apiKey, model })
  }

  private extractResponseText(result: unknown): string {
    if (typeof result === 'string') return result.trim()
    if (result && typeof (result as { output?: string }).output === 'string') {
      return (result as { output: string }).output.trim()
    }
    const content = (result as BaseMessage | AIMessage | { content?: unknown })?.content
    if (typeof content === 'string') return content.trim()
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part === 'string' ? part : ((part as { text?: string }).text ?? '')))
        .join('')
    }
    return JSON.stringify(result)
  }
}
