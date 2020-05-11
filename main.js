const fs = require('fs');
const { Telegraf } = require('telegraf');
const fetch = require("node-fetch");

const BOT_TOKEN = '1099889005:AAEH1YQyLaRl5HcTphsk9N2RRJ_nf21iPug';

const bot = new Telegraf(BOT_TOKEN);

const chatGroupID = readFile('chatGroupID.txt'); //chatID -> groupID
const chatTeacherID = readFile('chatTeacherID.txt'); //chatID -> teacherID

const groupsBase = mixFindIndex(JSON.parse(fs.readFileSync("./base/groupsBase.txt", 'utf8')));
const lessonsBase = JSON.parse(fs.readFileSync("./base/lessonsBase.txt", 'utf8'));
const roomsSchedule = JSON.parse(fs.readFileSync("./base/roomsSchedule.txt", 'utf8'));
const studentSchedule = JSON.parse(fs.readFileSync("./base/studentSchedule.txt", 'utf8'));
const teachersBase = JSON.parse(fs.readFileSync("./base/teachersBase.txt", 'utf8'));
const teacherSchedule = JSON.parse(fs.readFileSync("./base/teachersSchedule.txt", 'utf8'));

const days = [``, `Понеділок`, `Вівторок`, `Середа`, `Четвер`, `П'ятниця`, `Субота`, `Неділя`];
const scheduleLessons = [
  {condition: date => 510 <= date.getHours() * 60 + date.getMinutes() <= 605},
  {condition: date => 625 <= date.getHours() * 60 + date.getMinutes() <= 720},
  {condition: date => 740 <= date.getHours() * 60 + date.getMinutes() <= 835},
  {condition: date => 855 <= date.getHours() * 60 + date.getMinutes() <= 950},
  {condition: date => 970 <= date.getHours() * 60 + date.getMinutes() <= 1065}
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
  const day = date.getDay();
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
  const file = JSON.parse(fs.readFileSync(path, 'utf8'));
  return typeof file === 'object' ? file : {};
}

function mixFindIndex(obj) {
  obj.indexOf = (val) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && typeof val === 'string' && (obj[key].localeCompare(val) === 0))
        return key;
    }
  };
  return obj;
}

function parseCommandText(str) {
  const strArr = str.toLowerCase().split(' ');
  strArr.shift();
  return strArr;
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
  for (const lessonNumb in scheduleLessons) {
    const lesson = scheduleLessons[lessonNumb];
    if (lesson.condition(date))
      return lessonNumb + 1;
  }
}

function findCongruences(enteredArr) {
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

bot.start((ctx) => {
  ctx.reply(`Hi! I'm your bot in the KPI world. At first, choose your group. To do this, write /group and name of your group.`);
});

bot.command(`/group`, ctx => {
  const chatID = ctx.update.message.chat.id;
  const ID = groupsBase.indexOf(parseCommandText(ctx.update.message.text)[0]);
  if (ID) {
    chatGroupID[chatID] = ID;
    fs.writeFileSync("chatGroupID.txt", JSON.stringify(chatGroupID));
    ctx.reply('Your group was set!');
  } else ctx.reply('Unknown group name');
});

bot.command(`/getGroupID`, ctx => {
  const chatID = ctx.update.message.chat.id;
  if (chatGroupID[chatID]) {
    ctx.reply(`Your group is ${chatGroupID[chatID]}`);
  } else ctx.reply('Your group ID was not set!');
});

bot.command(`/getTeacherID`, ctx => {
  const chatID = ctx.update.message.chat.id;
  if (chatTeacherID[chatID]) {
    ctx.reply(`Your teacher is ${chatTeacherID[chatID]}`);
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

bot.command('/busyrooms', ctx => {
  const chatID = ctx.update.message.chat.id;
  const block = parseCommandText(ctx.update.message.text)[0];
  const date = new Date();
  const lessonNumb = findLessonNumb(date);
  const day = date.getDay();
  //block -> week -> day -> lesson number
  if (block && roomsSchedule[block] && roomsSchedule[block][week] &&
    roomsSchedule[block][week][day] && lessonNumb && roomsSchedule[block][week][day][lessonNumb])
    ctx.reply(roomsSchedule[block][week][day][lessonNumb]);
  else ctx.reply(`Can't find rooms`);
});

bot.command('/teacher', ctx => {
  const chatID = ctx.update.message.chat.id;
  const enteredNameArr = parseCommandText(ctx.update.message.text);
  const congruences = findCongruences(enteredNameArr);
  if (congruences.length > 0) {
    if (congruences.length === 1) {
      chatTeacherID[chatID] = congruences[0].id;
      fs.writeFileSync("chatTeacherID.txt", JSON.stringify(chatTeacherID));
      ctx.reply('Your name was set');
    } else {
      const keyboard = [];
      for (const teacher of congruences)
        keyboard.push([{text: teacher.name, callback_data: `teacher ${teacher.id}`}]);
      const selectKeyboard = {
        reply_markup: JSON.stringify({
          inline_keyboard: keyboard
        })
      };
      bot.telegram.sendMessage(ctx.message.chat.id, `We've found some results. Select one please`, selectKeyboard)
    }
  } else {
    ctx.reply(`Can't find teacher's name`);
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
        ctx.reply(weekSchedule.join(`\n\n`), {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have lessons this week`);
    }
  } else ctx.reply('Your teacher ID was not set!');
});

bot.on('callback_query', ctx => {
  const chatID = ctx.update.callback_query.message.chat.id;
  const text = ctx.update.callback_query.data;
  const command = text.split(' ')[0];
  if (command === 'teacher') {
    chatTeacherID[chatID] = text.split(' ')[1];
    fs.writeFileSync("chatTeacherID.txt", JSON.stringify(chatTeacherID));
    ctx.reply('Your name was set');
  }
})




// bot.command('/WhoIsPidor', ctx => {
//   ctx.reply(`I have found one pidor. It's @deGenre`);
// })

bot.launch();