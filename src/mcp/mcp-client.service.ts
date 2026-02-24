import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import type { StructuredToolInterface } from '@langchain/core/tools'

type McpTransport = 'stdio' | 'sse' | 'http'

type McpServerConfig = {
  transport: McpTransport
  type?: McpTransport
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  defaultToolTimeout?: number
  optional?: boolean
  restart?: {
    enabled?: boolean
    maxAttempts?: number
    delayMs?: number
  }
}

type McpServersConfig = Record<string, McpServerConfig>

@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name)
  private readonly eventBus = new EventEmitter()
  private readonly optionalServers = new Set<string>()
  private client: MultiServerMCPClient | null = null
  private toolsByName = new Map<string, StructuredToolInterface>()

  constructor(private readonly configService: ConfigService) {}

  get events(): EventEmitter {
    return this.eventBus
  }

  async loadTools(): Promise<StructuredToolInterface[]> {
    const hasServers = this.configService.get<string>('appConfig.mcpServersRaw', '').trim().length > 0
    if (!hasServers) {
      this.logger.debug('No MCP_SERVERS configured; skipping MCP tool loading.')
      return []
    }
    const client = this.getOrCreateClient()
    const tools = await client.getTools()
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]))
    this.eventBus.emit('progress', {
      type: 'tools_loaded',
      count: tools.length,
      names: tools.map((tool) => tool.name),
    })
    this.logger.log(`Loaded ${tools.length} MCP tool(s): ${tools.map((tool) => tool.name).join(', ')}`)
    return tools
  }

  getTool(name: string): StructuredToolInterface | undefined {
    return this.toolsByName.get(name)
  }

  async close(): Promise<void> {
    if (!this.client) return
    await this.client.close()
    this.client = null
    this.toolsByName.clear()
    this.logger.log('MCP client closed.')
  }

  async onModuleDestroy(): Promise<void> {
    await this.close()
  }

  private getOrCreateClient(): MultiServerMCPClient {
    if (this.client) return this.client

    const mcpServers = this.readMcpServers()
    this.client = new MultiServerMCPClient({
      mcpServers: mcpServers as Record<string, any>,
      throwOnLoadError: this.configService.get<boolean>('appConfig.mcpThrowOnLoadError', true),
      useStandardContentBlocks: this.configService.get<boolean>('appConfig.mcpUseStandardContentBlocks', true),
      onConnectionError: ({ error, serverName }: { error: unknown; serverName: string }) => {
        const message = error instanceof Error ? error.message : String(error)
        if (this.optionalServers.has(serverName)) {
          this.logger.warn(`Optional MCP server "${serverName}" is unavailable: ${message}`)
          this.eventBus.emit('message', {
            level: 'warn',
            serverName,
            optional: true,
            message,
          })
          return
        }
        this.logger.error(`MCP server "${serverName}" connection error: ${message}`)
        this.eventBus.emit('message', {
          level: 'error',
          serverName,
          optional: false,
          message,
        })
      },
      beforeToolCall: (toolCall: { args: unknown; name: string; serverName: string }) => {
        const requestId = randomUUID()
        const args =
          typeof toolCall.args === 'object' && toolCall.args !== null
            ? { ...(toolCall.args as Record<string, unknown>), requestId }
            : { input: toolCall.args, requestId }
        this.eventBus.emit('progress', {
          type: 'before_tool_call',
          requestId,
          toolName: toolCall.name,
          serverName: toolCall.serverName,
        })
        return { args }
      },
      afterToolCall: (res: { name: string; serverName: string; result: unknown }) => {
        let normalized = res.result
        if (Array.isArray(normalized)) {
          normalized = normalized.map((block) => {
            if ((block as any)?.type === 'text' && typeof (block as any).text !== 'string') {
              return { ...(block as any), text: JSON.stringify((block as any).text) }
            }
            return block
          })
        } else if (typeof normalized === 'object' && normalized !== null) {
          normalized = JSON.stringify(normalized)
        }
        this.eventBus.emit('progress', {
          type: 'after_tool_call',
          toolName: res.name,
          serverName: res.serverName,
          resultBlocks: Array.isArray(normalized) ? normalized.length : 1,
        })
        return { result: normalized }
      },
    })

    return this.client
  }

  private readMcpServers(): McpServersConfig {
    const raw = this.configService.get<string>('appConfig.mcpServersRaw', '').trim()
    if (!raw) return {}

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      throw new Error(`MCP_SERVERS has invalid JSON: ${(error as Error).message}`)
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('MCP_SERVERS must be a JSON object keyed by server name.')
    }

    const servers = parsed as McpServersConfig
    const defaultToken = this.configService.get<string>('appConfig.mcpAuthToken', '')
    const defaultHeader = this.configService.get<string>('appConfig.mcpAuthHeader', 'Authorization')
    const defaultTimeout = this.configService.get<number>('appConfig.mcpToolTimeout', 20000)

    Object.entries(servers).forEach(([name, config]) => {
      config.defaultToolTimeout = config.defaultToolTimeout ?? defaultTimeout
      if (config.optional) this.optionalServers.add(name)
      if (config.transport !== 'stdio') {
        config.headers ??= {}
        if (defaultToken && !config.headers[defaultHeader]) {
          config.headers[defaultHeader] = `Bearer ${defaultToken}`
        }
      } else {
        config.restart = {
          enabled: config.restart?.enabled ?? true,
          maxAttempts: config.restart?.maxAttempts ?? 3,
          delayMs: config.restart?.delayMs ?? 1000,
        }
      }
    })

    return servers
  }
}
