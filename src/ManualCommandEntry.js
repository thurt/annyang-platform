const manualCommandEntry = (annyang) => (channel) => {
  const { Either } = require('fp-lib')
  const err = {
    0: (cmd) => `Can't complete [${cmd}]. Missing required input.`,
    1: (cmd, len) => `Can't complete [${cmd}]. It requires exactly ${len} inputs.`
  }
  const regx = {
    0: new RegExp(/(:\w+|\*\w+)/, 'gi'), // has command arguments
    1: new RegExp(/(:\w+)/, 'gi'), // command arg
    2: new RegExp(/(\*\w+)/, 'gi'), // command splat
    3: new RegExp(/(\w+)/, 'gi') // words
  }
  const pred = {
    0: (x) => x === '',
    1: (x, y) => x.length !== y.length
  }  
  
  //:: (String, String) -> Either String null
  const hasInput = (x, cmd) => {
    let result = null
    
    if (pred[0](x)) {
      result = Either.Left(err[0](cmd))
    } else {
      result = Either.Right(null)
    }

    return result
  }
  
  //:: (String, String) -> Either String null -> Either String String 
  const hasCorrectNumberOfInputs = (x, cmd) => (_) => {
    // first check if it has ':args'
    let args = cmd.match(regx[1])
    let xs
    let i = 0  
    
    if (args === null) {
      args = cmd.match(regx[2])
      xs = [x]
    } else {
      xs = x.match(regx[3])
    }
    
    return (pred[1](xs, args))
      ? Either.Left(err[1](cmd, args.length))
      : Either.Right(cmd.replace(regx[0], (match) => xs[i++]))
  }
  
  //:: String -> Either String String
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
        (right => { annyang.trigger(right) })
        (result)
        
    } else {
      annyang.trigger(cmd)
    }
  }
}

module.exports = manualCommandEntry