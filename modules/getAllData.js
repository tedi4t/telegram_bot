'use strict';

const fetch = require('node-fetch');

const MODELS = require('./models');
const MONGO = require('./mongo');

const minID = 5000, maxID = 8000;
const teacherMinID = 0, teacherMaxID = 6000;
const amountOfBlocks = 37;

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
        const lesson_sorted = {};
        for (const field in fields) {
          const API_key = fields[field]; // field's key in API
          if (Array.isArray(API_key))
            lesson_sorted[field] = API_key.reduce((val, key) =>
              (val ? (typeof key === 'function' ?
                key(val) : val[key]) : undefined), lesson);
          else lesson_sorted[field] = lesson[API_key];
        }
        group.push(lesson_sorted);
      }
      base[ID] = group;
    } else delete checkObj[ID];
  }
  return base;
}

function generateGroupLessonsURl(groupID) {
  return `https://api.rozklad.org.ua/v2/groups/${groupID}/lessons`;
}

async function generateLessonBaseIDAsync(minID, maxID, checkObj) {
  const interestingFields = {
    week: 'lesson_week', day_number: 'day_number', lesson_name: 'lesson_name',
    lesson_number: 'lesson_number', lesson_type: 'lesson_type',
    lesson_room: 'lesson_room', room_id: ['rooms', '0', 'room_id'],
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
      const group_name = group.group_full_name;
      if (group_name)
        groups[groupID] = group_name;
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
    const day_number = lesson.day_number;
    if (byDay[day_number])
      byDay[day_number].push(lesson);
    else byDay[day_number] = [lesson];
  }
  return byDay;
}

const sortByLessonNumb = lessons =>
  lessons.sort((a, b) => a.lesson_number - b.lesson_number);

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
    week: 'lesson_week', day_number: 'day_number', lesson_name: 'lesson_name',
    lesson_number: 'lesson_number', lesson_type: 'lesson_type',
    lesson_room: 'lesson_room', room_id: ['rooms', '0', 'room_id'],
    groups: ['groups', arr => arr.map(item => item.group_full_name).join(', ')]
  };  //list of field's names in our base(key) and analog in API(value)
  return generateBase(minID, maxID, generateTeacherLessonsURl,
    interestingFields, checkObj);
}

//teachersBase

function parseTeacherName(teacher_name) {
  const nameArr = teacher_name.split(' ');
  const len = nameArr.length;
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
      const teacher_name = teacher.teacher_name;
      if (teacher_name)
        teachers[teacherID] = parseTeacherName(teacher_name);
    }
  }
  return teachers;
}

//rooms schedule

function parseRoom(room) {
  const roomArr = room.split('-');
  const block = parseInt(roomArr[roomArr.length - 1], 10);
  const audience = roomArr.slice(0, roomArr.length - 1).join('-');
  return { block, audience, full_name: room };
}

function createArrOfBusyRooms(lessonsForAllGroups) {
  const busyRooms = {}; //block -> week -> day -> lesson number
  for (const groupID in lessonsForAllGroups) {
    const groupLessons = lessonsForAllGroups[groupID];
    for (const lesson of groupLessons) {
      const week = lesson.week, day_number = lesson.day_number,
        lesson_number = lesson.lesson_number,
        rooms = lesson.lesson_room.split(',');
      rooms.map(room => {
        const parsedRoom = parseRoom(room);
        const block = parsedRoom.block;
        if (block && parsedRoom.full_name && block <= amountOfBlocks) {
          if (!busyRooms[block]) busyRooms[block] = [];
          if (!busyRooms[block][week]) busyRooms[block][week] = [];
          if (!busyRooms[block][week][day_number])
            busyRooms[block][week][day_number] = [];
          if (!busyRooms[block][week][day_number][lesson_number])
            busyRooms[block][week][day_number][lesson_number] =
              [parsedRoom.full_name];
          else busyRooms[block][week][day_number][lesson_number]
            .push(parsedRoom.full_name);
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
    const blockRooms = busyRooms[block];
    for (const week in blockRooms) {
      sortedArr[block][week] = [];
      const weekRooms = busyRooms[block][week];
      for (const day in weekRooms) {
        sortedArr[block][week][day] = [];
        const dayRooms = busyRooms[block][week][day];
        for (const lesson in dayRooms) {
          const lessonRooms = busyRooms[block][week][day][lesson]
            .sort((a, b) => a.localeCompare(b));
          sortedArr[block][week][day][lesson] = lessonRooms;
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
