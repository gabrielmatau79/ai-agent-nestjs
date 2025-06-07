/**
 * Multilanguage prompt templates for the chatbot agent.
 * You can extend this map to support more languages.
 */
export const AGENT_PROMPT_TEMPLATES: Record<string, (context: string, question: string) => string> = {
  en: (context, question) => `
  Use the following information as context to answer the user's question.
  Context:
  ${context}
  Question: ${question}
  Respond clearly and briefly in English.
  `,

  es: (context, question) => `
  Usa la siguiente información como contexto para responder la pregunta del usuario.
  Contexto:
  ${context}
  Pregunta: ${question}
  Responde de forma clara y breve en español.
  `,
}
