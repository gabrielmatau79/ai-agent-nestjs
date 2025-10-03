import { Module } from '@nestjs/common'
import { LlmService } from './llm.service'
import { ToolsService } from './tools/tools.service'

@Module({
  providers: [LlmService, ToolsService],
  exports: [LlmService, ToolsService],
})
export class LlmModule {}
