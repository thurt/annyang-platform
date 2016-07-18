const manualCommandEntry = (annyang) => (channel) => {
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
  
  //:: (String, String) -> Either String null
  const hasInput = (x, cmd) => {
    return (pred[0](x))
      ? Either.Left(err[0](cmd))
      : Either.Right(null)
  }
  
  //:: (String, String) -> Either String null -> Either String String 
  const hasCorrectNumberOfInputs = (x, cmd) => (_) => {
    const args = cmd.match(regx[0])
    const xs = x.match(regx[1])
    let i = 0  
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