import { Module } from '@nestjs/common'
import { AgentService } from './agent.service'
import { AgentController } from './agent.controller'
import { LlmModule } from '../llm/llm.module'

/**
 * Aggregates all dependencies required for the agent feature.
 *
 * This module wires together the RAG, LLM and memory modules, registers
 * the service and controller, and exports the service for consumption by
 * other modules. Keeping these imports explicit clarifies the agent’s
 * dependencies and facilitates testing.
 */
@Module({
  imports: [LlmModule],
  providers: [AgentService],
  controllers: [AgentController],
  exports: [AgentService],
})
export class AgentModule {}
