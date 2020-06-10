'use strict';

class Obj {
  constructor(obj) {
    this.obj = obj;
  }

  addObj(key) {
    if (!this.obj[key])
      this.obj[key] = {};
    return new Obj(this.obj[key]);
  }

  addManyObj(...keys) {
    return keys.reduce((acc, key) => acc.addObj(key), this);
  }

  addArr(key) {
    if (!this.obj[key])
      this.obj[key] = [];
    return new Obj(this.obj[key]);
  }

  get(key) {
    const value = this.obj[key];
    return new Obj(value);
  }

  getMany(...keys) {
    return keys.reduce((acc, key) => acc.get(key), this);
  }

  value() {
    return this.obj;
  }
}

module.exports = Obj;
