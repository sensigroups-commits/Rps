// ============================================
// فایل اصلی ربات سنگ-کاغذ-قیچی
// ============================================

import { gameLogic } from './gamelogic.js';
import { storage } from './storage.js';
import { messages } from './messages.js';

// ============================================
// کلاس اصلی ربات
// ============================================
class RockPaperScissorsBot {
    constructor() {
        // ذخیره وضعیت بازی کاربران
        this.gameStates = new Map();
        // ذخیره تورنمنت‌های گروهی
        this.tournaments = new Map();
        // ذخیره تایمرهای کاربران
        this.userTimers = new Map();
        // ذخیره انتخاب‌های تورنمنت
        this.tournamentChoices = new Map();
    }

    // ============================================
    // پردازش Webhook
    // ============================================
    async handleUpdate(update, env) {
        try {
            // تنظیم محیط
            this.env = env;
            this.storage = new storage(env);

            // پردازش پیام متنی
            if (update.message) {
                const msg = update.message;
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const text = msg.text?.trim() || '';
                const isGroup = msg.chat.type !== 'private';
                const username = msg.from.username || msg.from.first_name || `کاربر ${userId}`;

                // پردازش دستورات
                if (text.startsWith('/')) {
                    await this.handleCommand(chatId, userId, text, isGroup, msg, username);
                } else {
                    // پردازش پاسخ بازی (انتخاب دست)
                    await this.handleGameChoice(chatId, userId, text, msg, username);
                }
            }

            // پردازش Callback Query (برای کیبوردهای شیشه‌ای)
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
    // مدیریت دستورات
    // ============================================
    async handleCommand(chatId, userId, command, isGroup, msg, username) {
        const args = command.split(' ');
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case '/start':
                await this.startCommand(chatId, userId, isGroup, username);
                break;

            case '/play':
                const mode = args[1] || 'normal';
                await this.playCommand(chatId, userId, mode, username);
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
                    await this.sendMessage(chatId, '❌ تورنمنت فقط در گروه‌ها قابل اجراست!');
                }
                break;

            default:
                await this.sendMessage(chatId, '❌ دستور ناشناخته. از /help استفاده کن.');
        }
    }

