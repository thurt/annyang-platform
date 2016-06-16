const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  var vtree = parentNode
  const states = []
  
  // cursor stores the index of the currently rendered state
  // it moves back and forward for undo/redo operations
  const i = 0
  
  // replace must be true for first state change
  const change = (state, { replace }) => {
    if (!replace) {
      state = Object.assign(Object.assign({}, states[i]), state)
    }

    const new_vtree = StateCreator(state)
    
    // remove all state parameters in front of cursor position
    if (i !== 0) {
      states.splice(0, i)
      i = 0
    }
    states.unshift(state)
    
    patch(vtree, new_vtree)
    vtree = new_vtree
  }
  
  const undo = () => {
    return (i < states.length - 1)
      ? (change(states[++i], { replace: true }), true)
      : false
  }
  
  const redo = () => {
    return (i > 0)
      ? (change(states[--i], { replace: true }), true)
      : false
    }
  
  // replace must be true for first state change
  change(init_params, { replace: true })
  
  return { change, undo, redo }
}

module.exports = { init }