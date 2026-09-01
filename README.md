# 🎮 Rock-Paper-Scissors Telegram Bot

یک ربات کامل سنگ-کاغذ-قیچی برای تلگرام که روی **Cloudflare Workers** اجرا می‌شه.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/rps-bot)
[![GitHub license](https://img.shields.io/github/license/YOUR_USERNAME/rps-bot)](https://github.com/YOUR_USERNAME/rps-bot/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/YOUR_USERNAME/rps-bot)](https://github.com/YOUR_USERNAME/rps-bot/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/YOUR_USERNAME/rps-bot)](https://github.com/YOUR_USERNAME/rps-bot/issues)

## ✨ قابلیت‌ها

- 🎮 **بازی ۱‌به‌۱ با ربات** در ۴ حالت مختلف
- 👥 **حالت ۲ نفره** برای بازی در گروه
- 🏆 **تورنمنت گروهی** با قرعه‌کشی و براکت
- 📊 **آمار کامل** با ذخیره‌سازی در Cloudflare KV
- 🏅 **رتبه‌بندی** گروهی با سیستم امتیازدهی
- ⏰ **تایمر ۳۰ ثانیه‌ای** برای هر دور
- 🎯 **حالت سخت** با ربات هوشمند
- 🔥 **مسابقه Best of 3**
- 💬 **پیام‌های طعنه‌آمیز** متنوع
- 📱 **کیبورد شیشه‌ای** برای انتخاب راحت
- 🎨 **دکمه‌های تعاملی** برای تجربه بهتر

## 🚀 نصب و راه‌اندازی

### پیش‌نیازها

- یک حساب [Cloudflare](https://dash.cloudflare.com/)
- یک ربات تلگرام (ساخت با [@BotFather](https://t.me/botfather))
- [Node.js](https://nodejs.org/) نسخه ۱۶ یا بالاتر
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### مراحل نصب

#### ۱. کلون کردن پروژه

```bash
git clone https://github.com/YOUR_USERNAME/rps-bot.git
cd rps-bot
