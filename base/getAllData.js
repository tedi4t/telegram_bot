'use strict';

/*

0-10000 - 1304 groups;
  5005 - 7315

 */

const fetch = require("node-fetch");

const letterChanger = require('../constantas.js');
const fs = require("fs");

const minID = 3000, maxID = 10000;
const amountOfBlocks = 37;

async function sendRequestAsync(url) {
  let response = await fetch(url);
  let data = await response.json();
  return data;
}

// function parseUkrToEng(str) {
//   const arr = str.split('').filter(item => item[0].charCodeAt() !== 32);
//   for (const index inarr) {
//     const item = arr[index];
//     const changer = letterChanger[item];
//     if (changer)
//       arr[index] = changer;
//   }
//   return arr.join('');
// }


//lessonsBase


function generateGroupLessonsURl(groupID) {
  return `https://api.rozklad.org.ua/v2/groups/${groupID}/lessons`
}

async function generateLessonBaseIDAsync(minID, maxID){
  const base = {};
  for (let groupID = minID; groupID <= maxID; groupID++) {
    const lessons = (await sendRequestAsync(generateGroupLessonsURl(String(groupID)))).data;
    const group = [];
    const interestingFields = {
      week: 'lesson_week', day_number: 'day_number', lesson_name: 'lesson_name',
      lesson_number: 'lesson_number', lesson_type: 'lesson_type', lesson_room: 'lesson_room',
      room_id: ['rooms', '0', 'room_id'], teachers: 'teachers',
    };  //list of field's names in our base(key) and analog in API(value)
    if (lessons) {
      for (const lesson of lessons) {
        const lesson_sorted = {};
        for (const field in interestingFields) {
          const API_key = interestingFields[field]; // field's key in API
          lesson_sorted[field] = Array.isArray(API_key) ?
            API_key.reduce((val, key) => val ? val[key] : undefined, lesson) : lesson[API_key];
        }
        group.push(lesson_sorted);
      }
      base[groupID] = group;
    }
  }
  return base;
}


//groupsBase


function generateGroupURl(groupID) {
  return `https://api.rozklad.org.ua/v2/groups/${groupID}`
}

async function generateGroupBaseIDAsync(){
  const groups = {};
  for (let groupID = minID; groupID <= maxID; groupID++) {
    const group = (await sendRequestAsync(generateGroupURl(String(groupID)))).data;
    if (group) {
      const group_name = group.group_full_name;
      if (group_name)
        groups [groupID] = group_name;
    }
  }
  return groups;
}

function generateGroupsBase() {
  generateGroupBaseIDAsync().then(base => fs.writeFileSync("groupsBase.txt", JSON.stringify(base)));
}


//students Schedule


function sortByWeek(lessons) {
  const sorted = [];
  for (const lesson of lessons) {
    sorted[parseInt(lesson.week)] ? sorted[parseInt(lesson.week)].push(lesson) : sorted[parseInt(lesson.week)] = [lesson];
  }
  return sorted;
}

function sortByDay(lessons) {
  const byDay = [];
  for (const lesson of lessons) {
    const day_number = lesson.day_number;
    byDay[day_number] ? byDay[day_number].push(lesson) : byDay[day_number] = [lesson];
  }
  return byDay;
}

const sortByLessonNumb = (lessons) =>
  lessons.sort((a, b) => a.lesson_number - b.lesson_number);

const sortSchedule = (lessons) =>
  sortByWeek(lessons).map(week => sortByDay(week).map(day => sortByLessonNumb(day)));

function generateStudentSchedule(lessonsGroups) {
  const schedule = {};
  Object.keys(lessonsGroups).map(groupID => schedule[groupID] = sortSchedule(lessonsGroups[groupID]));
  return schedule;
}


//teachers and teachers schedule


function parseTeacherName(teacher_name) {
  const nameArr = teacher_name.split(' ');
  const len = nameArr.length;
  const start = Math.max(len - 3, 0), end = len;
  const parsedName = nameArr.slice(start, end);
  return parsedName.join(' ');
}

