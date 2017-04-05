'use strict'

const memcachePlus = require('memcache-plus'),
            crypto = require('crypto'),
         serialize = require('serialize-javascript'),
            logger = require('log4js').getLogger()

const MAX_VALUE_SIZE = 1024 * 1024 * 3

var m = new memcachePlus({
  hosts: [`${SETTINGS.memcached.host}:${SETTINGS.memcached.port}`],
  maxValueSize: MAX_VALUE_SIZE,
})

function toMD5(v){
  if (typeof(v) === 'string' || v instanceof String){
    return v
  }

  return crypto
          .createHash('md5')
          .update(serialize(v), 'utf-8')
          .digest('hex')
}

module.exports = {
  set: (key, value, option) => {
    const keyMD5 = toMD5(key)

    let valueString;
    if (value instanceof Object){
      valueString = JSON.stringify(value)
    }

    if ((valueString || value).length > MAX_VALUE_SIZE){
      return new Promise((resolve, reject) => {
        throw `memcached set values failed. ${valueString.length} over max size.`
      })
    }

    return m.set(keyMD5, valueString || value, option)
  },

  get: function* (key, next, ttl){
    const isCompress = serialize(key).match(/compress/i) != null
    const keyMD5 = toMD5(key)

    logger.info(`memcached key: ${serialize(key)}, md5: ${keyMD5}`)

    let resultObject = yield m.get(keyMD5, {compressed: isCompress})
    if (_.isNil(resultObject)){
      if (_.isNil(next)){
        return
      }

      logger.warn(`memcached not hit, md5: ${keyMD5}`);
      const result = yield next();
      if (!_.isNil(result)){
        module.exports.set(keyMD5, result, {compressed: isCompress, ttl: ttl || 3600})
          .then((r) => {})
          .catch((e) => {logger.error(`memcached error: ${e}`)})
      }

      resultObject = result
    }

    try{
      if (typeof(resultObject) === 'string'){
        resultObject = JSON.parse(resultObject)
      }
    }catch(e){}

    return resultObject
  },

  del: (key) => {
    const keyMD5 = toMD5(key)

    logger.info(`memcached clear key: ${serialize(key)}, md5: ${keyMD5}`)
    m.delete(keyMD5).then(_.noop())
  }
}
