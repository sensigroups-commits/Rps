export const messages = {
    welcome(isGroup, username) {
        let msg = `🎮 ${username} عزیز، به ربات سنگ-کاغذ-قیچی خوش آمدی!\n\n`;
        msg += '📋 **دستورات:**\n';
        msg += '/play - شروع بازی (حالت عادی)\n';
        msg += '/playhard - حالت سخت 🧠\n';
        msg += '/playbest3 - حالت مسابقه‌ای (Best of 3)\n';
        if (isGroup) {
            msg += '/play2p - حالت ۲ نفره 👥\n';
            msg += '/tournament - شروع تورنمنت گروهی 🏆\n';
        }
        msg += '/stats - نمایش آمار من 📊\n';
        msg += '/leaderboard - جدول رتبه‌بندی 🏅\n';
        msg += '/reset - ریست آمار من 🔄\n';
        msg += '/help - راهنما ❓\n\n';
        msg += '⬇️ از دکمه‌های زیر برای انتخاب استفاده کن!';
        return msg;
    },

    startGame(modeName, username) {
        return `🎮 ${username} عزیز، **بازی جدید شروع شد!**\n📌 حالت: ${modeName}\n\n⬇️ دست خود را انتخاب کن:`;
    },

    showResult(userChoice, botChoice, result, gameState, username) {
        const emojis = { 'سنگ': '🪨', 'کاغذ': '📄', 'قیچی': '✂️' };
        const resultEmojis = { 'win': '🎉', 'lose': '😔', 'draw': '🤝' };
        const resultTexts = { 'win': `${username} شما برنده شدید!`, 'lose': `${username} ربات برنده شد!`, 'draw': `مساوی!` };
        
        let msg = `${emojis[userChoice]} شما: ${userChoice}\n`;
        msg += `${emojis[botChoice]} ربات: ${botChoice}\n\n`;
        msg += `${resultEmojis[result]} **${resultTexts[result]}**\n\n`;

        if (gameState.mode === 'best_of_3') {
            msg += `📊 **امتیاز:** شما ${gameState.userWins} - ${gameState.botWins} ربات\n`;
            msg += `🔄 دور ${gameState.round} از ۳\n`;
        } else {
            const taunts = {
                'win': ['🔥 عالی بود!', '💪 چه نمایشی!', '🎯 دقیقاً هدف‌ت رو زدی!', '⭐ ستاره‌ای!', '👏 آفرین!', '🎊 تبریک میگم!'],
                'lose': ['😅 شانس بیار!', '🤔 دفعه بعد بهتر!', '📚 تمرین بیشتری نیاز داری!', '🎯 هدف رو اشتباه زدی!', '💪 قوی‌تر از این باش!', '😄 دفعه بعد حتماً!'],
                'draw': ['🤝 مساوی، دفعه بعد!', '🔄 دوباره تلاش کن!', '🎯 نزدیک بود!', '⚖️ عدالت!', '😎 عالی بود!', '💪 باز هم!']
            };
            const tauntList = taunts[result];
            if (tauntList) {
                msg += `\n${tauntList[Math.floor(Math.random() * tauntList.length)]}`;
            }
        }
        return msg;
    },

    showTwoPlayerResult(player1, player2, choice1, choice2, result) {
        const emojis = { 'سنگ': '🪨', 'کاغذ': '📄', 'قیچی': '✂️' };
        let msg = `⚔️ **نتیجه بازی ۲ نفره:**\n\n`;
        msg += `👤 ${player1}: ${emojis[choice1]} ${choice1}\n`;
        msg += `👤 ${player2}: ${emojis[choice2]} ${choice2}\n\n`;
        if (result === 'win') {
            msg += `🎉 **${player1} برنده شد!**`;
        } else if (result === 'lose') {
            msg += `🎉 **${player2} برنده شد!**`;
        } else {
            msg += `🤝 **مساوی!**`;
        }
        return msg;
    },

    showStats(stats, username) {
        const total = stats.wins + stats.losses + stats.draws;
        const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
        const points = stats.wins * 3 + stats.draws * 1;

        let msg = `📊 **آمار ${username}:**\n\n`;
        msg += `🏆 برد: ${stats.wins}\n`;
        msg += `💔 باخت: ${stats.losses}\n`;
        msg += `🤝 مساوی: ${stats.draws}\n`;
        msg += `📊 مجموع: ${total}\n`;
        msg += `🎯 درصد برد: ${winRate}%\n\n`;
        msg += `🔥 روند برد فعلی: ${stats.winStreak}\n`;
        msg += `⭐ بیشترین روند برد: ${stats.maxWinStreak}\n`;
        msg += `🏅 امتیاز کل: ${points}\n\n`;
        
        if (points >= 50) {
            msg += '👑 شما یک قهرمان هستید!';
        } else if (points >= 30) {
            msg += '⭐ شما یک بازیکن حرفه‌ای هستید!';
        } else if (points >= 15) {
            msg += '💪 در حال پیشرفت هستید!';
        } else {
            msg += '🚀 شروع کنید و پیشرفت کنید!';
        }
        return msg;
    },

    showLeaderboard(leaderboard) {
        let msg = '🏆 **جدول رتبه‌بندی گروه:**\n\n';
        const medals = ['🥇', '🥈', '🥉'];

        leaderboard.forEach((user, index) => {
            const medal = index < 3 ? medals[index] : `${index + 1}.`;
            const points = user.wins * 3 + user.draws * 1;
            const total = user.wins + user.losses + user.draws;
            const winRate = total > 0 ? Math.round((user.wins / total) * 100) : 0;
            
            msg += `${medal} **${user.username || `کاربر ${user.userId}`}**\n`;
            msg += `   🏆 ${user.wins} برد | 🏅 ${points} امتیاز | 🎯 ${winRate}%\n\n`;
        });
        return msg;
    },

    showHelp() {
        let msg = '📖 **راهنمای کامل ربات:**\n\n';
        msg += '🎮 **دستورات:**\n';
        msg += '/start - شروع و خوش‌آمدگویی\n';
        msg += '/play - شروع بازی (حالت عادی)\n';
        msg += '/playhard - حالت سخت 🧠\n';
        msg += '/playbest3 - حالت مسابقه‌ای (Best of 3)\n';
        msg += '/play2p - حالت ۲ نفره 👥 (فقط گروه)\n';
        msg += '/stats - نمایش آمار شما 📊\n';
        msg += '/leaderboard - جدول رتبه‌بندی گروه 🏅\n';
        msg += '/reset - ریست کردن آمار شما 🔄\n';
        msg += '/tournament - شروع تورنمنت گروهی 🏆 (فقط گروه)\n';
        msg += '/help - نمایش این راهنما ❓\n\n';

        msg += '🎯 **امتیازدهی:**\n';
        msg += 'برد = ۳ امتیاز 🏆\n';
        msg += 'مساوی = ۱ امتیاز 🤝\n';
        msg += 'باخت = ۰ امتیاز 💔\n\n';

        msg += '⏰ **تایمر:**\n';
        msg += 'شما ۳۰ ثانیه فرصت دارید تا دست خود را انتخاب کنید.\n\n';

        msg += '🤖 **حالت‌های بازی:**\n';
        msg += '• عادی: ربات تصادفی انتخاب می‌کند\n';
        msg += '• سخت: ربات هوشمندتر انتخاب می‌کند 🧠\n';
        msg += '• مسابقه‌ای: بهترین از ۳ دور 🏆\n';
        msg += '• ۲ نفره: دو کاربر در گروه با هم بازی می‌کنند 👥\n\n';

        msg += '🏆 **تورنمنت گروهی:**\n';
        msg += '• حداقل ۲ نفر برای شروع نیاز است\n';
        msg += '• حداکثر ۸ نفر می‌توانند شرکت کنند\n';
        msg += '• قرعه‌کشی تصادفی برای مسابقات\n';
        msg += '• برنده نهایی قهرمان تورنمنت می‌شود\n\n';

        msg += '💡 **نکات:**\n';
        msg += '• می‌توانید از دکمه‌های شیشه‌ای استفاده کنید\n';
        msg += '• آمار شما به‌صورت دائمی ذخیره می‌شود\n';
        msg += '• برای ریست آمار از /reset استفاده کنید';
        return msg;
    },

    showTournamentBracket(rounds, players) {
        let msg = '🏆 **براکت تورنمنت:**\n\n';
        msg += `👥 تعداد شرکت‌کنندگان: ${players.length}\n\n`;
        msg += '📋 **مسابقات دور اول:**\n';
        rounds.forEach((match, index) => {
            const player1 = match[0];
            const player2 = match[1] || '🆓 Bye';
            msg += `⚔️ مسابقه ${index + 1}: ${player1} VS ${player2}\n`;
        });
        return msg;
    }
};
