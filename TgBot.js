import { Telegraf, Markup, session } from 'telegraf';
import { message } from 'telegraf/filters';
import TgCallbacks from './TgBot-callbacks.js';

export default class TgBot {
  constructor() {

    this.bot = new Telegraf(
      process.env.TELEGRAM_BOT_TOKEN, 
      { handlerTimeout: parseInt(process.env.TELEGRAM_HANDLER_TIMEOUT) || 90000 }
    );

    this.keyboards = {};

    this.createInlineKeyboard_main();
    this.createInlineKeyboard_notifications();

    this.tgCallbacks = new TgCallbacks(this.keyboards, this.bot);

    this.#useSession();
    this.#setRoutes();
    this.#onBotError();
  };

  #useSession = () => {
    try {
      this.bot.use(session());
      this.bot.use((ctx, next) => {
        ctx.session ??= {};
        next();
      });
    } catch (error) {
      console.error(`Error while #useSession in TgBot.js. ${error.message}`);
      throw error;
    }
  };

  #setRoutes = () => {
    try {
      this.bot.start(this.tgCallbacks.onStart);
      this.bot.action('actionToday', this.tgCallbacks.onActionToday);
      this.bot.action('actionTomorrow', this.tgCallbacks.onActionTomorrow);
      this.bot.action('actionMonday', this.tgCallbacks.onActionMonday);
      this.bot.action('actionTuesday', this.tgCallbacks.onActionTuesday);
      this.bot.action('actionWednesday', this.tgCallbacks.onActionWednesday);
      this.bot.action('actionThursday', this.tgCallbacks.onActionThursday);
      this.bot.action('actionFriday', this.tgCallbacks.onActionFriday);
      this.bot.action('actionSaturday', this.tgCallbacks.onActionSaturday);
      this.bot.action('actionSunday', this.tgCallbacks.onActionSunday);
      this.bot.action('actionGotoNotifications', this.tgCallbacks.onActionGotoNotifications);
      this.bot.action('actionGotoMain', this.tgCallbacks.onActionGotoMain);
      this.bot.action('actionSubscribeTodaySpammer', this.tgCallbacks.onActionSubscribeTodaySpammer);
      this.bot.action('actionUnsubscribeTodaySpammer', this.tgCallbacks.onActionUnsubscribeTodaySpammer);
      this.bot.action('actionSubscribeTomorrowSpammer', this.tgCallbacks.onActionSubscribeTomorrowSpammer);
      this.bot.action('actionUnsubscribeTomorrowSpammer', this.tgCallbacks.onActionUnsubscribeTomorrowSpammer);
      this.bot.action('actionSubscribeBeforeLesson', this.tgCallbacks.onActionSubscribeBeforeLesson);
      this.bot.action('actionUnsubscribeBeforeLesson', this.tgCallbacks.onActionUnsubscribeBeforeLesson);
      // this.bot.on(message('photo'), this.tgCallbacks.onMessagePhoto);
      // this.bot.on('message', this.tgCallbacks.onMessage);

      return null;
    } catch (error) {
      console.error(`Error while #setRoutes in telegram-bot.js. ${error.message}`);
      throw error;
    };
  };

  #onBotError = () => {
    try {
      this.bot.catch((err, ctx) => {
        console.log(`this is error: ${err}`)
        return null;
      })
    } catch (error) {
      console.error(`Error while #onBotError in telegram-bot.js. ${error.message}`)
    }
  };

  createInlineKeyboard_main = () => {
    try {
      this.keyboards.main = Markup.inlineKeyboard([
        [ Markup.button.callback('Розклад на Сьогодні', 'actionToday') ],
        [ Markup.button.callback('Розклад на Завтра', 'actionTomorrow') ],
        // [Markup.button.callback('Розклад на Число місяця', 'actionDayOfMonth')],
        [
          Markup.button.callback('Пн', 'actionMonday'),
          Markup.button.callback('Вт', 'actionTuesday'),
          Markup.button.callback('Ср', 'actionWednesday'),
          Markup.button.callback('Чт', 'actionThursday'),
          Markup.button.callback('Пт', 'actionFriday'),
        ],
        [
          Markup.button.callback('Сб', 'actionSaturday'),
          Markup.button.callback('Нд', 'actionSunday'),
        ],
        [ Markup.button.callback('Сповіщення >', 'actionGotoNotifications') ],
      ]);
      return this.keyboards.main;
    } catch (error) {
      console.error(`Error while createInlineKeyboard__kasset_main in telegram-bot.js. ${error.message}`);
      throw error;
    };
  };

  createInlineKeyboard_notifications = () => {
    try {
      this.keyboards.notifications = Markup.inlineKeyboard([
        [ Markup.button.callback('< назад', 'actionGotoMain') ],
        [ Markup.button.callback('Увімкнути ранкові сповіщення [Пн-Пт]', 'actionSubscribeTodaySpammer') ],
        [ Markup.button.callback('Вимкнути ранкові сповіщення', 'actionUnsubscribeTodaySpammer') ],
        [ Markup.button.callback('Увімкнути вечірні сповіщення [Пн-Пт, Нд]', 'actionSubscribeTomorrowSpammer') ],
        [ Markup.button.callback('Вимкнути вечірні сповіщення', 'actionUnsubscribeTomorrowSpammer') ],
        [ Markup.button.callback(`Увімкнути сповіщення перед парами (за ${process.env.NOTIFY_BEFORE_LESSON_TIME || 30} хв)`, 'actionSubscribeBeforeLesson') ],
        [ Markup.button.callback(`Вимкнути сповіщення перед парами (за ${process.env.NOTIFY_BEFORE_LESSON_TIME || 30} хв)`, 'actionUnsubscribeBeforeLesson') ],
      ]);
      return this.keyboards.notifications;
    } catch (error) {
      console.error(`Error while createInlineKeyboard_notifications in telegram-bot.js. ${error.message}`);
      throw error;
    };
  };

  listen = () => {
    return new Promise((resolve, reject) => {
      console.info("Starting Telegram Bot ...");
      this.bot.launch()
        .catch(error => reject(`Cannot launch TelegramBot.\nDetails: "${error.message}"`));
      resolve()
    });
  };

};