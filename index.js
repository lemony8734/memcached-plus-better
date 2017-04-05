'use strict'

const memcachePlus = require('memcache-plus'),
            crypto = require('crypto'),
                 _ = require('lodash'),
         serialize = require('serialize-javascript'),
            logger = require('log4js').getLogger('memcached')

const MAX_VALUE_SIZE = 1024 * 1024 * 3

class Memcached {
  constructor(hosts){
    this.m = new memcachePlus({
      hosts: hosts,
      maxValueSize: MAX_VALUE_SIZE,
    })
  }

  toMD5(v){
    if (typeof(v) === 'string' || v instanceof String){
      return v
    }

    return crypto
            .createHash('md5')
            .update(serialize(v), 'utf-8')
            .digest('hex')
  }

  *set(key, value, option){
    const keyMD5 = this.toMD5(key)

    let valueString;
    if (value instanceof Object){
      valueString = JSON.stringify(value)
    }

    try{
      if ((valueString || value).length > MAX_VALUE_SIZE){
        return new Promise((resolve, reject) => {
          throw `memcached set values failed. ${valueString.length} over max size.`
        })
      }

      return this.m.set(keyMD5, valueString || value, option)
    }catch(e){
      logger.error(`memcached error: ${e}`)
    }
  }

  *get(key, next, ttl){
    const isCompress = serialize(key).match(/compress/i) != null
    const keyMD5 = this.toMD5(key)

    logger.info(`memcached key: ${serialize(key)}, md5: ${keyMD5}`)

    let resultObject = yield this.m.get(keyMD5, {compressed: isCompress})
    if (_.isNil(resultObject)){
      if (_.isNil(next)){
        return
      }

      logger.warn(`memcached not hit, md5: ${keyMD5}`);
      const result = yield next();
      if (!_.isNil(result)){
        yield this.set(keyMD5, result, {compressed: isCompress, ttl: ttl || 3600})
      }

      resultObject = result
    }

    try{
      if (typeof(resultObject) === 'string'){
        resultObject = JSON.parse(resultObject)
      }
    }catch(e){}

    return resultObject
  }

  del(key){
    const keyMD5 = this.toMD5(key)

    logger.info(`memcached clear key: ${serialize(key)}, md5: ${keyMD5}`)
    return this.m.delete(keyMD5)
  }
}

module.exports = Memcached
