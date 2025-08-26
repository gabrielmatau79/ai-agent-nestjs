/**
 * Interface representing a generic Large Language Model (LLM) provider.
 *
 * Providers implementing this interface should expose a `generate` method
 * that takes a prompt string and optional options and returns a promise
 * resolving to the generated text.  This abstraction allows the rest of
 * the application to remain agnostic of the underlying LLM implementation
 * (OpenAI, Ollama, etc.) and follow the Dependency Inversion principle.
 */
export interface LlmProvider {
  /**
   * Generate a completion for the given prompt.
   *
   * @param prompt The input text sent to the model.
   * @param options Optional provider‑specific generation options.
   * @returns A promise resolving with the generated text.
   */
  generate(prompt: string, options?: any): Promise<string>
}

/**
 * Configuration options required to instantiate an OpenAI provider.
 */
export interface OpenAiProviderConfig {
  /**
   * OpenAI API key used to authenticate requests.
   */
  apiKey: string
  /**
   * Name of the model to use, e.g. `gpt-3.5-turbo` or `gpt-4`. If omitted
   * a sensible default will be used by the provider.
   */
  model?: string
}

/**
 * Configuration options required to instantiate an Ollama provider.
 */
export interface OllamaProviderConfig {
  /**
   * Base URL of the Ollama API server (e.g. `http://localhost:11434`).
   */
  endpoint: string
  /**
   * Name of the default model to use. If omitted a sensible default will be
   * chosen by the provider (typically `llama3`).
   */
  model?: string
}
