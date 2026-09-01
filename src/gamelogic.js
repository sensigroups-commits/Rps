// ============================================
// منطق بازی سنگ-کاغذ-قیچی
// ============================================

export const gameLogic = {
    // انتخاب ربات (با حالت سخت)
    getBotChoice(mode = 'normal') {
        const choices = ['سنگ', 'کاغذ', 'قیچی'];

        if (mode === 'hard') {
            // حالت سخت: ربات با احتمال بیشتری برنده می‌شود
            // این یک الگوی ساده برای سخت‌تر کردن بازی است
            const patterns = [
                { pattern: ['سنگ', 'کاغذ', 'قیچی'], weight: 2 },
                { pattern: ['کاغذ', 'سنگ', 'قیچی'], weight: 1 },
                { pattern: ['قیچی', 'سنگ', 'کاغذ'], weight: 1 }
            ];
            
            const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
            let random = Math.random() * totalWeight;
            
            for (const pattern of patterns) {
                random -= pattern.weight;
                if (random <= 0) {
                    return pattern.pattern[Math.floor(Math.random() * 3)];
                }
            }
        }

        return choices[Math.floor(Math.random() * 3)];
    },

    // تعیین برنده
    determineWinner(player1, player2) {
        if (player1 === player2) return 'draw';

        const wins = {
            'سنگ': 'قیچی',
            'کاغذ': 'سنگ',
            'قیچی': 'کاغذ'
        };

        if (wins[player1] === player2) return 'win';
        return 'lose';
    },

    // نتیجه نهایی Best of 3
    getFinalResult(gameState, username) {
        const { userWins, botWins } = gameState;
        if (userWins > botWins) {
            return `🎉 ${username} برنده مسابقه شدید! (${userWins} - ${botWins})`;
        } else if (botWins > userWins) {
            return `😔 ${username} ربات برنده مسابقه شد! (${userWins} - ${botWins})`;
        } else {
            return `🤝 ${username} مسابقه مساوی شد! (${userWins} - ${botWins})`;
        }
    },

    // شافل کردن آرایه (برای قرعه‌کشی تورنمنت)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    // محاسبه امتیاز
    calculatePoints(stats) {
        return (stats.wins || 0) * 3 + (stats.draws || 0) * 1;
    },

    // محاسبه درصد برد
    calculateWinRate(stats) {
        const total = (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0);
        if (total === 0) return 0;
        return Math.round(((stats.wins || 0) / total) * 100);
    }
};
