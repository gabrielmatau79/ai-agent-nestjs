import { Logger } from '@nestjs/common'
import { LlmProvider, openiaProviderConfig } from '../interfaces/llm-provider.interface'
import { OpenAI } from 'openai'

/**
 * Provider implementation for OpenAI using the LangChain-compatible interface.
 *
 * This class wraps the OpenAI SDK to generate completions via chat-based models
 * like `gpt-3.5-turbo` or `gpt-4`.
 */
export class OpenAiProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name)

  private client: OpenAI
  private model: string

  /**
   * Creates an instance of OpenAiProvider.
   *
   * @param options - Configuration for the provider including API key and model name.
   * @throws Will throw an error if the API key is not provided.
   */
  constructor(options: openiaProviderConfig) {
    const { apiKey, model } = options

    if (!apiKey) {
      this.logger.error('❌ OPENAI_API_KEY not set in environment variables!')
      throw new Error('OPENAI_API_KEY not set')
    }

    this.model = model || 'gpt-3.5-turbo'
    this.client = new OpenAI({ apiKey })

    this.logger.log(`✅ OpenAI client initialized with model: ${this.model}`)
  }

  /**
   * Generates a response from the OpenAI model based on a given prompt.
   *
   * @param prompt - The input text to send to the LLM.
   * @returns A promise resolving to the generated text from OpenAI.
   */
  async generate(prompt: string): Promise<string> {
    this.logger.debug(`📝 Sending prompt to OpenAI: "${prompt}"`)

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      })

      const result = completion.choices[0].message.content ?? ''
      this.logger.debug(`✅ OpenAI response: "${result}"`)
      return result
    } catch (error) {
      this.logger.error(
        '🔥 Failed to generate response from OpenAI',
        error instanceof Error ? error.stack : String(error),
      )
      throw error
    }
  }
}
