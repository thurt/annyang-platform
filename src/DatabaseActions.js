
const init = (horizon) => (fuzzyset) => (channel) =>{
  const { Either, pluck } = require('fp-lib')
  const clients = horizon('clients')
  
  const success = (msg) => channel.push(Either.Right(msg))
  const fail = (msg) => channel.push(Either.Left(msg))
  
  let fuzzy_clients = fuzzyset([])
  let fuzzy_addresses = fuzzyset([])
  
  clients.watch().subscribe(
    (res) => { 
      if (res.length === 0) {} 
      else {
        fuzzy_clients = fuzzyset(pluck('name')(res))
        //fuzzy_addresses = fuzzyset(pluck('address')(res))
      }
    },
    (err) => console.error(`clients.watch(): ${err}`))
  
  return {
    getClientByName: (name) => (cb) =>
      clients.find({ name }).fetch().defaultIfEmpty()
        .forEach(cb)
        .catch(err => fail(`Error getting client by name ${name} -- ${err}`)),
    getClientByAddress: (address) => clients.find({ address }).fetch().defaultIfEmpty(),
    createNewClient: (name) => (cb) => 
      clients.store({ name })
        .forEach(cb)
        .catch((err) => fail(`Error creating new client ${name} -- ${err}`)),
    searchForClient: (name) => fuzzy_clients.get(name)
  }
}


module.exports = init