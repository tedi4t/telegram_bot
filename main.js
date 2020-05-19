const fs = require('fs');
const { Telegraf } = require('telegraf');
const express = require('express');

const { readFile, convertDateToSeconds, parseGroupName, sendRequestAsync,
    parseCommandText, findCongruencesGroup, findCongruencesTeacher,
    replyOneDayStudent, replyWeekStudent,
    replyOneDayTeacher, replyWeekTeacher, findLessonNumb, findLessonByNumb,
  } = require('./modules/functions');

const chatGroupID = readFile('chatGroupID.txt'); //chatID -> groupID
const chatTeacherID = readFile('chatTeacherID.txt'); //chatID -> teacherID

const roomsSchedule = JSON.parse(fs.readFileSync("./base/roomsSchedule.txt", 'utf8'));
const studentSchedule = JSON.parse(fs.readFileSync("./base/studentSchedule.txt", 'utf8'));

const { BOT_TOKEN, BOT_URL, port } = require('./modules/config');

const bot = new Telegraf(BOT_TOKEN);
const __app = express();

bot.telegram.setWebhook(`${BOT_URL}/bot${BOT_TOKEN}`);
__app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

async function getWeek(setTimer = true) {
  week = (await sendRequestAsync(`https://api.rozklad.org.ua/v2/weeks`)).data;
  if (setTimer) {
    setTimeout(getWeek, milliSecondsWeek)
  }
}

function sendInlineKeyboardMessage(chatID, keyboard) {
  const selectKeyboard = {
    reply_markup: JSON.stringify({
      inline_keyboard: keyboard,
    }),
  };
  bot.telegram.sendMessage(chatID, `We've found some results. Select one please`, selectKeyboard);
}

const milliSecondsWeek = 604800000;
const date = new Date();
let week;
getWeek(false);
setTimeout(getWeek, milliSecondsWeek - convertDateToSeconds(date));

bot.start((ctx) => {
  ctx.reply(`Hi! I'm your bot in the KPI world. At first, choose your group. To do this, write /group and name of your group.` +
  `e.g. "/group ip93". If I can't find it, please write it in ukrainian. If you are teacher write /teacher anf your surname un ukrainian.` +
  `If you want you can write your name and middle name. e. g. "/teacher Шемсединов Тимур Гафарович"`);
});

bot.help(ctx => {
  ctx.reply(`At first, choose your group. To do this, write /group and name of your group.` +
    `e.g. "/group ip93". If I can't find it, please write it in ukrainian. If you are teacher write /teacher anf your surname un ukrainian.` +
  `If you want you can write your name and middle name. e. g. "/teacher Шемсединов Тимур Гафарович"`);
});

bot.command(`/group`, ctx => {
  const chatID = ctx.update.message.chat.id;
  const enteredGroup = parseGroupName(parseCommandText(ctx.update.message.text)[0]);
  if (enteredGroup){
    const congruences = findCongruencesGroup(enteredGroup);
    if (congruences.length > 0) {
      if (congruences.length === 1) {
        chatGroupID[chatID] = congruences[0].id;
        fs.writeFileSync("chatGroupID.txt", JSON.stringify(chatGroupID));
        ctx.reply('Your group was set');
      } else {
        const keyboard = [];
        for (const group of congruences)
          keyboard.push([{text: group.name, callback_data: `group ${group.id}`}]);
        sendInlineKeyboardMessage(ctx.message.chat.id, keyboard);
      }
    } else {
      ctx.reply(`Can't find group's name`);
    }
  }
});

bot.command(`/getGroupName`, ctx => {
  const chatID = ctx.update.message.chat.id;
  if (chatGroupID[chatID]) {
    ctx.reply(`Your group is ${groupsBase[chatGroupID[chatID]]}`);
  } else ctx.reply('Your group ID was not set!');
});

