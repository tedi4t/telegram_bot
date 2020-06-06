'use strict';

const fetch = require('node-fetch');

const MODELS = require('./models');
const MONGO = require('./mongo');

const minID = 5000, maxID = 8000;
const teacherMinID = 0, teacherMaxID = 6000;
// above you can see start and end ID for requests
const { amountOfBlocks } = require('../modules/constantas.js');

async function sendRequestAsync(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

//lessonsBase

async function generateBase(minID, maxID, generateURL, fields, checkObj) {
  const base = {};
  for (let ID = minID; ID <= maxID; ID++) {
    const lessons = (await sendRequestAsync(generateURL(String(ID)))).data;
    const group = [];
    if (lessons) {
      for (const lesson of lessons) {
        const lessonSorted = {};
        for (const field in fields) {
          const apiKey = fields[field]; // field's key in API
          if (Array.isArray(apiKey))
            lessonSorted[field] = apiKey.reduce((val, key) =>
              (val ? (typeof key === 'function' ?
                key(val) : val[key]) : undefined), lesson);
          else lessonSorted[field] = lesson[apiKey];
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

async function generateLessonBaseIDAsync(minID, maxID, checkObj) {
  const interestingFields = {
    week: 'lesson_week', dayNumber: 'day_number', lessonName: 'lesson_name',
    lessonNumber: 'lesson_number', lessonType: 'lesson_type',
    lessonRoom: 'lesson_room', roomId: ['rooms', '0', 'room_id'],
    teachers: ['teachers', arr => arr.map(item => item.teacher_name).join(', ')],
  };  //list of field's names in our base(key) and analog in API(value)
  return await generateBase(minID, maxID, generateGroupLessonsURl,
    interestingFields, checkObj);
}

//groupsBase

function generateGroupURl(groupID) {
  return `https://api.rozklad.org.ua/v2/groups/${groupID}`;
}

async function generateGroupBaseIDAsync(minID, maxID) {
  const groups = {};
  for (let groupID = minID; groupID <= maxID; groupID++) {
    const groupUrl = generateGroupURl(String(groupID));
    const group = (await sendRequestAsync(groupUrl)).data;
    if (group) {
      const groupName = group.group_full_name;
      if (groupName)
        groups[groupID] = groupName;
    }
  }
  return groups;
}

//students Schedule

function sortByWeek(lessons) {
  const sorted = [];
  for (const lesson of lessons) {
    if (sorted[parseInt(lesson.week, 10)])
      sorted[parseInt(lesson.week, 10)].push(lesson);
    else sorted[parseInt(lesson.week, 10)] = [lesson];
  }
  return sorted;
}

function sortByDay(lessons) {
  const byDay = [];
  for (const lesson of lessons) {
    const dayNumber = lesson.dayNumber;
    if (byDay[dayNumber])
      byDay[dayNumber].push(lesson);
    else byDay[dayNumber] = [lesson];
  }
  return byDay;
}

const sortByLessonNumb = lessons =>
  lessons.sort((a, b) => a.lessonNumber - b.lessonNumber);

const sortSchedule = lessons =>
  sortByWeek(lessons)
    .map(week => sortByDay(week)
      .map(day => sortByLessonNumb(day)));

function generateSchedule(lessons) {
  const schedule = {};
  Object.keys(lessons).map(ID => schedule[ID] = sortSchedule(lessons[ID]));
  return schedule;
}

//teachers and teachers schedule

function generateTeacherLessonsURl(teacherID) {
  return `https://api.rozklad.org.ua/v2/teachers/${teacherID}/lessons`;
}

async function generateTeacherLessonBaseIDAsync(minID, maxID, checkObj) {
  const interestingFields = {
    week: 'lesson_week', dayNumber: 'day_number', lessonName: 'lesson_name',
    lessonNumber: 'lesson_number', lessonType: 'lesson_type',
    lessonRoom: 'lesson_room', roomId: ['rooms', '0', 'room_id'],
    groups: ['groups', arr => arr.map(item => item.group_full_name).join(', ')]
  };  //list of field's names in our base(key) and analog in API(value)
  return generateBase(minID, maxID, generateTeacherLessonsURl,
    interestingFields, checkObj);
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

async function generateTeachersBaseIDAsync(minID, maxID) {
  const teachers = {};
  for (let teacherID = minID; teacherID <= maxID; teacherID++) {
    const teacherURL = generateTeacherURl(String(teacherID));
    const teacher = (await sendRequestAsync(teacherURL)).data;
    if (teacher) {
      const teacherName = teacher.teacher_name;
      if (teacherName)
        teachers[teacherID] = parseTeacherName(teacherName);
    }
  }
  return teachers;
}

//rooms schedule

function parseRoom(room) {
  const roomArr = room.split('-');
  const block = parseInt(roomArr[roomArr.length - 1], 10);
  const audience = roomArr.slice(0, roomArr.length - 1).join('-');
  return { block, audience, fullName: room };
}

function assignArrForWeekRooms() {
  const weeks = 2;
  const days = 7;
  const lessonsPerDay = 4;
  const Arr = Array.from({ length: weeks },
    (() => Array.from({ length: days },
      (() => Array.from({ length: lessonsPerDay }, (() => []))))));
  return Arr;
}

function createArrOfBusyRooms(lessonsForAllGroups) {
  const busyRooms = {}; //block -> week -> day -> lesson number
  for (const groupID in lessonsForAllGroups) {
    const groupLessons = lessonsForAllGroups[groupID];
    for (const lesson of groupLessons) {
      const week = lesson.week, dayNumber = lesson.dayNumber,
        lessonNumber = lesson.lessonNumber,
        rooms = lesson.lesson_room.split(',');
      rooms.forEach(room => {
        const parsedRoom = parseRoom(room);
        const block = parsedRoom.block;
        if (block && parsedRoom.fullName && block <= amountOfBlocks) {
          busyRooms[block] = busyRooms[block] || assignArrForWeekRooms();
          let busyRoomsLesson = busyRooms[block][week][dayNumber][lessonNumber];
          if (!busyRoomsLesson)
            busyRoomsLesson = [parsedRoom.fullName];
          else busyRoomsLesson.push(parsedRoom.fullName);
        }
      });
    }
  }
  return busyRooms;
}

function sortArrOfBusyRooms(busyRooms) {
  const sortedArr = {};
  for (const block in busyRooms) {
    sortedArr[block] = [];
    const sortedArrBlock = sortedArr[block];
    const blockRooms = busyRooms[block];
    for (const week in blockRooms) {
      sortedArrBlock[week] = [];
      const sortedArrWeek = sortedArrBlock[week];
      const weekRooms = blockRooms[week];
      for (const day in weekRooms) {
        sortedArrWeek[day] = [];
        const sortedArrDay = sortedArrWeek[day];
        const dayRooms = weekRooms[day];
        for (const lesson in dayRooms) {
          const lessonRooms = dayRooms[lesson]
            .sort((a, b) => a.localeCompare(b));
          sortedArrDay[lesson] = lessonRooms;
        }
      }
    }
  }
  return sortedArr;
}

function makeRoomsSchedule(lessonsGroups) {
  return sortArrOfBusyRooms(createArrOfBusyRooms(lessonsGroups));
}

function getAllData() {
  generateGroupBaseIDAsync(minID, maxID).then(groupsBase => {
    const allIDs = Object.keys(groupsBase);
    const minID = allIDs[0], maxID = allIDs[allIDs.length - 1];
    generateLessonBaseIDAsync(minID, maxID, groupsBase).then(lessonsBase => {
      MONGO.writeToMongo({
        baseName: 'studentSchedule',
        content: generateSchedule(lessonsBase)
      }, MODELS.generalModel);
      MONGO.writeToMongo({
        baseName: 'roomsSchedule',
        content: makeRoomsSchedule(lessonsBase)
      }, MODELS.generalModel);
      MONGO.writeToMongo({
        baseName: 'groupsBase', content:
        groupsBase
      }, MODELS.generalModel);
    });
  });
  generateTeachersBaseIDAsync(teacherMinID, teacherMaxID).then(teachersBase => {
    const allIDs = Object.keys(teachersBase);
    const minID = allIDs[0], maxID = allIDs[allIDs.length - 1];
    generateTeacherLessonBaseIDAsync(minID, maxID, teachersBase)
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
  .then(() => getAllData());
