'use strict';

const { Telegraf } = require('telegraf');

const FUNCTIONS = require('./modules/functions');
const MODELS = require('./modules/models');
const MONGO = require('./modules/mongo');

const { TOKEN, URL } = require('./modules/config');
const { milliSecondsWeek } = require('./modules/constantas');
const commands = require('./modules/answers');

const bot = new Telegraf(TOKEN);

bot.telegram.setWebhook(`${URL}/bot${TOKEN}`);
bot.startWebhook(`/bot${TOKEN}`, null, process.env.PORT);

let chatGroupID, chatTeacherID;

MONGO.openConnection().then(async () => {
  chatGroupID = await FUNCTIONS.readMongo('chatGroupID');
  chatTeacherID = await FUNCTIONS.readMongo('chatTeacherID');
});

let week;

function setWeek() {
  //false means that we won't set timer in getWeek function
  getWeek(false);
  const secondsPassed = FUNCTIONS.findMiliSecondsDate();
  setTimeout(getWeek, milliSecondsWeek - secondsPassed);
}

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

function setGroupTeacher(ctx, congruences, objMongo, callbackData) {
  //further we will use elem instead of teacher/group
  const chatID = ctx.update.message.chat.id;
  const chatElemID = objMongo.content;
  const { baseName } = objMongo;
  const congruencesLen = congruences.length;
  if (congruencesLen === 0) {
    ctx.reply('Can\'t find name');
  } else if (congruencesLen === 1) {
    chatElemID[chatID] = congruences[0].ID;
    MONGO.overwrite(baseName, objMongo, MODELS.generalModel);
    ctx.reply('Your name was set');
  } else {
    const keyboard = [];
    for (const elem of congruences) {
      keyboard.push([{
        text: elem.name,
        callback_data: `${callbackData} ${elem.ID}`
      }]);
    }
    sendInlineKeyboardMessage(chatID, keyboard);
  }
}

bot.start(ctx => ctx.reply(commands.start));

bot.help(ctx => ctx.reply(commands.help));

bot.command(['/group', '/group@aefioiefjsrhfbsbjbot'], ctx => {
  const text = ctx.update.message.text;
  const parsedCommand = FUNCTIONS.parseCommandText(text)[0];
  const enteredGroup = FUNCTIONS.parseGroupName(parsedCommand);
  const congruences = FUNCTIONS.findCongruencesGroup(enteredGroup);
  const baseName = 'chatGroupID';
  const newObjMongo = { baseName, content: chatGroupID };
  const callbackData = 'group';
  setGroupTeacher(ctx, congruences, newObjMongo, callbackData);
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
  //for last day of the week another request
  if (day === 7) FUNCTIONS.replyOneDayStudent(ctx, week % 2 + 1, 1, groupID);
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
  const text = ctx.update.message.text;
  const enteredNameArr = FUNCTIONS.parseCommandText(text);
  const congruences = FUNCTIONS.findCongruencesTeacher(enteredNameArr);
  const baseName = 'chatTeacherID';
  const callbackData = 'teacher';
  const newObjMongo = {
    baseName,
    content: chatTeacherID
  };
  setGroupTeacher(ctx, congruences, newObjMongo, callbackData);
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
  if (day === 7) FUNCTIONS.replyOneDayTeacher(ctx, week % 2 + 1, 1);
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
  const rooms = FUNCTIONS.findBusyRooms(block, week);
  if (rooms.length > 0) ctx.reply(rooms.join(', '));
  else ctx.reply('Can\'t find rooms');
});

bot.command(['/name', '/name@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const teacher = ctx.reply(FUNCTIONS.findTeacherName(ctx, week, groupID));
  if (teacher) ctx.reply(FUNCTIONS.findTeacherName(ctx, week, groupID));
  else ctx.reply('You don\'t have any lesson now');
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
  let objMongo, baseName;
  ctx.editMessageReplyMarkup();
  if (command === 'teacher') {
    chatTeacherID[chatID] = ID;
    baseName = 'chatTeacherID';
    objMongo = { baseName, content: chatTeacherID };
  } else if (command === 'group') {
    chatGroupID[chatID] = ID;
    baseName = 'chatGroupID';
    objMongo = { baseName, content: chatGroupID };
  }
  MONGO.overwrite(baseName, objMongo, MODELS.generalModel);
  ctx.reply('Your name was set');
});

setWeek();
