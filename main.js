const fs = require('fs');
const { Telegraf } = require('telegraf');
const fetch = require("node-fetch");

const BOT_TOKEN = '1099889005:AAEH1YQyLaRl5HcTphsk9N2RRJ_nf21iPug';
const url = 'https://878a4f9d.ngrok.io';
const port = 3000;

const bot = new Telegraf(BOT_TOKEN, {
  webHook: {
    port
  }
});

bot.telegram.setWebhook(`${url}/bot${BOT_TOKEN}`);
bot.startWebhook();

const letterChanger = require("./constantas.js");

const chatGroupID = readFile('chatGroupID.txt'); //chatID -> groupID
const chatTeacherID = readFile('chatTeacherID.txt'); //chatID -> teacherID

const groupsBase = (JSON.parse(fs.readFileSync("./base/groupsBase.txt", 'utf8')));
const lessonsBase = JSON.parse(fs.readFileSync("./base/lessonsBase.txt", 'utf8'));
const roomsSchedule = JSON.parse(fs.readFileSync("./base/roomsSchedule.txt", 'utf8'));
const studentSchedule = JSON.parse(fs.readFileSync("./base/studentSchedule.txt", 'utf8'));
const teachersBase = JSON.parse(fs.readFileSync("./base/teachersBase.txt", 'utf8'));
const teacherSchedule = JSON.parse(fs.readFileSync("./base/teachersSchedule.txt", 'utf8'));

const days = [``, `Понеділок`, `Вівторок`, `Середа`, `Четвер`, `П'ятниця`, `Субота`, `Неділя`];
const scheduleLessons = [
  {condition: time => (510 <= time && time <= 605)},
  {condition: time => (625 <= time && time <= 720)},
  {condition: time => (740 <= time && time <= 835)},
  {condition: time => (855 <= time && time <= 950)},
  {condition: time => (970 <= time && time <= 1065)}
];
const scheduleBreaks = [
  {condition: date => 605 <= date.getHours() * 60 + date.getMinutes() <= 625},
  {condition: date => 720 <= date.getHours() * 60 + date.getMinutes() <= 740},
  {condition: date => 835 <= date.getHours() * 60 + date.getMinutes() <= 855},
  {condition: date => 950 <= date.getHours() * 60 + date.getMinutes() <= 970}
];
const milliSecondsWeek = 604800000;
const date = new Date();
let week;
getWeek(false);
setTimeout(getWeek, milliSecondsWeek - convertDateToSeconds(date));

function convertDateToSeconds(date) {
  const day = date.getDay() - 1;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return (day*86400 + hours*3600 + minutes*60 + seconds)*1000
}

async function sendRequestAsync(url) {
  let response = await fetch(url);
  let data = await response.json();
  return data;
}

async function getWeek(setTimer = true) {
  week = (await sendRequestAsync(`https://api.rozklad.org.ua/v2/weeks`)).data;
  if (setTimer) {
    setTimeout(getWeek, 604800000)
  }
}

function readFile(path) {
  try {
    const file = JSON.parse(fs.readFileSync(path, 'utf8'));
    return typeof file === 'object' ? file : {};
  } catch (e) {
    return new Object();
  }
}

// function mixFindIndex(obj) {
//   Object.defineProperty(obj, indexOf, {
//     value: (val) => {
//       for (const key in obj) {
//         if (typeof obj[key] === 'string' && typeof val === 'string' && (obj[key].localeCompare(val) === 0))
//           return key;
//       }
//     },
//     enumerable: false,
//   })
//   obj.indexOf = (val) => {
//     for (const key in obj) {
//       if (typeof obj[key] === 'string' && typeof val === 'string' && (obj[key].localeCompare(val) === 0))
//         return key;
//     }
//   };
//   return obj;
// }

function parseCommandText(str) {
  const strArr = str.toLowerCase().split(' ');
  strArr.shift();
  return strArr;
}

