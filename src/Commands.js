const commands = (horizon) => (manualCommandEntry) => (channel) => {
  const fuzzyset = require('fuzzyset.js')
  const h = require('snabbdom/h')
  const { Either, pluck } = require('fp-lib')
  
  const getClientRecord = (name) => {
    clients.find({ name }).fetch().defaultIfEmpty().subscribe(
      (msg) => {
        delete msg['id']
        channel.push(Either.Right(JSON.stringify(msg)))
      },
      (err) => channel.push(Either.Left(`Error fetching client record ${name} -- ${err}`)))
  }
  
  const letters = horizon('letters')
  const clients = horizon('clients')
  
  let fuzzy_clients = fuzzyset([])
  let fuzzy_addresses = fuzzyset([])
  
  clients.watch().subscribe(
    (res) => { 
      if (res.length === 0) {} 
      else {
        console.log('received update', res)
        console.log(pluck('name')(res))
        fuzzy_clients = fuzzyset(pluck('name')(res))
        //fuzzy_addresses = fuzzyset(pluck('address')(res))
      }
    },
    (err) => console.error(`clients.watch(): ${err}`))
  
  const _commands = {
    'client *name': (name) => {
      const res = fuzzy_clients.get(name)

      if (res !== null) {
        channel.push(Either.Right([pluck(1)(res).map(name => {
          return h('button', { on: { click: [getClientRecord, name] } }, name)
        })]))
      } else {
        channel.push(Either.Left(`client ${name} not found`))
      }
    },
    'new client': () => {
      const name = window.prompt(`Enter new client name`)
      
      if (name === null) { // cancelled
        return
      }
      
      if (name === '') { // empty name
        channel.push(Either.Left(`Error new client -- cannot create client with no name`))  
        return
      }
      
      clients.find({ name }).fetch().defaultIfEmpty().subscribe(
        (msg) => {
          if (msg === null) {
            clients.store({ name }).subscribe(
              (res) => channel.push(Either.Right(`Created new client ${name}`)),
              (err) => channel.push(Either.Left(`Error new client ${name} -- ${err}`)))
          } else {
            channel.push(Either.Left(`Error new client ${name} -- that name already exists`))
          }
        }
      )
    },
    [`what's nearby`]: () => {},
    'client address *addr': (addr) => {
      
    },
    'increase :letter': (letter) => {
      letters.find(letter.toLowerCase()).fetch().defaultIfEmpty().subscribe(
        (res) => {
          if (res === null) {
            channel.push(Either.Left(`cannot increase letter ${letter} -- it does not exist`)) 
          } else {
            letters.replace({ id: letter, count: res.count + 1 }).subscribe(
              (id) => { 
                channel.push(Either.Right(`increased letter ${letter} to ${res.count}`)) 
              },
              (err) => { 
                channel.push(Either.Left(`Error on replace: increase letter ${letter} -- ${err} `))
              }
            )  
          }
        },
        (err) => {
          channel.push(Either.Left(`Error on find: increase letter ${letter} -- ${err}`)) 
        }
      )
    },
    'show commands': () => {
      const state = (names) => {
        return [names.map(name => {
          return h('button', { on: { click: [manualCommandEntry, name] } }, name)
        })]
      }
      channel.push(Either.Right(state(Reflect.ownKeys(_commands))))
    }
  }
  /*
  const wrapper = (f) => (...args) => {
    channel.push(f(...args))
  }
  
  for (let name of Object.keys(_commands)) {
    _commands[name] = wrapper(_commands[name])
  }
  */
  return _commands
} 

module.exports = commands