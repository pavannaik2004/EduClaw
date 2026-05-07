/**
 * EduClaw Gateway — Telegram Bot Adapter
 * Handles all Telegram messaging through the Bot API.
 */

import TelegramBot from 'node-telegram-bot-api';
import type { MessageEnvelope, AgentResponse, QuizPayload } from '../types/MessageEnvelope.js';
import * as fs from 'fs';
import * as path from 'path';

// Intent patterns for routing
const INTENT_PATTERNS: Record<string, RegExp[]> = {
  doubt: [/what is/i, /how does/i, /explain/i, /difference between/i, /why/i, /what are/i, /define/i, /tell me/i],
  quiz: [/\/quiz/i, /give me a quiz/i, /test me/i],
  deadlines: [/\/deadlines/i, /\/deadline/i, /upcoming deadline/i, /due date/i],
  examprep: [/\/examprep/i, /exam prep/i, /prepare for exam/i],
  status: [/\/status/i, /my scores/i, /how am i doing/i],
  scribe: [/\/scribe/i],
  onboard: [/\/start/i],
  help: [/\/help/i, /what can you do/i],
};

export class TelegramAdapter {
  private bot: TelegramBot;
  private skillsRuntimeUrl: string;

  constructor(token: string, skillsRuntimeUrl: string = 'http://localhost:8001') {
    this.bot = new TelegramBot(token, { polling: true });
    this.skillsRuntimeUrl = skillsRuntimeUrl;
    this.setupHandlers();
    console.log('🤖 EduClaw Telegram bot started (polling mode)');
  }

