'use strict';

const { letterChanger, days, scheduleLessons,
  timezoneOffset } = require('./constantas.js');
const fetch = require('node-fetch');

const MODELS = require('../modules/models.js');
const MONGO = require('../modules/mongo.js');

let groupsBase, studentSchedule, teachersBase, teacherSchedule, roomsSchedule;

MONGO.openConnection().then(async () => {
  groupsBase = await readMongo('groupsBase');
  studentSchedule = await readMongo('studentSchedule');
  teachersBase = await readMongo('teachersBase');
  teacherSchedule = await readMongo('teachersSchedule');
  roomsSchedule = await readMongo('roomsSchedule');
});

function findSecondsDate() {
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
  return (day * 86400 + hours * 3600 + minutes * 60 + seconds) * 1000;
}

async function sendRequestAsync(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function readMongo(baseName) {
  const data = (await MONGO.readFromMongo({ baseName }, MODELS.generalModel));
  if (data)
    return data.content;
  else {
    MONGO.writeToMongo({ baseName, content: {} }, MODELS.generalModel);
    return new Object();
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
  parsedNameArr[2] = '-';
  for (const index in arr) {
    const indInt = parseInt(index, 10);
    const value = arr[index];
    const changer = letterChanger[value];
    if (parsedNameArr[indInt]) {
      parsedNameArr[indInt + 1] = changer || value;
    } else {
      parsedNameArr[indInt] = changer || value;
    }
  }
  return parsedNameArr.join('');
}

function stringScheduleForDay(lessons) {
  if (lessons) {
    let index = 0;
    while (!lessons[index])
      index++;
    const str = [`*${days[lessons[index].dayNumber]}*`];
    for (const lesson of lessons) {
      if (lesson)
        str.push(`${lesson.lessonNumber}. ${lesson.lessonName} ` +
          `${lesson.lessonType} ${lesson.lessonRoom}`);
    }
    return str.join('\n');
  }
}

function findLessonNumb(date) {
  const time = date.getHours() * 60 + date.getMinutes();
  //60 for minutes in hour
  for (const lessonNumb in scheduleLessons) {
    const lesson = scheduleLessons[lessonNumb];
    if (lesson.condition(time))
      return parseInt(lessonNumb, 10) + 1;
  }
}

function convergeTeacherName(enteredArr, nameArr) {
  let converged = true;
  for (const index in enteredArr) {
    if (parseInt(index, 10) === 0 &&
      nameArr[index].localeCompare(enteredArr[index]) !== 0) {
        converged = false;
    } else if (converged && nameArr[index] && enteredArr[index] &&
      nameArr[index][0] !== enteredArr[index][0]) {
      converged = false;
    }
  }
  return converged;
}

function findCongruencesTeacher(enteredArr) {
  const congruences = [];
  for (const id in teachersBase) {
    const nameArr = teachersBase[id].toLowerCase().split(' ');
    const converged = convergeTeacherName(enteredArr, nameArr);
    if (converged) congruences.push({ id, name: nameArr.join(' ') });
  }
  return congruences;
}

function findCongruencesGroup(str) {
  const congruences = [];
  for (const id in groupsBase) {
    const nameArr = groupsBase[id].split(' ');
    if (str.localeCompare(nameArr[0]) === 0)
      congruences.push({ id, name: nameArr.join(' ') });
  }
  return congruences;
}

function findLessonByNumb(lessons, numb) {
  for (const lesson of lessons) {
    if (parseInt(lesson.lessonNumber, 10) === numb)
      return lesson;
  }
}

function replyOneDayStudent(ctx, week, day, groupID) {
  if (groupID) {
    const schedule = studentSchedule[groupID][week][day];
    const scheduleDay = stringScheduleForDay(schedule);
    if (scheduleDay)
      ctx.reply(scheduleDay, { parse_mode: 'Markdown' });
    else ctx.reply('You don\'t have any lessons');
  } else ctx.reply('Your group ID was not set!');
}

function replyWeekStudent(ctx, week, groupID) {
  if (groupID) {
    const weekSchedule = [];
    const dayInWeek = 7;
    for (let day = 1; day <= dayInWeek; day++) {
      const schedule = studentSchedule[groupID][week][day];
      const daySchedule = stringScheduleForDay(schedule);
      if (daySchedule)
        weekSchedule.push(daySchedule);
    }
    const schedule = weekSchedule.join('\n\n');
    if (schedule)
      ctx.reply(weekSchedule.join('\n\n'), { parse_mode: 'Markdown' });
    else ctx.reply('You don\'t have lessons');
  } else ctx.reply('Your group ID was not set!');
}

function replyOneDayTeacher(ctx, week, day, teacherID) {
  if (teacherID) {
    if (!teacherSchedule[teacherID])
      ctx.reply('There aren\'t any lessons by this ID');
    else {
      const schedule = teacherSchedule[teacherID][week][day];
      const scheduleDay = stringScheduleForDay(schedule);
      if (scheduleDay)
        ctx.reply(scheduleDay, { parse_mode: 'Markdown' });
      else ctx.reply('You don\'t have any lessons');
    }
  } else ctx.reply('Your teacher ID was not set!');
}

function replyWeekTeacher(ctx, week, teacherID) {
  if (teacherID) {
    const weekSchedule = [];
    const dayInWeek = 7;
    for (let day = 1; day <= dayInWeek; day++) {
      const schedule = teacherSchedule[teacherID][week][day];
      const daySchedule = stringScheduleForDay(schedule);
      if (daySchedule)
        weekSchedule.push(daySchedule);
    }
    const schedule = weekSchedule.join('\n\n');
    ctx.reply(schedule, { parse_mode: 'Markdown' });
  } else ctx.reply('Your teacher ID was not set!');
}

function findTeacherName(ctx, week, groupID) {
  const date = new Date();
  date.setTime(date.getTime() + timezoneOffset);
  const day = date.getDay();
  const schedule = studentSchedule[groupID][week][day];
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
  findSecondsDate,
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
