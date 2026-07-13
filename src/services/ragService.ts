import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export class RagService {
  private vectorStore: PineconeStore | null = null;

  async init() {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY!,
      model: "models/gemini-embedding-001",
    });

    this.vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: "posts-content",
    });
  }

  async retrieveContext(query: string, filterNiche?: string): Promise<string> {
    if (!this.vectorStore) await this.init();

    console.log(`[RAG] Searching Pinecone context for: "${query}"...`);
    const filter = filterNiche ? { niche: filterNiche } : undefined;
    const results = await this.vectorStore!.similaritySearch(query, 4, filter);

    if (results.length === 0) return "";
    return results.map(doc => `[Source: ${doc.metadata?.source || 'Unknown'}]\n${doc.pageContent}`).join('\n\n');
  }
}
