import { DynamicTool } from '@langchain/core/tools'
import { Logger } from '@nestjs/common'
import { RagService } from '../../rag/rag.service'

const logger = new Logger('RagRetrieverTool')

/**
 * Factory that creates a RAG retriever tool bound to a RagService instance.
 */
export const createRagRetrieverTool = (ragService: RagService): DynamicTool =>
  new DynamicTool({
    name: 'rag_retriever',
    description:
      'Use this tool to search the internal knowledge base for information relevant to the user question. ' +
      'Pass the full user question or a focused search query.',
    func: async (input: string) => {
      logger.log(`[RAG Tool] Called with query="${input}"`)
      const contextArr = await ragService.retrieveContext(input)
      logger.log(`[RAG Tool] Retrieved ${contextArr.length} context snippet(s).`)

      if (!contextArr.length) {
        return 'No relevant documents were found in the knowledge base for this query.'
      }

      return contextArr.join('\n---\n')
    },
  })
