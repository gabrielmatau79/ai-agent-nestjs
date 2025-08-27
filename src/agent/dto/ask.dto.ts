import { IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Data transfer object representing a chat request to the AI agent.
 *
 * This DTO validates that the user input and session identifier are strings,
 * and allows an optional language hint. Adding the language hint enables
 * callers to skip automatic language detection and force the response in
 * a specific language.
 */
export class AskDto {
  @ApiProperty({
    description: 'User input or question directed to the AI agent.',
    example: '¿Qué es Kubernetes?',
  })
  @IsString()
  userInput!: string

  @ApiProperty({
    description: 'Unique identifier for the chat session used to persist context.',
    example: 'session-abc123',
  })
  @IsString()
  sessionId!: string

  @ApiPropertyOptional({
    description: 'Optional ISO 639‑1 language code hint for the desired response language.',
    example: 'es',
  })
  @IsOptional()
  @IsString()
  userLang?: string
}
