export const messages = {
    welcome(isGroup, username) {
        let msg = `🎮 ${username} عزیز، به ربات سنگ-کاغذ-قیچی خوش آمدی!\n\n`;
        msg += '📋 دستورات:\n';
        if (isGroup) {
            msg += '/play2p - بازی ۲ نفره 👥\n';
            msg += '/tournament - تورنمنت گروهی 🏆\n';
        }
        msg += '/stats - نمایش آمار من 📊\n';
        msg += '/leaderboard - جدول رتبه‌بندی 🏅\n';
        msg += '/reset - ریست آمار من 🔄\n';
        msg += '/help - راهنما ❓\n\n';
        msg += '⬇️ از دکمه‌های زیر برای انتخاب استفاده کن!';
        return msg;
    },

    showStats(stats, username) {
        const total = stats.wins + stats.losses + stats.draws;
        const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
        const points = stats.wins * 3 + stats.draws * 1;

        let msg = `📊 آمار ${username}:\n\n`;
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
        let msg = '🏆 جدول رتبه‌بندی گروه:\n\n';
        const medals = ['🥇', '🥈', '🥉'];

        leaderboard.forEach((user, index) => {
            const medal = index < 3 ? medals[index] : `${index + 1}.`;
            const points = user.wins * 3 + user.draws * 1;
            const total = user.wins + user.losses + user.draws;
            const winRate = total > 0 ? Math.round((user.wins / total) * 100) : 0;
            
            msg += `${medal} ${user.username || `کاربر ${user.userId}`}\n`;
            msg += `   🏆 ${user.wins} برد | 🏅 ${points} امتیاز | 🎯 ${winRate}%\n\n`;
        });
        return msg;
    },

    showHelp() {
        let msg = '📖 راهنمای کامل ربات:\n\n';
        msg += '🎮 دستورات:\n';
        msg += '/start - شروع و خوش‌آمدگویی\n';
        msg += '/play2p - بازی ۲ نفره 👥 (فقط گروه)\n';
        msg += '/tournament - تورنمنت گروهی 🏆 (فقط گروه)\n';
        msg += '/stats - نمایش آمار شما 📊\n';
        msg += '/leaderboard - جدول رتبه‌بندی گروه 🏅\n';
        msg += '/reset - ریست کردن آمار شما 🔄\n';
        msg += '/help - نمایش این راهنما ❓\n\n';

        msg += '🎯 امتیازدهی:\n';
        msg += 'برد = ۳ امتیاز 🏆\n';
        msg += 'مساوی = ۱ امتیاز 🤝\n';
        msg += 'باخت = ۰ امتیاز 💔\n\n';

        msg += '⏰ تایمر:\n';
        msg += 'شما ۳۰ ثانیه فرصت دارید تا دست خود را انتخاب کنید.\n\n';

        msg += '👥 بازی ۲ نفره:\n';
        msg += '• دو کاربر در گروه با هم بازی می‌کنند\n';
        msg += '• هر دو باید دست خود را انتخاب کنند\n\n';

        msg += '🏆 تورنمنت گروهی:\n';
        msg += '• حداقل ۲ نفر برای شروع نیاز است\n';
        msg += '• حداکثر ۸ نفر می‌توانند شرکت کنند\n';
        msg += '• قرعه‌کشی تصادفی برای مسابقات\n';
        msg += '• برنده نهایی قهرمان تورنمنت می‌شود\n\n';

        msg += '💡 نکات:\n';
        msg += '• می‌توانید از دکمه‌های شیشه‌ای استفاده کنید\n';
        msg += '• آمار شما به‌صورت دائمی ذخیره می‌شود\n';
        msg += '• برای ریست آمار از /reset استفاده کنید';
        return msg;
    },

    showTournamentBracket(rounds, players) {
        let msg = '🏆 براکت تورنمنت:\n\n';
        msg += `👥 تعداد شرکت‌کنندگان: ${players.length}\n\n`;
        msg += '📋 مسابقات دور اول:\n';
        rounds.forEach((match, index) => {
            const player1 = match[0];
            const player2 = match[1] || '🆓 Bye';
            msg += `⚔️ مسابقه ${index + 1}: ${player1} VS ${player2}\n`;
        });
        return msg;
    }
};