bot.command(`/getTeacherName`, ctx => {
  const chatID = ctx.update.message.chat.id;
  if (chatTeacherID[chatID]) {
    ctx.reply(`Your teacher is ${teachersBase[chatTeacherID[chatID]]}`);
  } else ctx.reply('Your teacher ID was not set!');
});

bot.command('/today', ctx => {
  const day = new Date().getDay();
  replyOneDayStudent(ctx, week, day);
});

bot.command('/tomorrow', ctx => {
  const day = new Date().getDay();
  if (day === 7)
    replyOneDayStudent(ctx, week % 2 + 1, 1);
  else replyOneDayStudent(ctx, week, day + 1);
});

bot.command('/week', ctx => {
  replyWeekStudent(ctx, week);
});

bot.command('/nextweek', ctx => {
  replyWeekStudent(ctx, week % 2 + 1);
});

bot.command('/teacher', ctx => {
  const chatID = ctx.update.message.chat.id;
  const enteredNameArr = parseCommandText(ctx.update.message.text);
  if (enteredNameArr.length) {
    const congruences = findCongruencesTeacher(enteredNameArr);
    if (congruences.length > 0) {
      if (congruences.length === 1) {
        chatTeacherID[chatID] = congruences[0].id;
        fs.writeFileSync("chatTeacherID.txt", JSON.stringify(chatTeacherID));
        ctx.reply('Your name was set');
      } else {
        const keyboard = [];
        for (const teacher of congruences)
          keyboard.push([{text: teacher.name, callback_data: `teacher ${teacher.id}`}]);
        sendInlineKeyboardMessage(ctx.message.chat.id, keyboard);
      }
    } else {
      ctx.reply(`Can't find teacher's name`);
    }
  }
});

bot.command('/teachertoday', ctx => {
  const day = new Date().getDay();
  replyOneDayTeacher(ctx, week, day);
});

bot.command('/teachertomorrow', ctx => {
  const day = new Date().getDay();
  if (day === 7)
    replyOneDayTeacher(ctx, week % 2 + 1, 1);
  else replyOneDayTeacher(ctx, week, day + 1);
});

bot.command('/teacherweek', ctx => {
  replyWeekTeacher(ctx, week);
});

bot.command('/teachernextweek', ctx => {
  replyWeekTeacher(ctx, week % 2 + 1);
});

bot.command('/busyrooms', ctx => {
  const chatID = ctx.update.message.chat.id;
  const block = parseCommandText(ctx.update.message.text)[0];
  const date = new Date();
  const day = date.getDay();
  try {
    const lessonNumb = findLessonNumb(date);
    ctx.reply(roomsSchedule[block][week][day][lessonNumb].join(', '));
  } catch (e) {
    ctx.reply(`Can't find rooms`);
  }
});

bot.command('/name', ctx => {
  const chatID = ctx.update.message.chat.id;
  const date = new Date();
  const day = date.getDay();
  try {
    const lesson = findLessonByNumb(studentSchedule[chatGroupID[chatID]][week][day], findLessonNumb(date));
    ctx.reply(lesson.teachers.map(obj => obj.teacher_name).join(', '))
  } catch (e) {
    ctx.reply(`You don't have any lesson now`);
  }
});

// bot.catch((err) => {
//   console.log(`Ooops, unknown error: ${err.message}`);
// });

bot.on('callback_query', ctx => {
  const chatID = ctx.update.callback_query.message.chat.id;
  const text = ctx.update.callback_query.data;
  const command = text.split(' ')[0];
  ctx.editMessageReplyMarkup();
  if (command === 'teacher') {
    chatTeacherID[chatID] = text.split(' ')[1];
    fs.writeFileSync("chatTeacherID.txt", JSON.stringify(chatTeacherID));
    ctx.reply('Your name was set');
  }
  if (command === 'group') {
    chatGroupID[chatID] = text.split(' ')[1];
    fs.writeFileSync("chatGroupID.txt", JSON.stringify(chatGroupID));
    ctx.reply('Your group was set');
  }
})

__app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// bot.launch();
