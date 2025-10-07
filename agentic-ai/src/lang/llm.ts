import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";

export type ChatModel = ChatOpenAI | ChatGoogleGenerativeAI;

/** Select a chat LLM (Google Gemini preferred) from env. */
export function getChatModel(): ChatModel {
  const { GOOGLE_AI_API_KEY, OPENAI_API_KEY } = process.env as Record<
    string,
    string | undefined
  >;
  if (GOOGLE_AI_API_KEY) {
    const model = process.env.GOOGLE_AI_MODEL || "gemini-1.5-pro-002";
    return new ChatGoogleGenerativeAI({
      apiKey: GOOGLE_AI_API_KEY,
      model,
      temperature: 0.2,
    });
  }
  if (OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    return new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      model,
      temperature: 0.2,
    });
  }
  throw new Error("Missing GOOGLE_AI_API_KEY or OPENAI_API_KEY for chat model");
}

/** Select an embeddings model matching the chosen provider. */
export function getEmbeddings() {
  const { GOOGLE_AI_API_KEY, OPENAI_API_KEY } = process.env as Record<
    string,
    string | undefined
  >;
  if (GOOGLE_AI_API_KEY) {
    const model = process.env.GOOGLE_EMBED_MODEL || "text-embedding-004";
    return new GoogleGenerativeAIEmbeddings({
      apiKey: GOOGLE_AI_API_KEY,
      model,
    });
  }
  if (OPENAI_API_KEY) {
    const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";
    return new OpenAIEmbeddings({ apiKey: OPENAI_API_KEY, model });
  }
  throw new Error("Missing GOOGLE_AI_API_KEY or OPENAI_API_KEY for embeddings");
}
