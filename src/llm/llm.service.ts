import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LlmProvider } from './interfaces/llm-provider.interface'
import { OpenAiProvider } from './providers/openai.provider'
import { OllamaProvider } from './providers/ollama.provider'
import { detectLanguage } from '../common/utils/lang-detect.util'
import { ToolsService } from './tools/tools.service'

/**
 * Service responsible for instantiating and delegating to a concrete LLM provider.
 *
 * The provider (OpenAI or Ollama) is selected at construction time based on
 * application configuration.  This class also builds prompts using an agent
 * prompt prefix and optional language hints, and exposes a `generate` method
 * that hides provider specific details from callers.  All actions are logged
 * for visibility.
 */
@Injectable()
export class LlmService implements OnModuleInit {
  /** Selected LLM provider implementation. */
  private provider: LlmProvider
  /** Agent prompt prefix loaded from configuration. */
  private readonly agentPrompt: string
  /** Internal logger instance. */
  private readonly logger = new Logger(LlmService.name)

  /**
   * Constructs the LLM service.
   *
   * @param configService NestJS configuration service used to access environment variables.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: ToolsService,
  ) {
    // Load the agent prompt.  This provides high‑level instructions for the
    // assistant and should be kept concise.
    this.agentPrompt = this.configService.get<string>('appConfig.agentPrompt') ?? ''
    const llmProvider = this.configService.get<string>('appConfig.llmProvider')
    this.logger.log(`Initializing LlmService with provider: ${llmProvider}`)

    // Instantiate the appropriate provider based on configuration.
    if (llmProvider === 'ollama') {
      const endpoint = this.configService.get<string>('appConfig.ollamaEndpoint', 'http://localhost:11434')
      const model = this.configService.get<string>('appConfig.ollamaModel', 'llama3')
      this.logger.log(`OllamaProvider initialization with endpoint: ${endpoint}, default model: ${model}`)
      this.provider = new OllamaProvider({ endpoint, model })
      this.logger.log('OllamaProvider selected.')
    } else {
      // Default to OpenAI when nothing is specified or the value is 'openai'.
      const apiKey = this.configService.get<string>('appConfig.openaiApiKey')
      const model = this.configService.get<string>('appConfig.openaiModel')
      this.logger.log(
        `OpenAiProvider initialization with apiKey: ${apiKey ? '*****' : 'undefined'}, default model: ${model}`,
      )
      this.provider = new OpenAiProvider({ apiKey, model })
      this.logger.log('OpenAiProvider selected.')
    }
    this.logger.debug(`Agent prompt loaded: "${this.agentPrompt}"`)
  }

  onModuleInit() {
    // Initialize tools at module init and print their names
    try {
      const tools = this.toolsService.getTools()
      const names = tools.map((t) => t.name).join(', ')
      this.logger.log(`Tools initialized: ${tools.length} tool(s) available to the LLM`)
      if (names.length > 0) this.logger.log(`Tools: ${names}`)
    } catch (e) {
      this.logger.error(`Failed to initialize tools on module init: ${(e as Error).message}`)
    }
  }

  /**
   * Builds the final prompt for the LLM using the agent prompt and user specific options.
   *
   * @param userMessage The user message to include in the prompt.
   * @param options Optional parameters such as user language.
   * @returns The final prompt string to send to the LLM.
   */
  buildPrompt(userMessage: string, options?: { userLang?: string }): string {
    let prompt = this.agentPrompt
    // If the user language is not English, instruct the assistant to answer in that language.
    if (options?.userLang && options.userLang.toLowerCase() !== 'en') {
      prompt += ` Always respond in ${options.userLang}, unless told otherwise.`
      this.logger.debug(`Agent will answer in language: ${options.userLang}`)
    }
    // Combine the agent prompt and user message into a typical conversational format.
    const finalPrompt = `${prompt}\nUser: ${userMessage}`
    this.logger.verbose(`Built prompt: ${finalPrompt}`)
    return finalPrompt
  }

  /**
   * Generates a response from the configured LLM provider using the agent's role prompt
   * and the user message.  Language detection is performed when no language hint is provided.
   *
   * @param userMessage The user's input message.
   * @param options Optional generation parameters, including user language.
   * @returns A promise resolving with the model's response text.
   */
  async generate(userMessage: string, options?: { userLang?: string; [key: string]: any }): Promise<string> {
    let lang = options?.userLang
    if (!lang) {
      lang = detectLanguage(userMessage)
      this.logger.log(`Detected user language: ${lang}`)
    }
    const prompt = this.buildPrompt(userMessage, { userLang: lang })
    this.logger.debug(`Sending prompt to provider: "${prompt}"`)
    try {
      const tools = this.toolsService.getTools()
      this.logger.debug(`Available tools: ${tools.map((t) => t.name).join(', ')}`)
      const result = await this.provider.generate(prompt, { ...options, userLang: lang, tools })
      this.logger.debug('LLM provider returned response.')
      return result
    } catch (error) {
      this.logger.error(`Error during LLM provider generation: ${(error as Error).message}`, (error as Error).stack)
      throw error
    }
  }
}