function generateTeachersSchedule(lessonGroups, groups) {
  const schedule = {}, teachersBase = {};
  for (const groupID in lessonGroups) {
    const group = groups[groupID];
    const groupLessons = lessonGroups[groupID];
    for (const lesson of groupLessons) {
      const week = lesson.week, day_number = lesson.day_number, lesson_number = lesson.lesson_number,
        teachers = lesson.teachers;
      for (const teacher of teachers) {
        if (teacher) {
          const teacher_name = teacher.teacher_name, teacher_id = teacher.teacher_id;
          lesson.group_name = group;
          if (!schedule[teacher_id]) schedule[teacher_id] = [];
          if (!schedule[teacher_id][week]) schedule[teacher_id][week] = [];
          if (!schedule[teacher_id][week][day_number]) schedule[teacher_id][week][day_number] = [];
          if (schedule[teacher_id][week][day_number][lesson_number]) {
            const currentGroupName = schedule[teacher_id][week][day_number][lesson_number].group_name;
            schedule[teacher_id][week][day_number][lesson_number].group_name = `${currentGroupName} ${group}`;
          } else schedule[teacher_id][week][day_number][lesson_number] = lesson;
          if (!teachersBase[teacher_id]) teachersBase[teacher_id] = parseTeacherName(teacher_name);
        }
      }
    }
  }
  return {schedule, teachers: teachersBase};
}


//rooms schedule


function parseRoom(room) {
  const roomArr = room.split('-');
  const block = parseInt(roomArr[roomArr.length - 1]);
  const audience = roomArr.slice(0, roomArr.length - 1).join('-');
  return {block, audience, full_name: room};
}

function createArrOfBusyRooms(lessonsForAllGroups) {
  const busyRooms = {}; //block -> week -> day -> lesson number
  for (const groupID in lessonsForAllGroups) {
    const groupLessons = lessonsForAllGroups[groupID];
    for (const lesson of groupLessons) {
      function addRoom (room) {
        const parsedRoom = parseRoom(room);
        const block = parsedRoom.block;
        if (block && parsedRoom.full_name && block <= amountOfBlocks) {
          if (!busyRooms[block]) busyRooms[block] = [];
          if (!busyRooms[block][week]) busyRooms[block][week] = [];
          if (!busyRooms[block][week][day_number]) busyRooms[block][week][day_number] = [];
          if (!busyRooms[block][week][day_number][lesson_number]) busyRooms[block][week][day_number][lesson_number] = [parsedRoom.full_name];
          else busyRooms[block][week][day_number][lesson_number].push(parsedRoom.full_name);
        }
      }
      const week = lesson.week, day_number = lesson.day_number, lesson_number = lesson.lesson_number, rooms = lesson.lesson_room.split(',');
      rooms.map(room => addRoom(room));
    }
  }
  return busyRooms;
}

//block -> week -> day -> lesson number

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
          const lessonRooms = busyRooms[block][week][day][lesson].sort((a, b) => a.localeCompare(b));
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

function getAllData () {
  generateGroupBaseIDAsync().then(groupsBase => {
    const allIDs = Object.keys(groupsBase);
    const minID = allIDs[0], maxID = allIDs[allIDs.length - 1];
    generateLessonBaseIDAsync(minID, maxID).then(lessonsBase => {


      const teachersAndSchedule = generateTeachersSchedule(lessonsBase, groupsBase);
      const teachers = teachersAndSchedule.teachers;
      const teachersSchedule = teachersAndSchedule.schedule;
      // console.log(lessonsBase);
      fs.writeFileSync("studentSchedule.txt", JSON.stringify(generateStudentSchedule(lessonsBase)));
      fs.writeFileSync("roomsSchedule.txt", JSON.stringify(makeRoomsSchedule(lessonsBase)));
      fs.writeFileSync("teacherSchedule.txt", JSON.stringify(teachersSchedule));
      fs.writeFileSync("teachersBase.txt", JSON.stringify(teachers));
      fs.writeFileSync("groupsBase.txt", JSON.stringify(groupsBase));
      fs.writeFileSync("lessonsBase.txt", JSON.stringify(lessonsBase));
    })
  });
}

getAllData();