function parseGroupName(str) {
  if (str) {
    const arr = str.split('');
    const parsedNameArr = [];
    parsedNameArr[2] = '-';
    for (const index in arr) {
      const indInt = parseInt(index);
      const value = arr[index];
      const changer = letterChanger[value];
      if (parsedNameArr[indInt] && value !== '-') {
        changer ? parsedNameArr[indInt + 1] = changer : parsedNameArr[indInt + 1] = value;
      } else {
        changer ? parsedNameArr[indInt] = changer : parsedNameArr[indInt] = value;
      }
    }
    return parsedNameArr.join('');
  }
}

function stringScheduleForDay(lessons) {
  if (lessons) {
    let index = 0;
    while (!lessons[index])
      index++;
    const str = [`*${days[lessons[index].day_number]}*`];
    for (const lesson of lessons) {
      if (lesson)
        str.push(`${lesson.lesson_number}. ${lesson.lesson_name} ${lesson.lesson_type} ${lesson.lesson_room}`);
    }
    return str.join(`\n`);
  }
}

function findLessonNumb(date) {
  const time = date.getHours() * 60 + date.getMinutes();
  for (const lessonNumb in scheduleLessons) {
    const lesson = scheduleLessons[lessonNumb];
    if (lesson.condition(time))
      return parseInt(lessonNumb) + 1;
  }
}

function findCongruencesTeacher(enteredArr) {
  const congruences = [];
  for (const id in teachersBase) {
    let converged = true;
    const nameArr = teachersBase[id].toLowerCase().split(' ');
    for (const index in enteredArr) {
      if (index == 0) {
        if (nameArr[index].localeCompare(enteredArr[index]) !== 0)
          converged = false;
      } else {
        if (converged && nameArr[index] && enteredArr[index]) {
          if (nameArr[index][0] !== enteredArr[index][0])
            converged = false;
        }
      }
    }
    if (converged) congruences.push({ id, name: nameArr.join(' ') });
  }
  return congruences;
}

function findCongruencesGroup(str) {
  const congruences = [];
  for (const id in groupsBase) {
    const nameArr = groupsBase[id].split(' ');
    if (str.localeCompare(nameArr[0]) === 0)
      congruences.push({id, name: nameArr.join(' ')});
  }
  return congruences;
}

function sendInlineKeyboardMessage(chatID, keyboard) {
  const selectKeyboard = {
    reply_markup: JSON.stringify({
      inline_keyboard: keyboard,
    }),
  };
  bot.telegram.sendMessage(chatID, `We've found some results. Select one please`, selectKeyboard);
}

function findLessonByNumb(lessons, numb) {
  for (const lesson of lessons) {
    if (lesson.lesson_number == numb)
      return lesson;
  }
}

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

bot.command('/yura', ctx => {
  ctx.reply(`I have found one pidor. It's @deGenre`);
})

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

/*
  const chatID = ctx.update.message.chat.id;
  const enteredNameArr = parseCommandText(ctx.update.message.text);
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
 */

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
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const curDate = new Date();
  const day = curDate.getDay();
  if (groupID) {
    if (!studentSchedule[groupID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      const schedule = stringScheduleForDay(studentSchedule[groupID][week][day]);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have any lessons today`);
    }
  } else ctx.reply('Your group ID was not set!');
});

bot.command('/tomorrow', ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  const curDate = new Date();
  const day = curDate.getDay() + 1 > 7 ? 1 : curDate.getDay() + 1;
  if (groupID) {
    if (!studentSchedule[groupID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      const schedule = stringScheduleForDay(studentSchedule[groupID][week][day]);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have any lessons tomorrow`);
    }
  } else ctx.reply('Your group ID was not set!');
});

