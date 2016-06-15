const stateCreator = require('./StateCreator')

const env = (data) => {
  
// these are related to data manipulation
 const commands = {
   'increase :letter': {
     regexp: /^increase (\w)$/,
     callback: (letter) => {
       letter = letter.toLowerCase()
       StateMachine()
       if (data.letters[letter] !== undefined) {
         data.letters[letter]++
         var span = document.createElement('span')
         span.textContent = `increased ${letter} to ${data.letters[letter]}. ${JSON.stringify(data.letters)} \n`
         $clog.appendChild(span)
       }
     }
   },
   'client :first :last': function(first, last) {
     const name = `${first} ${last}`
     var span = document.createElement('span')
     if (data.clients[name] !== undefined) {
       span.textContent = `found ${name}\n`
     }
     else {
       span.textContent = `no ${name}\n`
     }
     $clog.appendChild(span)
   },
   'show commands': function() {
     const span = document.createElement('span')
     span.textContent += Reflect.ownKeys(commands).join(', ') + '\n'
     $clog.appendChild(span)
   }
 }

 return {
   commands, stateCreator
 }
}

module.exports = env