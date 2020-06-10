'use strict';

const { letterChanger, days, scheduleLessons,
  timezoneOffset } = require('./constantas.js');
const fetch = require('node-fetch');
const Obj = require('./obj.js');

const MODELS = require('../modules/models.js');
const MONGO = require('../modules/mongo.js');

let groupsBase, studentSchedule, teachersBase, teacherSchedule, roomsSchedule;

MONGO.openConnection().then(async () => {
  groupsBase = await readMongo('groupsBase');
  studentSchedule = new Obj(await readMongo('studentSchedule'));
  teachersBase = await readMongo('teachersBase');
  teacherSchedule = new Obj(await readMongo('teachersSchedule'));
  roomsSchedule = await readMongo('roomsSchedule');
});

function findMiliSecondsDate() {
  const date = new Date();
  date.setTime(date.getTime() + timezoneOffset);
  const day = date.getDay() - 1;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  /*
  below you can see numbers that are in each period:
  day: 86400,
  hour: 3600,
  minutes: 60
  */
  const secondsPassed = day * 86400 + hours * 3600 + minutes * 60 + seconds;
  return secondsPassed * 1000;
}

async function sendRequestAsync(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function readMongo(baseName) {
  const data = await MONGO.readFromMongo({ baseName }, MODELS.generalModel);
  if (data)
    return data.content || {};
  else {
    MONGO.writeToMongo({ baseName, content: {} }, MODELS.generalModel);
    return {};
  }
}

function parseCommandText(str) {
  const strArr = str.toLowerCase().split(' ');
  strArr.shift();
  return strArr;
}

function parseGroupName(str) {
  const arr = str.split('');
  const parsedNameArr = [];
  //adding - for third position in group name
  parsedNameArr[2] = '-';
  for (const index in arr) {
    const indInt = parseInt(index, 10);
    const value = arr[index];
    const changer = letterChanger[value];
    const newValue = changer || value;
    if (parsedNameArr[indInt]) parsedNameArr[indInt + 1] = newValue;
    else parsedNameArr[indInt] = newValue;
  }
  return parsedNameArr.join('');
}

function stringScheduleForDay(lessons) {
  if (lessons) {
    const key = Object.keys(lessons)[0];
    const lesson = lessons[key];
    const dayNumbInArr = lesson.dayNumber - 1;
    const day = days[dayNumbInArr];
    const str = [`*${day}*`];
    for (const key in lessons) {
      const lesson = lessons[key];
      str.push(`${lesson.lessonNumber}. ${lesson.lessonName} ` +
        `${lesson.lessonType} ${lesson.lessonRoom}`);
    }
    return str.join('\n');
  }
}

function stringScheduleForWeek(weekSchedule) {
  const schedule = [];
  for (const dayNumber in weekSchedule) {
    const daySchedule = weekSchedule[dayNumber];
    const strDaySchedule = stringScheduleForDay(daySchedule);
    if (strDaySchedule)
      schedule.push(strDaySchedule);
  }
  return  schedule.join('\n\n');
}

function findLessonNumb(date) {
  //60 for minutes in hour
  const time = date.getHours() * 60 + date.getMinutes();
  for (const lessonNumb in scheduleLessons) {
    const lesson = scheduleLessons[lessonNumb];
    if (lesson.condition(time))
      return parseInt(lessonNumb, 10) + 1;
  }
}

function convergeTeacherName(enteredArr, nameArr) {
  let converged = true;
  for (const index in enteredArr) {
    const surname = parseInt(index, 10) === 0;
    const nameVal = nameArr[index], enteredVal = enteredArr[index];
    const sameSurnames = nameVal.localeCompare(enteredVal) !== 0;
    const itemExists = nameVal && enteredVal;
    const sameNames = nameVal[0] !== enteredVal[0];
    if (surname && sameSurnames)
      converged = false;
    else if (converged && itemExists && sameNames)
      converged = false;
  }
  return converged;
}

function findCongruencesTeacher(enteredArr) {
  const congruences = [];
  for (const ID in teachersBase) {
    const nameArr = teachersBase[ID].toLowerCase().split(' ');
    const converged = convergeTeacherName(enteredArr, nameArr);
    if (converged) congruences.push({ ID, name: nameArr.join(' ') });
  }
  return congruences;
}

function findCongruencesGroup(str) {
  const congruences = [];
  for (const ID in groupsBase) {
    const nameArr = groupsBase[ID].split(' ');
    if (str.localeCompare(nameArr[0]) === 0)
      congruences.push({ ID, name: nameArr.join(' ') });
  }
  return congruences;
}

function findLessonByNumb(lessons, numb) {
  for (const lesson of lessons) {
    if (parseInt(lesson.lessonNumber, 10) === numb)
      return lesson;
  }
}

function replyDay(ctx, time, ID, base) {
  const { week, day } = time;
  if (ID) {
    const schedule = base.getMany(ID, week, day).value();
    const scheduleDay = stringScheduleForDay(schedule);
    if (scheduleDay)
      ctx.reply(scheduleDay, { parse_mode: 'Markdown' });
    else ctx.reply('You don\'t have any lessons');
  } else ctx.reply('Your ID was not set!');
}

function replyWeek(ctx, week, ID, base) {
  if (ID) {
    const weekSchedule = base.getMany(ID, week).value();
    const schedule = stringScheduleForWeek(weekSchedule);
    if (schedule)
      ctx.reply(schedule, { parse_mode: 'Markdown' });
    else ctx.reply('You don\'t have lessons');
  } else ctx.reply('Your ID was not set!');
}

function replyOneDayStudent(ctx, week, day, groupID) {
  const time = { week, day };
  replyDay(ctx, time, groupID, studentSchedule);
}

function replyWeekStudent(ctx, week, groupID) {
  replyWeek(ctx, week, groupID, studentSchedule);
}

function replyOneDayTeacher(ctx, week, day, teacherID) {
  const time = { week, day };
  replyDay(ctx, time, teacherID, teacherSchedule);
}

function replyWeekTeacher(ctx, week, teacherID) {
  replyWeek(ctx, week, teacherID, teacherSchedule);
}

function findTeacherName(ctx, week, groupID) {
  const date = new Date();
  date.setTime(date.getTime() + timezoneOffset);
  const day = date.getDay();
  const schedule = studentSchedule.getMany(groupID, week, day).value();
  const lessonNumb = findLessonNumb(date);
  const lesson = findLessonByNumb(schedule, lessonNumb);
  const teacher = lesson.teachers;
  return teacher;
}

function findBusyRooms(block, week) {
  const date = new Date();
  date.setTime(date.getTime() + timezoneOffset);
  const day = date.getDay();
  const lessonNumb = findLessonNumb(date);
  const rooms = roomsSchedule[block][week][day][lessonNumb];
  return rooms;
}

module.exports = {
  readMongo,
  sendRequestAsync,
  findMiliSecondsDate,
  parseGroupName,
  parseCommandText,
  findCongruencesGroup,
  findCongruencesTeacher,
  replyOneDayStudent,
  replyWeekStudent,
  replyOneDayTeacher,
  replyWeekTeacher,
  findTeacherName,
  findBusyRooms
};
