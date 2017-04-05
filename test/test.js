const m = new require('../'),
     co = require('co')

const memcached = new m(['127.0.0.1:11211'])
co(function* (){
  return yield memcached.get("12v", function* (){
    return 123
  })
}).then((r) => {
  console.log(r)

  co(function* (){
    return yield memcached.get("12v", function* (){
      return 1234
    })
  }).then((r1) => {
    console.log(r1)
  })

})
