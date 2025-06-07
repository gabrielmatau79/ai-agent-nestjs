import { registerAs } from '@nestjs/config'

/**
 * Global application configuration loader.
 * Organizes and documents all environment variables.
 */
export default registerAs('appConfig', () => ({
  // Application General Settings

  /**
   * The port number where the application HTTP server runs.
   * Default: 3000
   */
  appPort: parseInt(process.env.APP_PORT || '3000', 10),

  /**
   * Log level for application logging.
   * Default: 1 (minimal logs)
   */
  logLevel: parseInt(process.env.LOG_LEVEL || '1', 10),

  // LLM & Agent Settings

  /**
   * The default agent prompt to define the LLM's persona/role.
   */
  agentPrompt: process.env.AGENT_PROMPT || '',

  /**
   * LLM provider to use: "openai" | "ollama"
   * Default: openai
   */
  llmProvider: process.env.LLM_PROVIDER || 'openai',

  /**
   * Ollama endpoint URL for local LLM inference.
   * Default: http://localhost:11434
   */
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',

  /**
   * Model name for Ollama provider (e.g., "llama3", "phi3", etc).
   * Default: llama3
   */
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3',

  /**
   * OpenAI API key (required if using OpenAI provider).
   */
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  /**
   * OpenAI Model .
   */

  openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',

  // RAG (Retrieval Augmented Generation) Settings
  /**
   * RAG provider selection. "InMemoryRagProvider" (inMemory) or "langchain" (LangchainRagProvider).
   * Default: "vectorstore"
   */
  ragProvider: process.env.RAG_PROVIDER || 'inMemory',

  /**
   * Directory path from which RAG loads .txt and .pdf documents for context retrieval.
   */
  ragDocsPath: process.env.RAG_DOCS_PATH || './docs',

  /**
   * Vector store provider for RAG: "redis" etc.
   * Used when RAG_PROVIDER = "langchain"
   * Default: redis you define de url redis service
   */
  vectorStore: process.env.VECTOR_STORE || 'redis',

  /**
   * Shared index name for all supported vector stores (e.g Redis).
   * Set as VECTOR_INDEX_NAME in your environment.
   * Default: agent-ia
   */
  vectorIndexName: process.env.VECTOR_INDEX_NAME || 'agent-ia',

  // Memory/Session Settings

  /**
   * Memory backend: "memory" for in-memory, "redis" for Redis.
   * Default: memory
   */
  agentMemoryType: process.env.AGENT_MEMORY_TYPE || 'memory',

  /**
   * Number of messages/tokens to keep in session memory window.
   * Default: 8
   */
  agentMemoryWindow: parseInt(process.env.AGENT_MEMORY_WINDOW || '8', 10),

  // External Service URLs

  /**
   * Redis database URL for persistent memory/session storage.
   * Default: redis://localhost:6379
   */
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
}))
