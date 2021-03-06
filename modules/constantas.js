'use strict';

const letterChanger = {
  'a': 'а',
  'b': 'б',
  'v': 'в',
  'g': 'г',
  'd': 'д',
  'e': 'є',
  'zh': 'ж',
  'z': 'з',
  'i': 'і',
  'k': 'к',
  'l': 'л',
  'm': 'м',
  'n': 'н',
  'o': 'о',
  'p': 'п',
  'r': 'р',
  's': 'с',
  't': 'т',
  'u': 'у',
  'f': 'ф',
  'h': 'х',
  'c': 'ц',
  'ch': 'ч',
  'sh': 'ш',
  'yu': 'ю',
  'ya': 'я',
};

const days = [
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  'П\'ятниця',
  'Субота',
  'Неділя',
];

const lessons = [
  [510, 605],
  [625, 720],
  [740, 835],
  [855, 950],
  [970, 1065],
];

const milliSecondsWeek = 604800000;

const mongoURL = 'mongodb+srv://tedi4t:qazwsxedc@cluster0-9gang.mongodb.net/' +
  'DATABASE?retryWrites=true&w=majority';

const timezoneOffset = 3 * 60 * 60 * 1000; //difference between UTC and UTC + 3

const amountOfBlocks = 37;

const studentBordersID = {
  minID: 5000,
  maxID: 8000,
};

const teacherBordersID = {
  minID: 0,
  maxID: 5000,
};

module.exports = {
  letterChanger,
  days,
  lessons,
  milliSecondsWeek,
  mongoURL,
  timezoneOffset,
  amountOfBlocks,
  studentBordersID,
  teacherBordersID,
};

