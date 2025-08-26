import { Injectable, Logger } from '@nestjs/common'
import { LlmProvider, OpenAiProviderConfig } from '../interfaces/llm-provider.interface'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'

/**
 * Provider implementation for OpenAI using the LangChain `ChatOpenAI` class.
 *
 * This provider wraps the LangChain chat model and exposes a simple API to
 * generate completions from a plain text prompt.  Using LangChain allows
 * swapping between different chat model implementations while retaining a
 * consistent interface and benefiting from features like streaming and tool
 * support.  Errors are logged and surfaced to callers.
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name)
  private readonly chat: ChatOpenAI

  /**
   * Constructs a new OpenAI provider.
   *
   * @param options Configuration including API key and optional model name.
   * @throws Will throw if the API key is missing.
   */
  constructor(options: OpenAiProviderConfig) {
    const { apiKey, model } = options
    if (!apiKey) {
      this.logger.error('❌ OPENAI_API_KEY not set in environment variables!')
      throw new Error('OPENAI_API_KEY not set')
    }
    // Default to gpt-3.5-turbo if no model provided.
    const modelName = model ?? 'gpt-3.5-turbo'
    this.chat = new ChatOpenAI({ openAIApiKey: apiKey, modelName })
    this.logger.log(`✅ OpenAI chat client initialized with model: ${modelName}`)
  }

  /**
   * Generates a response from the OpenAI chat model based on a given prompt.
   *
   * @param prompt The input text sent to the LLM.
   * @returns A promise resolving to the generated text from the model.
   */
  async generate(prompt: string): Promise<string> {
    this.logger.debug(` Sending prompt to OpenAI: "${prompt}"`)
    try {
      // Wrap the prompt as a human message; LangChain expects a sequence of
      // messages.  Additional system or assistant messages could be added here
      // in the future to support roles and system prompts.
      const messages = [new HumanMessage(prompt)]
      const result = await this.chat.invoke(messages)
      const response = result.content.toString().trim()

      this.logger.debug(`✅ OpenAI response: "${response}"`)
      return response
    } catch (error) {
      this.logger.error(
        ' Failed to generate response from OpenAI',
        error instanceof Error ? error.stack : String(error),
      )
      // Rethrow so callers can handle appropriately
      throw error
    }
  }
}
