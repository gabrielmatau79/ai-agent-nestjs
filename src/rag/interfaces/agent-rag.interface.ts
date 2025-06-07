export interface AgentRag {
  retrieveContext(query: string): Promise<string[]>
  addDocument(id: string, text: string): Promise<void>
}
