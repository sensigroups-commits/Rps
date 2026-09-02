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
    }

    async handleUpdate(update, env) {
        try {
            this.env = env;
            this.storage = new storage(env);

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

    async startCommand(chatId, userId, isGroup, username) {
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
        } else if (mode === '2p' || mode === 'two_player') {
            gameMode = 'two_player';
            modeName = '۲ نفره 👥';
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

        this.setTimer(chatId, userId);
    }

    async handleGameChoice(chatId, userId, choice, msg, username) {
        const gameState = this.gameStates.get(userId);
        
        if (!gameState) {
            await this.sendMessage(chatId, '❌ ابتدا با دستور /play بازی رو شروع کن!');
            return;
        }

        if (!gameState.isActive) {
            await this.sendMessage(chatId, '❌ این بازی قبلاً تمام شده! با /play دوباره شروع کن.');
            return;
        }

        if (this.userTimers.has(userId) && this.userTimers.get(userId).expired) {
            await this.sendMessage(chatId, '⏰ زمانت تموم شد! دوباره با /play شروع کن.');
            this.gameStates.delete(userId);
            this.clearTimer(userId);
            return;
        }

        const validChoices = ['سنگ', 'کاغذ', 'قیچی'];
        if (!validChoices.includes(choice)) {
            await this.sendMessage(chatId, '❌ لطفاً یکی از گزینه‌های سنگ، کاغذ یا قیچی رو انتخاب کن.');
            return;
        }

        if (gameState.mode === 'two_player') {
            await this.handleTwoPlayerMode(chatId, userId, choice, username);
            return;
        }

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

        if (gameState.mode === 'best_of_3') {
            if (gameState.userWins >= 2 || gameState.botWins >= 2) {
                const finalMsg = gamelogic.getFinalResult(gameState, username);
                await this.sendMessage(chatId, finalMsg);
                gameState.isActive = false;
                this.gameStates.set(userId, gameState);
                this.clearTimer(userId);
                return;
            }
        }

        this.clearTimer(userId);
        this.setTimer(chatId, userId);
    }

    async handleTwoPlayerMode(chatId, userId, choice, username) {
        const gameState = this.gameStates.get(userId);
        
        if (gameState.userChoice) {
            await this.sendMessage(chatId, '⏳ شما قبلاً انتخاب کردید! منتظر نفر دوم باشید.');
            return;
        }

        gameState.userChoice = choice;
        gameState.round++;
        this.gameStates.set(userId, gameState);

        let opponentId = null;
        for (const [id, state] of this.gameStates) {
            if (id !== userId && state.chatId === chatId && state.mode === 'two_player' && !state.userChoice) {
                opponentId = id;
                break;
            }
        }

        if (!opponentId) {
            await this.sendMessage(chatId, `✅ انتخاب شما (${choice}) ثبت شد!\n⏳ در حال انتظار برای نفر دوم...`);
            return;
        }

        const opponentState = this.gameStates.get(opponentId);
        if (!opponentState || !opponentState.userChoice) {
            await this.sendMessage(chatId, '❌ خطا در دریافت انتخاب نفر دوم!');
            return;
        }

        const user1Choice = gameState.userChoice;
        const user2Choice = opponentState.userChoice;

        const result = gamelogic.determineWinner(user1Choice, user2Choice);

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

        gameState.isActive = false;
        opponentState.isActive = false;
        this.gameStates.set(userId, gameState);
        this.gameStates.set(opponentId, opponentState);
        
        this.clearTimer(userId);
        this.clearTimer(opponentId);
    }

    async statsCommand(chatId, userId, username) {
        const stats = await this.storage.getUserStats(userId, chatId);
        if (!stats) {
            await this.sendMessage(chatId, '❌ هنوز آماری برای شما ثبت نشده!');
            return;
        }
        const msg = messages.showStats(stats, username);
        await this.sendMessage(chatId, msg);
    }

    async leaderboardCommand(chatId) {
        const leaderboard = await this.storage.getLeaderboard(chatId, 10);
        if (!leaderboard || leaderboard.length === 0) {
            await this.sendMessage(chatId, '❌ هنوز هیچ کاربری در این گروه بازی نکرده!');
            return;
        }
        const msg = messages.showLeaderboard(leaderboard);
        await this.sendMessage(chatId, msg);
    }

    async resetCommand(chatId, userId, username) {
        await this.storage.resetStats(userId, chatId);
        await this.sendMessage(chatId, `✅ ${username} عزیز، آمار شما با موفقیت ریست شد!`);
    }

    async helpCommand(chatId) {
        const msg = messages.showHelp();
        await this.sendMessage(chatId, msg);
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
            await this.sendMessage(chatId, '❌ یک تورنمنت در حال برگزاری است! صبر کنید تا تمام شود.');
            return;
        }

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

        await this.sendMessage(chatId, '🏆 **تورنمنت شروع شد!**\n\n' + 
            messages.showTournamentBracket(rounds, tournament.players));
        
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
            await this.sendMessage(chatId, '❌ شما در این دور تورنمنت شرکت ندارید!');
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

        await this.sendMessage(chatId, `✅ انتخاب شما (${choice}) ثبت شد!`);

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
                msg += `🤝 ${result.player1} (${result.choice1}) VS ${result.player2} (${result.choice2}) -> مساوی!\n`;
            } else {
                msg += `🎉 ${result.winner} برنده شد!\n`;
                msg += `   ${result.player1} (${result.choice1}) VS ${result.player2} (${result.choice2})\n`;
            }
        }

        await this.sendMessage(chatId, msg);

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

        await this.sendMessage(chatId, msg);

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
                await this.sendMessage(chatId, `⏰ زمان ${userId} تموم شد! انتخاب تصادفی: ${randomChoice}`);
                
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
                await this.sendMessage(chatId, '⏰ زمان شما به پایان رسید! لطفاً با /play دوباره شروع کنید.');
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

        return new Response(
            '🎮 Rock Paper Scissors Bot is running!\n\n' +
            '📌 Use /setwebhook to configure webhook\n' +
            '🤖 Bot by: Your Name',
            { status: 200 }
        );
    }
};
