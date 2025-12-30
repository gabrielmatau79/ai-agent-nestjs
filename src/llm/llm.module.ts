import { Module } from '@nestjs/common'
import { LlmService } from './llm.service'
import { ToolsService } from './tools/tools.service'
import { RagModule } from '../rag/rag.module'
import { MemoryModule } from '../memory/memory.module'

@Module({
  imports: [RagModule, MemoryModule],
  providers: [LlmService, ToolsService],
  exports: [LlmService, ToolsService],
})
export class LlmModule {}
