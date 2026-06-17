import apiClient from "../lib/axios";
import { BASE_API_URL } from "../constants/api";
import type {
  ChatActionDraftDto,
  ChatConversationDto,
  ChatConversationSummaryDto,
  ChatMessageRequestDto,
  ChatMessageResponseDto,
} from "../types/chatbot";

interface ApiEnvelope<T> {
  isSuccess: boolean;
  message: string;
  statusCode: number;
  response: T;
  errors?: unknown;
}

const ENDPOINTS = {
  MESSAGES: `${BASE_API_URL}/api/Chat/messages`,
  CONVERSATIONS: `${BASE_API_URL}/api/Chat/conversations`,
  CONVERSATION: (guid: string) => `${BASE_API_URL}/api/Chat/conversations/${guid}`,
  DRAFT_CONFIRM: (guid: string) => `${BASE_API_URL}/api/Chat/drafts/${guid}/confirm`,
  DRAFT_REJECT: (guid: string) => `${BASE_API_URL}/api/Chat/drafts/${guid}/reject`,
  SETTINGS: `${BASE_API_URL}/api/Chat/settings`,
};

export const chatService = {
  async sendMessage(req: ChatMessageRequestDto): Promise<ChatMessageResponseDto> {
    const { data } = await apiClient.post<ApiEnvelope<ChatMessageResponseDto>>(
      ENDPOINTS.MESSAGES,
      req,
    );
    if (!data.isSuccess) {
      throw new Error(data.message || "Chat request failed");
    }
    return data.response;
  },

  async listConversations(): Promise<ChatConversationSummaryDto[]> {
    const { data } = await apiClient.get<ApiEnvelope<ChatConversationSummaryDto[]>>(
      ENDPOINTS.CONVERSATIONS,
    );
    return data.response ?? [];
  },

  async getConversation(guid: string): Promise<ChatConversationDto | null> {
    const { data } = await apiClient.get<ApiEnvelope<ChatConversationDto>>(
      ENDPOINTS.CONVERSATION(guid),
    );
    return data.response ?? null;
  },

  async deleteConversation(guid: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.CONVERSATION(guid));
  },

  async confirmDraft(guid: string, note?: string): Promise<ApiEnvelope<unknown>> {
    const { data } = await apiClient.post<ApiEnvelope<unknown>>(
      ENDPOINTS.DRAFT_CONFIRM(guid),
      { note: note ?? null },
    );
    return data;
  },

  async rejectDraft(guid: string, reason?: string): Promise<ApiEnvelope<unknown>> {
    const { data } = await apiClient.post<ApiEnvelope<unknown>>(
      ENDPOINTS.DRAFT_REJECT(guid),
      { reason: reason ?? null },
    );
    return data;
  },
};

export type { ChatActionDraftDto };
