'use strict';

const mongoose = require('mongoose');

const { mongoURL } = require('./constantas.js');

let db;

async function openConnection() {
  mongoose.connect(mongoURL);
  db = mongoose.connection;
}

async function readFromMongo(obj, model) {
  return await model.findOne(obj);
}

async function writeToMongo(obj, Model) {
  db.once('open', async function() {
    const model = new Model(obj);
    model.save(async function (err) {
      if (err) return console.log(err.message);
    });
  });
}

async function closeConnection() {
  mongoose.connection.close();
}

module.exports = {
  openConnection,
  readFromMongo,
  writeToMongo,
  closeConnection,
};
