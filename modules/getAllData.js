'use strict';

const fetch = require('node-fetch');

const MODELS = require('./models');
const MONGO = require('./mongo');

const Obj = require('./obj.js');

const { studentBordersID, teacherBordersID } = require('constantas.js');

// above you can see start and end ID for requests
const { amountOfBlocks } = require('../modules/constantas.js');

async function sendRequestAsync(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

//lessonsBase

function projection(obj, apiKey) {
  if (Array.isArray(apiKey))
    return apiKey.reduce((val, key) =>
      (val ? (typeof key === 'function' ?
        key(val) : val[key]) : undefined), obj);
  return obj[apiKey];
}

async function generateBase(borderID, funcGenerateURL, fields, checkObj) {
  const { minID, maxID } = borderID;
  const base = {};
  for (let ID = minID; ID <= maxID; ID++) {
    const url = funcGenerateURL(ID);
    const lessons = (await sendRequestAsync(url)).data;
    const group = [];
    if (lessons) {
      for (const lesson of lessons) {
        const lessonSorted = {};
        for (const field in fields) {
          const apiKey = fields[field]; // field's key in API
          lessonSorted[field] = projection(lesson, apiKey);
        }
        group.push(lessonSorted);
      }
      base[ID] = group;
    } else {
      delete checkObj[ID];
    }
  }
  return base;
}

function generateGroupLessonsURl(groupID) {
  return `https://api.rozklad.org.ua/v2/groups/${groupID}/lessons`;
}

async function generateLessonBaseIDAsync(borderID, checkObj) {
  const fields = {
    week: 'lesson_week', dayNumber: 'day_number', lessonName: 'lesson_name',
    lessonNumber: 'lesson_number', lessonType: 'lesson_type',
    lessonRoom: 'lesson_room', roomId: ['rooms', '0', 'room_id'],
    teachers: ['teachers', arr => arr.map(item => item.teacher_name).join(', ')],
  };  //list of field's names in our base(key) and analog in API(value)
  const base = await generateBase(
    borderID,
    generateGroupLessonsURl,
    fields,
    checkObj);
  return base;
}

//groupsBase

function generateGroupURl(groupID) {
  return `https://api.rozklad.org.ua/v2/groups/${groupID}`;
}

async function generateGroupBaseIDAsync(borderID) {
  const { minID, maxID } = borderID;
  const groups = {};
  for (let ID = minID; ID <= maxID; ID++) {
    const groupUrl = generateGroupURl(ID);
    const group = (await sendRequestAsync(groupUrl)).data;
    if (group) {
      const groupName = group.group_full_name;
      groups[ID] = groupName;
    }
  }
  return groups;
}

//students Schedule

function sortByWeek(lessons) {
  const sorted = {};
  for (const lesson of lessons) {
    const key = parseInt(lesson.week, 10);
    const item = sorted[key];
    if (item)
      item.push(lesson);
    else sorted[parseInt(lesson.week, 10)] = [lesson];
  }
  return sorted;
}

function sortByDay(lessons) {
  const byDay = {};
  for (const lesson of lessons) {
    const dayNumber = lesson.dayNumber, lessonNumber = lesson.lessonNumber;
    const dayLessons = byDay[dayNumber];
    if (dayLessons) {
      dayLessons[lessonNumber] = lesson;
    } else {
      byDay[dayNumber] = {};
      byDay[dayNumber][lessonNumber] = lesson;
    }
  }
  return byDay;
}

function sortSchedule(lessons) {
  const sortedWeek = sortByWeek(lessons);
  const weekKeys = Object.keys(sortedWeek);
  const sorted = weekKeys.reduce((hash, week) =>
    (hash[week] = sortByDay(sortedWeek[week]), hash), {});
  return sorted;
}

function generateSchedule(lessons) {
  const schedule = {};
  Object.keys(lessons).forEach(ID => schedule[ID] = sortSchedule(lessons[ID]));
  return schedule;
}

//teachers and teachers schedule

function generateTeacherLessonsURl(teacherID) {
  return `https://api.rozklad.org.ua/v2/teachers/${teacherID}/lessons`;
}

async function generateTeacherLessonBaseIDAsync(borderID, checkObj) {
  const fields = {
    week: 'lesson_week', dayNumber: 'day_number', lessonName: 'lesson_name',
    lessonNumber: 'lesson_number', lessonType: 'lesson_type',
    lessonRoom: 'lesson_room', roomId: ['rooms', '0', 'room_id'],
    groups: ['groups', arr => arr.map(item => item.group_full_name).join(', ')]
  };  //list of field's names in our base(key) and analog in API(value)
  const base = generateBase(
    borderID,
    generateTeacherLessonsURl,
    fields,
    checkObj);
  return base;
}

//teachersBase

function parseTeacherName(teacherName) {
  const nameArr = teacherName.split(' ');
  const len = nameArr.length;
  // len - 3 because it's usually written 'something surname name paternal name'
  const start = Math.max(len - 3, 0), end = len;
  const parsedName = nameArr.slice(start, end);
  return parsedName.join(' ');
}

function generateTeacherURl(teacherID) {
  return `https://api.rozklad.org.ua/v2/teachers/${teacherID}`;
}

async function generateTeachersBaseIDAsync(borderID) {
  const { minID, maxID } = borderID;
  const teachers = {};
  for (let ID = minID; ID <= maxID; ID++) {
    const teacherURL = generateTeacherURl(ID);
    const teacher = (await sendRequestAsync(teacherURL)).data;
    if (teacher) {
      const teacherName = teacher.teacher_name;
      if (teacherName)
        teachers[ID] = parseTeacherName(teacherName);
    }
  }
  return teachers;
}

//rooms schedule

function parseRoom(room) {
  const roomArr = room.split('-');
  const lastInd = roomArr.length - 1;
  const block = parseInt(roomArr[lastInd], 10);
  const audience = roomArr.slice(0, lastInd).join('-');
  return { block, audience, fullName: room };
}

function makeRoomsSchedule(lessonsForAllGroups) {
  const busyRooms = {}; //block -> week -> day -> lesson number
  for (const groupID in lessonsForAllGroups) {
    const groupLessons = lessonsForAllGroups[groupID];
    for (const lesson of groupLessons) {
      const week = lesson.week, dayNumber = lesson.dayNumber,
        lessonNumber = lesson.lessonNumber,
        rooms = lesson.lessonRoom.split(',');
      rooms.forEach(room => {
        const parsedRoom = parseRoom(room);
        const block = parsedRoom.block;
        if (block && block <= amountOfBlocks) {
          const busyRoomsLesson = new Obj(busyRooms)
            .addManyObj(block, week, dayNumber).addArr(lessonNumber).value();
          busyRoomsLesson.push(parsedRoom.fullName);
        }
      });
    }
  }
  return busyRooms;
}

function getAllData(studentBordersID, teacherBordersID) {
  generateGroupBaseIDAsync(studentBordersID).then(groupsBase => {
    const allIDs = Object.keys(groupsBase);
    const minID = allIDs[0], maxID = allIDs[allIDs.length - 1];
    const borderID = { minID, maxID };
    generateLessonBaseIDAsync(borderID, groupsBase).then(lessonsBase => {
      MONGO.writeToMongo({
        baseName: 'studentSchedule',
        content: generateSchedule(lessonsBase)
      }, MODELS.generalModel);
      MONGO.writeToMongo({
        baseName: 'roomsSchedule',
        content: makeRoomsSchedule(lessonsBase),
      }, MODELS.generalModel);
      MONGO.writeToMongo({
        baseName: 'groupsBase',
        content: groupsBase
      }, MODELS.generalModel);
    });
  });
  generateTeachersBaseIDAsync(teacherBordersID).then(teachersBase => {
    const allIDs = Object.keys(teachersBase);
    const minID = allIDs[0], maxID = allIDs[allIDs.length - 1];
    const borderID = { minID, maxID };
    generateTeacherLessonBaseIDAsync(borderID, teachersBase)
      .then(teacherLessonBase => {
        MONGO.writeToMongo({
          baseName: 'teachersBase',
          content: teachersBase
        }, MODELS.generalModel)
          .then(() => {
            MONGO.writeToMongo({
              baseName: 'teachersSchedule',
              content: generateSchedule(teacherLessonBase)
            }, MODELS.generalModel, true);
          });
      });
  });
}

MONGO.openConnection()
  .then(() => getAllData(studentBordersID, teacherBordersID));
