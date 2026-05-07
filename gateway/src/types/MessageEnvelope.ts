/**
 * EduClaw Gateway — Message Envelope Type
 * Normalised message format across all channels.
 */

export interface MessageEnvelope {
  channel: 'telegram' | 'whatsapp' | 'discord';
  user_id: string;
  chat_id: string;
  username: string;
  text: string;
  timestamp: Date;
  raw?: unknown;
}

export interface AgentResponse {
  text: string;
  format?: 'markdown' | 'plain';
  quiz?: QuizPayload;
}

export interface QuizPayload {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}
