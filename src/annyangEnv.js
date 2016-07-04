const platform = require('./platform')
const { Either } = require('fp-lib')
const annyang = require('annyang')
const commands = require('./internal/_commands')

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
   platform.push(Either.Left({ errMsg: `No command matches for ${result[0]}` }))
 },
 'end': () => {
   $activateBtn.disabled = false
   $activateBtn.textContent = 'Start'
 }
}

module.exports = { annyang, dom_events, callbacks, commands }