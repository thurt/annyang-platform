const dom_events = ({ $activateBtn, $showCommandsBtn }) => (annyang) => {
  return {
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
}

const callbacks = ({ $activateBtn }) => (channel) => {
  const { Either } = require('fp-lib')
  
  return {
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
      channel.push(Either.Left(`No command matches for ${result[0]}`))
    },
    'end': () => {
      $activateBtn.disabled = false
      $activateBtn.textContent = 'Start'
    }
  }
}

const commands = (horizon) => (channel) => (commandCreators) => {
  const { Either } = require('fp-lib')
  const { showCommands } = commandCreators
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
      return Either.Right(showCommands(Reflect.ownKeys(_commands)))
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

// needs work

const manualCommandEntry = (commands) => (channel) => {
  const { Either } = require('fp-lib')
  const err = {
    0: (cmd) => `Can't complete [${cmd}]. Missing required input.`,
    1: (cmd, len) => `Can't complete [${cmd}]. It requires exactly ${len} inputs.`
  }
  const regx = {
    0: new RegExp(/(:\w+|\*\w+)/, 'gi'), // command arguments
    1: new RegExp(/(\w+)/, 'gi') // words
  }
  const pred = {
    0: (x) => x === '',
    1: (x, y) => x.length !== y.length
  }
  
  //:: (String, String) -> Either err null
  const hasInput = (x, cmd) => {
    return (pred[0](x))
      ? Either.Left(err[0](cmd))
      : Either.Right(null)
  }
  
  //:: (String, String) -> Either err null -> Either err String 
  const hasCorrectNumberOfInputs = (x, cmd) => (_) => {
    const args = cmd.match(regx[0])
    const xs = x.match(regx[1])
    let i = 0  
    return (pred[1](xs, args))
      ? Either.Left(err[1](cmd, args.length))
      : Either.Right(cmd.replace(regx[0], (match) => xs[i++]))
  }
  
  //:: String -> Either err String
  const getUserInput = (cmd) => {
    const x = window.prompt(cmd)
    return hasInput(x, cmd).chain(hasCorrectNumberOfInputs(x, cmd))
  }
  
  //:: String -> Bool
  const requiresArguments = (cmd) =>  {
    return regx[0].test(cmd)
  }
  
  //:: String -> _  
  return (cmd) => {
    if (requiresArguments(cmd)) {
      const result = getUserInput(cmd)
      
      Either.bimap
        (left => { channel.push(result) })
        (right => { commands[cmd](right) })
        (result)
        
    } else {
      commands[cmd]()
    }
  }
}

const commandCreators = (manualCommandEntry) => {
  const h = require('snabbdom/h')
  
  const showCommands = (names) => {
    return [names.map(name => {
      return h('button', { on: { click: [manualCommandEntry, name] } }, name)
    })]
  }
  
  module.exports = { showCommands }
}

module.exports = { dom_events, callbacks, commands, manualCommandEntry, commandCreators }