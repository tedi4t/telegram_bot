'use strict';

const mongoose = require('mongoose');

const generalSchema = mongoose.Schema({
  baseName: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    // required: false,
  },
});

const generalModel = mongoose.model('generalModel', generalSchema,
  'telegram_bot');

module.exports = {
  generalModel
};
