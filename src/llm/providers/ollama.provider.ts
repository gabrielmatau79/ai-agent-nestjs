import { Injectable, Logger } from '@nestjs/common'
import { LlmProvider, OllamaProviderConfig } from '../interfaces/llm-provider.interface'
import axios from 'axios'

/**
 * LLM Provider for Ollama.
 *
 * This provider generates completions using locally hosted Ollama models.
 * Configuration includes customizable endpoint and model name.
 */
@Injectable()
export class OllamaProvider implements LlmProvider {
  private readonly logger = new Logger(OllamaProvider.name)
  private readonly endpoint: string
  private readonly model: string

  /**
   * Constructs the OllamaProvider using configuration options.
   *
   * @param options Configuration object containing:
   *  - `endpoint`: URL to the Ollama API server.
   *  - `model`: Default model name to use for generation.
   *
   * @throws Will throw an error if the endpoint is not provided.
   */
  constructor(options: OllamaProviderConfig) {
    const { endpoint, model } = options

    if (!endpoint) {
      this.logger.error('❌ Ollama endpoint not provided!')
      throw new Error('Ollama endpoint is required')
    }

    this.endpoint = endpoint
    this.model = model || 'llama3'
    this.logger.log(`✅ OllamaProvider initialized with model "${this.model}" at "${this.endpoint}"`)
  }

  /**
   * Generates a response using the Ollama model.
   *
   * @param prompt The text prompt to send to the model.
   * @param options Optional override for model name.
   * @returns A Promise resolving to the model's generated response.
   *
   * @throws If the response is empty or the HTTP request fails.
   */
  async generate(prompt: string, options?: { model?: string }): Promise<string> {
    const model = options?.model || this.model
    const url = this.endpoint.endsWith('/api/generate')
      ? this.endpoint
      : this.endpoint.replace(/\/+$/, '') + '/api/generate'

    this.logger.debug(`🔍 Sending prompt to Ollama model "${model}" at "${url}"`)
    this.logger.verbose(`📝 Prompt: ${prompt}`)

    try {
      const response = await axios.post(url, {
        model,
        prompt,
        stream: false,
      })

      const content = response.data?.response
      if (!content) {
        this.logger.error('❗ Ollama returned empty content')
        throw new Error('Ollama returned empty content')
      }

      const result = content.trim()
      this.logger.debug(`✅ Response from Ollama: ${result}`)
      return result
    } catch (error) {
      this.logger.error(`🔥 Failed to get response from Ollama: ${(error as Error).message}`, (error as Error).stack)
      throw error
    }
  }
}
