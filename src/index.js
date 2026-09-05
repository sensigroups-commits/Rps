// ============================================
// فایل اصلی ربات سنگ-کاغذ-قیچی
// ============================================

import { gamelogic } from './gamelogic.js';
import { storage } from './storage.js';
import { messages } from './messages.js';

// ============================================
// کلاس اصلی ربات
// ============================================
class RockPaperScissorsBot {
    constructor() {
        this.gameStates = new Map();
        this.tournaments = new Map();
        this.userTimers = new Map();
        this.tournamentChoices = new Map();
        this.twoPlayerGames = new Map();
        this.messageTimers = new Map();
    }

    async handleUpdate(update, env) {
        try {
            this.env = env;
            this.storage = new storage(env);

            // ====== پیام خوش‌آمدگویی هنگام اضافه شدن به گروه ======
            if (update.my_chat_member) {
                const status = update.my_chat_member.new_chat_member.status;
                const chatId = update.my_chat_member.chat.id;
                if (status === 'member' || status === 'administrator') {
                    await this.sendWelcomeToGroup(chatId);
                }
                return new Response('OK', { status: 200 });
            }

            if (update.message) {
                const msg = update.message;
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const text = msg.text?.trim() || '';
                const isGroup = msg.chat.type !== 'private';
                const username = msg.from.username || msg.from.first_name || `کاربر ${userId}`;

                if (text.startsWith('/')) {
                    await this.handleCommand(chatId, userId, text, isGroup, msg, username);
                } else {
                    await this.handleGameChoice(chatId, userId, text, msg, username);
                }
            }

            if (update.callback_query) {
                const query = update.callback_query;
                const chatId = query.message.chat.id;
                const userId = query.from.id;
                const data = query.data;
                const username = query.from.username || query.from.first_name || `کاربر ${userId}`;

                await this.handleCallback(chatId, userId, data, query, username);
            }

            return new Response('OK', { status: 200 });
        } catch (error) {
            console.error('Error in handleUpdate:', error);
            return new Response('Error', { status: 500 });
        }
    }

