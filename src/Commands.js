const commands = (horizon) => (DatabaseActions) => (manualCommandEntry) => (channel) => {
  const h = require('snabbdom/h')
  const { Either, pluck } = require('fp-lib')
  const { getClientByName, createNewClient, searchForClient } = DatabaseActions

  const success = (msg) => channel.push(Either.Right(msg))
  const fail = (msg) => channel.push(Either.Left(msg))
  
  const _commands = {
    'client *name': (name) => {
      const res = searchForClient(name)
      
      if (res !== null) {
        success([pluck(1)(res).map(name => 
          h('button', { on: { 
            click: [getClientByName(name), (client) => success(JSON.stringify(client))] 
          } }, name)
        )])
      } else {
        fail(`client ${name} not found`)
      }
    },
    'new client': () => {
      const name = window.prompt(`Enter new client name`)
      
      if (name === null) { // cancelled
        return
      }
      
      if (name === '') { // empty name
        fail(`Error new client -- cannot create client with no name`)
        return
      }
      
      getClientByName(name)((msg) => {
        console.log(msg)
        if (msg === null) {
          createNewClient(name)((new_client) => success(`Created new client ${name}`))
        } else {
          fail(`Error new client ${name} -- that name already exists`)
        }
      })
    },
    [`what's nearby`]: () => {},
    'client address *addr': (addr) => {
      
    },
    'show commands': () => {
      
      const names = Reflect.ownKeys(_commands)
      
      success([names.map(name => 
        h('button', { on: { click: [manualCommandEntry, name] } }, name)
      )])
    }
  }

  return _commands
} 

module.exports = commands