'use strict';

const fs = require('fs');
const { Telegraf } = require('telegraf');

const FUNCTIONS = require('./modules/functions');

//chatID -> groupID
const chatGroupID = FUNCTIONS.readFile('./chatID/chatGroupID.txt');
//chatID -> teacherID
const chatTeacherID = FUNCTIONS.readFile('./chatID/chatTeacherID.txt');

const roomsSchedule = FUNCTIONS.readFile('./base/roomsSchedule.txt');
const studentSchedule = FUNCTIONS.readFile('./base/studentSchedule.txt');

const { BOT_TOKEN } = require('./modules/config');
const { milliSecondsWeek } = require('./modules/constantas');

const bot = new Telegraf(BOT_TOKEN, { polling: true });

let week;
getWeek(false);
setTimeout(getWeek, milliSecondsWeek - FUNCTIONS.findSecondsDate());

async function getWeek(setTimer = true) {
  week = (await FUNCTIONS.sendRequestAsync('https://api.rozklad.org.ua/v2/weeks')).data;
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
  ctx.reply('Hi! I\'m your bot in the KPI world. At first, choose your group.' +
    ' To do this, write /group and name of your group.' +
  'e.g. "/group ip93". If I can\'t find it, please write it in ukrainian. ' +
    'If you are teacher write /teacher anf your surname un ukrainian.' +
  'If you want you can write your name and middle name. ' +
    'e. g. "/teacher Шемсединов Тимур Гафарович"');
});

bot.help(ctx => {
  ctx.reply('At first, choose your group. To do this,' +
    ' write /group and name of your group. e.g. "/group ip93".' +
    ' If I can\'t find it, please write it in ukrainian. If you' +
    ' are teacher write /teacher anf your surname un ukrainian.' +
  'If you want you can write your name and middle name.' +
    ' e. g. "/teacher Шемсединов Тимур Гафарович"');
});

bot.command('/group', ctx => {
  const chatID = ctx.update.message.chat.id;
  const parsedCommand = FUNCTIONS.parseCommandText(ctx.update.message.text)[0];
  const enteredGroup = FUNCTIONS.parseGroupName(parsedCommand);
  if (enteredGroup) {
    const congruences = FUNCTIONS.findCongruencesGroup(enteredGroup);
    if (congruences.length > 0) {
      if (congruences.length === 1) {
        chatGroupID[chatID] = congruences[0].id;
        const chatGroupIDStr = JSON.stringify(chatGroupID);
        fs.writeFileSync('./chatID/chatGroupID.txt', chatGroupIDStr);
        ctx.reply('Your group was set');
      } else {
        const keyboard = [];
        for (const group of congruences)
          keyboard.push([{ text: group.name, callback_data: `group ${group.id}` }]);
        sendInlineKeyboardMessage(ctx.message.chat.id, keyboard);
      }
    } else {
      ctx.reply('Can\'t find group\'s name');
    }
  }
});

bot.command('/today', ctx => {
  const day = new Date().getDay();
  FUNCTIONS.replyOneDayStudent(ctx, week, day);
});

bot.command('/tomorrow', ctx => {
  const day = new Date().getDay();
  if (day === 7)
    FUNCTIONS.replyOneDayStudent(ctx, week % 2 + 1, 1);
  else FUNCTIONS.replyOneDayStudent(ctx, week, day + 1);
});

bot.command('/week', ctx => {
  FUNCTIONS.replyWeekStudent(ctx, week);
});

bot.command('/nextweek', ctx => {
  FUNCTIONS.replyWeekStudent(ctx, week % 2 + 1);
});

bot.command('/teacher', ctx => {
  const chatID = ctx.update.message.chat.id;
  const enteredNameArr = FUNCTIONS.parseCommandText(ctx.update.message.text);
  if (enteredNameArr.length) {
    const congruences = FUNCTIONS.findCongruencesTeacher(enteredNameArr);
    if (congruences.length > 0) {
      if (congruences.length === 1) {
        chatTeacherID[chatID] = congruences[0].id;
        const chatTeacherIDStr = JSON.stringify(chatTeacherID);
        fs.writeFileSync('./chatID/chatTeacherID.txt', chatTeacherIDStr);
        ctx.reply('Your name was set');
      } else {
        const keyboard = [];
        for (const teacher of congruences)
          keyboard.push([{ text: teacher.name, callback_data: `teacher ${teacher.id}` }]);
        sendInlineKeyboardMessage(ctx.message.chat.id, keyboard);
      }
    } else {
      ctx.reply('Can\'t find teacher\'s name');
    }
  }
});

bot.command('/teachertoday', ctx => {
  const day = new Date().getDay();
  FUNCTIONS.replyOneDayTeacher(ctx, week, day);
});

bot.command('/teachertomorrow', ctx => {
  const day = new Date().getDay();
  if (day === 7)
    FUNCTIONS.replyOneDayTeacher(ctx, week % 2 + 1, 1);
  else FUNCTIONS.replyOneDayTeacher(ctx, week, day + 1);
});

bot.command('/teacherweek', ctx => {
  FUNCTIONS.replyWeekTeacher(ctx, week);
});

bot.command('/teachernextweek', ctx => {
  FUNCTIONS.replyWeekTeacher(ctx, week % 2 + 1);
});

bot.command('/busyrooms', ctx => {
  const block = FUNCTIONS.parseCommandText(ctx.update.message.text)[0];
  const date = new Date();
  const day = date.getDay();
  try {
    const lessonNumb = FUNCTIONS.findLessonNumb(date);
    ctx.reply(roomsSchedule[block][week][day][lessonNumb].join(', '));
  } catch (e) {
    ctx.reply('Can\'t find rooms');
  }
});

bot.command('/name', ctx => {
  const chatID = ctx.update.message.chat.id;
  const date = new Date();
  const day = date.getDay();
  try {
    const schedule = studentSchedule[chatGroupID[chatID]][week][day];
    const lessonNumb = FUNCTIONS.findLessonNumb(date);
    const lesson = FUNCTIONS.findLessonByNumb(schedule, lessonNumb);
    ctx.reply(lesson.teachers.map(obj => obj.teacher_name).join(', '));
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
  const command = text.split(' ')[0];
  ctx.editMessageReplyMarkup();
  if (command === 'teacher') {
    chatTeacherID[chatID] = text.split(' ')[1];
    const chatTeacherIDStr = JSON.stringify(chatTeacherID);
    fs.writeFileSync('./chatID/chatTeacherID.txt', chatTeacherIDStr);
    ctx.reply('Your name was set');
  }
  if (command === 'group') {
    chatGroupID[chatID] = text.split(' ')[1];
    fs.writeFileSync('./chatID/chatGroupID.txt', JSON.stringify(chatGroupID));
    ctx.reply('Your group was set');
  }
});

bot.launch();
