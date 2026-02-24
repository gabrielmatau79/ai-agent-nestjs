import { z } from 'zod'
import { RagService } from '../rag/rag.service'
import { MemoryService } from '../memory/memory.service'

const queryRagInputSchema = z.object({
  query: z.string().min(1),
})

const getMemoryHistoryInputSchema = z.object({
  sessionId: z.string().min(1),
})

const addMemoryMessageInputSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})

const clearMemoryInputSchema = z.object({
  sessionId: z.string().min(1),
})

export type LocalMcpToolName = 'queryRag' | 'getMemoryHistory' | 'addMemoryMessage' | 'clearMemory'

export function listLocalMcpTools() {
  return [
    {
      name: 'queryRag',
      description: 'Searches the RAG context provider and returns relevant document snippets.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language query for document retrieval.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'getMemoryHistory',
      description: 'Returns stored conversation history for a session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session identifier.' },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'addMemoryMessage',
      description: 'Appends a message to session memory.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session identifier.' },
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string', description: 'Message content.' },
        },
        required: ['sessionId', 'role', 'content'],
      },
    },
    {
      name: 'clearMemory',
      description: 'Clears stored messages for a session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session identifier.' },
        },
        required: ['sessionId'],
      },
    },
  ]
}

export async function runLocalMcpTool(
  toolName: string,
  args: unknown,
  dependencies: { ragService: RagService; memoryService: MemoryService },
): Promise<string> {
  const { ragService, memoryService } = dependencies

  switch (toolName as LocalMcpToolName) {
    case 'queryRag': {
      const { query } = queryRagInputSchema.parse(args ?? {})
      const contexts = await ragService.retrieveContext(query)
      return JSON.stringify({ query, contexts })
    }
    case 'getMemoryHistory': {
      const { sessionId } = getMemoryHistoryInputSchema.parse(args ?? {})
      const history = await memoryService.getHistory(sessionId)
      return JSON.stringify({ sessionId, history })
    }
    case 'addMemoryMessage': {
      const { sessionId, role, content } = addMemoryMessageInputSchema.parse(args ?? {})
      await memoryService.addMessage(sessionId, role, content)
      return JSON.stringify({ ok: true, sessionId, role })
    }
    case 'clearMemory': {
      const { sessionId } = clearMemoryInputSchema.parse(args ?? {})
      await memoryService.clear(sessionId)
      return JSON.stringify({ ok: true, sessionId })
    }
    default:
      throw new Error(`Unknown MCP tool: ${toolName}`)
  }
}