    // ============================================
    // پیام خوش‌آمدگویی به گروه
    // ============================================
    async sendWelcomeToGroup(chatId) {
        const msg = `🎉 **به ربات سنگ-کاغذ-قیچی خوش آمدید!**\n\n` +
                    `این ربات یک بازی گروهی جذاب برای سرگرمی شماست.\n\n` +
                    `📋 **دستورات سریع:**\n` +
                    `/play - بازی عادی\n` +
                    `/play2p - بازی ۲ نفره\n` +
                    `/tournament - تورنمنت گروهی\n\n` +
                    `برای مشاهده همه دستورات از /help استفاده کنید.`;

        await this.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🎮 شروع بازی', callback_data: 'start_game' },
                        { text: '👥 بازی ۲ نفره', callback_data: 'start_2p_game' }
                    ],
                    [
                        { text: '📊 آمار من', callback_data: 'my_stats' },
                        { text: '🏆 جدول رتبه‌بندی', callback_data: 'show_leaderboard' }
                    ],
                    [
                        { text: '❓ راهنما', callback_data: 'show_help' }
                    ]
                ]
            }
        });
    }

    // ============================================
    // مدیریت دستورات (پشتیبانی از @)
    // ============================================
    async handleCommand(chatId, userId, command, isGroup, msg, username) {
        const args = command.split(' ');
        let cmd = args[0].toLowerCase();
        
        if (cmd.includes('@')) {
            cmd = cmd.split('@')[0];
        }

        switch (cmd) {
            case '/start':
                await this.startCommand(chatId, userId, isGroup, username);
                break;
            case '/play':
                await this.playCommand(chatId, userId, 'normal', username);
                break;
            case '/playhard':
                await this.playCommand(chatId, userId, 'hard', username);
                break;
            case '/playbest3':
                await this.playCommand(chatId, userId, 'best3', username);
                break;
            case '/play2p':
                if (isGroup) {
                    await this.startTwoPlayerGame(chatId, userId, username);
                } else {
                    const sentMsg = await this.sendMessage(chatId, '❌ بازی ۲ نفره فقط در گروه‌ها قابل اجراست!');
                    if (sentMsg && sentMsg.result) {
                        this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                    }
                }
                break;
            case '/stats':
                await this.statsCommand(chatId, userId, username);
                break;
            case '/leaderboard':
                await this.leaderboardCommand(chatId);
                break;
            case '/reset':
                await this.resetCommand(chatId, userId, username);
                break;
            case '/help':
                await this.helpCommand(chatId);
                break;
            case '/tournament':
                if (isGroup) {
                    await this.tournamentCommand(chatId, userId, username);
                } else {
                    const sentMsg = await this.sendMessage(chatId, '❌ تورنمنت فقط در گروه‌ها قابل اجراست!');
                    if (sentMsg && sentMsg.result) {
                        this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                    }
                }
                break;
            case '/cancel':
                await this.cancelGame(chatId, userId);
                break;
            default:
                const sentMsg = await this.sendMessage(chatId, '❌ دستور ناشناخته. از /help استفاده کن.');
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                }
        }
    }

    // ============================================
    // کنسل کردن بازی
    // ============================================
    async cancelGame(chatId, userId) {
        if (this.gameStates.has(userId)) {
            this.gameStates.delete(userId);
            this.clearTimer(userId);
            const sentMsg = await this.sendMessage(chatId, '✅ بازی شما لغو شد.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        if (this.twoPlayerGames.has(chatId)) {
            const game = this.twoPlayerGames.get(chatId);
            if (game.player1 === userId || game.player2 === userId) {
                this.twoPlayerGames.delete(chatId);
                this.clearTimer(game.player1);
                this.clearTimer(game.player2);
                const sentMsg = await this.sendMessage(chatId, '✅ بازی ۲ نفره لغو شد.');
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                }
                return;
            }
        }

        const sentMsg = await this.sendMessage(chatId, '❌ هیچ بازی فعالی برای لغو وجود ندارد.');
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
        }
    }

    // ============================================
    // حذف خودکار پیام‌ها بعد از ۴۰ ثانیه
    // ============================================
    scheduleMessageDeletion(chatId, messageId, delay = 40000) {
        const timer = setTimeout(async () => {
            try {
                const url = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/deleteMessage`;
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId
                    })
                });
            } catch (error) {
                console.error('Error deleting message:', error);
            }
            this.messageTimers.delete(`${chatId}_${messageId}`);
        }, delay);

        this.messageTimers.set(`${chatId}_${messageId}`, timer);
    }

    async startCommand(chatId, userId, isGroup, username) {
        await this.storage.registerUser(userId, chatId, username);
        const welcomeMsg = messages.welcome(isGroup, username);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🪨 سنگ', callback_data: 'rock' },
                    { text: '📄 کاغذ', callback_data: 'paper' },
                    { text: '✂️ قیچی', callback_data: 'scissors' }
                ],
                [
                    { text: '🎮 شروع بازی', callback_data: 'start_game' },
                    { text: '📊 آمار من', callback_data: 'my_stats' },
                    { text: '🏆 جدول امتیازات', callback_data: 'show_leaderboard' }
                ],
                [
                    { text: '❌ لغو بازی', callback_data: 'cancel_game' },
                    { text: '❓ راهنما', callback_data: 'show_help' }
                ]
            ]
        };

        const sentMsg = await this.sendMessage(chatId, welcomeMsg, {
            reply_markup: keyboard
        });
        if (sentMsg && sentMsg.result && isGroup) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }
    }

    // ============================================
    // بازی ۲ نفره
    // ============================================
    async startTwoPlayerGame(chatId, userId, username) {
        if (this.twoPlayerGames.has(chatId)) {
            const game = this.twoPlayerGames.get(chatId);
            if (game.status === 'waiting_for_second') {
                if (game.player1 === userId) {
                    const sentMsg = await this.sendMessage(chatId, '❌ شما قبلاً بازی رو شروع کردید! منتظر نفر دوم باشید.');
                    if (sentMsg && sentMsg.result) {
                        this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                    }
                    return;
                }
                
                game.player2 = userId;
                game.username2 = username;
                game.status = 'playing';
                this.twoPlayerGames.set(chatId, game);
                
                const sentMsg = await this.sendMessage(chatId, 
                    `🎮 **بازی ۲ نفره شروع شد!**\n\n` +
                    `👤 ${game.username1} VS ${game.username2}\n\n` +
                    `هر دو بازیکن دست خود را انتخاب کنند.\n` +
                    `⏰ شما ۳۰ ثانیه فرصت دارید.`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🪨 سنگ', callback_data: '2p_rock' },
                                    { text: '📄 کاغذ', callback_data: '2p_paper' },
                                    { text: '✂️ قیچی', callback_data: '2p_scissors' }
                                ],
                                [
                                    { text: '❌ لغو بازی', callback_data: 'cancel_2p_game' }
                                ]
                            ]
                        }
                    }
                );
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
                }
                
                this.setTwoPlayerTimer(chatId, game.player1);
                this.setTwoPlayerTimer(chatId, game.player2);
                return;
            }
        }
        
        const game = {
            player1: userId,
            player2: null,
            username1: username,
            username2: null,
            choice1: null,
            choice2: null,
            status: 'waiting_for_second',
            chatId: chatId
        };
        
        this.twoPlayerGames.set(chatId, game);
        
        const sentMsg = await this.sendMessage(chatId, 
            `🎮 ${username} عزیز، بازی ۲ نفره شروع شد!\n\n` +
            `⏳ در حال انتظار برای نفر دوم...\n` +
            `به دوستانت بگو دستور /play2p رو بزنن تا به بازی بپیوندن.`
        );
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }
    }

    async handleTwoPlayerChoice(chatId, userId, choice, username) {
        const game = this.twoPlayerGames.get(chatId);
        if (!game) {
            const sentMsg = await this.sendMessage(chatId, '❌ هیچ بازی ۲ نفره‌ای فعال نیست! با /play2p شروع کن.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        if (game.status === 'finished') {
            const sentMsg = await this.sendMessage(chatId, '❌ این بازی به پایان رسیده! با /play2p دوباره شروع کن.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        if (userId === game.player1) {
            if (game.choice1) {
                await this.sendMessage(chatId, '⏳ شما قبلاً انتخاب کردید! منتظر نفر دوم باشید.');
                return;
            }
            game.choice1 = choice;
            const sentMsg = await this.sendMessage(chatId, '✅ انتخاب شما ثبت شد! منتظر انتخاب نفر دوم باشید.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
        } else if (userId === game.player2) {
            if (game.choice2) {
                await this.sendMessage(chatId, '⏳ شما قبلاً انتخاب کردید! منتظر نفر اول باشید.');
                return;
            }
            game.choice2 = choice;
            const sentMsg = await this.sendMessage(chatId, '✅ انتخاب شما ثبت شد! منتظر انتخاب نفر اول باشید.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
        } else {
            const sentMsg = await this.sendMessage(chatId, '❌ شما در این بازی شرکت ندارید!');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        this.twoPlayerGames.set(chatId, game);

        if (game.choice1 && game.choice2) {
            await this.showTwoPlayerResult(chatId, game);
        }
    }

    async showTwoPlayerResult(chatId, game) {
        const result = gamelogic.determineWinner(game.choice1, game.choice2);
        
        let msg = '⚔️ **نتیجه بازی ۲ نفره:**\n\n';
        
        if (result === 'win') {
            msg += `🎉 **${game.username1} برنده شد!**`;
            await this.storage.updateStats(game.player1, chatId, 'win', game.username1);
            await this.storage.updateStats(game.player2, chatId, 'lose', game.username2);
        } else if (result === 'lose') {
            msg += `🎉 **${game.username2} برنده شد!**`;
            await this.storage.updateStats(game.player1, chatId, 'lose', game.username1);
            await this.storage.updateStats(game.player2, chatId, 'win', game.username2);
        } else {
            msg += `🤝 **مساوی!**`;
            await this.storage.updateStats(game.player1, chatId, 'draw', game.username1);
            await this.storage.updateStats(game.player2, chatId, 'draw', game.username2);
        }
        
        game.status = 'finished';
        this.twoPlayerGames.set(chatId, game);
        
        const sentMsg = await this.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 بازی جدید', callback_data: 'new_2p_game' },
                        { text: '📊 آمار من', callback_data: 'my_stats' }
                    ]
                ]
            }
        });
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }
        
        this.clearTimer(game.player1);
        this.clearTimer(game.player2);
    }

    setTwoPlayerTimer(chatId, userId) {
        const timer = setTimeout(async () => {
            const game = this.twoPlayerGames.get(chatId);
            if (!game || game.status === 'finished') return;
            
            let choice = ['سنگ', 'کاغذ', 'قیچی'][Math.floor(Math.random() * 3)];
            
            if (userId === game.player1 && !game.choice1) {
                game.choice1 = choice;
                const sentMsg = await this.sendMessage(chatId, `⏰ زمان ${game.username1} تموم شد! انتخاب تصادفی انجام شد.`);
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                }
            } else if (userId === game.player2 && !game.choice2) {
                game.choice2 = choice;
                const sentMsg = await this.sendMessage(chatId, `⏰ زمان ${game.username2} تموم شد! انتخاب تصادفی انجام شد.`);
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                }
            }
            
            this.twoPlayerGames.set(chatId, game);
            
            if (game.choice1 && game.choice2) {
                await this.showTwoPlayerResult(chatId, game);
            }
        }, 30000);
        
        this.userTimers.set(`twoplayer_${userId}`, { timer, expired: false });
    }

    // ============================================
    // بازی عادی با ربات (اصلاح‌شده برای عدم پاسخ به چت معمولی)
    // ============================================
    async playCommand(chatId, userId, mode, username) {
        this.clearTimer(userId);

        let gameMode = 'normal';
        let modeName = 'عادی';
        
        if (mode === 'hard') {
            gameMode = 'hard';
            modeName = 'سخت 🧠';
        } else if (mode === 'best3' || mode === 'best_of_3') {
            gameMode = 'best_of_3';
            modeName = 'مسابقه‌ای (Best of 3)';
        }

        this.gameStates.set(userId, {
            userId: userId,
            username: username,
            mode: gameMode,
            round: 0,
            userWins: 0,
            botWins: 0,
            userChoice: null,
            botChoice: null,
            history: [],
            timestamp: Date.now(),
            isActive: true,
            chatId: chatId
        });

        const msg = messages.startGame(modeName, username);
        const sentMsg = await this.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🪨 سنگ', callback_data: 'rock' },
                        { text: '📄 کاغذ', callback_data: 'paper' },
                        { text: '✂️ قیچی', callback_data: 'scissors' }
                    ],
                    [
                        { text: '❌ لغو بازی', callback_data: 'cancel_game' }
                    ]
                ]
            }
        });
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }

        this.setTimer(chatId, userId);
    }

    // ============================================
    // پردازش انتخاب کاربر (اصلاح‌شده برای عدم پاسخ به چت معمولی)
    // ============================================
    async handleGameChoice(chatId, userId, text, msg, username) {
        // ====== فقط پیام‌های متنی که انتخاب معتبر هستند رو پردازش کن ======
        const validChoices = ['سنگ', 'کاغذ', 'قیچی'];
        
        // اگه پیام یکی از انتخاب‌های معتبر نباشه، نادیده بگیر
        if (!validChoices.includes(text)) {
            return; // هیچ کاری نکن، پیام رو نادیده بگیر
        }

        const gameState = this.gameStates.get(userId);
        
        // اگه بازی فعال نیست، نادیده بگیر
        if (!gameState) {
            return;
        }

        if (!gameState.isActive) {
            return;
        }

        if (this.userTimers.has(userId) && this.userTimers.get(userId).expired) {
            const sentMsg = await this.sendMessage(chatId, '⏰ زمانت تموم شد! دوباره با /play شروع کن.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            this.gameStates.delete(userId);
            this.clearTimer(userId);
            return;
        }

        const choice = text;

        gameState.userChoice = choice;
        gameState.round++;

        const botChoice = gamelogic.getBotChoice(gameState.mode === 'hard' ? 'hard' : 'normal');
        gameState.botChoice = botChoice;

        const result = gamelogic.determineWinner(choice, botChoice);
        gameState.history.push({ user: choice, bot: botChoice, result });

        if (result === 'win') {
            gameState.userWins++;
        } else if (result === 'lose') {
            gameState.botWins++;
        }

        await this.storage.updateStats(userId, chatId, result, username);

        const resultMsg = messages.showResult(choice, botChoice, result, gameState, username);
        const sentMsg = await this.sendMessage(chatId, resultMsg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🪨 سنگ', callback_data: 'rock' },
                        { text: '📄 کاغذ', callback_data: 'paper' },
                        { text: '✂️ قیچی', callback_data: 'scissors' }
                    ],
                    [
                        { text: '📊 آمار', callback_data: 'my_stats' },
                        { text: '🔄 بازی جدید', callback_data: 'new_game' },
                        { text: '❌ لغو', callback_data: 'cancel_game' }
                    ]
                ]
            }
        });
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }

        if (gameState.mode === 'best_of_3') {
            if (gameState.userWins >= 2 || gameState.botWins >= 2) {
                const finalMsg = gamelogic.getFinalResult(gameState, username);
                const finalSent = await this.sendMessage(chatId, finalMsg);
                if (finalSent && finalSent.result) {
                    this.scheduleMessageDeletion(chatId, finalSent.result.message_id, 40000);
                }
                gameState.isActive = false;
                this.gameStates.set(userId, gameState);
                this.clearTimer(userId);
                return;
            }
        }

        this.clearTimer(userId);
        this.setTimer(chatId, userId);
    }

    async statsCommand(chatId, userId, username) {
        const stats = await this.storage.getUserStats(userId, chatId);
        if (!stats) {
            const sentMsg = await this.sendMessage(chatId, '❌ هنوز آماری برای شما ثبت نشده!');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }
        const msg = messages.showStats(stats, username);
        const sentMsg = await this.sendMessage(chatId, msg);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }
    }

    async leaderboardCommand(chatId) {
        const leaderboard = await this.storage.getLeaderboard(chatId, 10);
        if (!leaderboard || leaderboard.length === 0) {
            const sentMsg = await this.sendMessage(chatId, '❌ هنوز هیچ کاربری در این گروه بازی نکرده!');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }
        const msg = messages.showLeaderboard(leaderboard);
        const sentMsg = await this.sendMessage(chatId, msg);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }
    }

    async resetCommand(chatId, userId, username) {
        await this.storage.resetStats(userId, chatId);
        const sentMsg = await this.sendMessage(chatId, `✅ ${username} عزیز، آمار شما با موفقیت ریست شد!`);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
        }
    }

    async helpCommand(chatId) {
        const msg = messages.showHelp();
        const sentMsg = await this.sendMessage(chatId, msg);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 60000);
        }
    }

    async tournamentCommand(chatId, userId, username) {
        if (!this.tournaments.has(chatId)) {
            this.tournaments.set(chatId, {
                players: [],
                rounds: [],
                currentRound: 0,
                status: 'waiting',
                maxPlayers: 8,
                results: [],
                chatId: chatId,
                startedBy: userId
            });
        }

        const tournament = this.tournaments.get(chatId);

        if (tournament.status === 'active') {
            const sentMsg = await this.sendMessage(chatId, '❌ یک تورنمنت در حال برگزاری است! صبر کنید تا تمام شود.');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        if (tournament.players.includes(userId)) {
            const sentMsg = await this.sendMessage(chatId, '❌ شما قبلاً در تورنمنت ثبت‌نام کردید!');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        tournament.players.push(userId);
        this.tournaments.set(chatId, tournament);

        const playerCount = tournament.players.length;
        const sentMsg = await this.sendMessage(chatId, 
            `✅ کاربر ${username} به تورنمنت پیوست!\n` +
            `👥 تعداد شرکت‌کنندگان: ${playerCount}/${tournament.maxPlayers}\n` +
            `💰 برای شروع به حداقل ۲ نفر نیاز داریم.`
        );
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }

        if (playerCount >= 2) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedTournament = this.tournaments.get(chatId);
            if (updatedTournament && updatedTournament.status === 'waiting' && updatedTournament.players.length >= 2) {
                await this.startTournament(chatId);
            }
        }
    }

    async startTournament(chatId) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament) return;

        const players = tournament.players;
        const shuffled = gamelogic.shuffleArray([...players]);
        const rounds = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                rounds.push([shuffled[i], shuffled[i + 1]]);
            } else {
                rounds.push([shuffled[i], null]);
            }
        }

        tournament.rounds = rounds;
        tournament.currentRound = 0;
        tournament.status = 'active';
        tournament.results = [];
        this.tournaments.set(chatId, tournament);

        const sentMsg = await this.sendMessage(chatId, '🏆 **تورنمنت شروع شد!**\n\n' + 
            messages.showTournamentBracket(rounds, tournament.players));
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 60000);
        }
        
        await this.playTournamentRound(chatId);
    }

    async playTournamentRound(chatId) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament || tournament.status !== 'active') return;

        const round = tournament.rounds[tournament.currentRound];
        if (!round) {
            await this.finishTournament(chatId);
            return;
        }

        const activeMatches = round.filter(match => match[1] !== null);
        
        if (activeMatches.length === 0) {
            await this.advanceTournamentRound(chatId);
            return;
        }

        this.tournamentChoices.set(chatId, {});

        let msg = `⚔️ **دور ${tournament.currentRound + 1}**\n\n`;
        for (const match of round) {
            if (match[1] === null) {
                msg += `🎉 ${match[0]} به دور بعد راه یافت! (Bye)\n`;
            } else {
                msg += `⚔️ ${match[0]} VS ${match[1]}\n`;
            }
        }
        msg += '\n⏳ هر بازیکن ۳۰ ثانیه فرصت دارد تا انتخاب کند.';
        
        const sentMsg = await this.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🪨 سنگ', callback_data: 'tournament_rock' },
                        { text: '📄 کاغذ', callback_data: 'tournament_paper' },
                        { text: '✂️ قیچی', callback_data: 'tournament_scissors' }
                    ]
                ]
            }
        });
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 60000);
        }

        const allPlayers = round.flat().filter(p => p !== null);
        for (const playerId of allPlayers) {
            this.setTournamentTimer(chatId, playerId);
        }
    }

    async handleTournamentChoice(chatId, userId, choice) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament || tournament.status !== 'active') return;

        const round = tournament.rounds[tournament.currentRound];
        const isParticipant = round.some(match => match.includes(userId));
        if (!isParticipant) {
            const sentMsg = await this.sendMessage(chatId, '❌ شما در این دور تورنمنت شرکت ندارید!');
            if (sentMsg && sentMsg.result) {
                this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
            }
            return;
        }

        if (!this.tournamentChoices.has(chatId)) {
            this.tournamentChoices.set(chatId, {});
        }
        const choices = this.tournamentChoices.get(chatId);
        
        if (choices[userId]) {
            await this.sendMessage(chatId, '⏳ شما قبلاً انتخاب کردید! منتظر بقیه باشید.');
            return;
        }

        choices[userId] = choice;
        this.tournamentChoices.set(chatId, choices);

        const sentMsg = await this.sendMessage(chatId, `✅ انتخاب شما ثبت شد!`);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
        }

        const allPlayers = round.flat().filter(p => p !== null);
        const allSelected = allPlayers.every(p => choices[p] !== undefined);

        if (allSelected) {
            await this.processTournamentRound(chatId);
        }
    }

    async processTournamentRound(chatId) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament) return;

        const round = tournament.rounds[tournament.currentRound];
        const choices = this.tournamentChoices.get(chatId) || {};
        const results = [];
        const winners = [];

        for (const match of round) {
            if (match[1] === null) {
                winners.push(match[0]);
                results.push({ player1: match[0], player2: null, winner: match[0] });
                continue;
            }

            const choice1 = choices[match[0]];
            const choice2 = choices[match[1]];

            if (!choice1 || !choice2) {
                const winner = choice1 ? match[0] : (choice2 ? match[1] : null);
                if (winner) winners.push(winner);
                results.push({ 
                    player1: match[0], 
                    player2: match[1], 
                    winner: winner,
                    choice1: choice1 || 'انتخاب نشده',
                    choice2: choice2 || 'انتخاب نشده'
                });
                continue;
            }

            const result = gamelogic.determineWinner(choice1, choice2);
            let winner = null;
            if (result === 'win') winner = match[0];
            else if (result === 'lose') winner = match[1];

            if (winner) winners.push(winner);
            
            results.push({
                player1: match[0],
                player2: match[1],
                winner: winner,
                choice1: choice1,
                choice2: choice2,
                result: result
            });
        }

        let msg = `📊 **نتایج دور ${tournament.currentRound + 1}:**\n\n`;
        for (const result of results) {
            if (result.player2 === null) {
                msg += `🎉 ${result.player1} به دور بعد راه یافت! (Bye)\n`;
            } else if (result.winner === null) {
                msg += `🤝 ${result.player1} VS ${result.player2} -> مساوی!\n`;
            } else {
                msg += `🎉 ${result.winner} برنده شد!\n`;
            }
        }

        const sentMsg = await this.sendMessage(chatId, msg);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 40000);
        }

        tournament.results.push(results);
        
        const nextRound = [];
        for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
                nextRound.push([winners[i], winners[i + 1]]);
            } else {
                nextRound.push([winners[i], null]);
            }
        }

        tournament.currentRound++;
        tournament.rounds[tournament.currentRound] = nextRound;
        this.tournaments.set(chatId, tournament);

        this.tournamentChoices.delete(chatId);

        if (nextRound.length === 1 && nextRound[0][1] === null) {
            await this.finishTournament(chatId);
        } else {
            await this.playTournamentRound(chatId);
        }
    }

    async advanceTournamentRound(chatId) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament) return;

        tournament.currentRound++;
        const nextRound = tournament.rounds[tournament.currentRound];
        
        if (!nextRound || nextRound.length === 0) {
            await this.finishTournament(chatId);
        } else {
            await this.playTournamentRound(chatId);
        }
    }

    async finishTournament(chatId) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament) return;

        const lastRound = tournament.rounds[tournament.rounds.length - 1];
        let champion = null;
        if (lastRound && lastRound.length === 1 && lastRound[0][1] === null) {
            champion = lastRound[0][0];
        }

        let msg = '🏆 **تورنمنت به پایان رسید!**\n\n';
        if (champion) {
            const username = await this.getUsername(champion);
            msg += `🎉 **قهرمان: ${username || champion}** 🎉\n\n`;
            msg += `👏 تبریک به قهرمان تورنمنت!\n`;
            msg += `📊 تعداد شرکت‌کنندگان: ${tournament.players.length}`;
        } else {
            msg += '😔 متأسفانه تورنمنت بدون برنده به پایان رسید.';
        }

        const sentMsg = await this.sendMessage(chatId, msg);
        if (sentMsg && sentMsg.result) {
            this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 60000);
        }

        this.tournaments.delete(chatId);
        this.tournamentChoices.delete(chatId);
    }

    setTournamentTimer(chatId, userId) {
        const timer = setTimeout(async () => {
            const choices = this.tournamentChoices.get(chatId) || {};
            if (!choices[userId]) {
                const randomChoice = ['سنگ', 'کاغذ', 'قیچی'][Math.floor(Math.random() * 3)];
                choices[userId] = randomChoice;
                this.tournamentChoices.set(chatId, choices);
                const sentMsg = await this.sendMessage(chatId, `⏰ زمان ${userId} تموم شد! انتخاب تصادفی انجام شد.`);
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                }
                
                const tournament = this.tournaments.get(chatId);
                if (tournament) {
                    const round = tournament.rounds[tournament.currentRound];
                    const allPlayers = round.flat().filter(p => p !== null);
                    const allSelected = allPlayers.every(p => choices[p] !== undefined);
                    if (allSelected) {
                        await this.processTournamentRound(chatId);
                    }
                }
            }
        }, 30000);
        
        this.userTimers.set(`tournament_${chatId}_${userId}`, { timer, expired: false });
    }

    async getUsername(userId) {
        try {
            const url = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/getChat`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: userId })
            });
            const data = await response.json();
            if (data.ok && data.result) {
                return data.result.username || data.result.first_name || null;
            }
        } catch (error) {
            console.error('Error getting username:', error);
        }
        return null;
    }

    setTimer(chatId, userId) {
        this.clearTimer(userId);

        const timer = setTimeout(async () => {
            const gameState = this.gameStates.get(userId);
            if (gameState && gameState.isActive) {
                this.userTimers.set(userId, { expired: true });
                const sentMsg = await this.sendMessage(chatId, '⏰ زمان شما به پایان رسید! لطفاً با /play دوباره شروع کنید.');
                if (sentMsg && sentMsg.result) {
                    this.scheduleMessageDeletion(chatId, sentMsg.result.message_id, 4000);
                }
                gameState.isActive = false;
                this.gameStates.set(userId, gameState);
            }
        }, 30000);

        this.userTimers.set(userId, { timer, expired: false });
    }

    clearTimer(userId) {
        if (this.userTimers.has(userId)) {
            const data = this.userTimers.get(userId);
            if (data.timer) {
                clearTimeout(data.timer);
            }
            this.userTimers.delete(userId);
        }
        
        for (const [key, data] of this.userTimers) {
            if (key.includes('tournament_')) {
                clearTimeout(data.timer);
                this.userTimers.delete(key);
            }
        }
    }

    async handleCallback(chatId, userId, data, query, username) {
        switch (data) {
            case 'rock':
            case 'paper':
            case 'scissors':
                const choice = { rock: 'سنگ', paper: 'کاغذ', scissors: 'قیچی' }[data];
                await this.handleGameChoice(chatId, userId, choice, query.message, username);
                break;

            case '2p_rock':
            case '2p_paper':
            case '2p_scissors':
                const choice2p = { 
                    '2p_rock': 'سنگ', 
                    '2p_paper': 'کاغذ', 
                    '2p_scissors': 'قیچی' 
                }[data];
                await this.handleTwoPlayerChoice(chatId, userId, choice2p, username);
                break;

            case 'tournament_rock':
            case 'tournament_paper':
            case 'tournament_scissors':
                const tChoice = { 
                    tournament_rock: 'سنگ', 
                    tournament_paper: 'کاغذ', 
                    tournament_scissors: 'قیچی' 
                }[data];
                await this.handleTournamentChoice(chatId, userId, tChoice);
                break;

            case 'start_game':
                await this.playCommand(chatId, userId, 'normal', username);
                break;

            case 'start_2p_game':
                await this.startTwoPlayerGame(chatId, userId, username);
                break;

            case 'new_2p_game':
                await this.startTwoPlayerGame(chatId, userId, username);
                break;

            case 'my_stats':
                await this.statsCommand(chatId, userId, username);
                break;

            case 'show_leaderboard':
                await this.leaderboardCommand(chatId);
                break;

            case 'show_help':
                await this.helpCommand(chatId);
                break;

            case 'new_game':
                await this.playCommand(chatId, userId, 'normal', username);
                break;

            case 'cancel_game':
            case 'cancel_2p_game':
                await this.cancelGame(chatId, userId);
                break;

            default:
                await this.sendMessage(chatId, '❌ دکمه ناشناخته!');
        }

        await this.answerCallbackQuery(query.id);
    }

    async sendMessage(chatId, text, options = {}) {
        const url = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...options
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!data.ok) {
                console.error('Error sending message:', data);
            }
            return data;
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    async answerCallbackQuery(callbackQueryId) {
        const url = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQueryId })
            });
        } catch (error) {
            console.error('Error answering callback:', error);
        }
    }
}

// ============================================
// راه‌اندازی ربات
// ============================================
const bot = new RockPaperScissorsBot();

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/setwebhook') {
            const webhookUrl = `https://${url.hostname}/webhook`;
            try {
                const response = await fetch(
                    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`
                );
                const data = await response.json();
                return new Response(JSON.stringify(data, null, 2), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                await bot.handleUpdate(update, env);
                return new Response('OK', { status: 200 });
            } catch (error) {
                console.error('Webhook error:', error);
                return new Response('Error', { status: 500 });
            }
        }

        return new Response(
            '🎮 Rock Paper Scissors Bot is running!\n\n' +
            '📌 Use /setwebhook to configure webhook\n' +
            '🤖 Bot by: Your Name',
            { status: 200 }
        );
    }
};
