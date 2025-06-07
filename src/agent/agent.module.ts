import { Module } from '@nestjs/common'
import { AgentService } from './agent.service'
import { AgentController } from './agent.controller'
import { RagModule } from 'src/rag/rag.module'
import { LlmModule } from 'src/llm/llm.module'
import { MemoryModule } from '../memory/memory.module'

@Module({
  imports: [RagModule, LlmModule, MemoryModule],
  providers: [AgentService],
  controllers: [AgentController],
  exports: [AgentService],
})
export class AgentModule {}