bot.command('/week', ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  if (groupID) {
    if (!studentSchedule[groupID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      let weekSchedule = [];
      for (let day = 1; day <= 7; day++) {
        const daySchedule = stringScheduleForDay(studentSchedule[groupID][week][day]);
        if (daySchedule)
          weekSchedule.push(daySchedule);
      }
      const schedule = weekSchedule.join(`\n\n`);
      if (schedule)
        ctx.reply(weekSchedule.join(`\n\n`), {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have lessons this week`);
    }
  } else ctx.reply('Your group ID was not set!');
});

bot.command('/nextweek', ctx => {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  if (groupID) {
    if (!studentSchedule[groupID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      let weekSchedule = [];
      for (let day = 1; day <= 7; day++) {
        const daySchedule = stringScheduleForDay(studentSchedule[groupID][week === 2 ? 1 : 2][day]);
        if (daySchedule)
          weekSchedule.push(daySchedule);
      }
      const schedule = weekSchedule.join(`\n\n`);
      if (schedule)
        ctx.reply(weekSchedule.join(`\n\n`), {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have lessons next week`);
    }
  } else ctx.reply('Your group ID was not set!');
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
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  const curDate = new Date();
  const day = curDate.getDay();
  if (teacherID) {
    if (!teacherSchedule[teacherID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      const schedule = stringScheduleForDay(teacherSchedule[teacherID][week][day]);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have any lessons today`);
    }
  } else ctx.reply('Your teacher ID was not set!');
});

bot.command('/teachertomorrow', ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  const curDate = new Date();
  const day = curDate.getDay() + 1 > 7 ? 1 : curDate.getDay() + 1;
  if (teacherID) {
    if (!teacherSchedule[teacherID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      const schedule = stringScheduleForDay(teacherSchedule[teacherID][week][day]);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have any lessons tomorrow`);
    }
  } else ctx.reply('Your teacher ID was not set!');
});

bot.command('/teacherweek', ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  if (teacherID) {
    let weekSchedule = [];
    if (!teacherSchedule[teacherID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      for (let day = 1; day <= 7; day++) {
        const daySchedule = stringScheduleForDay(teacherSchedule[teacherID][week][day]);
        if (daySchedule)
          weekSchedule.push(daySchedule);
      }
      const schedule = weekSchedule.join(`\n\n`);
      if (schedule)
        ctx.reply(weekSchedule.join(`\n\n`), {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have lessons this week`);
    }
  } else ctx.reply('Your teacher ID was not set!');
});

bot.command('/teachernextweek', ctx => {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  if (teacherID) {
    let weekSchedule = [];
    if (!teacherSchedule[teacherID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      for (let day = 1; day <= 7; day++) {
        const daySchedule = stringScheduleForDay(teacherSchedule[teacherID][week === 2 ? 1 : 2][day]);
        if (daySchedule)
          weekSchedule.push(daySchedule);
      }
      const schedule = weekSchedule.join(`\n\n`);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have lessons this week`);
    }
  } else ctx.reply('Your teacher ID was not set!');
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

// bot.command('/name', ctx => {
//   const chatID = ctx.update.message.chat.id;
//   const date = new Date();
//   const day = date.getDay();
//   const lessonNumb = findLessonByNumb(studentSchedule[chatGroupID[chatID]][week][day], findLessonNumb(date));
//   console.log({lessonNumb, ID: chatGroupID[chatID], week, day});
//   console.log(studentSchedule[chatGroupID[chatID]][week][day][0].teachers);
//   if (studentSchedule[chatGroupID[chatID]][week] && studentSchedule[chatGroupID[chatID]][week][day]) {
//     const lessonNumb = findLessonByNumb(studentSchedule[chatGroupID[chatID]][week][day], findLessonNumb(date));
//     if (lessonNumb)
//       ctx.reply(studentSchedule[chatGroupID[chatID]][week][day][lessonNumb].teachers.map(obj => obj.teacher_name).join(', '))
//     else ctx.reply(`You don't have any lesson now`);
//   } else ctx.reply(`You don't have any lesson now`);
// });

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

bot.catch((err, ctx) => {
  console.log(`Ooops, unknown error: ${err.message}`);
});

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

bot.launch();
