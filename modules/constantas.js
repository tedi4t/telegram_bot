'use strict';

const letterChanger = {
  "a":"а",
  "b":"б",
  "v":"в",
  "g":"г",
  "d":"д",
  "e":"є",
  "zh":"ж",
  "z":"з",
  "i":"і",
  "k":"к",
  "l":"л",
  "m":"м",
  "n":"н",
  "o":"о",
  "p":"п",
  "r":"р",
  "s":"с",
  "t":"т",
  "u":"у",
  "f":"ф",
  "h":"х",
  "c":"ц",
  "ch":"ч",
  "sh":"ш",
  "yu":"ю",
  "ya":"я",
};

const days = [``, `Понеділок`, `Вівторок`, `Середа`, `Четвер`, `П'ятниця`, `Субота`, `Неділя`];

const scheduleLessons = [
  {condition: time => (510 <= time && time <= 605)},
  {condition: time => (625 <= time && time <= 720)},
  {condition: time => (740 <= time && time <= 835)},
  {condition: time => (855 <= time && time <= 950)},
  {condition: time => (970 <= time && time <= 1065)}
];


module.exports = {
  letterChanger,
  days,
  scheduleLessons,
};

