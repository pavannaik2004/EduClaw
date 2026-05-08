/**
 * EduClaw Gateway — Telegram Bot Adapter
 * Handles all Telegram messaging through the Bot API.
 * Features: Menu commands, inline keyboards, PDF upload, quiz, doubts.
 */

import TelegramBot from 'node-telegram-bot-api';
import type { MessageEnvelope, AgentResponse, QuizPayload } from '../types/MessageEnvelope.js';
import * as fs from 'fs';
import * as path from 'path';

export class TelegramAdapter {
  private bot: TelegramBot;
  private skillsRuntimeUrl: string;

  constructor(token: string, skillsRuntimeUrl: string = 'http://localhost:8001') {
    this.bot = new TelegramBot(token, { polling: true });
    this.skillsRuntimeUrl = skillsRuntimeUrl;
    this.registerCommands();
    this.setupHandlers();
    console.log('🤖 EduClaw Telegram bot started (polling mode)');
  }

  /**
   * Register bot commands — these show up in Telegram's menu button (☰).
   */
  private async registerCommands(): Promise<void> {
    try {
      await this.bot.setMyCommands([
        { command: 'start', description: '👋 Welcome & onboarding' },
        { command: 'help', description: '❓ Show all commands' },
        { command: 'quiz', description: '📝 Take a quiz (random topic)' },
        { command: 'topics', description: '📋 List all available topics' },
        { command: 'status', description: '📊 Your quiz scores & stats' },
        { command: 'deadlines', description: '📅 Upcoming deadlines' },
      ]);
      console.log('✅ Bot menu commands registered');
    } catch (err) {
      console.error('Failed to register commands:', err);
    }
  }

  // ── Inline Keyboard Helpers ───────────────────────────────────────────────

