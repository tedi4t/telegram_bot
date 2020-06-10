'use strict';

const { Telegraf } = require('telegraf');

const FUNCTIONS = require('./modules/functions');
const MODELS = require('./modules/models.js');
const MONGO = require('./modules/mongo.js');

const { TOKEN, URL } = require('./modules/config');
const { milliSecondsWeek, dayOffset } = require('./modules/constantas');

const bot = new Telegraf(TOKEN);

bot.telegram.setWebhook(`${URL}/bot${TOKEN}`);
bot.startWebhook(`/bot${TOKEN}`, null, process.env.PORT);

let chatGroupID, chatTeacherID;

MONGO.openConnection().then(async () => {
  chatGroupID = await FUNCTIONS.readMongo('chatGroupID');
  chatTeacherID = await FUNCTIONS.readMongo('chatTeacherID');
});

let week;
getWeek(false);
const secondsPassed = FUNCTIONS.findMiliSecondsDate();
setTimeout(getWeek, milliSecondsWeek - secondsPassed);

async function getWeek(setTimer = true) {
  const url = 'https://api.rozklad.org.ua/v2/weeks';
  week = (await FUNCTIONS.sendRequestAsync(url)).data;
  if (setTimer) {
    setTimeout(getWeek, milliSecondsWeek);
  }
}

function sendInlineKeyboardMessage(chatID, keyboard) {
  const selectKeyboard = {
    reply_markup: JSON.stringify({
      inline_keyboard: keyboard,
    }),
  };
  const message = 'We\'ve found some results. Select one please';
  bot.telegram.sendMessage(chatID, message, selectKeyboard);
}

bot.start(ctx => {
  ctx.reply('Hi! I\'m your bot in the KPI world. At first, choose your' +
    ' group. To do this, write /group and name of your group.' +
  'e.g. "/group ip93". If I can\'t find it, please write it in ukrainian. ' +
    'If you are teacher write /teacher and your surname un ukrainian.' +
  'If you want you can write your name and paternal name. ' +
    'e. g. "/teacher Шемсединов Тимур Гафарович"');
});

bot.help(ctx => {
  ctx.reply('At first, choose your group. To do this,' +
    ' write /group and name of your group. e.g. "/group ip93".' +
    ' If I can\'t find it, please write it in ukrainian. If you' +
    ' are teacher write /teacher and your surname un ukrainian.' +
  'If you want you can write your name and paternal name.' +
    ' e. g. "/teacher Шемсединов Тимур Гафарович"');
});

bot.command(['/group', '/group@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const parsedCommand = FUNCTIONS.parseCommandText(ctx.update.message.text)[0];
  const enteredGroup = FUNCTIONS.parseGroupName(parsedCommand);
  try {
    const congruences = FUNCTIONS.findCongruencesGroup(enteredGroup);
    if (congruences.length === 1) {
      chatGroupID[chatID] = congruences[0].ID;
      const baseName = 'chatGroupID';
      const newObjMongo = { baseName, content: chatGroupID };
      MONGO.overwrite(baseName, newObjMongo, MODELS.generalModel);
      ctx.reply('Your group was set');
    } else {
      const keyboard = [];
      for (const group of congruences)
        keyboard.push([{
          text: group.name,
          callback_data: `group ${group.ID}`
        }]);
      sendInlineKeyboardMessage(chatID, keyboard);
    }
  } catch (e) {
    ctx.reply('Can\'t find group\'s name');
  }
});

bot.command(['/today', '/today@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const day = new Date().getDay();
  FUNCTIONS.replyOneDayStudent(ctx, week, day, groupID);
});

bot.command(['/tomorrow', '/tomorrow@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const day = new Date().getDay();
  if (day === 7) //for last day of the week another request
    FUNCTIONS.replyOneDayStudent(ctx, week % 2 + 1, 1, groupID);
  else FUNCTIONS.replyOneDayStudent(ctx, week, day + 1, groupID);
});

bot.command(['/week', '/week@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  FUNCTIONS.replyWeekStudent(ctx, week, groupID);
});

bot.command(['/nextweek', '/nextweek@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[`${chatID}`];
  FUNCTIONS.replyWeekStudent(ctx, week % 2 + 1, groupID);
});

bot.command(['/teacher', '/teacher@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const enteredNameArr = FUNCTIONS.parseCommandText(ctx.update.message.text);
  try {
    const congruences = FUNCTIONS.findCongruencesTeacher(enteredNameArr);
    if (congruences.length === 1) {
      chatTeacherID[chatID] = congruences[0].ID;
      const newObjMongo = {
        baseName: 'chatTeacherID',
        content: chatTeacherID
      };
      MONGO.overwrite('chatTeacherID', newObjMongo, MODELS.generalModel);
      ctx.reply('Your name was set');
    } else {
      const keyboard = [];
      for (const teacher of congruences)
        keyboard.push([{
          text: teacher.name,
          callback_data: `teacher ${teacher.ID}`
        }]);
      sendInlineKeyboardMessage(ctx.message.chat.id, keyboard);
    }
  } catch {
    ctx.reply('Can\'t find teacher\'s name');
  }
});

bot.command(['/teachertoday', '/teachertoday@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  const day = new Date().getDay();
  FUNCTIONS.replyOneDayTeacher(ctx, week, day, teacherID);
});

bot.command(['/teachertomorrow',
  '/teachertomorrow@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  const day = new Date().getDay();
  if (day === 7)
    FUNCTIONS.replyOneDayTeacher(ctx, week % 2 + 1, 1);
  else FUNCTIONS.replyOneDayTeacher(ctx, week, day + 1, teacherID);
});

bot.command(['/teacherweek', '/teacherweek@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  FUNCTIONS.replyWeekTeacher(ctx, week, teacherID);
});

bot.command(['/teachernextweek',
  '/teachernextweek@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  FUNCTIONS.replyWeekTeacher(ctx, week % 2 + 1, teacherID);
});

bot.command(['/busyrooms', '/busyrooms@aefioiefjsrhfbsbjbot'], ctx => {
  const text = ctx.update.message.text;
  const block = FUNCTIONS.parseCommandText(text)[0];
  try {
    ctx.reply(FUNCTIONS.findBusyRooms(block, week).join(', '));
  } catch (e) {
    ctx.reply('Can\'t find rooms');
  }
});

bot.command(['/name', '/name@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  try {
    ctx.reply(FUNCTIONS.findTeacherName(ctx, week, groupID));
  } catch (e) {
    ctx.reply('You don\'t have any lesson now');
  }
});

bot.catch(err => {
  console.log(`Ooops, unknown error: ${err.message}`);
});

bot.on('callback_query', ctx => {
  const chatID = ctx.update.callback_query.message.chat.id;
  const text = ctx.update.callback_query.data;
  const splitQuery = text.split(' ');
  const command = splitQuery[0];
  const ID = splitQuery[1];
  ctx.editMessageReplyMarkup();
  if (command === 'teacher') {
    chatTeacherID[chatID] = ID;
    const baseName = 'chatTeacherID';
    const newObjMongo = { baseName: baseName, content: chatTeacherID };
    MONGO.overwrite(baseName, newObjMongo, MODELS.generalModel);
    ctx.reply('Your name was set');
  }
  if (command === 'group') {
    chatGroupID[chatID] = ID;
    const baseName = 'chatGroupID';
    const newObjMongo = { baseName: baseName, content: chatGroupID };
    MONGO.overwrite(baseName, newObjMongo, MODELS.generalModel);
    ctx.reply('Your group was set');
  }
});
