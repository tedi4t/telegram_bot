'use strict';

const mongoose = require('mongoose');

// User Schema
const groupSchema = mongoose.Schema({
  ID: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
});

const group = mongoose.model('group', groupSchema, 'groupsBase');

const blockRoomsSchema = mongoose.Schema({
  block: {
    type: Number,
    required: true,
    unique: true
  },
  content: {
    type: Array,
    required: true
  },
});

const blockRooms = mongoose.model('blockRooms', blockRoomsSchema,
  'roomsSchedule');

const groupScheduleSchema = mongoose.Schema({
  ID: {
    type: Number,
    required: true,
    unique: true
  },
  content: {
    type: Array,
    required: true
  },
});

const groupSchedule = mongoose.model('groupSchedule', groupScheduleSchema,
  'groupSchedule');

const teacherSchema = mongoose.Schema({
  ID: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
});

const teacher = mongoose.model('teacher', teacherSchema, 'teachersBase');

const teacherScheduleSchema = mongoose.Schema({
  ID: {
    type: Number,
    required: true,
    unique: true
  },
  content: {
    type: Array,
    required: true
  },
});

const teacherSchedule = mongoose.model('teacherSchedule', teacherScheduleSchema,
  'teacherSchedule');

const generalSchema = mongoose.Schema({
  baseName: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: Object,
  },
});

const generalModel = mongoose.model('generalModel', generalSchema,
  'telegram_bot');

module.exports = {
  group,
  blockRooms,
  groupSchedule,
  teacher,
  teacherSchedule,
  generalModel
};
