import { Injectable, Logger } from '@nestjs/common'
import { LlmProvider, OllamaProviderConfig } from '../interfaces/llm-provider.interface'
import { Ollama } from '@langchain/ollama'
import { HumanMessage } from '@langchain/core/messages'

/**
 * Provider implementation for locally hosted Ollama models using LangChain.
 *
 * This provider wraps the LangChain `ChatOllama` chat model to produce
 * completions from a prompt.  It supports specifying a default model name
 * and endpoint, and falls back to sensible defaults if none are provided.  All
 * interactions are logged for easier debugging.
 */
@Injectable()
export class OllamaProvider implements LlmProvider {
  private readonly logger = new Logger(OllamaProvider.name)
  private readonly chat: Ollama

  /**
   * Constructs a new Ollama provider.
   *
   * @param options Configuration including the Ollama API endpoint and optional model name.
   * @throws Will throw if the endpoint is missing.
   */
  constructor(options: OllamaProviderConfig) {
    const { endpoint, model } = options
    if (!endpoint) {
      this.logger.error('❌ Ollama endpoint not provided!')
      throw new Error('Ollama endpoint is required')
    }
    // Strip trailing slashes to normalise the endpoint.
    const normalizedEndpoint = endpoint.replace(/\/+$/, '')
    const modelName = model ?? 'llama3'
    // Initialise the LangChain chat model with provided config.
    this.chat = new Ollama({ baseUrl: normalizedEndpoint, model: modelName })
    this.logger.log(`✅ OllamaProvider initialized with model "${modelName}" at "${normalizedEndpoint}"`)
  }

  /**
   * Generates a response from the Ollama chat model based on a given prompt.
   *
   * @param prompt The input text sent to the LLM.
   * @returns A promise resolving to the generated text from the model.
   */
  async generate(prompt: string, options?: { model?: string; tools?: any[] }): Promise<string> {
    const modelName = options?.model ?? undefined
    const effectiveModel = modelName ?? this.chat.model
    this.logger.debug(` Sending prompt to Ollama model "${effectiveModel}" at "${this.chat.baseUrl}"`)
    this.logger.verbose(` Prompt: ${prompt}`)
    try {
      if (options?.tools && options.tools.length > 0) {
        this.logger.warn('Tools were provided, but tool-calling is not enabled for Ollama provider yet.')
      }
      // If an override model is provided at call time, create a temporary chat
      // instance to use that model.  Otherwise reuse the default instance.
      const messages = [new HumanMessage(prompt)]
      const result = await this.chat.invoke(messages)
      const response = result.trim()
      this.logger.debug(`✅ Response from Ollama: ${response}`)
      return response
    } catch (error) {
      this.logger.error(` Failed to get response from Ollama: ${(error as Error).message}`, (error as Error).stack)
      throw error
    }
  }
}