  private classifyIntent(text: string): string {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) return intent;
      }
    }
    return 'doubt'; // Default: treat as a doubt/question
  }

  private setupHandlers(): void {
    // Handle /start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleOnboarding(msg);
    });

    // Handle /help command
    this.bot.onText(/\/help/, async (msg) => {
      await this.bot.sendMessage(
        msg.chat.id,
        '🦞 *EduClaw — Your Academic Assistant*\n\n' +
          'Here\'s what I can do:\n\n' +
          '📚 Ask me any course-related question\n' +
          '❓ `/quiz` — Get a quick quiz on today\'s topic\n' +
          '📊 `/status` — Check your quiz scores & stats\n' +
          '📅 `/deadlines` — See upcoming deadlines\n' +
          '📝 `/examprep` — Get personalised exam prep\n' +
          '📋 `/scribe` — Generate meeting minutes\n' +
          '📄 Send me a PDF to add course material\n' +
          '❓ `/help` — Show this message\n\n' +
          '_Just type your question and I\'ll answer from your course notes!_',
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /quiz command
    this.bot.onText(/\/quiz\s*(.*)/, async (msg, match) => {
      await this.handleQuiz(msg, match?.[1] || '');
    });

    // Handle /deadlines command
    this.bot.onText(/\/deadlines?/, async (msg) => {
      await this.handleDeadlines(msg);
    });

    // Handle /status command
    this.bot.onText(/\/status/, async (msg) => {
      await this.handleStatus(msg);
    });

    // Handle PDF document uploads
    this.bot.on('document', async (msg) => {
      await this.handleDocumentUpload(msg);
    });

    // Handle all other text messages (doubt answering)
    this.bot.on('message', async (msg) => {
      if (!msg.text || !msg.from) return;
      // Skip commands that are already handled
      if (msg.text.startsWith('/')) return;

      await this.handleDoubt(msg);
    });
  }

  private async handleOnboarding(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const name = msg.from?.first_name || 'Student';

    await this.bot.sendMessage(
      chatId,
      `👋 Welcome to *EduClaw*, ${name}!\n\n` +
        "I'm your AI-powered academic assistant. Here's what I do:\n\n" +
        '📚 Send lecture summaries before class\n' +
        '❓ Answer your course doubts (with citations!)\n' +
        '📝 Daily quizzes to test your knowledge\n' +
        '📅 Deadline alerts 3 days in advance\n' +
        '📊 Track your quiz performance\n' +
        '📄 Upload PDFs to add course material\n\n' +
        'Try asking me something like:\n' +
        '_"What is the difference between TCP and UDP?"_\n\n' +
        'Or type `/help` for all commands.',
      { parse_mode: 'Markdown' }
    );

    console.log(`📥 New user onboarded: ${name} (${msg.from?.id})`);
  }

  private async handleDoubt(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);

    // Send typing indicator
    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: `telegram_${userId}`,
          course_id: 'networks_2024', // Default course for MVP
          question: msg.text,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await this.bot.sendMessage(
          chatId,
          `🧠 *Answer:*\n\n${data.answer}`,
          { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          `⚠️ ${data.error || "I couldn't find relevant course material for that question."}`,
          { reply_to_message_id: msg.message_id }
        );
      }
    } catch (err) {
      console.error('Doubt handler error:', err);
      await this.bot.sendMessage(
        chatId,
        '⚠️ Something went wrong. Please try again in a moment.',
        { reply_to_message_id: msg.message_id }
      );
    }
  }

  private async handleQuiz(msg: TelegramBot.Message, topicArg: string): Promise<void> {
    const chatId = msg.chat.id;

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/quiz_gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: 'networks_2024',
          topic_id: topicArg.trim() || 'tcp_ip',
          count: 3,
        }),
      });

      const data = await response.json();

      if (data.success && data.questions) {
        await this.bot.sendMessage(chatId, '📝 *Daily Quiz Time!*\n\nHere are your questions:', {
          parse_mode: 'Markdown',
        });

        for (const q of data.questions) {
          await this.bot.sendPoll(chatId, q.question, q.options, {
            type: 'quiz',
            correct_option_id: q.correct_index,
            explanation: q.explanation,
            is_anonymous: false,
          });
        }
      } else {
        await this.bot.sendMessage(
          chatId,
          `⚠️ ${data.error || 'Could not generate quiz. Make sure course material is uploaded.'}`
        );
      }
    } catch (err) {
      console.error('Quiz handler error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Quiz generation failed. Please try again.');
    }
  }

  private async handleDeadlines(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: 'networks_2024',
          student_id: `telegram_${userId}`,
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        await this.bot.sendMessage(chatId, data.message, { parse_mode: 'Markdown' });
      } else {
        await this.bot.sendMessage(chatId, '⚠️ Could not check deadlines.');
      }
    } catch (err) {
      console.error('Deadline handler error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch deadline info.');
    }
  }

  private async handleStatus(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/student_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: `telegram_${userId}`,
          course_id: 'networks_2024',
        }),
      });

      const data = await response.json();

      if (data.success && data.status_message) {
        await this.bot.sendMessage(chatId, data.status_message, { parse_mode: 'Markdown' });
      } else {
        await this.bot.sendMessage(chatId, '⚠️ Could not fetch your status.');
      }
    } catch (err) {
      console.error('Status handler error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch your status.');
    }
  }

  private async handleDocumentUpload(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const doc = msg.document;

    if (!doc || !doc.file_name?.toLowerCase().endsWith('.pdf')) {
      await this.bot.sendMessage(chatId, '📄 I can only process PDF files. Please send a PDF document.');
      return;
    }

    await this.bot.sendMessage(chatId, `📥 Received *${doc.file_name}*. Processing...`, {
      parse_mode: 'Markdown',
    });
    await this.bot.sendChatAction(chatId, 'typing');

    try {
      // Download the file from Telegram
      const fileLink = await this.bot.getFileLink(doc.file_id);
      const fileResponse = await fetch(fileLink);
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      // Save to inbox directory
      const inboxDir = path.resolve('..', 'data', 'inbox', 'networks_2024');
      fs.mkdirSync(inboxDir, { recursive: true });

      const filePath = path.join(inboxDir, doc.file_name!);
      fs.writeFileSync(filePath, fileBuffer);

      console.log(`📄 PDF saved: ${filePath}`);

      // Call the PDF ingestion skill
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/pdf_digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: 'networks_2024',
          pdf_path: filePath,
          topic_name: doc.file_name!.replace('.pdf', '').replace(/[_-]/g, ' '),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Strip characters that break Telegram's Markdown parser
        const stripMd = (str: string) => str.replace(/[_*[\]`]/g, '');
        
        let summaryText = '✅ *PDF Ingested Successfully!*\n\n';
        summaryText += `📚 Topic: *${stripMd(data.topic_id)}*\n\n`;

        if (data.summary_points && data.summary_points.length > 0) {
          summaryText += '*Key Points:*\n';
          data.summary_points.forEach((point: string, i: number) => {
            summaryText += `${i + 1}. ${stripMd(point)}\n`;
          });
        }

        if (data.topic_tags && data.topic_tags.length > 0) {
          summaryText += `\n🏷️ Tags: ${stripMd(data.topic_tags.join(', '))}`;
        }

        summaryText += '\n\n_You can now ask questions about this topic!_';

        await this.bot.sendMessage(chatId, summaryText, { parse_mode: 'Markdown' });
      } else {
        await this.bot.sendMessage(
          chatId,
          `⚠️ Failed to process PDF: ${data.error || 'Unknown error'}\n\nMake sure the PDF contains readable text (not a scanned image).`
        );
      }
    } catch (err) {
      console.error('Document upload error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Failed to process the PDF. Please try again.');
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  async sendQuiz(chatId: string, quiz: QuizPayload): Promise<void> {
    await this.bot.sendPoll(chatId, quiz.question, quiz.options, {
      type: 'quiz',
      correct_option_id: quiz.correct_index,
      explanation: quiz.explanation,
      is_anonymous: false,
    });
  }
}
