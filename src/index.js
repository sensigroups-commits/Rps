export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const token = env.TELEGRAM_BOT_TOKEN;

        // تنظیم Webhook
        if (url.pathname === '/setwebhook') {
            const webhookUrl = `https://${url.hostname}/webhook`;
            const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
            return new Response(JSON.stringify(await res.json()), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // دریافت Webhook
        if (url.pathname === '/webhook' && request.method === 'POST') {
            const update = await request.json();
            
            // به همه پیام‌ها پاسخ بده
            if (update.message) {
                const chatId = update.message.chat.id;
                const text = update.message.text || '';
                
                let reply = '✅ ربات وصل شد!\n';
                reply += 'دستورات:\n';
                reply += '/start - شروع\n';
                reply += '/help - راهنما';
                
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: reply,
                        parse_mode: 'HTML'
                    })
                });
            }
            
            return new Response('OK', { status: 200 });
        }

        return new Response('🎮 Bot is running!', { status: 200 });
    }
};
