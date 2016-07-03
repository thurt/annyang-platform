const { pipe, Either } = require('fp-lib')
const fuzzyset = require('fuzzyset.js')
const annyang = require('annyang')
const channel = []

const $activateBtn = document.getElementById('activate-btn')
const $showCommandsBtn = document.getElementById('show-commands-btn')

const dom_events = {
  'click': [{
    element: $activateBtn,
    callback: function(_) {
      annyang.start({ autoRestart: false, continuous: false })
    }
  }, {
    element: $showCommandsBtn,
    callback: function(_) {
      annyang.trigger('show commands')
    }
  }]
}

const callbacks = {
 'start': () => {
   $activateBtn.disabled = true
   $activateBtn.textContent = 'Listening'
 },
 'result': (result) => {
   //console.log(result)
 },
 'resultMatch': (result) => {
   //console.log(result)
 },
 'resultNoMatch': (result) => {
   channel.push(Either.Left({ errMsg: `No command matches for ${result[0]}` }))
 },
 'end': () => {
   $activateBtn.disabled = false
   $activateBtn.textContent = 'Start'
 }
}

const commands = (data) => (horizon) => {
  const fuzzy_clients = fuzzyset(Object.keys(data.clients))
  const letters = horizon('letters')

 
  const _commands = {
    'client *name': pipe(
      (name) => {
        const res = fuzzy_clients.get(name)
        console.log(name,res)
        if (res !== null) {
          return Either.Right(`fuzzy client found ${res}`)
        } else {
          return Either.Left(`client ${name} not found by fuzzy`)
        }
      }, 
      Either.bimap
        (errMsg => { return { errMsg } })
        (successMsg => { 
          const clogs = data.clogs.slice()
          clogs.push(successMsg)
          return { clogs }
        })
    ),
    'increase :letter': (letter) => {
      letter = letter.toLowerCase()
      
      letters.find(letter).fetch().forEach(res => {
        console.log(res)
        if (res !== null) {
          letters.replace({ id: letter, count: res.count + 1 })
          return Either.Right(`increased letter ${letter} to ${res.count}`)
        } else {
          return Either.Left(`cannot increase letter ${letter} -- it does not exist`)
        }
      })
    },
    'show commands': () => {
      var clogs = data.clogs.slice()
      clogs.push(Reflect.ownKeys(_commands).join(', ') + '\n')
      return Either.Right({ clogs })
    },
    'clear screen': () => {
      return Either.Right({ clogs: [] })
    },
    'get current user': () => {
      letters.find('a').fetch().defaultIfEmpty().subscribe(res => {
        if (res !== null) {
          res.count++
          console.log(res)
        }
      })
    }
  }
  
  const wrapper = (f) => (...args) => {
    channel.push(f(...args))
  }
  
  for (let name of Object.keys(_commands)) {
    _commands[name] = wrapper(_commands[name])
  }
  return _commands
}

module.exports = { annyang, dom_events, callbacks, commands, channel }