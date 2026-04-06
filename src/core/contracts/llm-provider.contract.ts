import { z } from "zod";

export const ChatRoleSchema = z.enum(["user", "assistant"]);

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1)
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export interface LLMProvider {
  id: string;
  displayName: string;
  chat(params: {
    systemPrompt: string;
    messages: ChatMessage[];
  }): Promise<string>;
}

export function validateChatMessage(value: unknown): ChatMessage {
  return ChatMessageSchema.parse(value);
}
