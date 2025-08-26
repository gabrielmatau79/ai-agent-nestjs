import { Body, Controller, Post, InternalServerErrorException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger'
import { AgentService } from './agent.service'
import { AskDto } from './dto/ask.dto'
import { Logger } from '@nestjs/common'

/**
 * HTTP controller responsible for routing chat requests to the agent.
 *
 * This controller exposes a single POST endpoint that accepts a user's
 * question and session identifier, optionally along with a language hint.
 * It delegates processing to the {@link AgentService} and returns the
 * generated answer. Swagger annotations document the API for tooling
 * such as Swagger UI.
 */
@ApiTags('agent')
@ApiBearerAuth()
@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name)

  constructor(private readonly agentService: AgentService) {}

  /**
   * Accepts a new question for the AI agent and returns its answer.
   *
   * @param askDto The validated request body containing user input, session ID and optional language hint.
   * @returns An object with the AI‑generated answer.
   */
  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question to the AI agent',
    description: 'Sends user input to the AI agent and returns an LLM‑generated answer.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI-generated answer returned successfully.',
    schema: {
      example: { answer: 'Kubernetes is an open-source platform for container orchestration.' },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiBody({
    type: AskDto,
    examples: {
      basic: {
        summary: 'Example input',
        value: {
          sessionId: 'session-abc123',
          userInput: 'What is Kubernetes?',
          userLang: 'en',
        },
      },
    },
  })
  async ask(@Body() askDto: AskDto): Promise<{ answer: string }> {
    const { userInput, sessionId, userLang } = askDto
    const options: AskDto = { userInput, sessionId, userLang }
    this.logger.debug(`Received ask request: ${JSON.stringify(options)}`)
    try {
      const answer = await this.agentService.chat(options)
      return { answer }
    } catch (error) {
      this.logger.error(`Error handling ask request: ${(error as Error).message}`, (error as Error).stack)
      // Propagate a generic 500 error to avoid leaking internal details
      throw new InternalServerErrorException('An error occurred while processing your request.')
    }
  }
}
