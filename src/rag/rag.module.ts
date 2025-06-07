import { Module } from '@nestjs/common'
import { RagService } from './rag.service'
import { InMemoryRagProvider } from './providers/inmemory-rag.provider'
import { LangchainRagProvider } from './providers/langchain-rag.provider'

@Module({
  providers: [RagService, InMemoryRagProvider, LangchainRagProvider],
  exports: [RagService, LangchainRagProvider, InMemoryRagProvider],
})
export class RagModule {}