    // ============================================
    // دستور /start
    // ============================================
    async startCommand(chatId, userId, isGroup, username) {
        // ثبت کاربر در KV
        await this.storage.registerUser(userId, chatId, username);

        const welcomeMsg = messages.welcome(isGroup, username);
        await this.sendMessage(chatId, welcomeMsg, {
            reply_markup: {
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
                        { text: '❓ راهنما', callback_data: 'show_help' }
                    ]
                ]
            }
        });
    }

    // ============================================
    // دستور /play
    // ============================================
    async playCommand(chatId, userId, mode, username) {
        // پاک کردن تایمر قبلی
        this.clearTimer(userId);

        // تنظیم حالت بازی
        let gameMode = 'normal';
        let modeName = 'عادی';
        
        if (mode === 'hard') {
            gameMode = 'hard';
            modeName = 'سخت 🧠';
        } else if (mode === 'best3' || mode === 'best_of_3') {
            gameMode = 'best_of_3';
            modeName = 'مسابقه‌ای (Best of 3)';
        } else if (mode === '2p' || mode === 'two_player') {
            gameMode = 'two_player';
            modeName = '۲ نفره 👥';
        }

        // ایجاد وضعیت بازی
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
        await this.sendMessage(chatId, msg, {
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

        // شروع تایمر ۳۰ ثانیه‌ای
        this.setTimer(chatId, userId);
    }

    // ============================================
    // پردازش انتخاب کاربر
    // ============================================
    async handleGameChoice(chatId, userId, choice, msg, username) {
        const gameState = this.gameStates.get(userId);
        
        // بررسی وجود بازی
        if (!gameState) {
            await this.sendMessage(chatId, '❌ ابتدا با دستور /play بازی رو شروع کن!');
            return;
        }

        // بررسی فعال بودن بازی
        if (!gameState.isActive) {
            await this.sendMessage(chatId, '❌ این بازی قبلاً تمام شده! با /play دوباره شروع کن.');
            return;
        }

        // بررسی تایمر
        if (this.userTimers.has(userId) && this.userTimers.get(userId).expired) {
            await this.sendMessage(chatId, '⏰ زمانت تموم شد! دوباره با /play شروع کن.');
            this.gameStates.delete(userId);
            this.clearTimer(userId);
            return;
        }

        // پردازش انتخاب
        const validChoices = ['سنگ', 'کاغذ', 'قیچی'];
        if (!validChoices.includes(choice)) {
            await this.sendMessage(chatId, '❌ لطفاً یکی از گزینه‌های سنگ، کاغذ یا قیچی رو انتخاب کن.');
            return;
        }

        // اگر حالت ۲ نفره است
        if (gameState.mode === 'two_player') {
            await this.handleTwoPlayerMode(chatId, userId, choice, username);
            return;
        }

        // ذخیره انتخاب کاربر
        gameState.userChoice = choice;
        gameState.round++;

        // انتخاب ربات (بر اساس حالت)
        const botChoice = gameLogic.getBotChoice(gameState.mode === 'hard' ? 'hard' : 'normal');
        gameState.botChoice = botChoice;

        // تعیین برنده
        const result = gameLogic.determineWinner(choice, botChoice);
        gameState.history.push({ user: choice, bot: botChoice, result });

        // به‌روزرسانی آمار
        if (result === 'win') {
            gameState.userWins++;
        } else if (result === 'lose') {
            gameState.botWins++;
        }

        // ذخیره آمار در KV
        await this.storage.updateStats(userId, chatId, result, username);

        // نمایش نتیجه
        const resultMsg = messages.showResult(choice, botChoice, result, gameState, username);
        await this.sendMessage(chatId, resultMsg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🪨 سنگ', callback_data: 'rock' },
                        { text: '📄 کاغذ', callback_data: 'paper' },
                        { text: '✂️ قیچی', callback_data: 'scissors' }
                    ],
                    [
                        { text: '📊 آمار', callback_data: 'my_stats' },
                        { text: '🔄 بازی جدید', callback_data: 'new_game' }
                    ]
                ]
            }
        });

        // بررسی پایان بازی (Best of 3)
        if (gameState.mode === 'best_of_3') {
            if (gameState.userWins >= 2 || gameState.botWins >= 2) {
                const finalMsg = gameLogic.getFinalResult(gameState, username);
                await this.sendMessage(chatId, finalMsg);
                gameState.isActive = false;
                this.gameStates.set(userId, gameState);
                this.clearTimer(userId);
                return;
            }
        }

        // پاک کردن تایمر
        this.clearTimer(userId);

        // شروع تایمر جدید برای دور بعد
        this.setTimer(chatId, userId);
    }

    // ============================================
    // حالت ۲ نفره (کامل)
    // ============================================
    async handleTwoPlayerMode(chatId, userId, choice, username) {
        const gameState = this.gameStates.get(userId);
        
        // بررسی اینکه آیا کاربر قبلاً انتخاب کرده
        if (gameState.userChoice) {
            await this.sendMessage(chatId, '⏳ شما قبلاً انتخاب کردید! منتظر نفر دوم باشید.');
            return;
        }

        // ذخیره انتخاب کاربر
        gameState.userChoice = choice;
        gameState.round++;
        this.gameStates.set(userId, gameState);

        // پیدا کردن کاربر دوم (در گروه)
        let opponentId = null;
        for (const [id, state] of this.gameStates) {
            if (id !== userId && state.chatId === chatId && state.mode === 'two_player' && !state.userChoice) {
                opponentId = id;
                break;
            }
        }

        if (!opponentId) {
            await this.sendMessage(chatId, 
                `✅ انتخاب شما (${choice}) ثبت شد!\n⏳ در حال انتظار برای نفر دوم...`
            );
            return;
        }

        // دریافت اطلاعات نفر دوم
        const opponentState = this.gameStates.get(opponentId);
        if (!opponentState || !opponentState.userChoice) {
            await this.sendMessage(chatId, '❌ خطا در دریافت انتخاب نفر دوم!');
            return;
        }

        const user1Choice = gameState.userChoice;
        const user2Choice = opponentState.userChoice;

        // تعیین برنده
        const result = gameLogic.determineWinner(user1Choice, user2Choice);

        // نمایش نتیجه
        const resultMsg = messages.showTwoPlayerResult(
            gameState.username || `کاربر ${userId}`,
            opponentState.username || `کاربر ${opponentId}`,
            user1Choice,
            user2Choice,
            result
        );
        await this.sendMessage(chatId, resultMsg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 بازی جدید', callback_data: 'new_game' },
                        { text: '📊 آمار من', callback_data: 'my_stats' }
                    ]
                ]
            }
        });

        // به‌روزرسانی آمار هر دو کاربر
        if (result === 'win') {
            await this.storage.updateStats(userId, chatId, 'win', gameState.username);
            await this.storage.updateStats(opponentId, chatId, 'lose', opponentState.username);
        } else if (result === 'lose') {
            await this.storage.updateStats(userId, chatId, 'lose', gameState.username);
            await this.storage.updateStats(opponentId, chatId, 'win', opponentState.username);
        } else {
            await this.storage.updateStats(userId, chatId, 'draw', gameState.username);
            await this.storage.updateStats(opponentId, chatId, 'draw', opponentState.username);
        }

        // پاک کردن وضعیت بازی هر دو
        gameState.isActive = false;
        opponentState.isActive = false;
        this.gameStates.set(userId, gameState);
        this.gameStates.set(opponentId, opponentState);
        
        this.clearTimer(userId);
        this.clearTimer(opponentId);
    }

    // ============================================
    // دستور /stats
    // ============================================
    async statsCommand(chatId, userId, username) {
        const stats = await this.storage.getUserStats(userId, chatId);
        if (!stats) {
            await this.sendMessage(chatId, '❌ هنوز آماری برای شما ثبت نشده!');
            return;
        }

        const msg = messages.showStats(stats, username);
        await this.sendMessage(chatId, msg);
    }

    // ============================================
    // دستور /leaderboard
    // ============================================
    async leaderboardCommand(chatId) {
        const leaderboard = await this.storage.getLeaderboard(chatId, 10);
        if (!leaderboard || leaderboard.length === 0) {
            await this.sendMessage(chatId, '❌ هنوز هیچ کاربری در این گروه بازی نکرده!');
            return;
        }

        const msg = messages.showLeaderboard(leaderboard);
        await this.sendMessage(chatId, msg);
    }

    // ============================================
    // دستور /reset
    // ============================================
    async resetCommand(chatId, userId, username) {
        await this.storage.resetStats(userId, chatId);
        await this.sendMessage(chatId, `✅ ${username} عزیز، آمار شما با موفقیت ریست شد!`);
    }

    // ============================================
    // دستور /help
    // ============================================
    async helpCommand(chatId) {
        const msg = messages.showHelp();
        await this.sendMessage(chatId, msg);
    }

    // ============================================
    // تورنمنت (کامل)
    // ============================================
    async tournamentCommand(chatId, userId, username) {
        // بررسی وجود تورنمنت
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

        // اگر تورنمنت فعال است
        if (tournament.status === 'active') {
            await this.sendMessage(chatId, '❌ یک تورنمنت در حال برگزاری است! صبر کنید تا تمام شود.');
            return;
        }

        // ثبت نام
        if (tournament.players.includes(userId)) {
            await this.sendMessage(chatId, '❌ شما قبلاً در تورنمنت ثبت‌نام کردید!');
            return;
        }

        tournament.players.push(userId);
        this.tournaments.set(chatId, tournament);

        const playerCount = tournament.players.length;
        await this.sendMessage(chatId, 
            `✅ کاربر ${username} به تورنمنت پیوست!\n` +
            `👥 تعداد شرکت‌کنندگان: ${playerCount}/${tournament.maxPlayers}\n` +
            `💰 برای شروع به حداقل ۲ نفر نیاز داریم.`
        );

        // اگر تعداد بازیکنان به ۲ رسید، تورنمنت شروع می‌شود
        if (playerCount >= 2) {
            // صبر ۵ ثانیه برای ثبت‌نام دیگران
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // بررسی مجدد تورنمنت
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
        
        // قرعه‌کشی
        const shuffled = gameLogic.shuffleArray([...players]);
        const rounds = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                rounds.push([shuffled[i], shuffled[i + 1]]);
            } else {
                rounds.push([shuffled[i], null]); // bye
            }
        }

        tournament.rounds = rounds;
        tournament.currentRound = 0;
        tournament.status = 'active';
        tournament.results = [];
        this.tournaments.set(chatId, tournament);

        await this.sendMessage(chatId, '🏆 **تورنمنت شروع شد!**\n\n' + 
            messages.showTournamentBracket(rounds, tournament.players));
        
        // شروع دور اول
        await this.playTournamentRound(chatId);
    }

    async playTournamentRound(chatId) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament || tournament.status !== 'active') return;

        const round = tournament.rounds[tournament.currentRound];
        if (!round) {
            // پایان تورنمنت
            await this.finishTournament(chatId);
            return;
        }

        // فیلتر کردن مسابقاتی که بازیکن bye دارن
        const activeMatches = round.filter(match => match[1] !== null);
        
        if (activeMatches.length === 0) {
            // همه bye هستن - به دور بعد برو
            await this.advanceTournamentRound(chatId);
            return;
        }

        // پاک کردن انتخاب‌های قبلی
        this.tournamentChoices.set(chatId, {});

        // اعلام مسابقات
        let msg = `⚔️ **دور ${tournament.currentRound + 1}**\n\n`;
        for (const match of round) {
            if (match[1] === null) {
                msg += `🎉 ${match[0]} به دور بعد راه یافت! (Bye)\n`;
            } else {
                msg += `⚔️ ${match[0]} VS ${match[1]}\n`;
            }
        }
        msg += '\n⏳ هر بازیکن ۳۰ ثانیه فرصت دارد تا انتخاب کند.';
        
        await this.sendMessage(chatId, msg, {
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

        // شروع تایمر برای همه بازیکنان
        const allPlayers = round.flat().filter(p => p !== null);
        for (const playerId of allPlayers) {
            this.setTournamentTimer(chatId, playerId);
        }
    }

    async handleTournamentChoice(chatId, userId, choice) {
        const tournament = this.tournaments.get(chatId);
        if (!tournament || tournament.status !== 'active') return;

        // بررسی اینکه آیا کاربر در این دور شرکت دارد
        const round = tournament.rounds[tournament.currentRound];
        const isParticipant = round.some(match => match.includes(userId));
        if (!isParticipant) {
            await this.sendMessage(chatId, '❌ شما در این دور تورنمنت شرکت ندارید!');
            return;
        }

        // ذخیره انتخاب
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

        await this.sendMessage(chatId, `✅ انتخاب شما (${choice}) ثبت شد!`);

        // بررسی اینکه آیا همه انتخاب کردن
        const allPlayers = round.flat().filter(p => p !== null);
        const allSelected = allPlayers.every(p => choices[p] !== undefined);

        if (allSelected) {
            // پردازش نتایج
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
                // Bye - بازیکن به دور بعد می‌ره
                winners.push(match[0]);
                results.push({ player1: match[0], player2: null, winner: match[0] });
                continue;
            }

            const choice1 = choices[match[0]];
            const choice2 = choices[match[1]];

            if (!choice1 || !choice2) {
                // اگر یکی انتخاب نکرده، اون بازیکن می‌بازه
                const winner = choice1 ? match[0] : (choice2 ? match[1] : null);
                winners.push(winner);
                results.push({ 
                    player1: match[0], 
                    player2: match[1], 
                    winner: winner,
                    choice1: choice1 || 'انتخاب نشده',
                    choice2: choice2 || 'انتخاب نشده'
                });
                continue;
            }

            const result = gameLogic.determineWinner(choice1, choice2);
            let winner = null;
            if (result === 'win') winner = match[0];
            else if (result === 'lose') winner = match[1];
            else winner = null; // مساوی

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

        // نمایش نتایج دور
        let msg = `📊 **نتایج دور ${tournament.currentRound + 1}:**\n\n`;
        for (const result of results) {
            if (result.player2 === null) {
                msg += `🎉 ${result.player1} به دور بعد راه یافت! (Bye)\n`;
            } else if (result.winner === null) {
                msg += `🤝 ${result.player1} (${result.choice1}) VS ${result.player2} (${result.choice2}) -> مساوی!\n`;
            } else {
                msg += `🎉 ${result.winner} برنده شد!\n`;
                msg += `   ${result.player1} (${result.choice1}) VS ${result.player2} (${result.choice2})\n`;
            }
        }

        await this.sendMessage(chatId, msg);

        // ذخیره برندگان
        tournament.results.push(results);
        
        // به‌روزرسانی براکت برای دور بعد
        const nextRound = [];
        for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
                nextRound.push([winners[i], winners[i + 1]]);
            } else {
                nextRound.push([winners[i], null]);
            }
        }

        // پیشرفت به دور بعد
        tournament.currentRound++;
        tournament.rounds[tournament.currentRound] = nextRound;
        this.tournaments.set(chatId, tournament);

        // پاک کردن انتخاب‌ها
        this.tournamentChoices.delete(chatId);

        // شروع دور بعد یا پایان تورنمنت
        if (nextRound.length === 1 && nextRound[0][1] === null) {
            // فقط یک بازیکن مونده - قهرمان
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

        // پیدا کردن قهرمان
        const lastRound = tournament.rounds[tournament.rounds.length - 1];
        let champion = null;
        if (lastRound && lastRound.length === 1 && lastRound[0][1] === null) {
            champion = lastRound[0][0];
        }

        // اعلام پایان تورنمنت
        let msg = '🏆 **تورنمنت به پایان رسید!**\n\n';
        if (champion) {
            const username = await this.getUsername(champion);
            msg += `🎉 **قهرمان: ${username || champion}** 🎉\n\n`;
            msg += `👏 تبریک به قهرمان تورنمنت!\n`;
            msg += `📊 تعداد شرکت‌کنندگان: ${tournament.players.length}`;
        } else {
            msg += '😔 متأسفانه تورنمنت بدون برنده به پایان رسید.';
        }

        await this.sendMessage(chatId, msg);

        // پاک کردن تورنمنت
        this.tournaments.delete(chatId);
        this.tournamentChoices.delete(chatId);
    }

    setTournamentTimer(chatId, userId) {
        const timer = setTimeout(() => {
            // اگر کاربر انتخاب نکرده، به‌صورت تصادفی انتخاب کن
            const choices = this.tournamentChoices.get(chatId) || {};
            if (!choices[userId]) {
                const randomChoice = ['سنگ', 'کاغذ', 'قیچی'][Math.floor(Math.random() * 3)];
                choices[userId] = randomChoice;
                this.tournamentChoices.set(chatId, choices);
                this.sendMessage(chatId, `⏰ زمان ${userId} تموم شد! انتخاب تصادفی: ${randomChoice}`);
                
                // بررسی اینکه آیا همه انتخاب کردن
                const tournament = this.tournaments.get(chatId);
                if (tournament) {
                    const round = tournament.rounds[tournament.currentRound];
                    const allPlayers = round.flat().filter(p => p !== null);
                    const allSelected = allPlayers.every(p => choices[p] !== undefined);
                    if (allSelected) {
                        this.processTournamentRound(chatId);
                    }
                }
            }
        }, 30000);
        
        this.userTimers.set(`tournament_${chatId}_${userId}`, { timer, expired: false });
    }

    async getUsername(userId) {
        // این تابع باید نام کاربر رو از KV یا از طریق API تلگرام بگیره
        // برای ساده‌سازی، فعلاً userId رو برمی‌گردونیم
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

    // ============================================
    // مدیریت تایمر
    // ============================================
    setTimer(chatId, userId) {
        this.clearTimer(userId);

        const timer = setTimeout(async () => {
            // بررسی اینکه آیا بازی هنوز فعال است
            const gameState = this.gameStates.get(userId);
            if (gameState && gameState.isActive) {
                this.userTimers.set(userId, { expired: true });
                await this.sendMessage(chatId, '⏰ زمان شما به پایان رسید! لطفاً با /play دوباره شروع کنید.');
                gameState.isActive = false;
                this.gameStates.set(userId, gameState);
            }
        }, 30000); // ۳۰ ثانیه

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
        
        // پاک کردن تایمرهای تورنمنت
        for (const [key, data] of this.userTimers) {
            if (key.includes('tournament_')) {
                clearTimeout(data.timer);
                this.userTimers.delete(key);
            }
        }
    }

    // ============================================
    // مدیریت Callback
    // ============================================
    async handleCallback(chatId, userId, data, query, username) {
        switch (data) {
            case 'rock':
            case 'paper':
            case 'scissors':
                const choice = { rock: 'سنگ', paper: 'کاغذ', scissors: 'قیچی' }[data];
                await this.handleGameChoice(chatId, userId, choice, query.message, username);
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
                this.gameStates.delete(userId);
                this.clearTimer(userId);
                await this.sendMessage(chatId, '❌ بازی لغو شد.');
                break;

            default:
                await this.sendMessage(chatId, '❌ دکمه ناشناخته!');
        }

        // پاسخ به Callback (برای حذف loading)
        await this.answerCallbackQuery(query.id);
    }

    // ============================================
    // ارسال پیام به تلگرام
    // ============================================
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
            return await response.json();
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

        // تنظیم Webhook
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

        // پردازش Webhook
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

        // صفحه اصلی
        return new Response(
            '🎮 Rock Paper Scissors Bot is running!\n\n' +
            '📌 Use /setwebhook to configure webhook\n' +
            '🤖 Bot by: Your Name',
            { status: 200 }
        );
    }
};
