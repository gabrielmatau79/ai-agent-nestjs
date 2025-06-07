import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import appConfig from './config/app-config'
import { LlmModule } from './llm/llm.module'
import { MemoryModule } from './memory/memory.module'
import { RagModule } from './rag/rag.module'
import { AgentModule } from './agent/agent.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [appConfig],
      isGlobal: true,
    }),
    LlmModule,
    MemoryModule,
    RagModule,
    AgentModule,
  ],
})
export class AppModule {}
