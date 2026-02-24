import { listLocalMcpTools, runLocalMcpTool } from '../../mcp-server/tools'

describe('local MCP server tools', () => {
  it('lists the expected tool names', () => {
    const names = listLocalMcpTools().map((tool) => tool.name)
    expect(names).toEqual(['queryRag', 'getMemoryHistory', 'addMemoryMessage', 'clearMemory'])
  })

  it('runs queryRag tool', async () => {
    const ragService = {
      retrieveContext: jest.fn().mockResolvedValue(['doc 1', 'doc 2']),
    }
    const memoryService = {
      getHistory: jest.fn(),
      addMessage: jest.fn(),
      clear: jest.fn(),
    }

    const result = await runLocalMcpTool('queryRag', { query: 'what is nestjs' }, { ragService, memoryService } as any)
    const parsed = JSON.parse(result)

    expect(parsed.query).toBe('what is nestjs')
    expect(parsed.contexts).toEqual(['doc 1', 'doc 2'])
    expect(ragService.retrieveContext).toHaveBeenCalledWith('what is nestjs')
  })

  it('validates addMemoryMessage tool input', async () => {
    const ragService = {
      retrieveContext: jest.fn(),
    }
    const memoryService = {
      getHistory: jest.fn(),
      addMessage: jest.fn(),
      clear: jest.fn(),
    }

    await expect(
      runLocalMcpTool('addMemoryMessage', { sessionId: 's1', role: 'invalid', content: 'hello' }, {
        ragService,
        memoryService,
      } as any),
    ).rejects.toThrow()
  })
})
