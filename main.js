'use strict';

const { Telegraf } = require('telegraf');

const functions = require('./modules/functions');
const models = require('./modules/models');
const mongo = require('./modules/mongo');

const { TOKEN, URL } = require('./modules/config');
const { milliSecondsWeek } = require('./modules/constantas');
const commands = require('./modules/answers');

const bot = new Telegraf(TOKEN);

bot.telegram.setWebhook(`${URL}/bot${TOKEN}`);
bot.startWebhook(`/bot${TOKEN}`, null, process.env.PORT);

let chatGroupID, chatTeacherID;

mongo.openConnection().then(async () => {
  chatGroupID = await functions.readMongo('chatGroupID');
  chatTeacherID = await functions.readMongo('chatTeacherID');
});

let week;

function setWeek() {
  //false means that we won't set timer in getWeek function
  getWeek(false);
  const secondsPassed = functions.findMiliSecondsDate();
  setTimeout(getWeek, milliSecondsWeek - secondsPassed);
}

async function getWeek(setTimer = true) {
  const url = 'https://api.rozklad.org.ua/v2/weeks';
  week = (await functions.sendRequestAsync(url)).data;
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

function setGroupTeacher(ctx, congruences, objmongo, callbackData) {
  //further we will use elem instead of teacher/group
  const chatID = ctx.update.message.chat.id;
  const chatElemID = objmongo.content;
  const { baseName } = objmongo;
  const congruencesLen = congruences.length;
  if (congruencesLen === 0) {
    ctx.reply('Can\'t find name');
  } else if (congruencesLen === 1) {
    chatElemID[chatID] = congruences[0].ID;
    mongo.overwrite(baseName, objmongo, models.generalModel);
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
  const parsedCommand = functions.parseCommandText(text)[0];
  const enteredGroup = functions.parseGroupName(parsedCommand);
  const congruences = functions.findCongruencesGroup(enteredGroup);
  const baseName = 'chatGroupID';
  const newObjmongo = { baseName, content: chatGroupID };
  const callbackData = 'group';
  setGroupTeacher(ctx, congruences, newObjmongo, callbackData);
});

bot.command(['/today', '/today@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const day = new Date().getDay();
  functions.replyOneDayStudent(ctx, week, day, groupID);
});

bot.command(['/tomorrow', '/tomorrow@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const day = new Date().getDay();
  //for last day of the week another request
  const SUNDAY = 7;
  if (day === SUNDAY) {
    functions.replyOneDayStudent(ctx, week % 2 + 1, 1, groupID);
  } else {
    functions.replyOneDayStudent(ctx, week, day + 1, groupID);
  }
});

bot.command(['/week', '/week@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  functions.replyWeekStudent(ctx, week, groupID);
});

bot.command(['/nextweek', '/nextweek@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[`${chatID}`];
  functions.replyWeekStudent(ctx, week % 2 + 1, groupID);
});

bot.command(['/teacher', '/teacher@aefioiefjsrhfbsbjbot'], ctx => {
  const text = ctx.update.message.text;
  const enteredNameArr = functions.parseCommandText(text);
  const congruences = functions.findCongruencesTeacher(enteredNameArr);
  const baseName = 'chatTeacherID';
  const callbackData = 'teacher';
  const newObjmongo = {
    baseName,
    content: chatTeacherID
  };
  setGroupTeacher(ctx, congruences, newObjmongo, callbackData);
});

bot.command(['/teachertoday', '/teachertoday@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  const day = new Date().getDay();
  functions.replyOneDayTeacher(ctx, week, day, teacherID);
});

bot.command(['/teachertomorrow',
  '/teachertomorrow@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  const day = new Date().getDay();
  const SUNDAY = 7;
  if (day === SUNDAY) functions.replyOneDayTeacher(ctx, week % 2 + 1, 1);
  else functions.replyOneDayTeacher(ctx, week, day + 1, teacherID);
});

bot.command(['/teacherweek', '/teacherweek@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  functions.replyWeekTeacher(ctx, week, teacherID);
});

bot.command(['/teachernextweek',
  '/teachernextweek@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  functions.replyWeekTeacher(ctx, week % 2 + 1, teacherID);
});

bot.command(['/busyrooms', '/busyrooms@aefioiefjsrhfbsbjbot'], ctx => {
  const text = ctx.update.message.text;
  const block = functions.parseCommandText(text)[0];
  const rooms = functions.findBusyRooms(block, week);
  if (rooms.length > 0) ctx.reply(rooms.join(', '));
  else ctx.reply('Can\'t find rooms');
});

bot.command(['/name', '/name@aefioiefjsrhfbsbjbot'], ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const teacher = functions.findTeacherName(ctx, week, groupID);
  if (teacher) ctx.reply(teacher);
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
  let objmongo, baseName;
  ctx.editMessageReplyMarkup();
  if (command === 'teacher') {
    chatTeacherID[chatID] = ID;
    baseName = 'chatTeacherID';
    objmongo = { baseName, content: chatTeacherID };
  } else if (command === 'group') {
    chatGroupID[chatID] = ID;
    baseName = 'chatGroupID';
    objmongo = { baseName, content: chatGroupID };
  }
  mongo.overwrite(baseName, objmongo, models.generalModel);
  ctx.reply('Your name was set');
});

setWeek();
