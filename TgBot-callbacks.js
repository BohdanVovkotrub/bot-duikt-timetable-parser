import ERozklad from "./ERozklad.js";
import cron from 'node-cron';
import { readFile, writeFile } from 'fs/promises';
import { CronTime } from 'cron-time-generator';

export default class TgCallbacks {
  constructor(keyboards, bot) {
    this.keyboards = keyboards;
    this.bot = bot;
    this.waitActions = [];
    this.waitActions[0] = 'wait for response on main keyboard';

    this.erozklad = new ERozklad(1, 5, 928);

    this.todaySpamTime = process.env.TODAY_SPAM_TIME || "09:00";
    this.tomorrowSpamTime = process.env.TOMORROW_SPAM_TIME || "21:00";
    this.beforeLessonTime = parseInt(process.env.NOTIFY_BEFORE_LESSON_TIME) || 30; // in minutes

    this.runTodaySpammer();
    this.runTomorrowSpammer();

    const scheduleTime = CronTime.everyWeekDayAt(7, 0);
    cron.schedule(scheduleTime, this.runTodayNotifyBeforeLesson);
  };

  onStart = (ctx) => {
    try {
      ctx.session.user = ctx.message.from;
      ctx.session.waitAction = this.waitActions[0];
      const { first_name, last_name, username } = ctx.message.from;
      const user = (`${first_name || ''} ${last_name || ''} @${username}`).trim();
      return ctx.reply(`Привіт, ${user}!`, this.keyboards.main);
    } catch (error) {
      console.error(`Error while onStart in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  parseSubscriberFromContext = (ctx) => {
    try {
      const message = ctx.update.callback_query.message;
      const from = ctx.update.callback_query.from;
      const chatId = message.chat.id;
      if (!chatId) return;
      const { title } = message.chat;
      const first_name = from.first_name || message.from.first_name ;
      const last_name = from.last_name || message.from.last_name;
      const username = from.username || message.from.username;
      const user = (`${first_name || ''} ${last_name || ''} @${username}`).trim();
      return { chatId, first_name, last_name, username, title, user };
    } catch (error) {
      console.error(`Error while parseSubscriberFromContext in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    }
  };

  onActionGotoMain = (ctx) => {
    try {
      ctx.answerCbQuery('');
      return ctx.reply('Головне меню', this.keyboards.main);
    } catch (error) {
      console.error(`Error while onActionGotoMain in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    }
  };
  
  onActionGotoNotifications = async (ctx) => {
    try {
      ctx.answerCbQuery('');
      const { chatId } = this.parseSubscriberFromContext(ctx);
      const spamSubscribers = await this.readSpamSubscribers();
      const isSubscribedToday = spamSubscribers.subscribersToday.find(subscriber => subscriber.chatId === chatId);
      const isSubscribedTomorrow = spamSubscribers.subscribersTomorrow.find(subscriber => subscriber.chatId === chatId);
      const isSubscribedBeforeLesson = spamSubscribers.subscribersBeforeLesson.find(subscriber => subscriber.chatId === chatId);
      let message = ``;
      if (!isSubscribedToday && !isSubscribedTomorrow && !isSubscribedBeforeLesson) {
        message = 'Ви ще не підписалися на жодні сповіщення.'
      } else {
        message = 'Ви вже підписані на:\n';
        if (!!isSubscribedToday) message += '- Ранкові сповіщення про "сьогоднішні" пари.\n';
        if (!!isSubscribedTomorrow) message += '- Вечірні сповіщення про "завтрашні" пари.\n';
        if (!!isSubscribedBeforeLesson) message += `- Сповіщення перед парами (за ${process.env.NOTIFY_BEFORE_LESSON_TIME} хв).\n`;
      };
      ctx.reply(message.trim(), this.keyboards.notifications);
    } catch (error) {
      console.error(`Error while onActionGotoNotifications in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionSubscribeBeforeLesson = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const subscriber = this.parseSubscriberFromContext(ctx);
      const { chatId, user } = subscriber;
      if (!subscriber || !chatId) return;
      this.addSpamSubscriberBeforeLesson(subscriber);
      return this.reply(chatId, `Ви підписались на сповіщення перед парами (за ${process.env.NOTIFY_BEFORE_LESSON_TIME} хв) у цьому чаті. [Виконано користувачем: ${user}]`);
    } catch (error) {
      console.error(`Error while onActionSubscribeBeforeLesson in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionUnsubscribeBeforeLesson = async (ctx) => {
    try {
      ctx.answerCbQuery('');
      const { chatId, user } = this.parseSubscriberFromContext(ctx);
      if (!chatId) return;
      await this.removeSpamSubscriberBeforeLesson(chatId);
      return this.reply(chatId, `Ви відписались від сповіщень перед парами (за ${process.env.NOTIFY_BEFORE_LESSON_TIME} хв) у цьому чаті. [Виконано користувачем: ${user}]`);
    } catch (error) {
      console.error(`Error while onActionUnsubscribeBeforeLesson in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  addSpamSubscriberBeforeLesson = async (newSubscriber) => {
    try {
      const spamSubscribers = await this.readSpamSubscribers();
      if (!spamSubscribers) return;
      const isAlreadyExists = spamSubscribers.subscribersBeforeLesson.find(({chatId}) => chatId === newSubscriber.chatId);
      if (!!isAlreadyExists) return;
      spamSubscribers.subscribersBeforeLesson.push(newSubscriber);
      return await this.writeSpamSubscribers(spamSubscribers);
    } catch (error) {
      console.error(`Error while addSpamSubscriberBeforeLesson in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };



  removeSpamSubscriberBeforeLesson = async (chatId) => {
    try {
      const spamSubscribers = await this.readSpamSubscribers();
      if (!spamSubscribers) return;
      spamSubscribers.subscribersBeforeLesson = spamSubscribers.subscribersBeforeLesson.filter((subscriber) => subscriber.chatId !== chatId);
      return await this.writeSpamSubscribers(spamSubscribers);
    } catch (error) {
      console.error(`Error while removeSpamSubscriberBeforeLesson in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };

  onActionSubscribeTodaySpammer = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const subscriber = this.parseSubscriberFromContext(ctx);
      const { chatId, user } = subscriber;
      if (!subscriber || !chatId) return;
      this.addSpamSubscriberToday(subscriber);
      return this.reply(chatId, `Ви підписались на ранкові сповіщення пар [Пн-Пт] у цьому чаті. [Виконано користувачем: ${user}]`);
    } catch (error) {
      console.error(`Error while onActionSubscribeTodaySpammer in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    }
  };

  onActionUnsubscribeTodaySpammer = async (ctx) => {
    try {
      ctx.answerCbQuery('');
      const { chatId, user } = this.parseSubscriberFromContext(ctx);
      if (!chatId) return;
      await this.removeSpamSubscriberToday(chatId);
      return this.reply(chatId, `Ви відписались від ранкових сповіщень пар [Пн-Пт] у цьому чаті. [Виконано користувачем: ${user}]`);
    } catch (error) {
      console.error(`Error while onActionUnsubscribeTodaySpammer in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };


  addSpamSubscriberToday = async (newSubscriber) => {
    try {
      const spamSubscribers = await this.readSpamSubscribers();
      if (!spamSubscribers) return;
      const isAlreadyExists = spamSubscribers.subscribersToday.find(({chatId}) => chatId === newSubscriber.chatId);
      if (!!isAlreadyExists) return;
      spamSubscribers.subscribersToday.push(newSubscriber);
      return await this.writeSpamSubscribers(spamSubscribers);
    } catch (error) {
      console.error(`Error while addSpamSubscriberToday in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };

  removeSpamSubscriberToday = async (chatId) => {
    try {
      const spamSubscribers = await this.readSpamSubscribers();
      if (!spamSubscribers) return;
      spamSubscribers.subscribersToday = spamSubscribers.subscribersToday.filter((subscriber) => subscriber.chatId !== chatId);
      return await this.writeSpamSubscribers(spamSubscribers);
    } catch (error) {
      console.error(`Error while removeSpamSubscriberToday in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };


  onActionSubscribeTomorrowSpammer = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const subscriber = this.parseSubscriberFromContext(ctx);
      const { chatId, user } = subscriber;
      if (!subscriber || !chatId) return;
      this.addSpamSubscriberTomorrow(subscriber);
      return this.reply(chatId, `Ви підписались на вечірні сповіщення пар [Пн-Пт, Нд] у цьому чаті. [Виконано користувачем: ${user}]`);
    } catch (error) {
      console.error(`Error while onActionSubscribeTomorrowSpammer in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    }
  };

  onActionUnsubscribeTomorrowSpammer = async (ctx) => {
    try {
      ctx.answerCbQuery('');
      const { chatId, user } = this.parseSubscriberFromContext(ctx);
      if (!chatId) return;
      await this.removeSpamSubscriberTomorrow(chatId);
      return this.reply(chatId, `Ви відписались від вечірніх сповіщень пар [Пн-Пт, Нд] у цьому чаті. [Виконано користувачем: ${user}]`);
    } catch (error) {
      console.error(`Error while onActionUnsubscribeTomorrowSpammer in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  addSpamSubscriberTomorrow = async (newSubscriber) => {
    try {
      const spamSubscribers = await this.readSpamSubscribers();
      if (!spamSubscribers) return;
      const isAlreadyExists = spamSubscribers.subscribersTomorrow.find(({chatId}) => chatId === newSubscriber.chatId);
      if (!!isAlreadyExists) return;
      spamSubscribers.subscribersTomorrow.push(newSubscriber);
      return await this.writeSpamSubscribers(spamSubscribers);
    } catch (error) {
      console.error(`Error while addSpamSubscriberToday in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };

  removeSpamSubscriberTomorrow = async (chatId) => {
    try {
      const spamSubscribers = await this.readSpamSubscribers();
      if (!spamSubscribers) return;
      spamSubscribers.subscribersTomorrow = spamSubscribers.subscribersTomorrow.filter((subscriber) => subscriber.chatId !== chatId);
      return await this.writeSpamSubscribers(spamSubscribers);
    } catch (error) {
      console.error(`Error while removeSpamSubscriberToday in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };


  reply = async (chatId, message) => {
    try {
      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      console.error(`Error while reply in TgBot-callback.js. Details: ${error.message}`)
    };
  };

  runTodayNotifyBeforeLesson = async () => {
    try {
      const today = await this.erozklad.getToday();
      if (!today || !today.lessons?.length) return;
      
      const now = Math.floor(new Date().getTime() / 1000);
      today.lessons.forEach(lesson => {
        const task = async () => {
          const lessonName = lesson.fullname || lesson.name;
          const todayStill = await this.erozklad.getToday();
          if (!todayStill || !todayStill.lessons?.length) return;
          const isStillExistLesson = todayStill.lessons.find(({start, name, fullname}) => (lessonName === fullname || lessonName === name) && lesson.start === start);
          if (!isStillExistLesson) return;
          const message = `Увага!\nСкоро почнеться пара:\n**${lesson.startStr}**\n${lessonName}\n\nДані взято з: ${process.env.EROZKLAD_URL}`;
          const { subscribersBeforeLesson } = await this.readSpamSubscribers();
          subscribersBeforeLesson.forEach(({chatId}) => {
            this.reply(chatId, message);
          });
        };
        let targetTime = (lesson.start - now - (this.beforeLessonTime * 60)) * 1000;
        if (targetTime < 0) {
          targetTime = (lesson.start - now) * 1000;
          if (targetTime < 0) return;
          return task();
        };
        setTimeout(task, targetTime);
      });
    } catch (error) {
      console.error(`Error while runTodayNotifyBeforeLesson in TgBot-callback.js. Details: ${error.message}`);
    };
  };

  runTodaySpammer = async () => {
    const task = async () => {
      console.log('Today Spammer is Running...');
      const { subscribersToday } = await this.readSpamSubscribers();
      subscribersToday.forEach(({chatId}) => {
        this.erozklad.getToday()
          .then(todaySchedule => {
            const message = 'Вітаю! Це ранковий спамер!\n\n' + this.messageToday(todaySchedule);
            this.reply(chatId, message);
          })
      });

    };
    const [hour, min] = this.todaySpamTime.split(':')
    const scheduleTime = CronTime.everyWeekDayAt(hour, min); // from Monday to Friday at hour:min
    cron.schedule(scheduleTime, task);
  };

  runTomorrowSpammer = async () => {
    const task = async () => {
      console.log('Tomorrow Spammer is Running...');
      const { subscribersTomorrow } = await this.readSpamSubscribers();
      subscribersTomorrow.forEach(({chatId}) => {
        this.erozklad.getTomorrow()
          .then(tomorrowSchedule => {
            const message = 'Вітаю! Це вечірній спамер!\n\n' + this.messageTomorrow(tomorrowSchedule);
            try {
              this.reply(chatId, message)
            } catch (error) {
              console.error(`Error while runTodaySpammer in TgBot-callback.js. Details: ${error.message}`);
            };
          })
      });
    };
    const [ hour, min ] = this.tomorrowSpamTime.split(':')
    const scheduleTime1 = CronTime.everyWeekDayAt(hour, min); // from Monday to Friday at hour:min
    cron.schedule(scheduleTime1, task);
    const scheduleTime2 = CronTime.everySundayAt(hour, min); // every Sunday at hour:min
    cron.schedule(scheduleTime2, task);
  };

  readSpamSubscribers = async () => {
    try {
      const subscribers = await readFile(process.env.SPAM_SUBSCRIBERS_PATH, { encoding: 'utf-8' });
      return JSON.parse(subscribers);
    } catch (error) {
      console.error(`Error while readSpamSubscribers in TgBot-callback.js. Details: ${error.message}`)
      return false;
    };
  };


  writeSpamSubscribers = async (spamSubscribers) => {
    const data = JSON.stringify(spamSubscribers, null, 2);
    return await writeFile(process.env.SPAM_SUBSCRIBERS_PATH, data, { encoding: 'utf-8' });
  };



  messageToday = (todaySchedule) => {
    const message = !todaySchedule.lessons.length
      ? `Сьогодні (${todaySchedule.dayOfWeek} - ${todaySchedule.dateStr}) у нас немає пар.`
      : `
      Сьогодні (${todaySchedule.dayOfWeek} - ${todaySchedule.dateStr}) у нас ${todaySchedule.lessons.length} пари.\n
      ${todaySchedule.lessons.map((lesson, index) => {
        return `
        ** ${lesson.startStr} - ${lesson.endStr} (${lesson.numberName}) **
        ${lesson.fullname || lesson.name}
        `.split('\n').map(line => line.trim()).join('\n');
      }).join('\n')}
      `.trim();

    return message + `\n\nДані взято з: ${process.env.EROZKLAD_URL}`;
  };

  messageTomorrow = (tomorrowSchedule) => {
    const message = !tomorrowSchedule.lessons.length
      ? `Завтра (${tomorrowSchedule.dayOfWeek} - ${tomorrowSchedule.dateStr}) у нас немає пар.`
      : `
      Завтра (${tomorrowSchedule.dayOfWeek} - ${tomorrowSchedule.dateStr}) у нас ${tomorrowSchedule.lessons.length} пари.\n
      ${tomorrowSchedule.lessons.map((lesson, index) => {
        return `
        ** ${lesson.startStr} - ${lesson.endStr} (${lesson.numberName}) **
        ${lesson.fullname || lesson.name}
        `.split('\n').map(line => line.trim()).join('\n');
      }).join('\n')}
      `.trim();

    return message + `\n\nДані взято з: ${process.env.EROZKLAD_URL}`;
  };

  messageWeekDay = (weekdaySchedule) => {
    const message = !weekdaySchedule.lessons.length
      ? `У (${weekdaySchedule.dayOfWeek} - ${weekdaySchedule.dateStr}) у нас немає пар.`
      : `
      У (${weekdaySchedule.dayOfWeek} - ${weekdaySchedule.dateStr}) у нас ${weekdaySchedule.lessons.length} пари.\n
      ${weekdaySchedule.lessons.map((lesson, index) => {
        return `
        ** ${lesson.startStr} - ${lesson.endStr} (${lesson.numberName}) **
        ${lesson.fullname || lesson.name}
        `.split('\n').map(line => line.trim()).join('\n');
      }).join('\n')}
      `.trim();

    return message + `\n\nДані взято з: ${process.env.EROZKLAD_URL}`;
  };


  onActionToday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getToday()
        .then(todaySchedule => {
          const message = this.messageToday(todaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionToday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionTomorrow = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getTomorrow()
        .then(tomorrowSchedule => {
          const message = this.messageTomorrow(tomorrowSchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionTomorrow in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionMonday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getMondayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionMonday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionTuesday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getTuesdayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionTuesday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionWednesday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getWednesdayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionWednesday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionThursday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getThursdayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionThursday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionFriday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getFridayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionFriday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionSaturday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getSaturdayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionSaturday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };

  onActionSunday = (ctx) => {
    try {
      ctx.answerCbQuery('');
      const chatId = ctx.update.callback_query.message.chat.id;
      return this.erozklad.getSundayOfThisWeek()
        .then(weekdaySchedule => {
          const message = this.messageWeekDay(weekdaySchedule);
          this.reply(chatId, message);
        });
    } catch (error) {
      console.error(`Error while onActionSaturday in TgBot-callbacks.js. ${error.message}`);
      return ctx.reply(`Нажаль сталася помилка :(\n${error.message}`);
    };
  };
};