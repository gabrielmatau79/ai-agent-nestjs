import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { ZodError } from 'zod'
import { McpServerModule } from './mcp-server.module'
import { RagService } from '../rag/rag.service'
import { MemoryService } from '../memory/memory.service'
import { listLocalMcpTools, runLocalMcpTool } from './tools'

async function bootstrapMcpServer() {
  const logger = new Logger('LocalMcpServer')
  const app = await NestFactory.createApplicationContext(McpServerModule, {
    logger: ['error', 'warn', 'log'],
  })

  const ragService = app.get(RagService)
  const memoryService = app.get(MemoryService)

  const server = new Server(
    {
      name: 'ai-agent-nestjs-local-mcp',
      version: '0.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listLocalMcpTools(),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name
    try {
      const payload = await runLocalMcpTool(toolName, request.params.arguments ?? {}, {
        ragService,
        memoryService,
      })
      return {
        content: [{ type: 'text', text: payload }],
      }
    } catch (error) {
      const message =
        error instanceof ZodError
          ? `Invalid tool input: ${error.issues.map((i) => i.message).join('; ')}`
          : (error as Error).message
      logger.error(`Tool "${toolName}" failed: ${message}`)
      return {
        isError: true,
        content: [{ type: 'text', text: message }],
      }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.log('Local MCP server running on stdio transport.')

  const shutdown = async () => {
    try {
      await app.close()
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrapMcpServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start local MCP server:', error)
  process.exit(1)
})
