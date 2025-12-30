import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosRequestConfig } from 'axios'
import { DynamicTool } from '@langchain/core/tools'
import { RagService } from '../../rag/rag.service'
import { createRagRetrieverTool } from './rag-retriever.tool'
import { LlmToolConfig, ToolsAuthConfig } from './types'

/**
 * ToolsService
 *
 * Builds a set of LLM-executable tools from environment configuration and
 * a small set of built-in utilities. Tools are exposed as LangChain
 * `DynamicTool` instances so they can be bound to supported chat models
 * (e.g., OpenAI with tool-calling).
 */
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name)
  private cachedTools: DynamicTool[] | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly ragService: RagService,
  ) {}

  /**
   * Returns the list of tools configured for the current environment.
   * Builds and memoizes the array on first access.
   */
  getTools(): DynamicTool[] {
    if (this.cachedTools) return this.cachedTools
    this.logger.log('Building tools from configuration...')
    const tools: DynamicTool[] = []

    // 1) Load external HTTP tools from env JSON
    const json = this.config.get<string>('appConfig.toolsConfigRaw')
    if (json) {
      try {
        const parsed = JSON.parse(json) as LlmToolConfig[]
        const auth: ToolsAuthConfig = {
          headerName: this.config.get<string>('appConfig.toolsAuthHeader') || 'Authorization',
          scheme: this.config.get<string>('appConfig.toolsAuthScheme') || 'Bearer',
          token: this.config.get<string>('appConfig.toolsAuthToken') || '',
        }
        parsed.forEach((cfg) => tools.push(this.createHttpTool(cfg, auth)))
        this.logger.log(`Loaded ${parsed.length} HTTP tools from LLM_TOOLS_CONFIG`)
      } catch (e) {
        this.logger.error('Failed to parse LLM_TOOLS_CONFIG JSON', (e as Error).stack)
      }
    } else {
      this.logger.debug('No LLM_TOOLS_CONFIG provided; skipping external tools.')
    }

    // 2) Add static tools (RAG + utilities)
    tools.push(createRagRetrieverTool(this.ragService))
    tools.push(
      new DynamicTool({
        name: 'getCurrentTime',
        description: 'Returns the current time in ISO 8601 format. Use to know the current date/time.',
        func: async () => new Date().toISOString(),
      }),
    )

    this.cachedTools = tools
    return tools
  }

  /**
   * Creates a DynamicTool that performs an HTTP request based on config.
   * Input convention: pass the user query as a plain string. If the endpoint
   * includes `{query}`, it will be replaced with `encodeURIComponent(input)`.
   * If not, for GET requests, a `?q=` query param will be appended.
   */
  private createHttpTool(cfg: LlmToolConfig, auth: ToolsAuthConfig): DynamicTool {
    const descSuffix =
      cfg.method === 'GET'
        ? ' Input is the query string to interpolate into the endpoint.'
        : ' Input is the query string; it will be sent as JSON body {"query": input} if not interpolated.'

    return new DynamicTool({
      name: cfg.name,
      description: `${cfg.description}${descSuffix}`,
      func: async (input: string) => {
        const hasPlaceholder = cfg.endpoint.includes('{query}')
        const encoded = encodeURIComponent(input ?? '')
        const url = hasPlaceholder
          ? cfg.endpoint.replace('{query}', encoded)
          : cfg.method === 'GET' && input
            ? `${cfg.endpoint}${cfg.endpoint.includes('?') ? '&' : '?'}q=${encoded}`
            : cfg.endpoint

        const headers: Record<string, string> = {}
        if (cfg.requiresAuth) {
          if (!auth.token) {
            this.logger.warn(`Tool "${cfg.name}" requires auth but no token provided. Set LLM_TOOLS_AUTH_TOKEN.`)
          } else {
            const headerName = auth.headerName || 'Authorization'
            const scheme = auth.scheme || 'Bearer'
            headers[headerName] = scheme ? `${scheme} ${auth.token}` : auth.token
          }
        }

        const request: AxiosRequestConfig = {
          url,
          method: cfg.method,
          headers,
        }

        if (cfg.method !== 'GET') {
          if (hasPlaceholder) {
            request.data = { query: input }
          } else {
            request.data = { query: input }
          }
        }

        try {
          const resp = await axios(request)
          // Normalize to string output
          if (typeof resp.data === 'string') return resp.data
          return JSON.stringify(resp.data)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.logger.error(`HTTP tool "${cfg.name}" failed: ${message}`)
          // Surface a compact error to the model
          return `ERROR calling ${cfg.name}: ${message}`
        }
      },
    })
  }
}
