const { Either } =require('fp-lib')
const platform = require('../platform')
const annyang = require('annyang')
const annyang_trigger = (command) => annyang.trigger(command)
const command_variables_regex = new RegExp(/(:\w+|\*\w+)/, 'gi')

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



const keyboardCommandEntry = (name) => {
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

module.exports = keyboardCommandEntry