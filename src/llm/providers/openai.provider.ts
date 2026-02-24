import { Injectable, Logger } from '@nestjs/common'
import { LlmProvider, OpenAiProviderConfig } from '../interfaces/llm-provider.interface'
import { ChatOpenAI } from '@langchain/openai'
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import type { DynamicTool } from '@langchain/core/tools'

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
  async generate(prompt: string, options?: { tools?: DynamicTool[] }): Promise<string> {
    this.logger.debug(` Sending prompt to OpenAI: "${prompt}"`)
    try {
      // Base message list
      const messages = [new HumanMessage(prompt)]

      if (!options?.tools || options.tools.length === 0) {
        const result = await this.chat.invoke(messages)
        const response = result.content.toString().trim()
        this.logger.debug(`✅ OpenAI response: "${response}"`)
        return response
      }

      // Tool-calling path
      const bound = this.chat.bindTools(options.tools)
      this.logger.log(`OpenAI tool-calling engaged with ${options.tools.length} tool(s).`)
      let aiMsg: AIMessage = await bound.invoke(messages)
      // Loop while model requests tool calls
      while (Array.isArray((aiMsg as any).tool_calls) && ((aiMsg as any).tool_calls as any[]).length > 0) {
        const toolCalls = (aiMsg as any).tool_calls as any[]
        // Include the AI tool-call message in history
        messages.push(aiMsg)
        for (const call of toolCalls) {
          const tool = options.tools.find((t) => t.name === call.name)
          if (!tool) {
            this.logger.warn(`Model requested unknown tool: ${call.name}`)
            continue
          }
          const args = call.args?.input ?? call.args?.query ?? call.args ?? ''
          const argString = typeof args === 'string' ? args : JSON.stringify(args)
          const argPreview = argString.length > 200 ? `${argString.slice(0, 200)}...` : argString
          this.logger.log(`Model requested tool: ${call.name} (id=${call.id}) with input: ${argPreview}`)
          const result = await tool.invoke(argString)
          const resultPreview = typeof result === 'string' ? result : JSON.stringify(result)
          this.logger.log(
            `Tool ${call.name} completed (id=${call.id}) with result: ${
              resultPreview.length > 300 ? resultPreview.slice(0, 300) + '...' : resultPreview
            }`,
          )
          messages.push(new ToolMessage({ content: result, tool_call_id: call.id, name: call.name }))
        }
        aiMsg = await bound.invoke(messages)
      }

      const finalText = aiMsg.content?.toString?.().trim?.() ?? ''
      this.logger.debug(`✅ OpenAI final response: "${finalText}"`)
      return finalText
    } catch (error) {
      this.logger.error(
        ' Failed to generate response from OpenAI',
        error instanceof Error ? error.stack : String(error),
      )
      throw error
    }
  }
}
