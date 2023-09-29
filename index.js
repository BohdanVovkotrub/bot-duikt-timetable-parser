import 'dotenv/config.js';

import TgBot from './TgBot.js';

const bot = new TgBot();
bot.listen();