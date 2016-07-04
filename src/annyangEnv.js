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

const commands = (horizon) => (channel) => {
  const { Either } = require('fp-lib')
  const { showCommands } = require('./internal/_commandCreators')
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
const command_variables_regex = new RegExp(/(:\w+|\*\w+)/, 'gi')
const keyboardCommandEntry = (commands) => {
  const getKeyboardInput = (name) => {
    const input = window.prompt(name)
    
    if (input === '') {
      return Either.Left(`Error: missing required input`)
    } else {
      const word_regex = new RegExp(/(\w+)/, 'gi')
      const vars = name.match(command_variables_regex)
      const inputs = input.match(word_regex)
      
      if (vars.length !== inputs.length) {
        return Either.Left(`Error: Command requires exactly ${vars.length} inputs`)
      } else {
        let i = 0
        const result = name.replace(command_variables_regex, (match) => inputs[i++])
        annyang.trigger(result)  
      }
    }
  }

  const requiresUserInput = (name) =>  {
    return command_variables_regex.test(name)
  }
    
  if (requiresUserInput(name)) {
    const input = getKeyboardInput(name)
    
    Either.bimap
      (left => { platform.push(left) })
      (right => { annyang_trigger(right) })
      (input)
      
  } else {
    annyang_trigger(name)
  }
}

module.exports = { dom_events, callbacks, commands, keyboardCommandEntry }