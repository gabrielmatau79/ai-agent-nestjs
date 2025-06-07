import { Controller, Post, Body, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger'
import { AgentService } from './agent.service'
import { AskDto } from './dto/agent.dts'

@ApiTags('agent')
@ApiBearerAuth() // 🔐 Requiere token de autenticación si usas JWT u otro esquema
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question to the AI agent',
    description: 'Sends user input to the AI agent and returns an LLM-generated answer.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI-generated answer returned successfully.',
    schema: {
      example: { answer: 'Kubernetes is an open-source platform for container orchestration.' },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request. Missing or invalid input.', type: BadRequestException })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid credentials.',
    type: UnauthorizedException,
  })
  @ApiBody({
    type: AskDto,
    examples: {
      basic: {
        summary: 'Example input',
        value: {
          sessionId: 'session-abc123',
          userInput: 'What is Kubernetes?',
        },
      },
    },
  })
  async ask(@Body() askDto: AskDto) {
    const { userInput, sessionId } = askDto
    const answer = await this.agentService.chat({ userInput, sessionId })
    return { answer }
  }
}
