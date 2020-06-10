'use strict';

const mongoose = require('mongoose');

const { mongoURL } = require('./constantas.js');

async function openConnection(URL = mongoURL) {
  mongoose.connect(URL, { useNewUrlParser: true });
}

async function readFromMongo(obj, model) {
  return await model.findOne(obj);
}

async function writeToMongo(obj, Model, disconnect = false) {
  const model = new Model(obj);
  model.save(async err => {
    if (err) return console.log(err.message);
    if (disconnect) closeConnection();
  });
}

async function closeConnection() {
  mongoose.connection.close();
}

async function overwrite(baseName, newObj, model) {
  await model.replaceOne({ baseName }, newObj);
}

module.exports = {
  openConnection,
  readFromMongo,
  writeToMongo,
  overwrite,
};
