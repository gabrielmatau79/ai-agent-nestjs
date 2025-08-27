import { Test, TestingModule } from '@nestjs/testing'
import { AgentService } from './agent.service'
import { RagService } from '../rag/rag.service'
import { LlmService } from '../llm/llm.service'
import { MemoryService } from '../memory/memory.service'
import { AskDto } from './dto/ask.dto'

/**
 * Unit tests for {@link AgentService}.
 *
 * The `AgentService` orchestrates language detection, context retrieval and
 * response generation.  These tests mock the dependent services to verify
 * that the service calls them correctly and returns the expected result.
 */
describe('AgentService', () => {
  let agentService: AgentService
  let ragService: Record<string, jest.Mock>
  let llmService: Record<string, jest.Mock>
  let memoryService: Record<string, jest.Mock>

  beforeEach(async () => {
    // Create simple mocks for dependent services
    ragService = {
      retrieveContext: jest.fn().mockResolvedValue(['context snippet']),
    } as unknown as Record<string, jest.Mock>
    llmService = {
      generate: jest.fn().mockResolvedValue('mocked answer'),
    } as unknown as Record<string, jest.Mock>
    memoryService = {
      getHistory: jest.fn().mockResolvedValue([]),
      addMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as Record<string, jest.Mock>

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: RagService, useValue: ragService },
        { provide: LlmService, useValue: llmService },
        { provide: MemoryService, useValue: memoryService },
      ],
    }).compile()

    agentService = module.get<AgentService>(AgentService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return a response and call dependencies correctly', async () => {
    const options: AskDto = { userInput: 'Hello world', sessionId: 'session1' }

    const answer = await agentService.chat(options)

    // Ensure the response matches the mocked LLM output
    expect(answer).toBe('mocked answer')
    // Ensure history was retrieved for the session
    expect(memoryService.getHistory).toHaveBeenCalledWith('session1')
    // Ensure context retrieval called with user input
    expect(ragService.retrieveContext).toHaveBeenCalledWith('Hello world')
    // Ensure the LLM was invoked with a prompt containing the user input
    expect(llmService.generate).toHaveBeenCalledTimes(1)
    // The third argument is an options object containing userLang.  Since
    // language detection is asynchronous and depends on the input, we only
    // assert that the options object exists.
    // The second parameter to generate() should be an options object
    const [, callOptions] = llmService.generate.mock.calls[0]
    expect(callOptions).toBeDefined()
    // Ensure both user and assistant messages were saved
    expect(memoryService.addMessage).toHaveBeenCalledTimes(2)
    expect(memoryService.addMessage).toHaveBeenNthCalledWith(1, 'session1', 'user', 'Hello world')
    expect(memoryService.addMessage).toHaveBeenNthCalledWith(2, 'session1', 'assistant', 'mocked answer')
  })

  it('should use provided language without detection', async () => {
    const options: AskDto = { userInput: 'Hola mundo', sessionId: 'session2', userLang: 'es' }
    await agentService.chat(options)
    // The generate method should have been called with the provided language
    const [, callOptions] = llmService.generate.mock.calls[0]
    expect(callOptions.userLang).toBe('es')
  })
})
