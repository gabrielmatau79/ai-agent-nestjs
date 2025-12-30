import { Test, TestingModule } from '@nestjs/testing'
import { AgentService } from './agent.service'
import { LlmService } from '../llm/llm.service'
import { AskDto } from './dto/ask.dto'

/**
 * Unit tests for {@link AgentService}.
 *
 * The `AgentService` delegates to LlmService for generation. These tests
 * mock the dependent service to verify that the service is called correctly.
 */
describe('AgentService', () => {
  let agentService: AgentService
  let llmService: Record<string, jest.Mock>

  beforeEach(async () => {
    // Create simple mock for dependent services
    llmService = {
      generate: jest.fn().mockResolvedValue('mocked answer'),
    } as unknown as Record<string, jest.Mock>

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentService, { provide: LlmService, useValue: llmService }],
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
    // Ensure the LLM was invoked with the user input and session
    expect(llmService.generate).toHaveBeenCalledTimes(1)
    expect(llmService.generate).toHaveBeenCalledWith('Hello world', expect.objectContaining({ sessionId: 'session1' }))
  })

  it('should use provided language without detection', async () => {
    const options: AskDto = { userInput: 'Hola mundo', sessionId: 'session2', userLang: 'es' }
    await agentService.chat(options)
    // The generate method should have been called with the provided language
    expect(llmService.generate).toHaveBeenCalledWith(
      'Hola mundo',
      expect.objectContaining({ sessionId: 'session2', userLang: 'es' }),
    )
  })
})
