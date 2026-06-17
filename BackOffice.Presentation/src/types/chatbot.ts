export enum ChatRole {
  User = 1,
  Assistant = 2,
  Tool = 3,
  System = 4,
}

export enum ChatDraftStatus {
  Pending = 1,
  Confirmed = 2,
  Rejected = 3,
  Expired = 4,
}

export interface ChatPageContextDto {
  route?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
}

export interface ChatMessageRequestDto {
  conversationGuid?: string | null;
  content: string;
  context?: ChatPageContextDto | null;
}

export interface ChatToolInvocationDto {
  toolName: string;
  argumentsJson?: string | null;
  resultSummary?: string | null;
}

export interface ChatActionDraftDto {
  draftGuid: string;
  toolName: string;
  permissionKey: string;
  previewJson: string;
  status: ChatDraftStatus;
  expiresAt: string;
}

export interface ChatChartSeriesDto {
  name: string;
  data: number[];
}

export interface ChatVisualizationDto {
  type: "bar" | "line" | "pie" | "donut" | "area";
  title?: string | null;
  xAxisLabel?: string | null;
  yAxisLabel?: string | null;
  categories: string[];
  series: ChatChartSeriesDto[];
  horizontal?: boolean;
}

export interface ChatEntityLinkDto {
  entityType: string;
  entityId: string;
  label: string;
}

export interface ChatMessageResponseDto {
  conversationGuid: string;
  assistantReply: string;
  toolsInvoked: ChatToolInvocationDto[];
  pendingDrafts: ChatActionDraftDto[];
  visualizations: ChatVisualizationDto[];
  links: ChatEntityLinkDto[];
  suggestedFollowUps: string[];
  inputTokens: number;
  outputTokens: number;
  modelName?: string | null;
}

export interface ChatConversationSummaryDto {
  conversationGuid: string;
  title: string;
  totalMessages: number;
  updatedAt: string;
}

export interface ChatHistoryMessageDto {
  role: ChatRole;
  content: string;
  toolName?: string | null;
  createdAt: string;
  visualizations?: ChatVisualizationDto[] | null;
  links?: ChatEntityLinkDto[] | null;
  suggestedFollowUps?: string[] | null;
}

export interface ChatConversationDto {
  conversationGuid: string;
  title: string;
  messages: ChatHistoryMessageDto[];
}

export interface ChatUiMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  createdAt: string;
  toolsInvoked?: ChatToolInvocationDto[];
  visualizations?: ChatVisualizationDto[];
  links?: ChatEntityLinkDto[];
  suggestedFollowUps?: string[];
}