  private mainMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📝 Quiz Me', callback_data: 'action_quiz_random' },
          { text: '📋 Topics', callback_data: 'action_topics' },
        ],
        [
          { text: '📊 My Status', callback_data: 'action_status' },
          { text: '📅 Deadlines', callback_data: 'action_deadlines' },
        ],
        [
          { text: '❓ Help', callback_data: 'action_help' },
        ],
      ],
    };
  }

  private topicQuizKeyboard(topics: any[]): TelegramBot.InlineKeyboardMarkup {
    // Build rows of 2 buttons each for topic selection
    const rows: TelegramBot.InlineKeyboardButton[][] = [];
    for (let i = 0; i < topics.length; i += 2) {
      const row: TelegramBot.InlineKeyboardButton[] = [];
      row.push({
        text: `📝 ${this.truncate(topics[i].topic_name, 25)}`,
        callback_data: `quiz_${topics[i].topic_id.substring(0, 50)}`,
      });
      if (i + 1 < topics.length) {
        row.push({
          text: `📝 ${this.truncate(topics[i + 1].topic_name, 25)}`,
          callback_data: `quiz_${topics[i + 1].topic_id.substring(0, 50)}`,
        });
      }
      rows.push(row);
    }
    // Add "Random" button at the bottom
    rows.push([{ text: '🎲 Random Topic Quiz', callback_data: 'action_quiz_random' }]);
    return { inline_keyboard: rows };
  }

  private truncate(str: string, len: number): string {
    const clean = str.replace(/[_*[\]`]/g, '');
    return clean.length > len ? clean.substring(0, len - 1) + '…' : clean;
  }

  // ── Handler Setup ─────────────────────────────────────────────────────────

  private setupHandlers(): void {
    // Handle /start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleOnboarding(msg);
    });

    // Handle /help command
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelp(msg.chat.id);
    });

    // Handle /topics command
    this.bot.onText(/\/topics/, async (msg) => {
      await this.handleListTopics(msg.chat.id);
    });

    // Handle /quiz command
    this.bot.onText(/\/quiz\s*(.*)/, async (msg, match) => {
      await this.handleQuiz(msg.chat.id, match?.[1] || '');
    });

    // Handle /deadlines command
    this.bot.onText(/\/deadlines?/, async (msg) => {
      await this.handleDeadlines(msg.chat.id, String(msg.from?.id));
    });

    // Handle /status command
    this.bot.onText(/\/status/, async (msg) => {
      await this.handleStatus(msg.chat.id, String(msg.from?.id));
    });

    // Handle inline keyboard button taps
    this.bot.on('callback_query', async (query) => {
      await this.handleCallbackQuery(query);
    });

    // Handle PDF document uploads
    this.bot.on('document', async (msg) => {
      await this.handleDocumentUpload(msg);
    });

    // Handle all other text messages (doubt answering)
    this.bot.on('message', async (msg) => {
      if (!msg.text || !msg.from) return;
      if (msg.text.startsWith('/')) return;
      await this.handleDoubt(msg);
    });
  }

  // ── Callback Query Handler (Button Taps) ──────────────────────────────────

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const userId = String(query.from.id);
    const data = query.data || '';

    if (!chatId) return;

    // Acknowledge the button press immediately
    await this.bot.answerCallbackQuery(query.id);

    if (data === 'action_quiz_random') {
      await this.handleQuiz(chatId, '');
    } else if (data === 'action_topics') {
      await this.handleListTopics(chatId);
    } else if (data === 'action_status') {
      await this.handleStatus(chatId, userId);
    } else if (data === 'action_deadlines') {
      await this.handleDeadlines(chatId, userId);
    } else if (data === 'action_help') {
      await this.handleHelp(chatId);
    } else if (data === 'action_pick_topic') {
      await this.handleTopicPicker(chatId);
    } else if (data.startsWith('quiz_')) {
      const topicId = data.replace('quiz_', '');
      await this.handleQuiz(chatId, topicId);
    }
  }

  // ── Command Handlers ──────────────────────────────────────────────────────

  private async handleOnboarding(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const name = msg.from?.first_name || 'Student';

    await this.bot.sendMessage(
      chatId,
      `👋 Welcome to *EduClaw*, ${name}!\n\n` +
        "I'm your AI-powered academic assistant.\n\n" +
        '📄 *Upload a PDF* to add course material\n' +
        '📚 *Ask any question* and I\'ll answer from your notes\n' +
        '📝 *Take quizzes* to test your knowledge\n' +
        '📅 *Track deadlines* and weak topics\n\n' +
        'Tap a button below to get started! 👇',
      {
        parse_mode: 'Markdown',
        reply_markup: this.mainMenuKeyboard(),
      }
    );

    console.log(`📥 New user onboarded: ${name} (${msg.from?.id})`);
  }

  private async handleHelp(chatId: number): Promise<void> {
    await this.bot.sendMessage(
      chatId,
      '🦞 *EduClaw — Your Academic Assistant*\n\n' +
        '*Commands:*\n' +
        '📝 `/quiz` — Random topic quiz\n' +
        '📋 `/topics` — See all topics & pick one for quiz\n' +
        '📊 `/status` — Your quiz scores & stats\n' +
        '📅 `/deadlines` — Upcoming deadlines\n' +
        '📄 Send a PDF — Add course material\n' +
        '💬 Type any question — Get answers from your notes\n\n' +
        '_Or just tap a button below!_ 👇',
      {
        parse_mode: 'Markdown',
        reply_markup: this.mainMenuKeyboard(),
      }
    );
  }

  private async handleListTopics(chatId: number): Promise<void> {
    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/topics/networks_2024`);
      const data = await response.json();

      if (data.success && data.topics && data.topics.length > 0) {
        const stripMd = (str: string) => str.replace(/[_*[\]`]/g, ' ').trim();

        let text = `📋 *Available Topics (${data.count})*\n\n`;
        data.topics.forEach((t: any, i: number) => {
          text += `${i + 1}. *${stripMd(t.topic_name)}*\n`;
          text += `   📄 ${stripMd(t.source_file)}\n\n`;
        });
        text += '_Tap a topic below to take a quiz on it:_';

        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: this.topicQuizKeyboard(data.topics),
        });
      } else {
        await this.bot.sendMessage(
          chatId,
          '📋 No topics available yet.\n\n📄 Send me a PDF to get started!',
          { reply_markup: this.mainMenuKeyboard() }
        );
      }
    } catch (err) {
      console.error('Topics handler error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch topics.');
    }
  }

  private async handleTopicPicker(chatId: number): Promise<void> {
    // Same as handleListTopics but specifically for quiz picking
    await this.handleListTopics(chatId);
  }

  private async handleDoubt(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const response = await fetch(`${this.skillsRuntimeUrl}/skill/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: `telegram_${userId}`,
          course_id: 'networks_2024',
          question: msg.text,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await this.bot.sendMessage(
          chatId,
          `🧠 *Answer:*\n\n${data.answer}`,
          {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📝 Quiz Me', callback_data: 'action_quiz_random' },
                  { text: '📋 More Topics', callback_data: 'action_topics' },
                ],
              ],
            },
          }
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

  private async handleQuiz(chatId: number, topicArg: string): Promise<void> {
    const trimmed = topicArg.trim();

    // If user typed "/quiz list", show topic picker
    if (trimmed === 'list') {
      await this.handleListTopics(chatId);
      return;
    }

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const topicId = trimmed || 'random';

      const response = await fetch(`${this.skillsRuntimeUrl}/skill/quiz_gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: 'networks_2024',
          topic_id: topicId,
          count: 3,
        }),
      });

      const data = await response.json();

      if (data.success && data.questions) {
        await this.bot.sendMessage(chatId, '📝 *Quiz Time!*\n\nHere are your 3 questions:', {
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

        // After quiz, show quick action buttons
        await this.bot.sendMessage(chatId, '_What\'s next?_', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Another Quiz', callback_data: 'action_quiz_random' },
                { text: '📋 Pick Topic', callback_data: 'action_pick_topic' },
              ],
              [
                { text: '📊 My Status', callback_data: 'action_status' },
              ],
            ],
          },
        });
      } else {
        await this.bot.sendMessage(
          chatId,
          `⚠️ ${data.error || 'Could not generate quiz.'}`,
          { reply_markup: this.mainMenuKeyboard() }
        );
      }
    } catch (err) {
      console.error('Quiz handler error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Quiz generation failed. Please try again.');
    }
  }

  private async handleDeadlines(chatId: number, userId: string): Promise<void> {
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
        await this.bot.sendMessage(chatId, data.message, {
          parse_mode: 'Markdown',
          reply_markup: this.mainMenuKeyboard(),
        });
      } else {
        await this.bot.sendMessage(chatId, '⚠️ Could not check deadlines.');
      }
    } catch (err) {
      console.error('Deadline handler error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch deadline info.');
    }
  }

  private async handleStatus(chatId: number, userId: string): Promise<void> {
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
        await this.bot.sendMessage(chatId, data.status_message, {
          parse_mode: 'Markdown',
          reply_markup: this.mainMenuKeyboard(),
        });
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
      const fileLink = await this.bot.getFileLink(doc.file_id);
      const fileResponse = await fetch(fileLink);
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      const inboxDir = path.resolve('..', 'data', 'inbox', 'networks_2024');
      fs.mkdirSync(inboxDir, { recursive: true });

      const filePath = path.join(inboxDir, doc.file_name!);
      fs.writeFileSync(filePath, fileBuffer);

      console.log(`📄 PDF saved: ${filePath}`);

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
        const stripMd = (str: string) => str.replace(/[_*[\]`]/g, '');
        const topicId = stripMd(data.topic_id);

        let summaryText = '✅ *PDF Ingested Successfully!*\n\n';
        summaryText += `📚 Topic: *${topicId}*\n\n`;

        if (data.summary_points && data.summary_points.length > 0) {
          summaryText += '*Key Points:*\n';
          data.summary_points.forEach((point: string, i: number) => {
            summaryText += `${i + 1}. ${stripMd(point)}\n`;
          });
        }

        if (data.topic_tags && data.topic_tags.length > 0) {
          summaryText += `\n🏷️ Tags: ${stripMd(data.topic_tags.join(', '))}`;
        }

        summaryText += '\n\n_Tap a button below to continue!_';

        await this.bot.sendMessage(chatId, summaryText, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: `📝 Quiz: ${this.truncate(topicId, 20)}`, callback_data: `quiz_${data.topic_id.substring(0, 50)}` },
                { text: '🎲 Random Quiz', callback_data: 'action_quiz_random' },
              ],
              [
                { text: '📋 All Topics', callback_data: 'action_topics' },
                { text: '📊 My Status', callback_data: 'action_status' },
              ],
            ],
          },
        });
      } else {
        await this.bot.sendMessage(
          chatId,
          `⚠️ Failed to process PDF: ${data.error || 'Unknown error'}\n\nMake sure the PDF contains readable text (not a scanned image).`,
          { reply_markup: this.mainMenuKeyboard() }
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
