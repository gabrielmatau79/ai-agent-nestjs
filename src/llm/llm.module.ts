import { Module } from '@nestjs/common'
import { LlmService } from './llm.service'
import { ToolsService } from './tools/tools.service'
import { McpModule } from '../mcp/mcp.module'

@Module({
  imports: [McpModule],
  providers: [LlmService, ToolsService],
  exports: [LlmService, ToolsService],
})
export class LlmModule {}
