/**
 * EduClaw Gateway — Telegram Bot Adapter
 * Multi-course support: each user has an active course stored in their YAML profile.
 * PDF uploads go to the active course; users can switch courses anytime.
 */

import TelegramBot from 'node-telegram-bot-api';
import type { QuizPayload } from '../types/MessageEnvelope.js';
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  private strip(str: string): string {
    return str.replace(/[_*[\]`]/g, '').trim();
  }

  private truncate(str: string, len: number): string {
    const s = this.strip(str);
    return s.length > len ? s.substring(0, len - 1) + '…' : s;
  }

  /** Get the active course_id for a user (from their profile). */
  private async getActiveCourse(userId: string): Promise<string> {
    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/active_course/telegram_${userId}`);
      const data = await res.json();
      return data.active_course || 'networks_2024';
    } catch {
      return 'networks_2024';
    }
  }

  /** Set active course for a user. */
  private async setActiveCourse(userId: string, courseId: string): Promise<void> {
    await fetch(`${this.skillsRuntimeUrl}/skill/set_active_course`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: `telegram_${userId}`, course_id: courseId }),
    });
  }

  // ── Inline Keyboards ──────────────────────────────────────────────────────

  private mainMenu(): TelegramBot.InlineKeyboardMarkup {
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
          { text: '📚 Switch Course', callback_data: 'action_courses' },
          { text: '❓ Help', callback_data: 'action_help' },
        ],
      ],
    };
  }

  private topicKeyboard(topics: any[]): TelegramBot.InlineKeyboardMarkup {
    const rows: TelegramBot.InlineKeyboardButton[][] = [];
    for (let i = 0; i < topics.length; i += 2) {
      const row: TelegramBot.InlineKeyboardButton[] = [
        { text: `📝 ${this.truncate(topics[i].topic_name, 22)}`, callback_data: `quiz_${topics[i].topic_id.substring(0, 50)}` },
      ];
      if (i + 1 < topics.length) {
        row.push({ text: `📝 ${this.truncate(topics[i + 1].topic_name, 22)}`, callback_data: `quiz_${topics[i + 1].topic_id.substring(0, 50)}` });
      }
      rows.push(row);
    }
    rows.push([{ text: '🎲 Random Topic', callback_data: 'action_quiz_random' }]);
    rows.push([{ text: '⬅️ Back', callback_data: 'action_main_menu' }]);
    return { inline_keyboard: rows };
  }

  private courseKeyboard(courses: any[]): TelegramBot.InlineKeyboardMarkup {
    const rows: TelegramBot.InlineKeyboardButton[][] = courses.map((c) => [{
      text: `📚 ${this.truncate(c.course_name, 30)} (${c.topic_count} topics)`,
      callback_data: `switch_${c.course_id}`,
    }]);
    rows.push([{ text: '➕ Add New Course', callback_data: 'action_new_course' }]);
    rows.push([{ text: '⬅️ Back', callback_data: 'action_main_menu' }]);
    return { inline_keyboard: rows };
  }

  // ── Command Registration ──────────────────────────────────────────────────

  private async registerCommands(): Promise<void> {
    try {
      await this.bot.setMyCommands([
        { command: 'start', description: '👋 Welcome & onboarding' },
        { command: 'help', description: '❓ Show all commands' },
        { command: 'quiz', description: '📝 Take a quiz (random topic)' },
        { command: 'topics', description: '📋 List topics in active course' },
        { command: 'courses', description: '📚 List & switch courses' },
        { command: 'status', description: '📊 Your quiz scores & stats' },
        { command: 'deadlines', description: '📅 Upcoming deadlines' },
        { command: 'newcourse', description: '➕ Add a new course' },
      ]);
      console.log('✅ Bot menu commands registered');
    } catch (err) {
      console.error('Failed to register commands:', err);
    }
  }

  // ── Handler Setup ─────────────────────────────────────────────────────────

  private setupHandlers(): void {
    this.bot.onText(/^\/start/, (msg) => this.safe(() => this.handleOnboarding(msg)));
    this.bot.onText(/^\/help/, (msg) => this.safe(() => this.handleHelp(msg.chat.id)));
    this.bot.onText(/^\/topics/, (msg) => this.safe(() => this.handleTopics(msg.chat.id, String(msg.from?.id))));
    this.bot.onText(/^\/courses/, (msg) => this.safe(() => this.handleCourses(msg.chat.id)));
    this.bot.onText(/^\/quiz\s*(.*)/, (msg, match) => this.safe(() => this.handleQuiz(msg.chat.id, String(msg.from?.id), match?.[1] || '')));
    this.bot.onText(/^\/deadlines?/, (msg) => this.safe(() => this.handleDeadlines(msg.chat.id, String(msg.from?.id))));
    this.bot.onText(/^\/status/, (msg) => this.safe(() => this.handleStatus(msg.chat.id, String(msg.from?.id))));
    // /newcourse <CourseName> — single step, e.g. /newcourse Operating Systems
    this.bot.onText(/^\/newcourse\s*(.*)/, (msg, match) => this.safe(() => this.handleNewCourse(msg.chat.id, String(msg.from?.id), match?.[1] || '')));

    this.bot.on('callback_query', (q) => this.safe(() => this.handleCallback(q)));
    this.bot.on('document', (msg) => this.safe(() => this.handlePdfUpload(msg)));
    this.bot.on('message', async (msg) => {
      if (!msg.text || !msg.from || msg.text.startsWith('/')) return;
      await this.safe(() => this.handleDoubt(msg));
    });
  }

  /** Wraps async handlers to catch and log errors */
  private async safe(fn: () => Promise<void>): Promise<void> {
    try { await fn(); } catch (err) { console.error('Handler error:', err); }
  }

  // ── Callback Handler ──────────────────────────────────────────────────────

  private async handleCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const userId = String(query.from.id);
    const data = query.data || '';
    if (!chatId) return;
    await this.bot.answerCallbackQuery(query.id);

    if (data === 'action_quiz_random')  await this.handleQuiz(chatId, userId, '');
    else if (data === 'action_topics')  await this.handleTopics(chatId, userId);
    else if (data === 'action_courses') await this.handleCourses(chatId);
    else if (data === 'action_status')  await this.handleStatus(chatId, userId);
    else if (data === 'action_deadlines') await this.handleDeadlines(chatId, userId);
    else if (data === 'action_help')    await this.handleHelp(chatId);
    else if (data === 'action_main_menu') await this.sendMainMenu(chatId);
    else if (data === 'action_new_course') {
      // Prompt user to type /newcourse <name>
      await this.bot.sendMessage(chatId,
        '➕ *Add New Course*\n\n' +
        'Type the command with your course name:\n\n' +
        '`/newcourse Operating Systems`\n' +
        '`/newcourse Data Structures`\n' +
        '`/newcourse DBMS`\n\n' +
        '_Replace with your actual course name!_',
        { parse_mode: 'Markdown' }
      );
    }
    else if (data.startsWith('quiz_')) await this.handleQuiz(chatId, userId, data.replace('quiz_', ''));
    else if (data.startsWith('switch_')) {
      const courseId = data.replace('switch_', '');
      await this.setActiveCourse(userId, courseId);
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/courses`);
      const d = await res.json();
      const c = d.courses?.find((x: any) => x.course_id === courseId);
      await this.bot.sendMessage(chatId,
        `✅ Switched to *${c?.course_name || courseId}*!\n\nAll questions, quizzes, and PDF uploads will now use this course.`,
        { parse_mode: 'Markdown', reply_markup: this.mainMenu() }
      );
    }
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  private async handleOnboarding(msg: TelegramBot.Message): Promise<void> {
    const name = msg.from?.first_name || 'Student';
    await this.bot.sendMessage(msg.chat.id,
      `👋 Welcome to *EduClaw*, ${name}!\n\n` +
      `I'm your AI-powered academic assistant.\n\n` +
      `📄 *Upload a PDF* → I'll summarise it into your active course\n` +
      `📝 *Ask any question* → I'll answer from your course notes\n` +
      `📚 *Multiple courses* → Switch with /courses\n\n` +
      `Tap a button to get started! 👇`,
      { parse_mode: 'Markdown', reply_markup: this.mainMenu() }
    );
  }

  private async sendMainMenu(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId, '🏠 Main Menu:', { reply_markup: this.mainMenu() });
  }

  private async handleHelp(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId,
      `🦞 *EduClaw Commands*\n\n` +
      `/quiz — Random topic quiz\n` +
      `/topics — Topics in active course\n` +
      `/courses — List & switch courses\n` +
      `/newcourse <name> — Add a new course\n` +
      `/status — Your scores & stats\n` +
      `/deadlines — Upcoming deadlines\n` +
      `📄 *Send a PDF* — Adds to active course\n` +
      `💬 *Type a question* — Doubt answering\n`,
      { parse_mode: 'Markdown', reply_markup: this.mainMenu() }
    );
  }

  // ── Course Management ─────────────────────────────────────────────────────

  private async handleCourses(chatId: number): Promise<void> {
    await this.bot.sendChatAction(chatId, 'typing');
    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/courses`);
      const data = await res.json();

      if (!data.courses || data.courses.length === 0) {
        await this.bot.sendMessage(chatId,
          `📚 No courses yet!\n\nUse \`/newcourse <name>\` to create one.`,
          { parse_mode: 'Markdown', reply_markup: this.courseKeyboard([]) }
        );
        return;
      }

      await this.bot.sendMessage(chatId, `📚 *Your Courses (${data.count})*\n\nTap to switch:`, {
        parse_mode: 'Markdown',
        reply_markup: this.courseKeyboard(data.courses),
      });
    } catch (err) {
      console.error('Courses error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch courses.');
    }
  }

  /** Single-step course creation: /newcourse Operating Systems */
  private async handleNewCourse(chatId: number, userId: string, nameArg: string): Promise<void> {
    const courseName = nameArg.trim();
    if (!courseName) {
      await this.bot.sendMessage(chatId,
        '➕ *Add New Course*\n\nUsage:\n`/newcourse Operating Systems`\n`/newcourse Data Structures`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const courseId = courseName.toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 30) + '_' + new Date().getFullYear();

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      await fetch(`${this.skillsRuntimeUrl}/skill/create_course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, course_name: courseName }),
      });

      await this.setActiveCourse(userId, courseId);

      await this.bot.sendMessage(chatId,
        `✅ Course created: *${courseName}*\nID: \`${courseId}\`\n\n` +
        `This is now your active course. Send me a PDF to add material!`,
        { parse_mode: 'Markdown', reply_markup: this.mainMenu() }
      );
    } catch (err) {
      console.error('Create course error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Failed to create course.');
    }
  }

  // ── Topics ────────────────────────────────────────────────────────────────

  private async handleTopics(chatId: number, userId: string): Promise<void> {
    await this.bot.sendChatAction(chatId, 'typing');
    const courseId = await this.getActiveCourse(userId);
    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/topics/${courseId}`);
      const data = await res.json();

      if (!data.success || !data.topics || data.topics.length === 0) {
        await this.bot.sendMessage(chatId,
          `📋 No topics in *${this.strip(courseId)}* yet.\n\n📄 Send me a PDF to add course material!`,
          { parse_mode: 'Markdown', reply_markup: this.mainMenu() }
        );
        return;
      }

      let text = `📋 *Topics in ${this.strip(courseId)} (${data.count})*\n\nTap any topic to take a quiz:\n`;
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: this.topicKeyboard(data.topics),
      });
    } catch (err) {
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch topics.');
    }
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  private async handleQuiz(chatId: number, userId: string, topicArg: string): Promise<void> {
    if (topicArg.trim() === 'list') { await this.handleTopics(chatId, userId); return; }

    await this.bot.sendChatAction(chatId, 'typing');
    const courseId = await this.getActiveCourse(userId);
    const topicId = topicArg.trim() || 'random';

    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/quiz_gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, topic_id: topicId, count: 3 }),
      });
      const data = await res.json();

      if (data.success && data.questions) {
        await this.bot.sendMessage(chatId, '📝 *Quiz Time!* — 3 questions:', { parse_mode: 'Markdown' });
        for (const q of data.questions) {
          await this.bot.sendPoll(chatId, q.question, q.options, {
            type: 'quiz', correct_option_id: q.correct_index,
            explanation: q.explanation, is_anonymous: false,
          });
        }
        await this.bot.sendMessage(chatId, `_Active course: *${this.strip(courseId)}*_ — What\'s next?`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Another Quiz', callback_data: 'action_quiz_random' }, { text: '📋 Pick Topic', callback_data: 'action_topics' }],
              [{ text: '📊 My Status', callback_data: 'action_status' }, { text: '📚 Switch Course', callback_data: 'action_courses' }],
            ],
          },
        });
      } else {
        await this.bot.sendMessage(chatId,
          `⚠️ ${data.error || 'Could not generate quiz.'}\n\nUse /topics to see available topics.`,
          { reply_markup: this.mainMenu() }
        );
      }
    } catch (err) {
      await this.bot.sendMessage(chatId, '⚠️ Quiz generation failed. Please try again.');
    }
  }

  // ── Doubt Answering ───────────────────────────────────────────────────────

  private async handleDoubt(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);
    await this.bot.sendChatAction(chatId, 'typing');
    const courseId = await this.getActiveCourse(userId);

    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: `telegram_${userId}`, course_id: courseId, question: msg.text }),
      });
      const data = await res.json();

      if (data.success) {
        await this.bot.sendMessage(chatId, `🧠 *Answer:*\n\n${data.answer}`, {
          parse_mode: 'Markdown',
          reply_to_message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: [[
              { text: '📝 Quiz Me', callback_data: 'action_quiz_random' },
              { text: '📋 Topics', callback_data: 'action_topics' },
            ]],
          },
        });
      } else {
        await this.bot.sendMessage(chatId,
          `⚠️ ${data.error || "Couldn't find that in your course notes."}`,
          { reply_to_message_id: msg.message_id }
        );
      }
    } catch {
      await this.bot.sendMessage(chatId, '⚠️ Something went wrong. Please try again.');
    }
  }

  // ── Deadlines & Status ────────────────────────────────────────────────────

  private async handleDeadlines(chatId: number, userId: string): Promise<void> {
    await this.bot.sendChatAction(chatId, 'typing');
    const courseId = await this.getActiveCourse(userId);
    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, student_id: `telegram_${userId}` }),
      });
      const data = await res.json();
      await this.bot.sendMessage(chatId, data.message || '⚠️ Could not check deadlines.', {
        parse_mode: 'Markdown', reply_markup: this.mainMenu(),
      });
    } catch {
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch deadline info.');
    }
  }

  private async handleStatus(chatId: number, userId: string): Promise<void> {
    await this.bot.sendChatAction(chatId, 'typing');
    const courseId = await this.getActiveCourse(userId);
    try {
      const res = await fetch(`${this.skillsRuntimeUrl}/skill/student_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: `telegram_${userId}`, course_id: courseId }),
      });
      const data = await res.json();
      await this.bot.sendMessage(chatId, data.status_message || '⚠️ Could not fetch status.', {
        parse_mode: 'Markdown', reply_markup: this.mainMenu(),
      });
    } catch {
      await this.bot.sendMessage(chatId, '⚠️ Could not fetch your status.');
    }
  }

  // ── PDF Upload ────────────────────────────────────────────────────────────

  private async handlePdfUpload(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);
    const doc = msg.document;

    if (!doc || !doc.file_name?.toLowerCase().endsWith('.pdf')) {
      await this.bot.sendMessage(chatId, '📄 Please send a PDF file.');
      return;
    }

    const courseId = await this.getActiveCourse(userId);
    await this.bot.sendMessage(chatId,
      `📥 Received *${doc.file_name}*\n📚 Adding to course: *${this.strip(courseId)}*\n\n_Processing..._`,
      { parse_mode: 'Markdown' }
    );
    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const fileLink = await this.bot.getFileLink(doc.file_id);
      const fileBuffer = Buffer.from(await (await fetch(fileLink)).arrayBuffer());

      const inboxDir = path.resolve('..', 'data', 'inbox', courseId);
      fs.mkdirSync(inboxDir, { recursive: true });
      const filePath = path.join(inboxDir, doc.file_name!);
      fs.writeFileSync(filePath, fileBuffer);

      const res = await fetch(`${this.skillsRuntimeUrl}/skill/pdf_digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          pdf_path: filePath,
          topic_name: doc.file_name!.replace('.pdf', '').replace(/[_-]/g, ' '),
        }),
      });
      const data = await res.json();

      if (data.success) {
        const topicId = this.strip(data.topic_id);
        let text = `✅ *PDF Added to ${this.strip(courseId)}!*\n\n`;
        text += `📚 Topic: *${topicId}*\n\n`;
        if (data.summary_points?.length) {
          text += `*Key Points:*\n`;
          data.summary_points.forEach((p: string, i: number) => { text += `${i + 1}. ${this.strip(p)}\n`; });
        }
        if (data.topic_tags?.length) text += `\n🏷️ ${this.strip(data.topic_tags.join(', '))}`;
        text += '\n\n_Tap below to continue!_';

        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: `📝 Quiz: ${this.truncate(data.topic_id, 18)}`, callback_data: `quiz_${data.topic_id.substring(0, 50)}` },
                { text: '🎲 Random Quiz', callback_data: 'action_quiz_random' },
              ],
              [
                { text: '📋 All Topics', callback_data: 'action_topics' },
                { text: '📚 Courses', callback_data: 'action_courses' },
              ],
            ],
          },
        });
      } else {
        await this.bot.sendMessage(chatId,
          `⚠️ Failed: ${data.error || 'Unknown error'}\n\nMake sure the PDF has readable text (not a scanned image).`,
          { reply_markup: this.mainMenu() }
        );
      }
    } catch (err) {
      console.error('PDF upload error:', err);
      await this.bot.sendMessage(chatId, '⚠️ Failed to process the PDF. Please try again.');
    }
  }

  // ── Public helpers for scheduled broadcasts ───────────────────────────────

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  async sendQuiz(chatId: string, quiz: QuizPayload): Promise<void> {
    await this.bot.sendPoll(chatId, quiz.question, quiz.options, {
      type: 'quiz', correct_option_id: quiz.correct_index,
      explanation: quiz.explanation, is_anonymous: false,
    });
  }
}
