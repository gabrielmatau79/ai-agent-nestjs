export interface LlmProvider {
  generate(prompt: string, options?: any): Promise<string>
}

export interface openiaProviderConfig {
  apiKey: string
  model: string
}

export interface OllamaProviderConfig {
  model: string
  endpoint: string
}
