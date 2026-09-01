// ============================================
// مدیریت ذخیره‌سازی در Cloudflare KV
// ============================================

export class storage {
    constructor(env) {
        this.env = env;
        this.kv = env.GAME_STATS; // Cloudflare KV namespace
    }

    // ثبت کاربر جدید
    async registerUser(userId, chatId, username = null) {
        const key = `user:${userId}:${chatId}`;
        const existing = await this.kv.get(key);

        if (!existing) {
            const defaultStats = {
                userId: userId,
                chatId: chatId,
                username: username || `کاربر ${userId}`,
                wins: 0,
                losses: 0,
                draws: 0,
                totalGames: 0,
                winStreak: 0,
                maxWinStreak: 0,
                lastGame: null,
                registered: Date.now(),
                points: 0
            };
            await this.kv.put(key, JSON.stringify(defaultStats));
            return defaultStats;
        }

        const stats = JSON.parse(existing);
        if (username && stats.username !== username) {
            stats.username = username;
            await this.kv.put(key, JSON.stringify(stats));
        }
        return stats;
    }

    // به‌روزرسانی آمار
    async updateStats(userId, chatId, result, username = null) {
        const key = `user:${userId}:${chatId}`;
        const existing = await this.kv.get(key);

        let stats = existing ? JSON.parse(existing) : {
            userId: userId,
            chatId: chatId,
            username: username || `کاربر ${userId}`,
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            winStreak: 0,
            maxWinStreak: 0,
            lastGame: null,
            registered: Date.now(),
            points: 0
        };

        // به‌روزرسانی نام کاربری
        if (username) {
            stats.username = username;
        }

        stats.totalGames++;

        if (result === 'win') {
            stats.wins++;
            stats.winStreak++;
            if (stats.winStreak > stats.maxWinStreak) {
                stats.maxWinStreak = stats.winStreak;
            }
            stats.points += 3; // ۳ امتیاز برای برد
        } else if (result === 'lose') {
            stats.losses++;
            stats.winStreak = 0;
            stats.points += 0; // ۰ امتیاز برای باخت
        } else if (result === 'draw') {
            stats.draws++;
            stats.points += 1; // ۱ امتیاز برای مساوی
            // مساوی باعث قطع روند برد نمی‌شه ولی ادامه نمی‌ده
        }

        stats.lastGame = Date.now();

        await this.kv.put(key, JSON.stringify(stats));
        return stats;
    }

    // دریافت آمار کاربر
    async getUserStats(userId, chatId) {
        const key = `user:${userId}:${chatId}`;
        const data = await this.kv.get(key);
        return data ? JSON.parse(data) : null;
    }

    // دریافت جدول رتبه‌بندی گروه
    async getLeaderboard(chatId, limit = 10) {
        try {
            const list = await this.kv.list({ prefix: `user:` });
            const users = [];

            for (const key of list.keys) {
                const data = await this.kv.get(key.name);
                if (data) {
                    const stats = JSON.parse(data);
                    if (stats.chatId === chatId) {
                        stats.points = (stats.wins || 0) * 3 + (stats.draws || 0) * 1;
                        users.push(stats);
                    }
                }
            }

            // مرتب‌سازی بر اساس امتیاز
            users.sort((a, b) => {
                const pointsA = (a.wins || 0) * 3 + (a.draws || 0) * 1;
                const pointsB = (b.wins || 0) * 3 + (b.draws || 0) * 1;
                return pointsB - pointsA;
            });

            return users.slice(0, limit);
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    }

    // دریافت بازیکنان گروه
    async getGroupPlayers(chatId) {
        const leaderboard = await this.getLeaderboard(chatId);
        return leaderboard.map(p => p.userId);
    }

    // ریست کردن آمار
    async resetStats(userId, chatId) {
        const key = `user:${userId}:${chatId}`;
        const defaultStats = {
            userId: userId,
            chatId: chatId,
            username: `کاربر ${userId}`,
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            winStreak: 0,
            maxWinStreak: 0,
            lastGame: null,
            registered: Date.now(),
            points: 0
        };
        await this.kv.put(key, JSON.stringify(defaultStats));
        return defaultStats;
    }

    // حذف کاربر (در صورت نیاز)
    async deleteUser(userId, chatId) {
        const key = `user:${userId}:${chatId}`;
        await this.kv.delete(key);
    }
}
