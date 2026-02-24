import { ConfigService } from '@nestjs/config'
import { McpClientService } from '../mcp-client.service'

const mockGetTools = jest.fn()
const mockClose = jest.fn()

jest.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    getTools: mockGetTools,
    close: mockClose,
  })),
}))

const { MultiServerMCPClient: mockMcpClientCtor } = jest.requireMock('@langchain/mcp-adapters') as {
  MultiServerMCPClient: jest.Mock
}

describe('McpClientService', () => {
  const configValues: Record<string, unknown> = {
    'appConfig.mcpServersRaw': JSON.stringify({
      optionalRemote: {
        transport: 'sse',
        url: 'https://mcp.example.com/sse',
        optional: true,
      },
      localStdio: {
        transport: 'stdio',
        command: 'node',
        args: ['dist/mcp-server/index.js'],
      },
    }),
    'appConfig.mcpThrowOnLoadError': true,
    'appConfig.mcpUseStandardContentBlocks': true,
    'appConfig.mcpAuthToken': 'token-123',
    'appConfig.mcpAuthHeader': 'Authorization',
  }

  let service: McpClientService
  let configService: Pick<ConfigService, 'get'>

  beforeEach(() => {
    jest.clearAllMocks()
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        Object.prototype.hasOwnProperty.call(configValues, key) ? configValues[key] : defaultValue,
      ),
    }
    service = new McpClientService(configService as ConfigService)
  })

  it('loads tools and returns them by name', async () => {
    const remoteTool = { name: 'remoteLookup' }
    mockGetTools.mockResolvedValue([remoteTool])

    const tools = await service.loadTools()

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('remoteLookup')
    expect(service.getTool('remoteLookup')).toBe(remoteTool)
    expect(mockMcpClientCtor).toHaveBeenCalledTimes(1)
  })

  it('builds MCP client with expected options and tool hooks', async () => {
    mockGetTools.mockResolvedValue([])
    await service.loadTools()

    const constructorOptions = mockMcpClientCtor.mock.calls[0][0]
    expect(constructorOptions.throwOnLoadError).toBe(true)
    expect(constructorOptions.useStandardContentBlocks).toBe(true)
    expect(constructorOptions.mcpServers.optionalRemote.headers.Authorization).toBe('Bearer token-123')
    expect(constructorOptions.mcpServers.localStdio.restart.enabled).toBe(true)

    const before = constructorOptions.beforeToolCall({
      name: 'remoteLookup',
      args: { query: 'nestjs' },
      serverName: 'optionalRemote',
    })
    expect(before.args.query).toBe('nestjs')
    expect(before.args.requestId).toBeDefined()

    const after = constructorOptions.afterToolCall({
      name: 'remoteLookup',
      result: [{ type: 'text', text: 'ok' }],
      serverName: 'optionalRemote',
    })
    expect(after).toEqual({ result: [{ type: 'text', text: 'ok' }] })

    expect(() =>
      constructorOptions.onConnectionError({ error: new Error('offline'), serverName: 'optionalRemote' }),
    ).not.toThrow()
  })

  it('closes MCP client gracefully', async () => {
    mockGetTools.mockResolvedValue([])
    await service.loadTools()
    await service.close()
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('fails when MCP_SERVERS is invalid JSON', async () => {
    ;(configService.get as jest.Mock).mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'appConfig.mcpServersRaw') return '{invalid-json}'
      return Object.prototype.hasOwnProperty.call(configValues, key) ? configValues[key] : defaultValue
    })
    const invalidService = new McpClientService(configService as ConfigService)
    await expect(invalidService.loadTools()).rejects.toThrow('MCP_SERVERS has invalid JSON')
  })
})
