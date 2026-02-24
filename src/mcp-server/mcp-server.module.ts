import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import appConfig from '../config/app-config'
import { MemoryModule } from '../memory/memory.module'
import { RagModule } from '../rag/rag.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [appConfig],
      isGlobal: true,
    }),
    RagModule,
    MemoryModule,
  ],
})
export class McpServerModule {}
