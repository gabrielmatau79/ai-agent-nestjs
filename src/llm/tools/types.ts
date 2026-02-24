export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface LlmToolConfig {
  name: string
  description: string
  endpoint: string
  method: HttpMethod
  requiresAuth?: boolean
}

export interface ToolsAuthConfig {
  headerName?: string // Default: Authorization
  scheme?: string // Default: Bearer
  token?: string // Required if any tool requiresAuth = true
}
