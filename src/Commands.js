const commands = (horizon) => (manualCommandEntry) => (channel) => {
  const h = require('snabbdom/h')
  const { Either } = require('fp-lib')
  //const { showCommands } = commandCreators
  //const fuzzy_clients = fuzzyset(Object.keys(data.clients))
  const letters = horizon('letters')

  const _commands = {
    'client *name': (name) => {
      const res = fuzzy_clients.get(name)

      if (res !== null) {
        return Either.Right(`fuzzy client found ${res}`)
      } else {
        return Either.Left(`client ${name} not found by fuzzy`)
      }
    },
    'increase :letter': (letter) => {
      letters.find(letter.toLowerCase()).fetch().defaultIfEmpty().subscribe(
        (res) => {
          if (res === null) {
            channel.push(Either.Left(`cannot increase letter ${letter} -- it does not exist`)) 
          } else {
            letters.replace({ id: letter, count: res.count + 1 }).subscribe(
              (id) => { 
                console.log(id)
                channel.push(Either.Right(`increased letter ${letter} to ${res.count}`)) 
              },
              (err) => { 
                console.log(err)
                channel.push(Either.Left(`Error on replace: increase letter ${letter} -- ${err} `))
              }
            )  
          }
        },
        (err) => {
          console.log(err)
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