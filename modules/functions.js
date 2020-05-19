const { letterChanger, days, scheduleLessons} = require("./constantas.js");
const fs = require('fs')
const fetch = require("node-fetch");

const chatGroupID = readFile('./chatGroupID.txt'); //chatID -> groupID
const chatTeacherID = readFile('./chatTeacherID.txt'); //chatID -> teacherID

const groupsBase = (JSON.parse(fs.readFileSync('./base/groupsBase.txt', 'utf8')));
const studentSchedule = JSON.parse(fs.readFileSync("./base/studentSchedule.txt", 'utf8'));
const teachersBase = JSON.parse(fs.readFileSync("./base/teachersBase.txt", 'utf8'));
const teacherSchedule = JSON.parse(fs.readFileSync("./base/teachersSchedule.txt", 'utf8'));

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
    setTimeout(getWeek, milliSecondsWeek)
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

function replyOneDayStudent(ctx, week, day) {
  const chatID = ctx.update.message.chat.id;
  const groupID = chatGroupID[chatID];
  if (groupID) {
    if (!studentSchedule[groupID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      const schedule = stringScheduleForDay(studentSchedule[groupID][week][day]);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have any lessons`);
    }
  } else ctx.reply('Your group ID was not set!');
}

function replyWeekStudent (ctx, week) {
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
      else ctx.reply(`You don't have lessons`);
    }
  } else ctx.reply('Your group ID was not set!');
}

function replyOneDayTeacher (ctx, week, day) {
  const chatID = ctx.update.message.chat.id;
  const teacherID = chatTeacherID[chatID];
  if (teacherID) {
    if (!teacherSchedule[teacherID])
      ctx.reply(`There aren't any lessons by this ID`);
    else {
      const schedule = stringScheduleForDay(teacherSchedule[teacherID][week][day]);
      if (schedule)
        ctx.reply(schedule, {parse_mode: 'Markdown'});
      else ctx.reply(`You don't have any lessons`);
    }
  } else ctx.reply('Your teacher ID was not set!');
}

function replyWeekTeacher(ctx, week) {
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
      else ctx.reply(`You don't have lessons`);
    }
  } else ctx.reply('Your teacher ID was not set!');
}

module.exports = {
  readFile,
  sendRequestAsync,
  convertDateToSeconds,
  parseGroupName,
  parseCommandText,
  findCongruencesGroup,
  findCongruencesTeacher,
  sendInlineKeyboardMessage,
  replyOneDayStudent,
  replyWeekStudent,
  replyOneDayTeacher,
  replyWeekTeacher,
  findLessonNumb,
  findLessonByNumb,
  sendInlineKeyboardMessage,
}