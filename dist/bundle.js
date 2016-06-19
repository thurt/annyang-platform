(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//! annyang
//! version : 2.4.0
//! author  : Tal Ater @TalAter
//! license : MIT
//! https://www.TalAter.com/annyang/
(function (root, factory) {
  "use strict";
  if (typeof define === 'function' && define.amd) { // AMD + global
    define([], function () {
      return (root.annyang = factory(root));
    });
  } else if (typeof module === 'object' && module.exports) { // CommonJS
    module.exports = factory(root);
  } else { // Browser globals
    root.annyang = factory(root);
  }
}(typeof window !== 'undefined' ? window : this, function (root, undefined) {
  "use strict";

  /**
   * # Quick Tutorial, Intro and Demos
   *
   * The quickest way to get started is to visit the [annyang homepage](https://www.talater.com/annyang/).
   *
   * For a more in-depth look at annyang, read on.
   *
   * # API Reference
   */

  var annyang;

  // Get the SpeechRecognition object, while handling browser prefixes
  var SpeechRecognition = root.SpeechRecognition ||
                          root.webkitSpeechRecognition ||
                          root.mozSpeechRecognition ||
                          root.msSpeechRecognition ||
                          root.oSpeechRecognition;

  // Check browser support
  // This is done as early as possible, to make it as fast as possible for unsupported browsers
  if (!SpeechRecognition) {
    return null;
  }

  var commandsList = [];
  var recognition;
  var callbacks = { start: [], error: [], end: [], result: [], resultMatch: [], resultNoMatch: [], errorNetwork: [], errorPermissionBlocked: [], errorPermissionDenied: [] };
  var autoRestart;
  var lastStartedAt = 0;
  var debugState = false;
  var debugStyle = 'font-weight: bold; color: #00f;';
  var pauseListening = false;
  var isListening = false;

  // The command matching code is a modified version of Backbone.Router by Jeremy Ashkenas, under the MIT license.
  var optionalParam = /\s*\((.*?)\)\s*/g;
  var optionalRegex = /(\(\?:[^)]+\))\?/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#]/g;
  var commandToRegExp = function(command) {
    command = command.replace(escapeRegExp, '\\$&')
                  .replace(optionalParam, '(?:$1)?')
                  .replace(namedParam, function(match, optional) {
                    return optional ? match : '([^\\s]+)';
                  })
                  .replace(splatParam, '(.*?)')
                  .replace(optionalRegex, '\\s*$1?\\s*');
    return new RegExp('^' + command + '$', 'i');
  };

  // This method receives an array of callbacks to iterate over, and invokes each of them
  var invokeCallbacks = function(callbacks) {
    var args = Array.prototype.slice.call(arguments, 1);
    callbacks.forEach(function(callback) {
      callback.callback.apply(callback.context, args);
    });
  };

  var isInitialized = function() {
    return recognition !== undefined;
  };

  var initIfNeeded = function() {
    if (!isInitialized()) {
      annyang.init({}, false);
    }
  };

  var registerCommand = function(command, cb, phrase) {
    commandsList.push({ command: command, callback: cb, originalPhrase: phrase });
    if (debugState) {
      console.log('Command successfully loaded: %c'+phrase, debugStyle);
    }
  };

  var parseResults = function(results) {
    invokeCallbacks(callbacks.result, results);
    var commandText;
    // go over each of the 5 results and alternative results received (we've set maxAlternatives to 5 above)
    for (var i = 0; i<results.length; i++) {
      // the text recognized
      commandText = results[i].trim();
      if (debugState) {
        console.log('Speech recognized: %c'+commandText, debugStyle);
      }

      // try and match recognized text to one of the commands on the list
      for (var j = 0, l = commandsList.length; j < l; j++) {
        var currentCommand = commandsList[j];
        var result = currentCommand.command.exec(commandText);
        if (result) {
          var parameters = result.slice(1);
          if (debugState) {
            console.log('command matched: %c'+currentCommand.originalPhrase, debugStyle);
            if (parameters.length) {
              console.log('with parameters', parameters);
            }
          }
          // execute the matched command
          currentCommand.callback.apply(this, parameters);
          invokeCallbacks(callbacks.resultMatch, commandText, currentCommand.originalPhrase, results);
          return;
        }
      }
    }
    invokeCallbacks(callbacks.resultNoMatch, results);
  };

  annyang = {

    /**
     * Initialize annyang with a list of commands to recognize.
     *
     * #### Examples:
     * ````javascript
     * var commands = {'hello :name': helloFunction};
     * var commands2 = {'hi': helloFunction};
     *
     * // initialize annyang, overwriting any previously added commands
     * annyang.init(commands, true);
     * // adds an additional command without removing the previous commands
     * annyang.init(commands2, false);
     * ````
     * As of v1.1.0 it is no longer required to call init(). Just start() listening whenever you want, and addCommands() whenever, and as often as you like.
     *
     * @param {Object} commands - Commands that annyang should listen to
     * @param {boolean} [resetCommands=true] - Remove all commands before initializing?
     * @method init
     * @deprecated
     * @see [Commands Object](#commands-object)
     */
    init: function(commands, resetCommands) {

      // resetCommands defaults to true
      if (resetCommands === undefined) {
        resetCommands = true;
      } else {
        resetCommands = !!resetCommands;
      }

      // Abort previous instances of recognition already running
      if (recognition && recognition.abort) {
        recognition.abort();
      }

      // initiate SpeechRecognition
      recognition = new SpeechRecognition();

      // Set the max number of alternative transcripts to try and match with a command
      recognition.maxAlternatives = 5;

      // In HTTPS, turn off continuous mode for faster results.
      // In HTTP,  turn on  continuous mode for much slower results, but no repeating security notices
      recognition.continuous = root.location.protocol === 'http:';

      // Sets the language to the default 'en-US'. This can be changed with annyang.setLanguage()
      recognition.lang = 'en-US';

      recognition.onstart   = function() {
        isListening = true;
        invokeCallbacks(callbacks.start);
      };

      recognition.onerror   = function(event) {
        invokeCallbacks(callbacks.error);
        switch (event.error) {
        case 'network':
          invokeCallbacks(callbacks.errorNetwork);
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          // if permission to use the mic is denied, turn off auto-restart
          autoRestart = false;
          // determine if permission was denied by user or automatically.
          if (new Date().getTime()-lastStartedAt < 200) {
            invokeCallbacks(callbacks.errorPermissionBlocked);
          } else {
            invokeCallbacks(callbacks.errorPermissionDenied);
          }
          break;
        }
      };

      recognition.onend     = function() {
        isListening = false;
        invokeCallbacks(callbacks.end);
        // annyang will auto restart if it is closed automatically and not by user action.
        if (autoRestart) {
          // play nicely with the browser, and never restart annyang automatically more than once per second
          var timeSinceLastStart = new Date().getTime()-lastStartedAt;
          if (timeSinceLastStart < 1000) {
            setTimeout(annyang.start, 1000-timeSinceLastStart);
          } else {
            annyang.start();
          }
        }
      };

      recognition.onresult  = function(event) {
        if(pauseListening) {
          if (debugState) {
            console.log('Speech heard, but annyang is paused');
          }
          return false;
        }

        // Map the results to an array
        var SpeechRecognitionResult = event.results[event.resultIndex];
        var results = [];
        for (var k = 0; k<SpeechRecognitionResult.length; k++) {
          results[k] = SpeechRecognitionResult[k].transcript;
        }

        parseResults(results);
      };

      // build commands list
      if (resetCommands) {
        commandsList = [];
      }
      if (commands.length) {
        this.addCommands(commands);
      }
    },

    /**
     * Start listening.
     * It's a good idea to call this after adding some commands first, but not mandatory.
     *
     * Receives an optional options object which supports the following options:
     *
     * - `autoRestart` (boolean, default: true) Should annyang restart itself if it is closed indirectly, because of silence or window conflicts?
     * - `continuous`  (boolean, default: undefined) Allow forcing continuous mode on or off. Annyang is pretty smart about this, so only set this if you know what you're doing.
     *
     * #### Examples:
     * ````javascript
     * // Start listening, don't restart automatically
     * annyang.start({ autoRestart: false });
     * // Start listening, don't restart automatically, stop recognition after first phrase recognized
     * annyang.start({ autoRestart: false, continuous: false });
     * ````
     * @param {Object} [options] - Optional options.
     * @method start
     */
    start: function(options) {
      pauseListening = false;
      initIfNeeded();
      options = options || {};
      if (options.autoRestart !== undefined) {
        autoRestart = !!options.autoRestart;
      } else {
        autoRestart = true;
      }
      if (options.continuous !== undefined) {
        recognition.continuous = !!options.continuous;
      }

      lastStartedAt = new Date().getTime();
      try {
        recognition.start();
      } catch(e) {
        if (debugState) {
          console.log(e.message);
        }
      }
    },

    /**
     * Stop listening, and turn off mic.
     *
     * Alternatively, to only temporarily pause annyang responding to commands without stopping the SpeechRecognition engine or closing the mic, use pause() instead.
     * @see [pause()](#pause)
     *
     * @method abort
     */
    abort: function() {
      autoRestart = false;
      if (isInitialized()) {
        recognition.abort();
      }
    },

    /**
     * Pause listening. annyang will stop responding to commands (until the resume or start methods are called), without turning off the browser's SpeechRecognition engine or the mic.
     *
     * Alternatively, to stop the SpeechRecognition engine and close the mic, use abort() instead.
     * @see [abort()](#abort)
     *
     * @method pause
     */
    pause: function() {
      pauseListening = true;
    },

    /**
     * Resumes listening and restores command callback execution when a result matches.
     * If SpeechRecognition was aborted (stopped), start it.
     *
     * @method resume
     */
    resume: function() {
      annyang.start();
    },

    /**
     * Turn on output of debug messages to the console. Ugly, but super-handy!
     *
     * @param {boolean} [newState=true] - Turn on/off debug messages
     * @method debug
     */
    debug: function(newState) {
      if (arguments.length > 0) {
        debugState = !!newState;
      } else {
        debugState = true;
      }
    },

    /**
     * Set the language the user will speak in. If this method is not called, defaults to 'en-US'.
     *
     * @param {String} language - The language (locale)
     * @method setLanguage
     * @see [Languages](#languages)
     */
    setLanguage: function(language) {
      initIfNeeded();
      recognition.lang = language;
    },

    /**
     * Add commands that annyang will respond to. Similar in syntax to init(), but doesn't remove existing commands.
     *
     * #### Examples:
     * ````javascript
     * var commands = {'hello :name': helloFunction, 'howdy': helloFunction};
     * var commands2 = {'hi': helloFunction};
     *
     * annyang.addCommands(commands);
     * annyang.addCommands(commands2);
     * // annyang will now listen to all three commands
     * ````
     *
     * @param {Object} commands - Commands that annyang should listen to
     * @method addCommands
     * @see [Commands Object](#commands-object)
     */
    addCommands: function(commands) {
      var cb;

      initIfNeeded();

      for (var phrase in commands) {
        if (commands.hasOwnProperty(phrase)) {
          cb = root[commands[phrase]] || commands[phrase];
          if (typeof cb === 'function') {
            // convert command to regex then register the command
            registerCommand(commandToRegExp(phrase), cb, phrase);
          } else if (typeof cb === 'object' && cb.regexp instanceof RegExp) {
            // register the command
            registerCommand(new RegExp(cb.regexp.source, 'i'), cb.callback, phrase);
          } else {
            if (debugState) {
              console.log('Can not register command: %c'+phrase, debugStyle);
            }
            continue;
          }
        }
      }
    },

    /**
     * Remove existing commands. Called with a single phrase, array of phrases, or methodically. Pass no params to remove all commands.
     *
     * #### Examples:
     * ````javascript
     * var commands = {'hello': helloFunction, 'howdy': helloFunction, 'hi': helloFunction};
     *
     * // Remove all existing commands
     * annyang.removeCommands();
     *
     * // Add some commands
     * annyang.addCommands(commands);
     *
     * // Don't respond to hello
     * annyang.removeCommands('hello');
     *
     * // Don't respond to howdy or hi
     * annyang.removeCommands(['howdy', 'hi']);
     * ````
     * @param {String|Array|Undefined} [commandsToRemove] - Commands to remove
     * @method removeCommands
     */
    removeCommands: function(commandsToRemove) {
      if (commandsToRemove === undefined) {
        commandsList = [];
        return;
      }
      commandsToRemove = Array.isArray(commandsToRemove) ? commandsToRemove : [commandsToRemove];
      commandsList = commandsList.filter(function(command) {
        for (var i = 0; i<commandsToRemove.length; i++) {
          if (commandsToRemove[i] === command.originalPhrase) {
            return false;
          }
        }
        return true;
      });
    },

    /**
     * Add a callback function to be called in case one of the following events happens:
     *
     * * `start` - Fired as soon as the browser's Speech Recognition engine starts listening
     * * `error` - Fired when the browser's Speech Recogntion engine returns an error, this generic error callback will be followed by more accurate error callbacks (both will fire if both are defined)
     * * `errorNetwork` - Fired when Speech Recognition fails because of a network error
     * * `errorPermissionBlocked` - Fired when the browser blocks the permission request to use Speech Recognition.
     * * `errorPermissionDenied` - Fired when the user blocks the permission request to use Speech Recognition.
     * * `end` - Fired when the browser's Speech Recognition engine stops
     * * `result` - Fired as soon as some speech was identified. This generic callback will be followed by either the `resultMatch` or `resultNoMatch` callbacks.
     *     Callback functions registered to this event will include an array of possible phrases the user said as the first argument
     * * `resultMatch` - Fired when annyang was able to match between what the user said and a registered command
     *     Callback functions registered to this event will include three arguments in the following order:
     *       * The phrase the user said that matched a command
     *       * The command that was matched
     *       * An array of possible alternative phrases the user might've said
     * * `resultNoMatch` - Fired when what the user said didn't match any of the registered commands.
     *     Callback functions registered to this event will include an array of possible phrases the user might've said as the first argument
     *
     * #### Examples:
     * ````javascript
     * annyang.addCallback('error', function() {
     *   $('.myErrorText').text('There was an error!');
     * });
     *
     * annyang.addCallback('resultMatch', function(userSaid, commandText, phrases) {
     *   console.log(userSaid); // sample output: 'hello'
     *   console.log(commandText); // sample output: 'hello (there)'
     *   console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
     * });
     *
     * // pass local context to a global function called notConnected
     * annyang.addCallback('errorNetwork', notConnected, this);
     * ````
     * @param {String} type - Name of event that will trigger this callback
     * @param {Function} callback - The function to call when event is triggered
     * @param {Object} [context] - Optional context for the callback function
     * @method addCallback
     */
    addCallback: function(type, callback, context) {
      if (callbacks[type]  === undefined) {
        return;
      }
      var cb = root[callback] || callback;
      if (typeof cb !== 'function') {
        return;
      }
      callbacks[type].push({callback: cb, context: context || this});
    },

    /**
     * Remove callbacks from events.
     *
     * - Pass an event name and a callback command to remove that callback command from that event type.
     * - Pass just an event name to remove all callback commands from that event type.
     * - Pass undefined as event name and a callback command to remove that callback command from all event types.
     * - Pass no params to remove all callback commands from all event types.
     *
     * #### Examples:
     * ````javascript
     * annyang.addCallback('start', myFunction1);
     * annyang.addCallback('start', myFunction2);
     * annyang.addCallback('end', myFunction1);
     * annyang.addCallback('end', myFunction2);
     *
     * // Remove all callbacks from all events:
     * annyang.removeCallback();
     *
     * // Remove all callbacks attached to end event:
     * annyang.removeCallback('end');
     *
     * // Remove myFunction2 from being called on start:
     * annyang.removeCallback('start', myFunction2);
     *
     * // Remove myFunction1 from being called on all events:
     * annyang.removeCallback(undefined, myFunction1);
     * ````
     *
     * @param type Name of event type to remove callback from
     * @param callback The callback function to remove
     * @returns undefined
     * @method removeCallback
     */
    removeCallback: function(type, callback) {
      var compareWithCallbackParameter = function(cb) {
        return cb.callback !== callback;
      };
      // Go over each callback type in callbacks store object
      for (var callbackType in callbacks) {
        if (callbacks.hasOwnProperty(callbackType)) {
          // if this is the type user asked to delete, or he asked to delete all, go ahead.
          if (type === undefined || type === callbackType) {
            // If user asked to delete all callbacks in this type or all types
            if (callback === undefined) {
                callbacks[callbackType] = [];
              } else {
                // Remove all matching callbacks
                callbacks[callbackType] = callbacks[callbackType].filter(compareWithCallbackParameter);
            }
          }
        }
      }
    },

    /**
     * Returns true if speech recognition is currently on.
     * Returns false if speech recognition is off or annyang is paused.
     *
     * @return boolean true = SpeechRecognition is on and annyang is listening
     * @method isListening
     */
    isListening: function() {
      return isListening && !pauseListening;
    },

    /**
     * Returns the instance of the browser's SpeechRecognition object used by annyang.
     * Useful in case you want direct access to the browser's Speech Recognition engine.
     *
     * @returns SpeechRecognition The browser's Speech Recognizer currently used by annyang
     * @method getSpeechRecognizer
     */
    getSpeechRecognizer: function() {
      return recognition;
    },

    /**
     * Simulate speech being recognized. This will trigger the same events and behavior as when the Speech Recognition
     * detects speech.
     *
     * Can accept either a string containing a single sentence, or an array containing multiple sentences to be checked
     * in order until one of them matches a command (similar to the way Speech Recognition Alternatives are parsed)
     *
     * #### Examples:
     * ````javascript
     * annyang.trigger('Time for some thrilling heroics');
     * annyang.trigger(
     *     ['Time for some thrilling heroics', 'Time for some thrilling aerobics']
     *   );
     * ````
     *
     * @param string|array sentences A sentence as a string or an array of strings of possible sentences
     * @returns undefined
     * @method trigger
     */
    trigger: function(sentences) {
      /*
      if(!annyang.isListening()) {
        if (debugState) {
          if (!isListening) {
            console.log('Cannot trigger while annyang is aborted');
          } else {
            console.log('Speech heard, but annyang is paused');
          }
        }
        return;
      }
      */

      if (!Array.isArray(sentences)) {
        sentences = [sentences];
      }

      parseResults(sentences);
    }
  };

  return annyang;

}));

/**
 * # Good to Know
 *
 * ## Commands Object
 *
 * Both the [init()]() and addCommands() methods receive a `commands` object.
 *
 * annyang understands commands with `named variables`, `splats`, and `optional words`.
 *
 * * Use `named variables` for one word arguments in your command.
 * * Use `splats` to capture multi-word text at the end of your command (greedy).
 * * Use `optional words` or phrases to define a part of the command as optional.
 *
 * #### Examples:
 * ````html
 * <script>
 * var commands = {
 *   // annyang will capture anything after a splat (*) and pass it to the function.
 *   // e.g. saying "Show me Batman and Robin" will call showFlickr('Batman and Robin');
 *   'show me *tag': showFlickr,
 *
 *   // A named variable is a one word variable, that can fit anywhere in your command.
 *   // e.g. saying "calculate October stats" will call calculateStats('October');
 *   'calculate :month stats': calculateStats,
 *
 *   // By defining a part of the following command as optional, annyang will respond
 *   // to both: "say hello to my little friend" as well as "say hello friend"
 *   'say hello (to my little) friend': greeting
 * };
 *
 * var showFlickr = function(tag) {
 *   var url = 'http://api.flickr.com/services/rest/?tags='+tag;
 *   $.getJSON(url);
 * }
 *
 * var calculateStats = function(month) {
 *   $('#stats').text('Statistics for '+month);
 * }
 *
 * var greeting = function() {
 *   $('#greeting').text('Hello!');
 * }
 * </script>
 * ````
 *
 * ### Using Regular Expressions in commands
 * For advanced commands, you can pass a regular expression object, instead of
 * a simple string command.
 *
 * This is done by passing an object containing two properties: `regexp`, and
 * `callback` instead of the function.
 *
 * #### Examples:
 * ````javascript
 * var calculateFunction = function(month) { console.log(month); }
 * var commands = {
 *   // This example will accept any word as the "month"
 *   'calculate :month stats': calculateFunction,
 *   // This example will only accept months which are at the start of a quarter
 *   'calculate :quarter stats': {'regexp': /^calculate (January|April|July|October) stats$/, 'callback': calculateFunction}
 * }
 ````
 *
 * ## Languages
 *
 * While there isn't an official list of supported languages (cultures? locales?), here is a list based on [anecdotal evidence](http://stackoverflow.com/a/14302134/338039).
 *
 * * Afrikaans `af`
 * * Basque `eu`
 * * Bulgarian `bg`
 * * Catalan `ca`
 * * Arabic (Egypt) `ar-EG`
 * * Arabic (Jordan) `ar-JO`
 * * Arabic (Kuwait) `ar-KW`
 * * Arabic (Lebanon) `ar-LB`
 * * Arabic (Qatar) `ar-QA`
 * * Arabic (UAE) `ar-AE`
 * * Arabic (Morocco) `ar-MA`
 * * Arabic (Iraq) `ar-IQ`
 * * Arabic (Algeria) `ar-DZ`
 * * Arabic (Bahrain) `ar-BH`
 * * Arabic (Lybia) `ar-LY`
 * * Arabic (Oman) `ar-OM`
 * * Arabic (Saudi Arabia) `ar-SA`
 * * Arabic (Tunisia) `ar-TN`
 * * Arabic (Yemen) `ar-YE`
 * * Czech `cs`
 * * Dutch `nl-NL`
 * * English (Australia) `en-AU`
 * * English (Canada) `en-CA`
 * * English (India) `en-IN`
 * * English (New Zealand) `en-NZ`
 * * English (South Africa) `en-ZA`
 * * English(UK) `en-GB`
 * * English(US) `en-US`
 * * Finnish `fi`
 * * French `fr-FR`
 * * Galician `gl`
 * * German `de-DE`
 * * Hebrew `he`
 * * Hungarian `hu`
 * * Icelandic `is`
 * * Italian `it-IT`
 * * Indonesian `id`
 * * Japanese `ja`
 * * Korean `ko`
 * * Latin `la`
 * * Mandarin Chinese `zh-CN`
 * * Traditional Taiwan `zh-TW`
 * * Simplified China zh-CN `?`
 * * Simplified Hong Kong `zh-HK`
 * * Yue Chinese (Traditional Hong Kong) `zh-yue`
 * * Malaysian `ms-MY`
 * * Norwegian `no-NO`
 * * Polish `pl`
 * * Pig Latin `xx-piglatin`
 * * Portuguese `pt-PT`
 * * Portuguese (Brasil) `pt-BR`
 * * Romanian `ro-RO`
 * * Russian `ru`
 * * Serbian `sr-SP`
 * * Slovak `sk`
 * * Spanish (Argentina) `es-AR`
 * * Spanish (Bolivia) `es-BO`
 * * Spanish (Chile) `es-CL`
 * * Spanish (Colombia) `es-CO`
 * * Spanish (Costa Rica) `es-CR`
 * * Spanish (Dominican Republic) `es-DO`
 * * Spanish (Ecuador) `es-EC`
 * * Spanish (El Salvador) `es-SV`
 * * Spanish (Guatemala) `es-GT`
 * * Spanish (Honduras) `es-HN`
 * * Spanish (Mexico) `es-MX`
 * * Spanish (Nicaragua) `es-NI`
 * * Spanish (Panama) `es-PA`
 * * Spanish (Paraguay) `es-PY`
 * * Spanish (Peru) `es-PE`
 * * Spanish (Puerto Rico) `es-PR`
 * * Spanish (Spain) `es-ES`
 * * Spanish (US) `es-US`
 * * Spanish (Uruguay) `es-UY`
 * * Spanish (Venezuela) `es-VE`
 * * Swedish `sv-SE`
 * * Turkish `tr`
 * * Zulu `zu`
 *
 * ## Developing
 *
 * Prerequisities: node.js
 *
 * First, install dependencies in your local annyang copy:
 *
 *     npm install
 *
 * Make sure to run the default grunt task after each change to annyang.js. This can also be done automatically by running:
 *
 *     grunt watch
 *
 * You can also run a local server for testing your work with:
 *
 *     grunt dev
 *
 * Point your browser to `https://localhost:8443/demo/` to see the demo page.
 * Since it's using self-signed certificate, you might need to click *"Proceed Anyway"*.
 *
 * For more info, check out the [CONTRIBUTING](https://github.com/TalAter/annyang/blob/master/CONTRIBUTING.md) file
 *
 */

},{}],2:[function(require,module,exports){
// FUNCTIONS /////////////////////////////////////////////////////

//:: a -> a
const trace = (x) => {
  console.log(x)
  return x
}

//:: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
const pipe = (...fns) => (...xs) => {
  return fns
    .slice(1)
    .reduce((x, fn) => fn(x), fns[0](...xs))
}
const pipeP = (...fns) => (...xs) => {
  return fns
    .slice(1)
    .reduce((xP, fn) => xP.then(fn), Promise.resolve(fns[0](...xs)))
}

//:: (a -> b) -> [a] -> [b]
const map = (fn) => (f) => {
  return f.map(fn)
}

//:: [a] -> [a] -> [a]
const intersection = (xs) => (xs2) => {
  return xs.filter(x => xs2.includes(x))
}

//:: [a] -> [a] -> [a]
const difference = (xs) => (xs2) => {
  return xs.filter(x => !xs2.includes(x))
}

//:: [(a, b, ...) -> n] -> [a, b, ...] -> [n]
const applyFunctions = (fns) => (xs) => {
  return fns.map(fn =>
    xs.slice(1).reduce((partial, x) => partial(x), fn(xs[0])))
}

//:: [a] -> a
const last = (xs) => {
  return xs[xs.length - 1]
}

//:: (a -> b -> c) -> b -> a -> c
const flip = (fn) => (b) => (a) => {
  return fn(a)(b)
}

const curry = (fn) => {
  var _args = []
  const countArgs = (...xs) => {
    _args = _args.concat(xs)
    return (_args.length >= fn.length)
      ? fn.apply(this, _args)
      : countArgs
  }
  return countArgs
}

//:: Int -> [a] -> a
const nth = (n) => (xs) => {
  return xs[n]
}

//:: (a -> a) -> Number -> [a] -> [a]
const adjust = (fn) => (i) => (list) => {
  var copy = list.slice()
  copy.splice(i, 1, fn(list[i]))
  return copy
}

//:: Object -> Array
const toPairs = (obj) => {
  return Reflect.ownKeys(obj).map(key => [key, obj[key]])
}

//:: (a -> Bool) -> (a -> b) -> (a -> b) -> a -> b
const ifElse = (predFn) => (whenTrueFn) => (whenFalseFn) => (a) =>{
  return predFn(a)
    ? whenTrueFn(a)
    : whenFalseFn(a)
}


// this isn't in exports, it is used by IO.sequence //////////////
const Generator = Object.freeze({
  //:: (a -> b) -> (Generator ([a] -> b))
  /* returns a generator which will apply
     action to ea value sequentially in xs
   */
  seq(action) {
    return function* applyAction(xs) {
      for (var x of xs) {
        yield action(x)
      }
    }
  },
  //:: Generator -> _
  /* automatically steps generator every ~x ms
     until the generator is exhausted
   */
  auto: (ms) => (gen) => {
    if (!gen.next().done) {
      setTimeout(() => Generator.auto(ms)(gen), ms)
    }
  }
})


// MONADS ///////////////////////////////////////////////////////

// Maybe type
const Maybe = (() => {
  const newM = (type) => (value) => {
    return Object.freeze(Object.create(type, { __value: { value: value }}))
  }

  const Nothing = Object.freeze({
    map(_) {
      return newM(Nothing)(null)
    },
    isNothing: true,
    isJust: false
  })

  const Just = Object.freeze({
    map(fn) {
      return newM(Just)(fn(this.__value))
    },
    isNothing: false,
    isJust: true
  })

  const Maybe = (x) => {
    return (x == null)
      ? newM(Nothing)(null)
      : newM(Just)(x)
  }

  Maybe.isNothing = (M) => {
    return Nothing.isPrototypeOf(M)
  }

  Maybe.isJust = (M) => {
    return Just.isPrototypeOf(M)
  }

  return Object.freeze(Maybe)
})()

// Either type
const Either = (() => {
  const newE = (type) => (value) => {
    return Object.freeze(Object.create(type, { __value: { value: value } }))
  }

  const Left = Object.freeze({
    map(_) {
      return this
    },
    bimap(fn) {
      const me = this
      return (_) => {
        return newE(Left)(fn(me.__value))
      }
    },
    isLeft: true,
    isRight: false
  })

  const Right = Object.freeze({
    map(fn) {
      return newE(Right)(fn(this.__value))
    },
    bimap(_) {
      const me = this
      return (fn) => {
        return me.map(fn)
      }
    },
    isLeft: false,
    isRight: true
  })

  const Either = Object.freeze({
    Left(x) {
      return newE(Left)(x)
    },
    Right(x) {
      return newE(Right)(x)
    },
    isRight(E) {
      return Right.isPrototypeOf(E)
    },
    isLeft(E) {
      return Left.isPrototypeOf(E)
    },
    bimap: (leftFn) => (rightFn) => (E) => {
      return E.bimap(leftFn)(rightFn)
    }
  })

  return Either
})()

// IO type
const IO = (() => {
  const new_io = (fn) => {
    return Object.freeze(Object.create(io, { __value: { value: fn }}))
  }

  const io = {
    runIO(value) {
      return this.__value(value)
    },
    map(fn) {
      return new_io(() => fn(this.__value()))
    },
    join() {
      return new_io(() => {
        return this.runIO().runIO()
      })
    },
    chain(io_returning_fn) {
      return this.map(io_returning_fn).join()
    },
    ap(io_value) {
      return io_value.map(this.__value)
    }
  }

  const IO = (fn) => {
    if (fn instanceof Function) {
      return new_io(fn)
    } else {
      throw new TypeError(`IO constructor expected instance of Function`)
    }
  }

  IO.of = (x) => {
    return new_io(() => x)
  }

  IO.run = (io) => {
    return io.runIO()
  }

  //:: (a -> b) -> a -> IO b
  IO.wrap = (fn) => (_value) => {
    return IO.of(_value).map(fn)
  }

  //:: [IO] -> IO _
  IO.sequence = IO.wrap(
    pipe(
      Generator.seq(IO.run),
      Generator.auto(0)
    ))

  return Object.freeze(IO)
})()


/////////////////////////////////////////////////////////////////

module.exports = {
  trace, pipe, pipeP, map, intersection, difference, applyFunctions,
  last, flip, curry, nth, adjust, toPairs, ifElse,
  Maybe, Either, IO
}






},{}],3:[function(require,module,exports){
module.exports = require('./lib/fuzzyset.js');

},{"./lib/fuzzyset.js":4}],4:[function(require,module,exports){
(function() {

var FuzzySet = function(arr, useLevenshtein, gramSizeLower, gramSizeUpper) {
    var fuzzyset = {
        version: '0.0.1'
    };

    // default options
    arr = arr || [];
    fuzzyset.gramSizeLower = gramSizeLower || 2;
    fuzzyset.gramSizeUpper = gramSizeUpper || 3;
    fuzzyset.useLevenshtein = useLevenshtein || true;

    // define all the object functions and attributes
    fuzzyset.exactSet = {}
    fuzzyset.matchDict = {};
    fuzzyset.items = {};

    // helper functions
    var levenshtein = function(str1, str2) {
        var current = [], prev, value;

        for (var i = 0; i <= str2.length; i++)
            for (var j = 0; j <= str1.length; j++) {
            if (i && j)
                if (str1.charAt(j - 1) === str2.charAt(i - 1))
                value = prev;
                else
                value = Math.min(current[j], current[j - 1], prev) + 1;
            else
                value = i + j;

            prev = current[j];
            current[j] = value;
            }

        return current.pop();
    };

    // return an edit distance from 0 to 1
    var _distance = function(str1, str2) {
        if (str1 == null && str2 == null) throw 'Trying to compare two null values'
        if (str1 == null || str2 == null) return 0;
        str1 = String(str1); str2 = String(str2);

        var distance = levenshtein(str1, str2);
        if (str1.length > str2.length) {
            return 1 - distance / str1.length;
        } else {
            return 1 - distance / str2.length;
        }
    };
    var _nonWordRe = /[^\w, ]+/;

    var _iterateGrams = function(value, gramSize) {
        gramSize = gramSize || 2;
        var simplified = '-' + value.toLowerCase().replace(_nonWordRe, '') + '-',
            lenDiff = gramSize - simplified.length,
            results = [];
        if (lenDiff > 0) {
            for (var i = 0; i < lenDiff; ++i) {
                value += '-';
            }
        }
        for (var i = 0; i < simplified.length - gramSize + 1; ++i) {
            results.push(simplified.slice(i, i + gramSize))
        }
        return results;
    };

    var _gramCounter = function(value, gramSize) {
        gramSize = gramSize || 2;
        var result = {},
            grams = _iterateGrams(value, gramSize),
            i = 0;
        for (i; i < grams.length; ++i) {
            if (grams[i] in result) {
                result[grams[i]] += 1;
            } else {
                result[grams[i]] = 1;
            }
        }
        return result;
    };

    // the main functions
    fuzzyset.get = function(value, defaultValue) {
        var result = this._get(value);
        if (!result && defaultValue) {
            return defaultValue;
        }
        return result;
    };

    fuzzyset._get = function(value) {
        var normalizedValue = this._normalizeStr(value),
            result = this.exactSet[normalizedValue];
        if (result) {
            return [[1, result]];
        }
        var results = [];
        for (var gramSize = this.gramSizeUpper; gramSize > this.gramSizeLower; --gramSize) {
            results = this.__get(value, gramSize);
            if (results) {
                return results;
            }
        }
        return null;
    };

    fuzzyset.__get = function(value, gramSize) {
        var normalizedValue = this._normalizeStr(value),
            matches = {},
            gramCounts = _gramCounter(normalizedValue, gramSize),
            items = this.items[gramSize],
            sumOfSquareGramCounts = 0,
            gram,
            gramCount,
            i,
            index,
            otherGramCount;

        for (gram in gramCounts) {
            gramCount = gramCounts[gram];
            sumOfSquareGramCounts += Math.pow(gramCount, 2);
            if (gram in this.matchDict) {
                for (i = 0; i < this.matchDict[gram].length; ++i) {
                    index = this.matchDict[gram][i][0];
                    otherGramCount = this.matchDict[gram][i][1];
                    if (index in matches) {
                        matches[index] += gramCount * otherGramCount;
                    } else {
                        matches[index] = gramCount * otherGramCount;
                    }
                }
            }
        }

        function isEmptyObject(obj) {
            for(var prop in obj) {
                if(obj.hasOwnProperty(prop))
                    return false;
            }
            return true;
        }

        if (isEmptyObject(matches)) {
            return null;
        }

        var vectorNormal = Math.sqrt(sumOfSquareGramCounts),
            results = [],
            matchScore;
        // build a results list of [score, str]
        for (var matchIndex in matches) {
            matchScore = matches[matchIndex];
            results.push([matchScore / (vectorNormal * items[matchIndex][0]), items[matchIndex][1]]);
        }
        var sortDescending = function(a, b) {
            if (a[0] < b[0]) {
                return 1;
            } else if (a[0] > b[0]) {
                return -1;
            } else {
                return 0;
            }
        };
        results.sort(sortDescending);
        if (this.useLevenshtein) {
            var newResults = [],
                endIndex = Math.min(50, results.length);
            // truncate somewhat arbitrarily to 50
            for (var i = 0; i < endIndex; ++i) {
                newResults.push([_distance(results[i][1], normalizedValue), results[i][1]]);
            }
            results = newResults;
            results.sort(sortDescending);
        }
        var newResults = [];
        for (var i = 0; i < results.length; ++i) {
            if (results[i][0] == results[0][0]) {
                newResults.push([results[i][0], this.exactSet[results[i][1]]]);
            }
        }
        return newResults;
    };

    fuzzyset.add = function(value) {
        var normalizedValue = this._normalizeStr(value);
        if (normalizedValue in this.exactSet) {
            return false;
        }

        var i = this.gramSizeLower;
        for (i; i < this.gramSizeUpper + 1; ++i) {
            this._add(value, i);
        }
    };

    fuzzyset._add = function(value, gramSize) {
        var normalizedValue = this._normalizeStr(value),
            items = this.items[gramSize] || [],
            index = items.length;

        items.push(0);
        var gramCounts = _gramCounter(normalizedValue, gramSize),
            sumOfSquareGramCounts = 0,
            gram, gramCount;
        for (var gram in gramCounts) {
            gramCount = gramCounts[gram];
            sumOfSquareGramCounts += Math.pow(gramCount, 2);
            if (gram in this.matchDict) {
                this.matchDict[gram].push([index, gramCount]);
            } else {
                this.matchDict[gram] = [[index, gramCount]];
            }
        }
        var vectorNormal = Math.sqrt(sumOfSquareGramCounts);
        items[index] = [vectorNormal, normalizedValue];
        this.items[gramSize] = items;
        this.exactSet[normalizedValue] = value;
    };

    fuzzyset._normalizeStr = function(str) {
        if (Object.prototype.toString.call(str) !== '[object String]') throw 'Must use a string as argument to FuzzySet functions'
        return str.toLowerCase();
    };

    // return length of items in set
    fuzzyset.length = function() {
        var count = 0,
            prop;
        for (prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                count += 1;
            }
        }
        return count;
    };

    // return is set is empty
    fuzzyset.isEmpty = function() {
        for (var prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                return false;
            }
        }
        return true;
    };

    // return list of values loaded into set
    fuzzyset.values = function() {
        var values = [],
            prop;
        for (prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                values.push(this.exactSet[prop])
            }
        }
        return values;
    };


    // initialization
    var i = fuzzyset.gramSizeLower;
    for (i; i < fuzzyset.gramSizeUpper + 1; ++i) {
        fuzzyset.items[i] = [];
    }
    // add all the items to the set
    for (i = 0; i < arr.length; ++i) {
        fuzzyset.add(arr[i]);
    }

    return fuzzyset;
};

var root = this;
// Export the fuzzyset object for **CommonJS**, with backwards-compatibility
// for the old `require()` API. If we're not in CommonJS, add `_` to the
// global object.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FuzzySet;
    root.FuzzySet = FuzzySet;
} else {
    root.FuzzySet = FuzzySet;
}

})();

},{}],5:[function(require,module,exports){
var VNode = require('./vnode');
var is = require('./is');

function addNS(data, children) {
  data.ns = 'http://www.w3.org/2000/svg';
  if (children !== undefined) {
    for (var i = 0; i < children.length; ++i) {
      addNS(children[i].data, children[i].children);
    }
  }
}

module.exports = function h(sel, b, c) {
  var data = {}, children, text, i;
  if (c !== undefined) {
    data = b;
    if (is.array(c)) { children = c; }
    else if (is.primitive(c)) { text = c; }
  } else if (b !== undefined) {
    if (is.array(b)) { children = b; }
    else if (is.primitive(b)) { text = b; }
    else { data = b; }
  }
  if (is.array(children)) {
    for (i = 0; i < children.length; ++i) {
      if (is.primitive(children[i])) children[i] = VNode(undefined, undefined, undefined, children[i]);
    }
  }
  if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g') {
    addNS(data, children);
  }
  return VNode(sel, data, children, text, undefined);
};

},{"./is":7,"./vnode":13}],6:[function(require,module,exports){
function createElement(tagName){
  return document.createElement(tagName);
}

function createElementNS(namespaceURI, qualifiedName){
  return document.createElementNS(namespaceURI, qualifiedName);
}

function createTextNode(text){
  return document.createTextNode(text);
}


function insertBefore(parentNode, newNode, referenceNode){
  parentNode.insertBefore(newNode, referenceNode);
}


function removeChild(node, child){
  node.removeChild(child);
}

function appendChild(node, child){
  node.appendChild(child);
}

function parentNode(node){
  return node.parentElement;
}

function nextSibling(node){
  return node.nextSibling;
}

function tagName(node){
  return node.tagName;
}

function setTextContent(node, text){
  node.textContent = text;
}

module.exports = {
  createElement: createElement,
  createElementNS: createElementNS,
  createTextNode: createTextNode,
  appendChild: appendChild,
  removeChild: removeChild,
  insertBefore: insertBefore,
  parentNode: parentNode,
  nextSibling: nextSibling,
  tagName: tagName,
  setTextContent: setTextContent
};

},{}],7:[function(require,module,exports){
module.exports = {
  array: Array.isArray,
  primitive: function(s) { return typeof s === 'string' || typeof s === 'number'; },
};

},{}],8:[function(require,module,exports){
function updateClass(oldVnode, vnode) {
  var cur, name, elm = vnode.elm,
      oldClass = oldVnode.data.class || {},
      klass = vnode.data.class || {};
  for (name in oldClass) {
    if (!klass[name]) {
      elm.classList.remove(name);
    }
  }
  for (name in klass) {
    cur = klass[name];
    if (cur !== oldClass[name]) {
      elm.classList[cur ? 'add' : 'remove'](name);
    }
  }
}

module.exports = {create: updateClass, update: updateClass};

},{}],9:[function(require,module,exports){
var is = require('../is');

function arrInvoker(arr) {
  return function() {
    if (!arr.length) return;
    // Special case when length is two, for performance
    arr.length === 2 ? arr[0](arr[1]) : arr[0].apply(undefined, arr.slice(1));
  };
}

function fnInvoker(o) {
  return function(ev) { 
    if (o.fn === null) return;
    o.fn(ev); 
  };
}

function updateEventListeners(oldVnode, vnode) {
  var name, cur, old, elm = vnode.elm,
      oldOn = oldVnode.data.on || {}, on = vnode.data.on;
  if (!on) return;
  for (name in on) {
    cur = on[name];
    old = oldOn[name];
    if (old === undefined) {
      if (is.array(cur)) {
        elm.addEventListener(name, arrInvoker(cur));
      } else {
        cur = {fn: cur};
        on[name] = cur;
        elm.addEventListener(name, fnInvoker(cur));
      }
    } else if (is.array(old)) {
      // Deliberately modify old array since it's captured in closure created with `arrInvoker`
      old.length = cur.length;
      for (var i = 0; i < old.length; ++i) old[i] = cur[i];
      on[name]  = old;
    } else {
      old.fn = cur;
      on[name] = old;
    }
  }
  if (oldOn) {
    for (name in oldOn) {
      if (on[name] === undefined) {
        var old = oldOn[name];
        if (is.array(old)) {
          old.length = 0;
        }
        else {
          old.fn = null;
        }
      }
    }
  }
}

module.exports = {create: updateEventListeners, update: updateEventListeners};

},{"../is":7}],10:[function(require,module,exports){
function updateProps(oldVnode, vnode) {
  var key, cur, old, elm = vnode.elm,
      oldProps = oldVnode.data.props || {}, props = vnode.data.props || {};
  for (key in oldProps) {
    if (!props[key]) {
      delete elm[key];
    }
  }
  for (key in props) {
    cur = props[key];
    old = oldProps[key];
    if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
      elm[key] = cur;
    }
  }
}

module.exports = {create: updateProps, update: updateProps};

},{}],11:[function(require,module,exports){
var raf = (typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout;
var nextFrame = function(fn) { raf(function() { raf(fn); }); };

function setNextFrame(obj, prop, val) {
  nextFrame(function() { obj[prop] = val; });
}

function updateStyle(oldVnode, vnode) {
  var cur, name, elm = vnode.elm,
      oldStyle = oldVnode.data.style || {},
      style = vnode.data.style || {},
      oldHasDel = 'delayed' in oldStyle;
  for (name in oldStyle) {
    if (!style[name]) {
      elm.style[name] = '';
    }
  }
  for (name in style) {
    cur = style[name];
    if (name === 'delayed') {
      for (name in style.delayed) {
        cur = style.delayed[name];
        if (!oldHasDel || cur !== oldStyle.delayed[name]) {
          setNextFrame(elm.style, name, cur);
        }
      }
    } else if (name !== 'remove' && cur !== oldStyle[name]) {
      elm.style[name] = cur;
    }
  }
}

function applyDestroyStyle(vnode) {
  var style, name, elm = vnode.elm, s = vnode.data.style;
  if (!s || !(style = s.destroy)) return;
  for (name in style) {
    elm.style[name] = style[name];
  }
}

function applyRemoveStyle(vnode, rm) {
  var s = vnode.data.style;
  if (!s || !s.remove) {
    rm();
    return;
  }
  var name, elm = vnode.elm, idx, i = 0, maxDur = 0,
      compStyle, style = s.remove, amount = 0, applied = [];
  for (name in style) {
    applied.push(name);
    elm.style[name] = style[name];
  }
  compStyle = getComputedStyle(elm);
  var props = compStyle['transition-property'].split(', ');
  for (; i < props.length; ++i) {
    if(applied.indexOf(props[i]) !== -1) amount++;
  }
  elm.addEventListener('transitionend', function(ev) {
    if (ev.target === elm) --amount;
    if (amount === 0) rm();
  });
}

module.exports = {create: updateStyle, update: updateStyle, destroy: applyDestroyStyle, remove: applyRemoveStyle};

},{}],12:[function(require,module,exports){
// jshint newcap: false
/* global require, module, document, Node */
'use strict';

var VNode = require('./vnode');
var is = require('./is');
var domApi = require('./htmldomapi');

function isUndef(s) { return s === undefined; }
function isDef(s) { return s !== undefined; }

var emptyNode = VNode('', {}, [], undefined, undefined);

function sameVnode(vnode1, vnode2) {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}

function createKeyToOldIdx(children, beginIdx, endIdx) {
  var i, map = {}, key;
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key;
    if (isDef(key)) map[key] = i;
  }
  return map;
}

var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];

function init(modules, api) {
  var i, j, cbs = {};

  if (isUndef(api)) api = domApi;

  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      if (modules[j][hooks[i]] !== undefined) cbs[hooks[i]].push(modules[j][hooks[i]]);
    }
  }

  function emptyNodeAt(elm) {
    return VNode(api.tagName(elm).toLowerCase(), {}, [], undefined, elm);
  }

  function createRmCb(childElm, listeners) {
    return function() {
      if (--listeners === 0) {
        var parent = api.parentNode(childElm);
        api.removeChild(parent, childElm);
      }
    };
  }

  function createElm(vnode, insertedVnodeQueue) {
    var i, data = vnode.data;
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.init)) {
        i(vnode);
        data = vnode.data;
      }
    }
    var elm, children = vnode.children, sel = vnode.sel;
    if (isDef(sel)) {
      // Parse selector
      var hashIdx = sel.indexOf('#');
      var dotIdx = sel.indexOf('.', hashIdx);
      var hash = hashIdx > 0 ? hashIdx : sel.length;
      var dot = dotIdx > 0 ? dotIdx : sel.length;
      var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
      elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                                                          : api.createElement(tag);
      if (hash < dot) elm.id = sel.slice(hash + 1, dot);
      if (dotIdx > 0) elm.className = sel.slice(dot+1).replace(/\./g, ' ');
      if (is.array(children)) {
        for (i = 0; i < children.length; ++i) {
          api.appendChild(elm, createElm(children[i], insertedVnodeQueue));
        }
      } else if (is.primitive(vnode.text)) {
        api.appendChild(elm, api.createTextNode(vnode.text));
      }
      for (i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode);
      i = vnode.data.hook; // Reuse variable
      if (isDef(i)) {
        if (i.create) i.create(emptyNode, vnode);
        if (i.insert) insertedVnodeQueue.push(vnode);
      }
    } else {
      elm = vnode.elm = api.createTextNode(vnode.text);
    }
    return vnode.elm;
  }

  function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      api.insertBefore(parentElm, createElm(vnodes[startIdx], insertedVnodeQueue), before);
    }
  }

  function invokeDestroyHook(vnode) {
    var i, j, data = vnode.data;
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode);
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
      if (isDef(i = vnode.children)) {
        for (j = 0; j < vnode.children.length; ++j) {
          invokeDestroyHook(vnode.children[j]);
        }
      }
    }
  }

  function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      var i, listeners, rm, ch = vnodes[startIdx];
      if (isDef(ch)) {
        if (isDef(ch.sel)) {
          invokeDestroyHook(ch);
          listeners = cbs.remove.length + 1;
          rm = createRmCb(ch.elm, listeners);
          for (i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm);
          if (isDef(i = ch.data) && isDef(i = i.hook) && isDef(i = i.remove)) {
            i(ch, rm);
          } else {
            rm();
          }
        } else { // Text node
          api.removeChild(parentElm, ch.elm);
        }
      }
    }
  }

  function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
    var oldStartIdx = 0, newStartIdx = 0;
    var oldEndIdx = oldCh.length - 1;
    var oldStartVnode = oldCh[0];
    var oldEndVnode = oldCh[oldEndIdx];
    var newEndIdx = newCh.length - 1;
    var newStartVnode = newCh[0];
    var newEndVnode = newCh[newEndIdx];
    var oldKeyToIdx, idxInOld, elmToMove, before;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        idxInOld = oldKeyToIdx[newStartVnode.key];
        if (isUndef(idxInOld)) { // New element
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        } else {
          elmToMove = oldCh[idxInOld];
          patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
          oldCh[idxInOld] = undefined;
          api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        }
      }
    }
    if (oldStartIdx > oldEndIdx) {
      before = isUndef(newCh[newEndIdx+1]) ? null : newCh[newEndIdx+1].elm;
      addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
    }
  }

  function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
    var i, hook;
    if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
      i(oldVnode, vnode);
    }
    var elm = vnode.elm = oldVnode.elm, oldCh = oldVnode.children, ch = vnode.children;
    if (oldVnode === vnode) return;
    if (!sameVnode(oldVnode, vnode)) {
      var parentElm = api.parentNode(oldVnode.elm);
      elm = createElm(vnode, insertedVnodeQueue);
      api.insertBefore(parentElm, elm, oldVnode.elm);
      removeVnodes(parentElm, [oldVnode], 0, 0);
      return;
    }
    if (isDef(vnode.data)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      i = vnode.data.hook;
      if (isDef(i) && isDef(i = i.update)) i(oldVnode, vnode);
    }
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue);
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) api.setTextContent(elm, '');
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      } else if (isDef(oldVnode.text)) {
        api.setTextContent(elm, '');
      }
    } else if (oldVnode.text !== vnode.text) {
      api.setTextContent(elm, vnode.text);
    }
    if (isDef(hook) && isDef(i = hook.postpatch)) {
      i(oldVnode, vnode);
    }
  }

  return function(oldVnode, vnode) {
    var i, elm, parent;
    var insertedVnodeQueue = [];
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]();

    if (isUndef(oldVnode.sel)) {
      oldVnode = emptyNodeAt(oldVnode);
    }

    if (sameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue);
    } else {
      elm = oldVnode.elm;
      parent = api.parentNode(elm);

      createElm(vnode, insertedVnodeQueue);

      if (parent !== null) {
        api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }

    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
    }
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]();
    return vnode;
  };
}

module.exports = {init: init};

},{"./htmldomapi":6,"./is":7,"./vnode":13}],13:[function(require,module,exports){
module.exports = function(sel, data, children, text, elm) {
  var key = data === undefined ? undefined : data.key;
  return {sel: sel, data: data, children: children,
          text: text, elm: elm, key: key};
};

},{}],14:[function(require,module,exports){
const { pipe, Either } = require('fp-lib')
const fuzzyset = require('fuzzyset.js')

const commands = (data) => {
  const fuzzy_clients = fuzzyset(Object.keys(data.clients))
  
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
    'increase :letter': pipe(
      (letter) => {
        letter = letter.toLowerCase()
        if (data.letters[letter] !== undefined) {
          data.letters[letter]++
          return Either.Right(`increased letter ${letter} ${JSON.stringify(data.letters)}`)
        } else {
          return Either.Left(`cannot increase letter ${letter} -- it does not exist`)
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
    'show commands': () => {
      var clogs = data.clogs.slice()
      clogs.push(Reflect.ownKeys(_commands).join(', ') + '\n')
      return Either.Right({ clogs })
    },
    'clear screen': () => {
      return Either.Right({ clogs: [] })
    }
  }
  return _commands
}

module.exports = commands
},{"fp-lib":2,"fuzzyset.js":3}],15:[function(require,module,exports){
const channel = []

const init = (commands) => {
  for (var name in commands) {
    commands[name] = wrapper(commands[name])
  }
  return { commands, channel }
}

const wrapper = (callback) => (...args) => {
  channel.push(callback(...args))
}

module.exports = { init }
},{}],16:[function(require,module,exports){
const h = require('snabbdom/h')

const StateCreator = ({
  errMsg,
  clogs
}) => {
  while (clogs.length > 30) {
    clogs.shift()
  }
  return h('div#content', [
      h('div#err', [errMsg]),
      h('div#clog', clogs.map(log => h('span', [log])))
    ])
}


module.exports = StateCreator
},{"snabbdom/h":5}],17:[function(require,module,exports){
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  var _vtree = parentNode
  const _states = []
  
  // cursor stores the index of the currently rendered state
  // it moves back and forward for undo/redo operations
  const i = 0
  
  // replace must be true for first state change
  const change = (state, { replace }) => {
    if (!replace) {
      state = Object.assign(Object.assign({}, _states[i]), state)
    }

    const new_vtree = StateCreator(state)
    
    // remove all state parameters in front of cursor position
    if (i !== 0) {
      _states.splice(0, i)
      i = 0
    }
    _states.unshift(state)
    
    patch(_vtree, new_vtree)
    _vtree = new_vtree
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
},{"snabbdom":12,"snabbdom/modules/class":8,"snabbdom/modules/eventlisteners":9,"snabbdom/modules/props":10,"snabbdom/modules/style":11}],18:[function(require,module,exports){
(function (global){
/*global Horizon*/
const annyang = require('annyang')

const StateMachine = require('./StateMachine')
const Environment = require('./Environment')
const data = {
  letters: {
     a: 0,
     b: 0,
     c: 0
   },
  clients: {
     'Bob Jones': {},
     'Greg Harmon': {},
     'Leann Lewis': {},
     'Harmony Chostwitz': {}
   },
   vlogs: [],
   clogs: []
}
const commands = require('./Commands')
const { Either } = require('fp-lib')
const StateCreator = require('./StateCreator')

const horizon = Horizon()
horizon.status(status => {
  document.getElementById('header').className = `status-${status.type}`
  if (status === 'disconnected') {
    
  }
})
horizon.connect()

annyang.debug()
/////////////////////
const myEnv = Environment.init(commands(data))
global.myEnv = myEnv
global.horizon = horizon
global.annyang = annyang

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
const annyang_callbacks = {
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
   console.log(result)
   myEnv.channel.push(Either.Left({ errMsg: `No match for ${result}` }))
 },
 'end': () => {
   $activateBtn.disabled = false
   $activateBtn.textContent = 'Start'
 }
}

for (var cb in annyang_callbacks) {
  annyang.addCallback(cb, annyang_callbacks[cb])
}
for (var type in dom_events) {
  dom_events[type].forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

/////////////////// 



const State = StateMachine.init(document.getElementById('content'))(StateCreator)({
  errMsg: 'Poo',
  clogs: data.clogs
})

const StateChange = (_) => {
  const either_state = myEnv.channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (err_state => { // same behavior for error state
        State.change(err_state, { replace: false }) 
      })
      (state => { 
        State.change(state, { replace: false }) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange)
}


annyang.addCommands(myEnv.commands)

window.requestAnimationFrame(StateChange)

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./Commands":14,"./Environment":15,"./StateCreator":16,"./StateMachine":17,"annyang":1,"fp-lib":2}]},{},[18])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYW5ueWFuZy9hbm55YW5nLmpzIiwibm9kZV9tb2R1bGVzL2ZwLWxpYi9mcC1saWIuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvbGliL2Z1enp5c2V0LmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL3N0eWxlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwic3JjL0NvbW1hbmRzLmpzIiwic3JjL0Vudmlyb25tZW50LmpzIiwic3JjL1N0YXRlQ3JlYXRvci5qcyIsInNyYy9TdGF0ZU1hY2hpbmUuanMiLCJzcmMvcGxhdGZvcm0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2p3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RSQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vISBhbm55YW5nXG4vLyEgdmVyc2lvbiA6IDIuNC4wXG4vLyEgYXV0aG9yICA6IFRhbCBBdGVyIEBUYWxBdGVyXG4vLyEgbGljZW5zZSA6IE1JVFxuLy8hIGh0dHBzOi8vd3d3LlRhbEF0ZXIuY29tL2FubnlhbmcvXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHsgLy8gQU1EICsgZ2xvYmFsXG4gICAgZGVmaW5lKFtdLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gKHJvb3QuYW5ueWFuZyA9IGZhY3Rvcnkocm9vdCkpO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7IC8vIENvbW1vbkpTXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJvb3QpO1xuICB9IGVsc2UgeyAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICByb290LmFubnlhbmcgPSBmYWN0b3J5KHJvb3QpO1xuICB9XG59KHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdGhpcywgZnVuY3Rpb24gKHJvb3QsIHVuZGVmaW5lZCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICAvKipcbiAgICogIyBRdWljayBUdXRvcmlhbCwgSW50cm8gYW5kIERlbW9zXG4gICAqXG4gICAqIFRoZSBxdWlja2VzdCB3YXkgdG8gZ2V0IHN0YXJ0ZWQgaXMgdG8gdmlzaXQgdGhlIFthbm55YW5nIGhvbWVwYWdlXShodHRwczovL3d3dy50YWxhdGVyLmNvbS9hbm55YW5nLykuXG4gICAqXG4gICAqIEZvciBhIG1vcmUgaW4tZGVwdGggbG9vayBhdCBhbm55YW5nLCByZWFkIG9uLlxuICAgKlxuICAgKiAjIEFQSSBSZWZlcmVuY2VcbiAgICovXG5cbiAgdmFyIGFubnlhbmc7XG5cbiAgLy8gR2V0IHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBvYmplY3QsIHdoaWxlIGhhbmRsaW5nIGJyb3dzZXIgcHJlZml4ZXNcbiAgdmFyIFNwZWVjaFJlY29nbml0aW9uID0gcm9vdC5TcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290LndlYmtpdFNwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3QubW96U3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5tc1NwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3Qub1NwZWVjaFJlY29nbml0aW9uO1xuXG4gIC8vIENoZWNrIGJyb3dzZXIgc3VwcG9ydFxuICAvLyBUaGlzIGlzIGRvbmUgYXMgZWFybHkgYXMgcG9zc2libGUsIHRvIG1ha2UgaXQgYXMgZmFzdCBhcyBwb3NzaWJsZSBmb3IgdW5zdXBwb3J0ZWQgYnJvd3NlcnNcbiAgaWYgKCFTcGVlY2hSZWNvZ25pdGlvbikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmFyIGNvbW1hbmRzTGlzdCA9IFtdO1xuICB2YXIgcmVjb2duaXRpb247XG4gIHZhciBjYWxsYmFja3MgPSB7IHN0YXJ0OiBbXSwgZXJyb3I6IFtdLCBlbmQ6IFtdLCByZXN1bHQ6IFtdLCByZXN1bHRNYXRjaDogW10sIHJlc3VsdE5vTWF0Y2g6IFtdLCBlcnJvck5ldHdvcms6IFtdLCBlcnJvclBlcm1pc3Npb25CbG9ja2VkOiBbXSwgZXJyb3JQZXJtaXNzaW9uRGVuaWVkOiBbXSB9O1xuICB2YXIgYXV0b1Jlc3RhcnQ7XG4gIHZhciBsYXN0U3RhcnRlZEF0ID0gMDtcbiAgdmFyIGRlYnVnU3RhdGUgPSBmYWxzZTtcbiAgdmFyIGRlYnVnU3R5bGUgPSAnZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiAjMDBmOyc7XG4gIHZhciBwYXVzZUxpc3RlbmluZyA9IGZhbHNlO1xuICB2YXIgaXNMaXN0ZW5pbmcgPSBmYWxzZTtcblxuICAvLyBUaGUgY29tbWFuZCBtYXRjaGluZyBjb2RlIGlzIGEgbW9kaWZpZWQgdmVyc2lvbiBvZiBCYWNrYm9uZS5Sb3V0ZXIgYnkgSmVyZW15IEFzaGtlbmFzLCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gIHZhciBvcHRpb25hbFBhcmFtID0gL1xccypcXCgoLio/KVxcKVxccyovZztcbiAgdmFyIG9wdGlvbmFsUmVnZXggPSAvKFxcKFxcPzpbXildK1xcKSlcXD8vZztcbiAgdmFyIG5hbWVkUGFyYW0gICAgPSAvKFxcKFxcPyk/OlxcdysvZztcbiAgdmFyIHNwbGF0UGFyYW0gICAgPSAvXFwqXFx3Ky9nO1xuICB2YXIgZXNjYXBlUmVnRXhwICA9IC9bXFwte31cXFtcXF0rPy4sXFxcXFxcXiR8I10vZztcbiAgdmFyIGNvbW1hbmRUb1JlZ0V4cCA9IGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgICBjb21tYW5kID0gY29tbWFuZC5yZXBsYWNlKGVzY2FwZVJlZ0V4cCwgJ1xcXFwkJicpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShvcHRpb25hbFBhcmFtLCAnKD86JDEpPycpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShuYW1lZFBhcmFtLCBmdW5jdGlvbihtYXRjaCwgb3B0aW9uYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbmFsID8gbWF0Y2ggOiAnKFteXFxcXHNdKyknO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHNwbGF0UGFyYW0sICcoLio/KScpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShvcHRpb25hbFJlZ2V4LCAnXFxcXHMqJDE/XFxcXHMqJyk7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoJ14nICsgY29tbWFuZCArICckJywgJ2knKTtcbiAgfTtcblxuICAvLyBUaGlzIG1ldGhvZCByZWNlaXZlcyBhbiBhcnJheSBvZiBjYWxsYmFja3MgdG8gaXRlcmF0ZSBvdmVyLCBhbmQgaW52b2tlcyBlYWNoIG9mIHRoZW1cbiAgdmFyIGludm9rZUNhbGxiYWNrcyA9IGZ1bmN0aW9uKGNhbGxiYWNrcykge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBjYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2suY2FsbGJhY2suYXBwbHkoY2FsbGJhY2suY29udGV4dCwgYXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIGlzSW5pdGlhbGl6ZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gcmVjb2duaXRpb24gIT09IHVuZGVmaW5lZDtcbiAgfTtcblxuICB2YXIgaW5pdElmTmVlZGVkID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCFpc0luaXRpYWxpemVkKCkpIHtcbiAgICAgIGFubnlhbmcuaW5pdCh7fSwgZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgcmVnaXN0ZXJDb21tYW5kID0gZnVuY3Rpb24oY29tbWFuZCwgY2IsIHBocmFzZSkge1xuICAgIGNvbW1hbmRzTGlzdC5wdXNoKHsgY29tbWFuZDogY29tbWFuZCwgY2FsbGJhY2s6IGNiLCBvcmlnaW5hbFBocmFzZTogcGhyYXNlIH0pO1xuICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICBjb25zb2xlLmxvZygnQ29tbWFuZCBzdWNjZXNzZnVsbHkgbG9hZGVkOiAlYycrcGhyYXNlLCBkZWJ1Z1N0eWxlKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIHBhcnNlUmVzdWx0cyA9IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLnJlc3VsdCwgcmVzdWx0cyk7XG4gICAgdmFyIGNvbW1hbmRUZXh0O1xuICAgIC8vIGdvIG92ZXIgZWFjaCBvZiB0aGUgNSByZXN1bHRzIGFuZCBhbHRlcm5hdGl2ZSByZXN1bHRzIHJlY2VpdmVkICh3ZSd2ZSBzZXQgbWF4QWx0ZXJuYXRpdmVzIHRvIDUgYWJvdmUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGk8cmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gdGhlIHRleHQgcmVjb2duaXplZFxuICAgICAgY29tbWFuZFRleHQgPSByZXN1bHRzW2ldLnRyaW0oKTtcbiAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTcGVlY2ggcmVjb2duaXplZDogJWMnK2NvbW1hbmRUZXh0LCBkZWJ1Z1N0eWxlKTtcbiAgICAgIH1cblxuICAgICAgLy8gdHJ5IGFuZCBtYXRjaCByZWNvZ25pemVkIHRleHQgdG8gb25lIG9mIHRoZSBjb21tYW5kcyBvbiB0aGUgbGlzdFxuICAgICAgZm9yICh2YXIgaiA9IDAsIGwgPSBjb21tYW5kc0xpc3QubGVuZ3RoOyBqIDwgbDsgaisrKSB7XG4gICAgICAgIHZhciBjdXJyZW50Q29tbWFuZCA9IGNvbW1hbmRzTGlzdFtqXTtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGN1cnJlbnRDb21tYW5kLmNvbW1hbmQuZXhlYyhjb21tYW5kVGV4dCk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICB2YXIgcGFyYW1ldGVycyA9IHJlc3VsdC5zbGljZSgxKTtcbiAgICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2NvbW1hbmQgbWF0Y2hlZDogJWMnK2N1cnJlbnRDb21tYW5kLm9yaWdpbmFsUGhyYXNlLCBkZWJ1Z1N0eWxlKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnd2l0aCBwYXJhbWV0ZXJzJywgcGFyYW1ldGVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGV4ZWN1dGUgdGhlIG1hdGNoZWQgY29tbWFuZFxuICAgICAgICAgIGN1cnJlbnRDb21tYW5kLmNhbGxiYWNrLmFwcGx5KHRoaXMsIHBhcmFtZXRlcnMpO1xuICAgICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0TWF0Y2gsIGNvbW1hbmRUZXh0LCBjdXJyZW50Q29tbWFuZC5vcmlnaW5hbFBocmFzZSwgcmVzdWx0cyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0Tm9NYXRjaCwgcmVzdWx0cyk7XG4gIH07XG5cbiAgYW5ueWFuZyA9IHtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgYW5ueWFuZyB3aXRoIGEgbGlzdCBvZiBjb21tYW5kcyB0byByZWNvZ25pemUuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyA6bmFtZSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqIHZhciBjb21tYW5kczIgPSB7J2hpJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICpcbiAgICAgKiAvLyBpbml0aWFsaXplIGFubnlhbmcsIG92ZXJ3cml0aW5nIGFueSBwcmV2aW91c2x5IGFkZGVkIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5pbml0KGNvbW1hbmRzLCB0cnVlKTtcbiAgICAgKiAvLyBhZGRzIGFuIGFkZGl0aW9uYWwgY29tbWFuZCB3aXRob3V0IHJlbW92aW5nIHRoZSBwcmV2aW91cyBjb21tYW5kc1xuICAgICAqIGFubnlhbmcuaW5pdChjb21tYW5kczIsIGZhbHNlKTtcbiAgICAgKiBgYGBgXG4gICAgICogQXMgb2YgdjEuMS4wIGl0IGlzIG5vIGxvbmdlciByZXF1aXJlZCB0byBjYWxsIGluaXQoKS4gSnVzdCBzdGFydCgpIGxpc3RlbmluZyB3aGVuZXZlciB5b3Ugd2FudCwgYW5kIGFkZENvbW1hbmRzKCkgd2hlbmV2ZXIsIGFuZCBhcyBvZnRlbiBhcyB5b3UgbGlrZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb21tYW5kcyAtIENvbW1hbmRzIHRoYXQgYW5ueWFuZyBzaG91bGQgbGlzdGVuIHRvXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcmVzZXRDb21tYW5kcz10cnVlXSAtIFJlbW92ZSBhbGwgY29tbWFuZHMgYmVmb3JlIGluaXRpYWxpemluZz9cbiAgICAgKiBAbWV0aG9kIGluaXRcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqIEBzZWUgW0NvbW1hbmRzIE9iamVjdF0oI2NvbW1hbmRzLW9iamVjdClcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbihjb21tYW5kcywgcmVzZXRDb21tYW5kcykge1xuXG4gICAgICAvLyByZXNldENvbW1hbmRzIGRlZmF1bHRzIHRvIHRydWVcbiAgICAgIGlmIChyZXNldENvbW1hbmRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzZXRDb21tYW5kcyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNldENvbW1hbmRzID0gISFyZXNldENvbW1hbmRzO1xuICAgICAgfVxuXG4gICAgICAvLyBBYm9ydCBwcmV2aW91cyBpbnN0YW5jZXMgb2YgcmVjb2duaXRpb24gYWxyZWFkeSBydW5uaW5nXG4gICAgICBpZiAocmVjb2duaXRpb24gJiYgcmVjb2duaXRpb24uYWJvcnQpIHtcbiAgICAgICAgcmVjb2duaXRpb24uYWJvcnQoKTtcbiAgICAgIH1cblxuICAgICAgLy8gaW5pdGlhdGUgU3BlZWNoUmVjb2duaXRpb25cbiAgICAgIHJlY29nbml0aW9uID0gbmV3IFNwZWVjaFJlY29nbml0aW9uKCk7XG5cbiAgICAgIC8vIFNldCB0aGUgbWF4IG51bWJlciBvZiBhbHRlcm5hdGl2ZSB0cmFuc2NyaXB0cyB0byB0cnkgYW5kIG1hdGNoIHdpdGggYSBjb21tYW5kXG4gICAgICByZWNvZ25pdGlvbi5tYXhBbHRlcm5hdGl2ZXMgPSA1O1xuXG4gICAgICAvLyBJbiBIVFRQUywgdHVybiBvZmYgY29udGludW91cyBtb2RlIGZvciBmYXN0ZXIgcmVzdWx0cy5cbiAgICAgIC8vIEluIEhUVFAsICB0dXJuIG9uICBjb250aW51b3VzIG1vZGUgZm9yIG11Y2ggc2xvd2VyIHJlc3VsdHMsIGJ1dCBubyByZXBlYXRpbmcgc2VjdXJpdHkgbm90aWNlc1xuICAgICAgcmVjb2duaXRpb24uY29udGludW91cyA9IHJvb3QubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwOic7XG5cbiAgICAgIC8vIFNldHMgdGhlIGxhbmd1YWdlIHRvIHRoZSBkZWZhdWx0ICdlbi1VUycuIFRoaXMgY2FuIGJlIGNoYW5nZWQgd2l0aCBhbm55YW5nLnNldExhbmd1YWdlKClcbiAgICAgIHJlY29nbml0aW9uLmxhbmcgPSAnZW4tVVMnO1xuXG4gICAgICByZWNvZ25pdGlvbi5vbnN0YXJ0ICAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaXNMaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLnN0YXJ0KTtcbiAgICAgIH07XG5cbiAgICAgIHJlY29nbml0aW9uLm9uZXJyb3IgICA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZXJyb3IpO1xuICAgICAgICBzd2l0Y2ggKGV2ZW50LmVycm9yKSB7XG4gICAgICAgIGNhc2UgJ25ldHdvcmsnOlxuICAgICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZXJyb3JOZXR3b3JrKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbm90LWFsbG93ZWQnOlxuICAgICAgICBjYXNlICdzZXJ2aWNlLW5vdC1hbGxvd2VkJzpcbiAgICAgICAgICAvLyBpZiBwZXJtaXNzaW9uIHRvIHVzZSB0aGUgbWljIGlzIGRlbmllZCwgdHVybiBvZmYgYXV0by1yZXN0YXJ0XG4gICAgICAgICAgYXV0b1Jlc3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAvLyBkZXRlcm1pbmUgaWYgcGVybWlzc2lvbiB3YXMgZGVuaWVkIGJ5IHVzZXIgb3IgYXV0b21hdGljYWxseS5cbiAgICAgICAgICBpZiAobmV3IERhdGUoKS5nZXRUaW1lKCktbGFzdFN0YXJ0ZWRBdCA8IDIwMCkge1xuICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvclBlcm1pc3Npb25CbG9ja2VkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvclBlcm1pc3Npb25EZW5pZWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25lbmQgICAgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlzTGlzdGVuaW5nID0gZmFsc2U7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZW5kKTtcbiAgICAgICAgLy8gYW5ueWFuZyB3aWxsIGF1dG8gcmVzdGFydCBpZiBpdCBpcyBjbG9zZWQgYXV0b21hdGljYWxseSBhbmQgbm90IGJ5IHVzZXIgYWN0aW9uLlxuICAgICAgICBpZiAoYXV0b1Jlc3RhcnQpIHtcbiAgICAgICAgICAvLyBwbGF5IG5pY2VseSB3aXRoIHRoZSBicm93c2VyLCBhbmQgbmV2ZXIgcmVzdGFydCBhbm55YW5nIGF1dG9tYXRpY2FsbHkgbW9yZSB0aGFuIG9uY2UgcGVyIHNlY29uZFxuICAgICAgICAgIHZhciB0aW1lU2luY2VMYXN0U3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKS1sYXN0U3RhcnRlZEF0O1xuICAgICAgICAgIGlmICh0aW1lU2luY2VMYXN0U3RhcnQgPCAxMDAwKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGFubnlhbmcuc3RhcnQsIDEwMDAtdGltZVNpbmNlTGFzdFN0YXJ0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYW5ueWFuZy5zdGFydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25yZXN1bHQgID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYocGF1c2VMaXN0ZW5pbmcpIHtcbiAgICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCBoZWFyZCwgYnV0IGFubnlhbmcgaXMgcGF1c2VkJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1hcCB0aGUgcmVzdWx0cyB0byBhbiBhcnJheVxuICAgICAgICB2YXIgU3BlZWNoUmVjb2duaXRpb25SZXN1bHQgPSBldmVudC5yZXN1bHRzW2V2ZW50LnJlc3VsdEluZGV4XTtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgayA9IDA7IGs8U3BlZWNoUmVjb2duaXRpb25SZXN1bHQubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICByZXN1bHRzW2tdID0gU3BlZWNoUmVjb2duaXRpb25SZXN1bHRba10udHJhbnNjcmlwdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcnNlUmVzdWx0cyhyZXN1bHRzKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIGJ1aWxkIGNvbW1hbmRzIGxpc3RcbiAgICAgIGlmIChyZXNldENvbW1hbmRzKSB7XG4gICAgICAgIGNvbW1hbmRzTGlzdCA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKGNvbW1hbmRzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmFkZENvbW1hbmRzKGNvbW1hbmRzKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgbGlzdGVuaW5nLlxuICAgICAqIEl0J3MgYSBnb29kIGlkZWEgdG8gY2FsbCB0aGlzIGFmdGVyIGFkZGluZyBzb21lIGNvbW1hbmRzIGZpcnN0LCBidXQgbm90IG1hbmRhdG9yeS5cbiAgICAgKlxuICAgICAqIFJlY2VpdmVzIGFuIG9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHdoaWNoIHN1cHBvcnRzIHRoZSBmb2xsb3dpbmcgb3B0aW9uczpcbiAgICAgKlxuICAgICAqIC0gYGF1dG9SZXN0YXJ0YCAoYm9vbGVhbiwgZGVmYXVsdDogdHJ1ZSkgU2hvdWxkIGFubnlhbmcgcmVzdGFydCBpdHNlbGYgaWYgaXQgaXMgY2xvc2VkIGluZGlyZWN0bHksIGJlY2F1c2Ugb2Ygc2lsZW5jZSBvciB3aW5kb3cgY29uZmxpY3RzP1xuICAgICAqIC0gYGNvbnRpbnVvdXNgICAoYm9vbGVhbiwgZGVmYXVsdDogdW5kZWZpbmVkKSBBbGxvdyBmb3JjaW5nIGNvbnRpbnVvdXMgbW9kZSBvbiBvciBvZmYuIEFubnlhbmcgaXMgcHJldHR5IHNtYXJ0IGFib3V0IHRoaXMsIHNvIG9ubHkgc2V0IHRoaXMgaWYgeW91IGtub3cgd2hhdCB5b3UncmUgZG9pbmcuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogLy8gU3RhcnQgbGlzdGVuaW5nLCBkb24ndCByZXN0YXJ0IGF1dG9tYXRpY2FsbHlcbiAgICAgKiBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlIH0pO1xuICAgICAqIC8vIFN0YXJ0IGxpc3RlbmluZywgZG9uJ3QgcmVzdGFydCBhdXRvbWF0aWNhbGx5LCBzdG9wIHJlY29nbml0aW9uIGFmdGVyIGZpcnN0IHBocmFzZSByZWNvZ25pemVkXG4gICAgICogYW5ueWFuZy5zdGFydCh7IGF1dG9SZXN0YXJ0OiBmYWxzZSwgY29udGludW91czogZmFsc2UgfSk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zLlxuICAgICAqIEBtZXRob2Qgc3RhcnRcbiAgICAgKi9cbiAgICBzdGFydDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgcGF1c2VMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICBpZiAob3B0aW9ucy5hdXRvUmVzdGFydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGF1dG9SZXN0YXJ0ID0gISFvcHRpb25zLmF1dG9SZXN0YXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXV0b1Jlc3RhcnQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuY29udGludW91cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlY29nbml0aW9uLmNvbnRpbnVvdXMgPSAhIW9wdGlvbnMuY29udGludW91cztcbiAgICAgIH1cblxuICAgICAgbGFzdFN0YXJ0ZWRBdCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVjb2duaXRpb24uc3RhcnQoKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGUubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RvcCBsaXN0ZW5pbmcsIGFuZCB0dXJuIG9mZiBtaWMuXG4gICAgICpcbiAgICAgKiBBbHRlcm5hdGl2ZWx5LCB0byBvbmx5IHRlbXBvcmFyaWx5IHBhdXNlIGFubnlhbmcgcmVzcG9uZGluZyB0byBjb21tYW5kcyB3aXRob3V0IHN0b3BwaW5nIHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBlbmdpbmUgb3IgY2xvc2luZyB0aGUgbWljLCB1c2UgcGF1c2UoKSBpbnN0ZWFkLlxuICAgICAqIEBzZWUgW3BhdXNlKCldKCNwYXVzZSlcbiAgICAgKlxuICAgICAqIEBtZXRob2QgYWJvcnRcbiAgICAgKi9cbiAgICBhYm9ydDogZnVuY3Rpb24oKSB7XG4gICAgICBhdXRvUmVzdGFydCA9IGZhbHNlO1xuICAgICAgaWYgKGlzSW5pdGlhbGl6ZWQoKSkge1xuICAgICAgICByZWNvZ25pdGlvbi5hYm9ydCgpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQYXVzZSBsaXN0ZW5pbmcuIGFubnlhbmcgd2lsbCBzdG9wIHJlc3BvbmRpbmcgdG8gY29tbWFuZHMgKHVudGlsIHRoZSByZXN1bWUgb3Igc3RhcnQgbWV0aG9kcyBhcmUgY2FsbGVkKSwgd2l0aG91dCB0dXJuaW5nIG9mZiB0aGUgYnJvd3NlcidzIFNwZWVjaFJlY29nbml0aW9uIGVuZ2luZSBvciB0aGUgbWljLlxuICAgICAqXG4gICAgICogQWx0ZXJuYXRpdmVseSwgdG8gc3RvcCB0aGUgU3BlZWNoUmVjb2duaXRpb24gZW5naW5lIGFuZCBjbG9zZSB0aGUgbWljLCB1c2UgYWJvcnQoKSBpbnN0ZWFkLlxuICAgICAqIEBzZWUgW2Fib3J0KCldKCNhYm9ydClcbiAgICAgKlxuICAgICAqIEBtZXRob2QgcGF1c2VcbiAgICAgKi9cbiAgICBwYXVzZTogZnVuY3Rpb24oKSB7XG4gICAgICBwYXVzZUxpc3RlbmluZyA9IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgbGlzdGVuaW5nIGFuZCByZXN0b3JlcyBjb21tYW5kIGNhbGxiYWNrIGV4ZWN1dGlvbiB3aGVuIGEgcmVzdWx0IG1hdGNoZXMuXG4gICAgICogSWYgU3BlZWNoUmVjb2duaXRpb24gd2FzIGFib3J0ZWQgKHN0b3BwZWQpLCBzdGFydCBpdC5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgcmVzdW1lXG4gICAgICovXG4gICAgcmVzdW1lOiBmdW5jdGlvbigpIHtcbiAgICAgIGFubnlhbmcuc3RhcnQoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVHVybiBvbiBvdXRwdXQgb2YgZGVidWcgbWVzc2FnZXMgdG8gdGhlIGNvbnNvbGUuIFVnbHksIGJ1dCBzdXBlci1oYW5keSFcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW25ld1N0YXRlPXRydWVdIC0gVHVybiBvbi9vZmYgZGVidWcgbWVzc2FnZXNcbiAgICAgKiBAbWV0aG9kIGRlYnVnXG4gICAgICovXG4gICAgZGVidWc6IGZ1bmN0aW9uKG5ld1N0YXRlKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZGVidWdTdGF0ZSA9ICEhbmV3U3RhdGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWJ1Z1N0YXRlID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBsYW5ndWFnZSB0aGUgdXNlciB3aWxsIHNwZWFrIGluLiBJZiB0aGlzIG1ldGhvZCBpcyBub3QgY2FsbGVkLCBkZWZhdWx0cyB0byAnZW4tVVMnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGxhbmd1YWdlIC0gVGhlIGxhbmd1YWdlIChsb2NhbGUpXG4gICAgICogQG1ldGhvZCBzZXRMYW5ndWFnZVxuICAgICAqIEBzZWUgW0xhbmd1YWdlc10oI2xhbmd1YWdlcylcbiAgICAgKi9cbiAgICBzZXRMYW5ndWFnZTogZnVuY3Rpb24obGFuZ3VhZ2UpIHtcbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuICAgICAgcmVjb2duaXRpb24ubGFuZyA9IGxhbmd1YWdlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgY29tbWFuZHMgdGhhdCBhbm55YW5nIHdpbGwgcmVzcG9uZCB0by4gU2ltaWxhciBpbiBzeW50YXggdG8gaW5pdCgpLCBidXQgZG9lc24ndCByZW1vdmUgZXhpc3RpbmcgY29tbWFuZHMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyA6bmFtZSc6IGhlbGxvRnVuY3Rpb24sICdob3dkeSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqIHZhciBjb21tYW5kczIgPSB7J2hpJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICpcbiAgICAgKiBhbm55YW5nLmFkZENvbW1hbmRzKGNvbW1hbmRzKTtcbiAgICAgKiBhbm55YW5nLmFkZENvbW1hbmRzKGNvbW1hbmRzMik7XG4gICAgICogLy8gYW5ueWFuZyB3aWxsIG5vdyBsaXN0ZW4gdG8gYWxsIHRocmVlIGNvbW1hbmRzXG4gICAgICogYGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbW1hbmRzIC0gQ29tbWFuZHMgdGhhdCBhbm55YW5nIHNob3VsZCBsaXN0ZW4gdG9cbiAgICAgKiBAbWV0aG9kIGFkZENvbW1hbmRzXG4gICAgICogQHNlZSBbQ29tbWFuZHMgT2JqZWN0XSgjY29tbWFuZHMtb2JqZWN0KVxuICAgICAqL1xuICAgIGFkZENvbW1hbmRzOiBmdW5jdGlvbihjb21tYW5kcykge1xuICAgICAgdmFyIGNiO1xuXG4gICAgICBpbml0SWZOZWVkZWQoKTtcblxuICAgICAgZm9yICh2YXIgcGhyYXNlIGluIGNvbW1hbmRzKSB7XG4gICAgICAgIGlmIChjb21tYW5kcy5oYXNPd25Qcm9wZXJ0eShwaHJhc2UpKSB7XG4gICAgICAgICAgY2IgPSByb290W2NvbW1hbmRzW3BocmFzZV1dIHx8IGNvbW1hbmRzW3BocmFzZV07XG4gICAgICAgICAgaWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgLy8gY29udmVydCBjb21tYW5kIHRvIHJlZ2V4IHRoZW4gcmVnaXN0ZXIgdGhlIGNvbW1hbmRcbiAgICAgICAgICAgIHJlZ2lzdGVyQ29tbWFuZChjb21tYW5kVG9SZWdFeHAocGhyYXNlKSwgY2IsIHBocmFzZSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY2IgPT09ICdvYmplY3QnICYmIGNiLnJlZ2V4cCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgLy8gcmVnaXN0ZXIgdGhlIGNvbW1hbmRcbiAgICAgICAgICAgIHJlZ2lzdGVyQ29tbWFuZChuZXcgUmVnRXhwKGNiLnJlZ2V4cC5zb3VyY2UsICdpJyksIGNiLmNhbGxiYWNrLCBwaHJhc2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQ2FuIG5vdCByZWdpc3RlciBjb21tYW5kOiAlYycrcGhyYXNlLCBkZWJ1Z1N0eWxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZXhpc3RpbmcgY29tbWFuZHMuIENhbGxlZCB3aXRoIGEgc2luZ2xlIHBocmFzZSwgYXJyYXkgb2YgcGhyYXNlcywgb3IgbWV0aG9kaWNhbGx5LiBQYXNzIG5vIHBhcmFtcyB0byByZW1vdmUgYWxsIGNvbW1hbmRzLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIHZhciBjb21tYW5kcyA9IHsnaGVsbG8nOiBoZWxsb0Z1bmN0aW9uLCAnaG93ZHknOiBoZWxsb0Z1bmN0aW9uLCAnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBhbGwgZXhpc3RpbmcgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNvbW1hbmRzKCk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgc29tZSBjb21tYW5kc1xuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAqXG4gICAgICogLy8gRG9uJ3QgcmVzcG9uZCB0byBoZWxsb1xuICAgICAqIGFubnlhbmcucmVtb3ZlQ29tbWFuZHMoJ2hlbGxvJyk7XG4gICAgICpcbiAgICAgKiAvLyBEb24ndCByZXNwb25kIHRvIGhvd2R5IG9yIGhpXG4gICAgICogYW5ueWFuZy5yZW1vdmVDb21tYW5kcyhbJ2hvd2R5JywgJ2hpJ10pO1xuICAgICAqIGBgYGBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxVbmRlZmluZWR9IFtjb21tYW5kc1RvUmVtb3ZlXSAtIENvbW1hbmRzIHRvIHJlbW92ZVxuICAgICAqIEBtZXRob2QgcmVtb3ZlQ29tbWFuZHNcbiAgICAgKi9cbiAgICByZW1vdmVDb21tYW5kczogZnVuY3Rpb24oY29tbWFuZHNUb1JlbW92ZSkge1xuICAgICAgaWYgKGNvbW1hbmRzVG9SZW1vdmUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb21tYW5kc0xpc3QgPSBbXTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29tbWFuZHNUb1JlbW92ZSA9IEFycmF5LmlzQXJyYXkoY29tbWFuZHNUb1JlbW92ZSkgPyBjb21tYW5kc1RvUmVtb3ZlIDogW2NvbW1hbmRzVG9SZW1vdmVdO1xuICAgICAgY29tbWFuZHNMaXN0ID0gY29tbWFuZHNMaXN0LmZpbHRlcihmdW5jdGlvbihjb21tYW5kKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpPGNvbW1hbmRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoY29tbWFuZHNUb1JlbW92ZVtpXSA9PT0gY29tbWFuZC5vcmlnaW5hbFBocmFzZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgaW4gY2FzZSBvbmUgb2YgdGhlIGZvbGxvd2luZyBldmVudHMgaGFwcGVuczpcbiAgICAgKlxuICAgICAqICogYHN0YXJ0YCAtIEZpcmVkIGFzIHNvb24gYXMgdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2duaXRpb24gZW5naW5lIHN0YXJ0cyBsaXN0ZW5pbmdcbiAgICAgKiAqIGBlcnJvcmAgLSBGaXJlZCB3aGVuIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbnRpb24gZW5naW5lIHJldHVybnMgYW4gZXJyb3IsIHRoaXMgZ2VuZXJpYyBlcnJvciBjYWxsYmFjayB3aWxsIGJlIGZvbGxvd2VkIGJ5IG1vcmUgYWNjdXJhdGUgZXJyb3IgY2FsbGJhY2tzIChib3RoIHdpbGwgZmlyZSBpZiBib3RoIGFyZSBkZWZpbmVkKVxuICAgICAqICogYGVycm9yTmV0d29ya2AgLSBGaXJlZCB3aGVuIFNwZWVjaCBSZWNvZ25pdGlvbiBmYWlscyBiZWNhdXNlIG9mIGEgbmV0d29yayBlcnJvclxuICAgICAqICogYGVycm9yUGVybWlzc2lvbkJsb2NrZWRgIC0gRmlyZWQgd2hlbiB0aGUgYnJvd3NlciBibG9ja3MgdGhlIHBlcm1pc3Npb24gcmVxdWVzdCB0byB1c2UgU3BlZWNoIFJlY29nbml0aW9uLlxuICAgICAqICogYGVycm9yUGVybWlzc2lvbkRlbmllZGAgLSBGaXJlZCB3aGVuIHRoZSB1c2VyIGJsb2NrcyB0aGUgcGVybWlzc2lvbiByZXF1ZXN0IHRvIHVzZSBTcGVlY2ggUmVjb2duaXRpb24uXG4gICAgICogKiBgZW5kYCAtIEZpcmVkIHdoZW4gdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2duaXRpb24gZW5naW5lIHN0b3BzXG4gICAgICogKiBgcmVzdWx0YCAtIEZpcmVkIGFzIHNvb24gYXMgc29tZSBzcGVlY2ggd2FzIGlkZW50aWZpZWQuIFRoaXMgZ2VuZXJpYyBjYWxsYmFjayB3aWxsIGJlIGZvbGxvd2VkIGJ5IGVpdGhlciB0aGUgYHJlc3VsdE1hdGNoYCBvciBgcmVzdWx0Tm9NYXRjaGAgY2FsbGJhY2tzLlxuICAgICAqICAgICBDYWxsYmFjayBmdW5jdGlvbnMgcmVnaXN0ZXJlZCB0byB0aGlzIGV2ZW50IHdpbGwgaW5jbHVkZSBhbiBhcnJheSBvZiBwb3NzaWJsZSBwaHJhc2VzIHRoZSB1c2VyIHNhaWQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50XG4gICAgICogKiBgcmVzdWx0TWF0Y2hgIC0gRmlyZWQgd2hlbiBhbm55YW5nIHdhcyBhYmxlIHRvIG1hdGNoIGJldHdlZW4gd2hhdCB0aGUgdXNlciBzYWlkIGFuZCBhIHJlZ2lzdGVyZWQgY29tbWFuZFxuICAgICAqICAgICBDYWxsYmFjayBmdW5jdGlvbnMgcmVnaXN0ZXJlZCB0byB0aGlzIGV2ZW50IHdpbGwgaW5jbHVkZSB0aHJlZSBhcmd1bWVudHMgaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAgICAgKiAgICAgICAqIFRoZSBwaHJhc2UgdGhlIHVzZXIgc2FpZCB0aGF0IG1hdGNoZWQgYSBjb21tYW5kXG4gICAgICogICAgICAgKiBUaGUgY29tbWFuZCB0aGF0IHdhcyBtYXRjaGVkXG4gICAgICogICAgICAgKiBBbiBhcnJheSBvZiBwb3NzaWJsZSBhbHRlcm5hdGl2ZSBwaHJhc2VzIHRoZSB1c2VyIG1pZ2h0J3ZlIHNhaWRcbiAgICAgKiAqIGByZXN1bHROb01hdGNoYCAtIEZpcmVkIHdoZW4gd2hhdCB0aGUgdXNlciBzYWlkIGRpZG4ndCBtYXRjaCBhbnkgb2YgdGhlIHJlZ2lzdGVyZWQgY29tbWFuZHMuXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIGFuIGFycmF5IG9mIHBvc3NpYmxlIHBocmFzZXMgdGhlIHVzZXIgbWlnaHQndmUgc2FpZCBhcyB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlcnJvcicsIGZ1bmN0aW9uKCkge1xuICAgICAqICAgJCgnLm15RXJyb3JUZXh0JykudGV4dCgnVGhlcmUgd2FzIGFuIGVycm9yIScpO1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygncmVzdWx0TWF0Y2gnLCBmdW5jdGlvbih1c2VyU2FpZCwgY29tbWFuZFRleHQsIHBocmFzZXMpIHtcbiAgICAgKiAgIGNvbnNvbGUubG9nKHVzZXJTYWlkKTsgLy8gc2FtcGxlIG91dHB1dDogJ2hlbGxvJ1xuICAgICAqICAgY29uc29sZS5sb2coY29tbWFuZFRleHQpOyAvLyBzYW1wbGUgb3V0cHV0OiAnaGVsbG8gKHRoZXJlKSdcbiAgICAgKiAgIGNvbnNvbGUubG9nKHBocmFzZXMpOyAvLyBzYW1wbGUgb3V0cHV0OiBbJ2hlbGxvJywgJ2hhbG8nLCAneWVsbG93JywgJ3BvbG8nLCAnaGVsbG8ga2l0dHknXVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gcGFzcyBsb2NhbCBjb250ZXh0IHRvIGEgZ2xvYmFsIGZ1bmN0aW9uIGNhbGxlZCBub3RDb25uZWN0ZWRcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlcnJvck5ldHdvcmsnLCBub3RDb25uZWN0ZWQsIHRoaXMpO1xuICAgICAqIGBgYGBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSAtIE5hbWUgb2YgZXZlbnQgdGhhdCB3aWxsIHRyaWdnZXIgdGhpcyBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBldmVudCBpcyB0cmlnZ2VyZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHRdIC0gT3B0aW9uYWwgY29udGV4dCBmb3IgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogQG1ldGhvZCBhZGRDYWxsYmFja1xuICAgICAqL1xuICAgIGFkZENhbGxiYWNrOiBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKGNhbGxiYWNrc1t0eXBlXSAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgY2IgPSByb290W2NhbGxiYWNrXSB8fCBjYWxsYmFjaztcbiAgICAgIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2tzW3R5cGVdLnB1c2goe2NhbGxiYWNrOiBjYiwgY29udGV4dDogY29udGV4dCB8fCB0aGlzfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBjYWxsYmFja3MgZnJvbSBldmVudHMuXG4gICAgICpcbiAgICAgKiAtIFBhc3MgYW4gZXZlbnQgbmFtZSBhbmQgYSBjYWxsYmFjayBjb21tYW5kIHRvIHJlbW92ZSB0aGF0IGNhbGxiYWNrIGNvbW1hbmQgZnJvbSB0aGF0IGV2ZW50IHR5cGUuXG4gICAgICogLSBQYXNzIGp1c3QgYW4gZXZlbnQgbmFtZSB0byByZW1vdmUgYWxsIGNhbGxiYWNrIGNvbW1hbmRzIGZyb20gdGhhdCBldmVudCB0eXBlLlxuICAgICAqIC0gUGFzcyB1bmRlZmluZWQgYXMgZXZlbnQgbmFtZSBhbmQgYSBjYWxsYmFjayBjb21tYW5kIHRvIHJlbW92ZSB0aGF0IGNhbGxiYWNrIGNvbW1hbmQgZnJvbSBhbGwgZXZlbnQgdHlwZXMuXG4gICAgICogLSBQYXNzIG5vIHBhcmFtcyB0byByZW1vdmUgYWxsIGNhbGxiYWNrIGNvbW1hbmRzIGZyb20gYWxsIGV2ZW50IHR5cGVzLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ3N0YXJ0JywgbXlGdW5jdGlvbjEpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ3N0YXJ0JywgbXlGdW5jdGlvbjIpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2VuZCcsIG15RnVuY3Rpb24xKTtcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlbmQnLCBteUZ1bmN0aW9uMik7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgYWxsIGNhbGxiYWNrcyBmcm9tIGFsbCBldmVudHM6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIGFsbCBjYWxsYmFja3MgYXR0YWNoZWQgdG8gZW5kIGV2ZW50OlxuICAgICAqIGFubnlhbmcucmVtb3ZlQ2FsbGJhY2soJ2VuZCcpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIG15RnVuY3Rpb24yIGZyb20gYmVpbmcgY2FsbGVkIG9uIHN0YXJ0OlxuICAgICAqIGFubnlhbmcucmVtb3ZlQ2FsbGJhY2soJ3N0YXJ0JywgbXlGdW5jdGlvbjIpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIG15RnVuY3Rpb24xIGZyb20gYmVpbmcgY2FsbGVkIG9uIGFsbCBldmVudHM6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjayh1bmRlZmluZWQsIG15RnVuY3Rpb24xKTtcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdHlwZSBOYW1lIG9mIGV2ZW50IHR5cGUgdG8gcmVtb3ZlIGNhbGxiYWNrIGZyb21cbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJlbW92ZVxuICAgICAqIEByZXR1cm5zIHVuZGVmaW5lZFxuICAgICAqIEBtZXRob2QgcmVtb3ZlQ2FsbGJhY2tcbiAgICAgKi9cbiAgICByZW1vdmVDYWxsYmFjazogZnVuY3Rpb24odHlwZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBjb21wYXJlV2l0aENhbGxiYWNrUGFyYW1ldGVyID0gZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgcmV0dXJuIGNiLmNhbGxiYWNrICE9PSBjYWxsYmFjaztcbiAgICAgIH07XG4gICAgICAvLyBHbyBvdmVyIGVhY2ggY2FsbGJhY2sgdHlwZSBpbiBjYWxsYmFja3Mgc3RvcmUgb2JqZWN0XG4gICAgICBmb3IgKHZhciBjYWxsYmFja1R5cGUgaW4gY2FsbGJhY2tzKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3MuaGFzT3duUHJvcGVydHkoY2FsbGJhY2tUeXBlKSkge1xuICAgICAgICAgIC8vIGlmIHRoaXMgaXMgdGhlIHR5cGUgdXNlciBhc2tlZCB0byBkZWxldGUsIG9yIGhlIGFza2VkIHRvIGRlbGV0ZSBhbGwsIGdvIGFoZWFkLlxuICAgICAgICAgIGlmICh0eXBlID09PSB1bmRlZmluZWQgfHwgdHlwZSA9PT0gY2FsbGJhY2tUeXBlKSB7XG4gICAgICAgICAgICAvLyBJZiB1c2VyIGFza2VkIHRvIGRlbGV0ZSBhbGwgY2FsbGJhY2tzIGluIHRoaXMgdHlwZSBvciBhbGwgdHlwZXNcbiAgICAgICAgICAgIGlmIChjYWxsYmFjayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0gPSBbXTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgYWxsIG1hdGNoaW5nIGNhbGxiYWNrc1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tjYWxsYmFja1R5cGVdID0gY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0uZmlsdGVyKGNvbXBhcmVXaXRoQ2FsbGJhY2tQYXJhbWV0ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgc3BlZWNoIHJlY29nbml0aW9uIGlzIGN1cnJlbnRseSBvbi5cbiAgICAgKiBSZXR1cm5zIGZhbHNlIGlmIHNwZWVjaCByZWNvZ25pdGlvbiBpcyBvZmYgb3IgYW5ueWFuZyBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGJvb2xlYW4gdHJ1ZSA9IFNwZWVjaFJlY29nbml0aW9uIGlzIG9uIGFuZCBhbm55YW5nIGlzIGxpc3RlbmluZ1xuICAgICAqIEBtZXRob2QgaXNMaXN0ZW5pbmdcbiAgICAgKi9cbiAgICBpc0xpc3RlbmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaXNMaXN0ZW5pbmcgJiYgIXBhdXNlTGlzdGVuaW5nO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBpbnN0YW5jZSBvZiB0aGUgYnJvd3NlcidzIFNwZWVjaFJlY29nbml0aW9uIG9iamVjdCB1c2VkIGJ5IGFubnlhbmcuXG4gICAgICogVXNlZnVsIGluIGNhc2UgeW91IHdhbnQgZGlyZWN0IGFjY2VzcyB0byB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyBTcGVlY2hSZWNvZ25pdGlvbiBUaGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pemVyIGN1cnJlbnRseSB1c2VkIGJ5IGFubnlhbmdcbiAgICAgKiBAbWV0aG9kIGdldFNwZWVjaFJlY29nbml6ZXJcbiAgICAgKi9cbiAgICBnZXRTcGVlY2hSZWNvZ25pemVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiByZWNvZ25pdGlvbjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2ltdWxhdGUgc3BlZWNoIGJlaW5nIHJlY29nbml6ZWQuIFRoaXMgd2lsbCB0cmlnZ2VyIHRoZSBzYW1lIGV2ZW50cyBhbmQgYmVoYXZpb3IgYXMgd2hlbiB0aGUgU3BlZWNoIFJlY29nbml0aW9uXG4gICAgICogZGV0ZWN0cyBzcGVlY2guXG4gICAgICpcbiAgICAgKiBDYW4gYWNjZXB0IGVpdGhlciBhIHN0cmluZyBjb250YWluaW5nIGEgc2luZ2xlIHNlbnRlbmNlLCBvciBhbiBhcnJheSBjb250YWluaW5nIG11bHRpcGxlIHNlbnRlbmNlcyB0byBiZSBjaGVja2VkXG4gICAgICogaW4gb3JkZXIgdW50aWwgb25lIG9mIHRoZW0gbWF0Y2hlcyBhIGNvbW1hbmQgKHNpbWlsYXIgdG8gdGhlIHdheSBTcGVlY2ggUmVjb2duaXRpb24gQWx0ZXJuYXRpdmVzIGFyZSBwYXJzZWQpXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogYW5ueWFuZy50cmlnZ2VyKCdUaW1lIGZvciBzb21lIHRocmlsbGluZyBoZXJvaWNzJyk7XG4gICAgICogYW5ueWFuZy50cmlnZ2VyKFxuICAgICAqICAgICBbJ1RpbWUgZm9yIHNvbWUgdGhyaWxsaW5nIGhlcm9pY3MnLCAnVGltZSBmb3Igc29tZSB0aHJpbGxpbmcgYWVyb2JpY3MnXVxuICAgICAqICAgKTtcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc3RyaW5nfGFycmF5IHNlbnRlbmNlcyBBIHNlbnRlbmNlIGFzIGEgc3RyaW5nIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb2YgcG9zc2libGUgc2VudGVuY2VzXG4gICAgICogQHJldHVybnMgdW5kZWZpbmVkXG4gICAgICogQG1ldGhvZCB0cmlnZ2VyXG4gICAgICovXG4gICAgdHJpZ2dlcjogZnVuY3Rpb24oc2VudGVuY2VzKSB7XG4gICAgICAvKlxuICAgICAgaWYoIWFubnlhbmcuaXNMaXN0ZW5pbmcoKSkge1xuICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgIGlmICghaXNMaXN0ZW5pbmcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW5ub3QgdHJpZ2dlciB3aGlsZSBhbm55YW5nIGlzIGFib3J0ZWQnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCBoZWFyZCwgYnV0IGFubnlhbmcgaXMgcGF1c2VkJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgICovXG5cbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShzZW50ZW5jZXMpKSB7XG4gICAgICAgIHNlbnRlbmNlcyA9IFtzZW50ZW5jZXNdO1xuICAgICAgfVxuXG4gICAgICBwYXJzZVJlc3VsdHMoc2VudGVuY2VzKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIGFubnlhbmc7XG5cbn0pKTtcblxuLyoqXG4gKiAjIEdvb2QgdG8gS25vd1xuICpcbiAqICMjIENvbW1hbmRzIE9iamVjdFxuICpcbiAqIEJvdGggdGhlIFtpbml0KCldKCkgYW5kIGFkZENvbW1hbmRzKCkgbWV0aG9kcyByZWNlaXZlIGEgYGNvbW1hbmRzYCBvYmplY3QuXG4gKlxuICogYW5ueWFuZyB1bmRlcnN0YW5kcyBjb21tYW5kcyB3aXRoIGBuYW1lZCB2YXJpYWJsZXNgLCBgc3BsYXRzYCwgYW5kIGBvcHRpb25hbCB3b3Jkc2AuXG4gKlxuICogKiBVc2UgYG5hbWVkIHZhcmlhYmxlc2AgZm9yIG9uZSB3b3JkIGFyZ3VtZW50cyBpbiB5b3VyIGNvbW1hbmQuXG4gKiAqIFVzZSBgc3BsYXRzYCB0byBjYXB0dXJlIG11bHRpLXdvcmQgdGV4dCBhdCB0aGUgZW5kIG9mIHlvdXIgY29tbWFuZCAoZ3JlZWR5KS5cbiAqICogVXNlIGBvcHRpb25hbCB3b3Jkc2Agb3IgcGhyYXNlcyB0byBkZWZpbmUgYSBwYXJ0IG9mIHRoZSBjb21tYW5kIGFzIG9wdGlvbmFsLlxuICpcbiAqICMjIyMgRXhhbXBsZXM6XG4gKiBgYGBgaHRtbFxuICogPHNjcmlwdD5cbiAqIHZhciBjb21tYW5kcyA9IHtcbiAqICAgLy8gYW5ueWFuZyB3aWxsIGNhcHR1cmUgYW55dGhpbmcgYWZ0ZXIgYSBzcGxhdCAoKikgYW5kIHBhc3MgaXQgdG8gdGhlIGZ1bmN0aW9uLlxuICogICAvLyBlLmcuIHNheWluZyBcIlNob3cgbWUgQmF0bWFuIGFuZCBSb2JpblwiIHdpbGwgY2FsbCBzaG93RmxpY2tyKCdCYXRtYW4gYW5kIFJvYmluJyk7XG4gKiAgICdzaG93IG1lICp0YWcnOiBzaG93RmxpY2tyLFxuICpcbiAqICAgLy8gQSBuYW1lZCB2YXJpYWJsZSBpcyBhIG9uZSB3b3JkIHZhcmlhYmxlLCB0aGF0IGNhbiBmaXQgYW55d2hlcmUgaW4geW91ciBjb21tYW5kLlxuICogICAvLyBlLmcuIHNheWluZyBcImNhbGN1bGF0ZSBPY3RvYmVyIHN0YXRzXCIgd2lsbCBjYWxsIGNhbGN1bGF0ZVN0YXRzKCdPY3RvYmVyJyk7XG4gKiAgICdjYWxjdWxhdGUgOm1vbnRoIHN0YXRzJzogY2FsY3VsYXRlU3RhdHMsXG4gKlxuICogICAvLyBCeSBkZWZpbmluZyBhIHBhcnQgb2YgdGhlIGZvbGxvd2luZyBjb21tYW5kIGFzIG9wdGlvbmFsLCBhbm55YW5nIHdpbGwgcmVzcG9uZFxuICogICAvLyB0byBib3RoOiBcInNheSBoZWxsbyB0byBteSBsaXR0bGUgZnJpZW5kXCIgYXMgd2VsbCBhcyBcInNheSBoZWxsbyBmcmllbmRcIlxuICogICAnc2F5IGhlbGxvICh0byBteSBsaXR0bGUpIGZyaWVuZCc6IGdyZWV0aW5nXG4gKiB9O1xuICpcbiAqIHZhciBzaG93RmxpY2tyID0gZnVuY3Rpb24odGFnKSB7XG4gKiAgIHZhciB1cmwgPSAnaHR0cDovL2FwaS5mbGlja3IuY29tL3NlcnZpY2VzL3Jlc3QvP3RhZ3M9Jyt0YWc7XG4gKiAgICQuZ2V0SlNPTih1cmwpO1xuICogfVxuICpcbiAqIHZhciBjYWxjdWxhdGVTdGF0cyA9IGZ1bmN0aW9uKG1vbnRoKSB7XG4gKiAgICQoJyNzdGF0cycpLnRleHQoJ1N0YXRpc3RpY3MgZm9yICcrbW9udGgpO1xuICogfVxuICpcbiAqIHZhciBncmVldGluZyA9IGZ1bmN0aW9uKCkge1xuICogICAkKCcjZ3JlZXRpbmcnKS50ZXh0KCdIZWxsbyEnKTtcbiAqIH1cbiAqIDwvc2NyaXB0PlxuICogYGBgYFxuICpcbiAqICMjIyBVc2luZyBSZWd1bGFyIEV4cHJlc3Npb25zIGluIGNvbW1hbmRzXG4gKiBGb3IgYWR2YW5jZWQgY29tbWFuZHMsIHlvdSBjYW4gcGFzcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBvYmplY3QsIGluc3RlYWQgb2ZcbiAqIGEgc2ltcGxlIHN0cmluZyBjb21tYW5kLlxuICpcbiAqIFRoaXMgaXMgZG9uZSBieSBwYXNzaW5nIGFuIG9iamVjdCBjb250YWluaW5nIHR3byBwcm9wZXJ0aWVzOiBgcmVnZXhwYCwgYW5kXG4gKiBgY2FsbGJhY2tgIGluc3RlYWQgb2YgdGhlIGZ1bmN0aW9uLlxuICpcbiAqICMjIyMgRXhhbXBsZXM6XG4gKiBgYGBgamF2YXNjcmlwdFxuICogdmFyIGNhbGN1bGF0ZUZ1bmN0aW9uID0gZnVuY3Rpb24obW9udGgpIHsgY29uc29sZS5sb2cobW9udGgpOyB9XG4gKiB2YXIgY29tbWFuZHMgPSB7XG4gKiAgIC8vIFRoaXMgZXhhbXBsZSB3aWxsIGFjY2VwdCBhbnkgd29yZCBhcyB0aGUgXCJtb250aFwiXG4gKiAgICdjYWxjdWxhdGUgOm1vbnRoIHN0YXRzJzogY2FsY3VsYXRlRnVuY3Rpb24sXG4gKiAgIC8vIFRoaXMgZXhhbXBsZSB3aWxsIG9ubHkgYWNjZXB0IG1vbnRocyB3aGljaCBhcmUgYXQgdGhlIHN0YXJ0IG9mIGEgcXVhcnRlclxuICogICAnY2FsY3VsYXRlIDpxdWFydGVyIHN0YXRzJzogeydyZWdleHAnOiAvXmNhbGN1bGF0ZSAoSmFudWFyeXxBcHJpbHxKdWx5fE9jdG9iZXIpIHN0YXRzJC8sICdjYWxsYmFjayc6IGNhbGN1bGF0ZUZ1bmN0aW9ufVxuICogfVxuIGBgYGBcbiAqXG4gKiAjIyBMYW5ndWFnZXNcbiAqXG4gKiBXaGlsZSB0aGVyZSBpc24ndCBhbiBvZmZpY2lhbCBsaXN0IG9mIHN1cHBvcnRlZCBsYW5ndWFnZXMgKGN1bHR1cmVzPyBsb2NhbGVzPyksIGhlcmUgaXMgYSBsaXN0IGJhc2VkIG9uIFthbmVjZG90YWwgZXZpZGVuY2VdKGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE0MzAyMTM0LzMzODAzOSkuXG4gKlxuICogKiBBZnJpa2FhbnMgYGFmYFxuICogKiBCYXNxdWUgYGV1YFxuICogKiBCdWxnYXJpYW4gYGJnYFxuICogKiBDYXRhbGFuIGBjYWBcbiAqICogQXJhYmljIChFZ3lwdCkgYGFyLUVHYFxuICogKiBBcmFiaWMgKEpvcmRhbikgYGFyLUpPYFxuICogKiBBcmFiaWMgKEt1d2FpdCkgYGFyLUtXYFxuICogKiBBcmFiaWMgKExlYmFub24pIGBhci1MQmBcbiAqICogQXJhYmljIChRYXRhcikgYGFyLVFBYFxuICogKiBBcmFiaWMgKFVBRSkgYGFyLUFFYFxuICogKiBBcmFiaWMgKE1vcm9jY28pIGBhci1NQWBcbiAqICogQXJhYmljIChJcmFxKSBgYXItSVFgXG4gKiAqIEFyYWJpYyAoQWxnZXJpYSkgYGFyLURaYFxuICogKiBBcmFiaWMgKEJhaHJhaW4pIGBhci1CSGBcbiAqICogQXJhYmljIChMeWJpYSkgYGFyLUxZYFxuICogKiBBcmFiaWMgKE9tYW4pIGBhci1PTWBcbiAqICogQXJhYmljIChTYXVkaSBBcmFiaWEpIGBhci1TQWBcbiAqICogQXJhYmljIChUdW5pc2lhKSBgYXItVE5gXG4gKiAqIEFyYWJpYyAoWWVtZW4pIGBhci1ZRWBcbiAqICogQ3plY2ggYGNzYFxuICogKiBEdXRjaCBgbmwtTkxgXG4gKiAqIEVuZ2xpc2ggKEF1c3RyYWxpYSkgYGVuLUFVYFxuICogKiBFbmdsaXNoIChDYW5hZGEpIGBlbi1DQWBcbiAqICogRW5nbGlzaCAoSW5kaWEpIGBlbi1JTmBcbiAqICogRW5nbGlzaCAoTmV3IFplYWxhbmQpIGBlbi1OWmBcbiAqICogRW5nbGlzaCAoU291dGggQWZyaWNhKSBgZW4tWkFgXG4gKiAqIEVuZ2xpc2goVUspIGBlbi1HQmBcbiAqICogRW5nbGlzaChVUykgYGVuLVVTYFxuICogKiBGaW5uaXNoIGBmaWBcbiAqICogRnJlbmNoIGBmci1GUmBcbiAqICogR2FsaWNpYW4gYGdsYFxuICogKiBHZXJtYW4gYGRlLURFYFxuICogKiBIZWJyZXcgYGhlYFxuICogKiBIdW5nYXJpYW4gYGh1YFxuICogKiBJY2VsYW5kaWMgYGlzYFxuICogKiBJdGFsaWFuIGBpdC1JVGBcbiAqICogSW5kb25lc2lhbiBgaWRgXG4gKiAqIEphcGFuZXNlIGBqYWBcbiAqICogS29yZWFuIGBrb2BcbiAqICogTGF0aW4gYGxhYFxuICogKiBNYW5kYXJpbiBDaGluZXNlIGB6aC1DTmBcbiAqICogVHJhZGl0aW9uYWwgVGFpd2FuIGB6aC1UV2BcbiAqICogU2ltcGxpZmllZCBDaGluYSB6aC1DTiBgP2BcbiAqICogU2ltcGxpZmllZCBIb25nIEtvbmcgYHpoLUhLYFxuICogKiBZdWUgQ2hpbmVzZSAoVHJhZGl0aW9uYWwgSG9uZyBLb25nKSBgemgteXVlYFxuICogKiBNYWxheXNpYW4gYG1zLU1ZYFxuICogKiBOb3J3ZWdpYW4gYG5vLU5PYFxuICogKiBQb2xpc2ggYHBsYFxuICogKiBQaWcgTGF0aW4gYHh4LXBpZ2xhdGluYFxuICogKiBQb3J0dWd1ZXNlIGBwdC1QVGBcbiAqICogUG9ydHVndWVzZSAoQnJhc2lsKSBgcHQtQlJgXG4gKiAqIFJvbWFuaWFuIGByby1ST2BcbiAqICogUnVzc2lhbiBgcnVgXG4gKiAqIFNlcmJpYW4gYHNyLVNQYFxuICogKiBTbG92YWsgYHNrYFxuICogKiBTcGFuaXNoIChBcmdlbnRpbmEpIGBlcy1BUmBcbiAqICogU3BhbmlzaCAoQm9saXZpYSkgYGVzLUJPYFxuICogKiBTcGFuaXNoIChDaGlsZSkgYGVzLUNMYFxuICogKiBTcGFuaXNoIChDb2xvbWJpYSkgYGVzLUNPYFxuICogKiBTcGFuaXNoIChDb3N0YSBSaWNhKSBgZXMtQ1JgXG4gKiAqIFNwYW5pc2ggKERvbWluaWNhbiBSZXB1YmxpYykgYGVzLURPYFxuICogKiBTcGFuaXNoIChFY3VhZG9yKSBgZXMtRUNgXG4gKiAqIFNwYW5pc2ggKEVsIFNhbHZhZG9yKSBgZXMtU1ZgXG4gKiAqIFNwYW5pc2ggKEd1YXRlbWFsYSkgYGVzLUdUYFxuICogKiBTcGFuaXNoIChIb25kdXJhcykgYGVzLUhOYFxuICogKiBTcGFuaXNoIChNZXhpY28pIGBlcy1NWGBcbiAqICogU3BhbmlzaCAoTmljYXJhZ3VhKSBgZXMtTklgXG4gKiAqIFNwYW5pc2ggKFBhbmFtYSkgYGVzLVBBYFxuICogKiBTcGFuaXNoIChQYXJhZ3VheSkgYGVzLVBZYFxuICogKiBTcGFuaXNoIChQZXJ1KSBgZXMtUEVgXG4gKiAqIFNwYW5pc2ggKFB1ZXJ0byBSaWNvKSBgZXMtUFJgXG4gKiAqIFNwYW5pc2ggKFNwYWluKSBgZXMtRVNgXG4gKiAqIFNwYW5pc2ggKFVTKSBgZXMtVVNgXG4gKiAqIFNwYW5pc2ggKFVydWd1YXkpIGBlcy1VWWBcbiAqICogU3BhbmlzaCAoVmVuZXp1ZWxhKSBgZXMtVkVgXG4gKiAqIFN3ZWRpc2ggYHN2LVNFYFxuICogKiBUdXJraXNoIGB0cmBcbiAqICogWnVsdSBgenVgXG4gKlxuICogIyMgRGV2ZWxvcGluZ1xuICpcbiAqIFByZXJlcXVpc2l0aWVzOiBub2RlLmpzXG4gKlxuICogRmlyc3QsIGluc3RhbGwgZGVwZW5kZW5jaWVzIGluIHlvdXIgbG9jYWwgYW5ueWFuZyBjb3B5OlxuICpcbiAqICAgICBucG0gaW5zdGFsbFxuICpcbiAqIE1ha2Ugc3VyZSB0byBydW4gdGhlIGRlZmF1bHQgZ3J1bnQgdGFzayBhZnRlciBlYWNoIGNoYW5nZSB0byBhbm55YW5nLmpzLiBUaGlzIGNhbiBhbHNvIGJlIGRvbmUgYXV0b21hdGljYWxseSBieSBydW5uaW5nOlxuICpcbiAqICAgICBncnVudCB3YXRjaFxuICpcbiAqIFlvdSBjYW4gYWxzbyBydW4gYSBsb2NhbCBzZXJ2ZXIgZm9yIHRlc3RpbmcgeW91ciB3b3JrIHdpdGg6XG4gKlxuICogICAgIGdydW50IGRldlxuICpcbiAqIFBvaW50IHlvdXIgYnJvd3NlciB0byBgaHR0cHM6Ly9sb2NhbGhvc3Q6ODQ0My9kZW1vL2AgdG8gc2VlIHRoZSBkZW1vIHBhZ2UuXG4gKiBTaW5jZSBpdCdzIHVzaW5nIHNlbGYtc2lnbmVkIGNlcnRpZmljYXRlLCB5b3UgbWlnaHQgbmVlZCB0byBjbGljayAqXCJQcm9jZWVkIEFueXdheVwiKi5cbiAqXG4gKiBGb3IgbW9yZSBpbmZvLCBjaGVjayBvdXQgdGhlIFtDT05UUklCVVRJTkddKGh0dHBzOi8vZ2l0aHViLmNvbS9UYWxBdGVyL2FubnlhbmcvYmxvYi9tYXN0ZXIvQ09OVFJJQlVUSU5HLm1kKSBmaWxlXG4gKlxuICovXG4iLCIvLyBGVU5DVElPTlMgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLy86OiBhIC0+IGFcbmNvbnN0IHRyYWNlID0gKHgpID0+IHtcbiAgY29uc29sZS5sb2coeClcbiAgcmV0dXJuIHhcbn1cblxuLy86OiAoKGEsIGIsIC4uLiAtPiBlKSwgKGUgLT4gZiksIC4uLiwgKHkgLT4geikpIC0+IChhLCBiLCAuLi4pIC0+IHpcbmNvbnN0IHBpcGUgPSAoLi4uZm5zKSA9PiAoLi4ueHMpID0+IHtcbiAgcmV0dXJuIGZuc1xuICAgIC5zbGljZSgxKVxuICAgIC5yZWR1Y2UoKHgsIGZuKSA9PiBmbih4KSwgZm5zWzBdKC4uLnhzKSlcbn1cbmNvbnN0IHBpcGVQID0gKC4uLmZucykgPT4gKC4uLnhzKSA9PiB7XG4gIHJldHVybiBmbnNcbiAgICAuc2xpY2UoMSlcbiAgICAucmVkdWNlKCh4UCwgZm4pID0+IHhQLnRoZW4oZm4pLCBQcm9taXNlLnJlc29sdmUoZm5zWzBdKC4uLnhzKSkpXG59XG5cbi8vOjogKGEgLT4gYikgLT4gW2FdIC0+IFtiXVxuY29uc3QgbWFwID0gKGZuKSA9PiAoZikgPT4ge1xuICByZXR1cm4gZi5tYXAoZm4pXG59XG5cbi8vOjogW2FdIC0+IFthXSAtPiBbYV1cbmNvbnN0IGludGVyc2VjdGlvbiA9ICh4cykgPT4gKHhzMikgPT4ge1xuICByZXR1cm4geHMuZmlsdGVyKHggPT4geHMyLmluY2x1ZGVzKHgpKVxufVxuXG4vLzo6IFthXSAtPiBbYV0gLT4gW2FdXG5jb25zdCBkaWZmZXJlbmNlID0gKHhzKSA9PiAoeHMyKSA9PiB7XG4gIHJldHVybiB4cy5maWx0ZXIoeCA9PiAheHMyLmluY2x1ZGVzKHgpKVxufVxuXG4vLzo6IFsoYSwgYiwgLi4uKSAtPiBuXSAtPiBbYSwgYiwgLi4uXSAtPiBbbl1cbmNvbnN0IGFwcGx5RnVuY3Rpb25zID0gKGZucykgPT4gKHhzKSA9PiB7XG4gIHJldHVybiBmbnMubWFwKGZuID0+XG4gICAgeHMuc2xpY2UoMSkucmVkdWNlKChwYXJ0aWFsLCB4KSA9PiBwYXJ0aWFsKHgpLCBmbih4c1swXSkpKVxufVxuXG4vLzo6IFthXSAtPiBhXG5jb25zdCBsYXN0ID0gKHhzKSA9PiB7XG4gIHJldHVybiB4c1t4cy5sZW5ndGggLSAxXVxufVxuXG4vLzo6IChhIC0+IGIgLT4gYykgLT4gYiAtPiBhIC0+IGNcbmNvbnN0IGZsaXAgPSAoZm4pID0+IChiKSA9PiAoYSkgPT4ge1xuICByZXR1cm4gZm4oYSkoYilcbn1cblxuY29uc3QgY3VycnkgPSAoZm4pID0+IHtcbiAgdmFyIF9hcmdzID0gW11cbiAgY29uc3QgY291bnRBcmdzID0gKC4uLnhzKSA9PiB7XG4gICAgX2FyZ3MgPSBfYXJncy5jb25jYXQoeHMpXG4gICAgcmV0dXJuIChfYXJncy5sZW5ndGggPj0gZm4ubGVuZ3RoKVxuICAgICAgPyBmbi5hcHBseSh0aGlzLCBfYXJncylcbiAgICAgIDogY291bnRBcmdzXG4gIH1cbiAgcmV0dXJuIGNvdW50QXJnc1xufVxuXG4vLzo6IEludCAtPiBbYV0gLT4gYVxuY29uc3QgbnRoID0gKG4pID0+ICh4cykgPT4ge1xuICByZXR1cm4geHNbbl1cbn1cblxuLy86OiAoYSAtPiBhKSAtPiBOdW1iZXIgLT4gW2FdIC0+IFthXVxuY29uc3QgYWRqdXN0ID0gKGZuKSA9PiAoaSkgPT4gKGxpc3QpID0+IHtcbiAgdmFyIGNvcHkgPSBsaXN0LnNsaWNlKClcbiAgY29weS5zcGxpY2UoaSwgMSwgZm4obGlzdFtpXSkpXG4gIHJldHVybiBjb3B5XG59XG5cbi8vOjogT2JqZWN0IC0+IEFycmF5XG5jb25zdCB0b1BhaXJzID0gKG9iaikgPT4ge1xuICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKG9iaikubWFwKGtleSA9PiBba2V5LCBvYmpba2V5XV0pXG59XG5cbi8vOjogKGEgLT4gQm9vbCkgLT4gKGEgLT4gYikgLT4gKGEgLT4gYikgLT4gYSAtPiBiXG5jb25zdCBpZkVsc2UgPSAocHJlZEZuKSA9PiAod2hlblRydWVGbikgPT4gKHdoZW5GYWxzZUZuKSA9PiAoYSkgPT57XG4gIHJldHVybiBwcmVkRm4oYSlcbiAgICA/IHdoZW5UcnVlRm4oYSlcbiAgICA6IHdoZW5GYWxzZUZuKGEpXG59XG5cblxuLy8gdGhpcyBpc24ndCBpbiBleHBvcnRzLCBpdCBpcyB1c2VkIGJ5IElPLnNlcXVlbmNlIC8vLy8vLy8vLy8vLy8vXG5jb25zdCBHZW5lcmF0b3IgPSBPYmplY3QuZnJlZXplKHtcbiAgLy86OiAoYSAtPiBiKSAtPiAoR2VuZXJhdG9yIChbYV0gLT4gYikpXG4gIC8qIHJldHVybnMgYSBnZW5lcmF0b3Igd2hpY2ggd2lsbCBhcHBseVxuICAgICBhY3Rpb24gdG8gZWEgdmFsdWUgc2VxdWVudGlhbGx5IGluIHhzXG4gICAqL1xuICBzZXEoYWN0aW9uKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKiBhcHBseUFjdGlvbih4cykge1xuICAgICAgZm9yICh2YXIgeCBvZiB4cykge1xuICAgICAgICB5aWVsZCBhY3Rpb24oeClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIC8vOjogR2VuZXJhdG9yIC0+IF9cbiAgLyogYXV0b21hdGljYWxseSBzdGVwcyBnZW5lcmF0b3IgZXZlcnkgfnggbXNcbiAgICAgdW50aWwgdGhlIGdlbmVyYXRvciBpcyBleGhhdXN0ZWRcbiAgICovXG4gIGF1dG86IChtcykgPT4gKGdlbikgPT4ge1xuICAgIGlmICghZ2VuLm5leHQoKS5kb25lKSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IEdlbmVyYXRvci5hdXRvKG1zKShnZW4pLCBtcylcbiAgICB9XG4gIH1cbn0pXG5cblxuLy8gTU9OQURTIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLy8gTWF5YmUgdHlwZVxuY29uc3QgTWF5YmUgPSAoKCkgPT4ge1xuICBjb25zdCBuZXdNID0gKHR5cGUpID0+ICh2YWx1ZSkgPT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKE9iamVjdC5jcmVhdGUodHlwZSwgeyBfX3ZhbHVlOiB7IHZhbHVlOiB2YWx1ZSB9fSkpXG4gIH1cblxuICBjb25zdCBOb3RoaW5nID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgbWFwKF8pIHtcbiAgICAgIHJldHVybiBuZXdNKE5vdGhpbmcpKG51bGwpXG4gICAgfSxcbiAgICBpc05vdGhpbmc6IHRydWUsXG4gICAgaXNKdXN0OiBmYWxzZVxuICB9KVxuXG4gIGNvbnN0IEp1c3QgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdNKEp1c3QpKGZuKHRoaXMuX192YWx1ZSkpXG4gICAgfSxcbiAgICBpc05vdGhpbmc6IGZhbHNlLFxuICAgIGlzSnVzdDogdHJ1ZVxuICB9KVxuXG4gIGNvbnN0IE1heWJlID0gKHgpID0+IHtcbiAgICByZXR1cm4gKHggPT0gbnVsbClcbiAgICAgID8gbmV3TShOb3RoaW5nKShudWxsKVxuICAgICAgOiBuZXdNKEp1c3QpKHgpXG4gIH1cblxuICBNYXliZS5pc05vdGhpbmcgPSAoTSkgPT4ge1xuICAgIHJldHVybiBOb3RoaW5nLmlzUHJvdG90eXBlT2YoTSlcbiAgfVxuXG4gIE1heWJlLmlzSnVzdCA9IChNKSA9PiB7XG4gICAgcmV0dXJuIEp1c3QuaXNQcm90b3R5cGVPZihNKVxuICB9XG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoTWF5YmUpXG59KSgpXG5cbi8vIEVpdGhlciB0eXBlXG5jb25zdCBFaXRoZXIgPSAoKCkgPT4ge1xuICBjb25zdCBuZXdFID0gKHR5cGUpID0+ICh2YWx1ZSkgPT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKE9iamVjdC5jcmVhdGUodHlwZSwgeyBfX3ZhbHVlOiB7IHZhbHVlOiB2YWx1ZSB9IH0pKVxuICB9XG5cbiAgY29uc3QgTGVmdCA9IE9iamVjdC5mcmVlemUoe1xuICAgIG1hcChfKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG4gICAgYmltYXAoZm4pIHtcbiAgICAgIGNvbnN0IG1lID0gdGhpc1xuICAgICAgcmV0dXJuIChfKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXdFKExlZnQpKGZuKG1lLl9fdmFsdWUpKVxuICAgICAgfVxuICAgIH0sXG4gICAgaXNMZWZ0OiB0cnVlLFxuICAgIGlzUmlnaHQ6IGZhbHNlXG4gIH0pXG5cbiAgY29uc3QgUmlnaHQgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdFKFJpZ2h0KShmbih0aGlzLl9fdmFsdWUpKVxuICAgIH0sXG4gICAgYmltYXAoXykge1xuICAgICAgY29uc3QgbWUgPSB0aGlzXG4gICAgICByZXR1cm4gKGZuKSA9PiB7XG4gICAgICAgIHJldHVybiBtZS5tYXAoZm4pXG4gICAgICB9XG4gICAgfSxcbiAgICBpc0xlZnQ6IGZhbHNlLFxuICAgIGlzUmlnaHQ6IHRydWVcbiAgfSlcblxuICBjb25zdCBFaXRoZXIgPSBPYmplY3QuZnJlZXplKHtcbiAgICBMZWZ0KHgpIHtcbiAgICAgIHJldHVybiBuZXdFKExlZnQpKHgpXG4gICAgfSxcbiAgICBSaWdodCh4KSB7XG4gICAgICByZXR1cm4gbmV3RShSaWdodCkoeClcbiAgICB9LFxuICAgIGlzUmlnaHQoRSkge1xuICAgICAgcmV0dXJuIFJpZ2h0LmlzUHJvdG90eXBlT2YoRSlcbiAgICB9LFxuICAgIGlzTGVmdChFKSB7XG4gICAgICByZXR1cm4gTGVmdC5pc1Byb3RvdHlwZU9mKEUpXG4gICAgfSxcbiAgICBiaW1hcDogKGxlZnRGbikgPT4gKHJpZ2h0Rm4pID0+IChFKSA9PiB7XG4gICAgICByZXR1cm4gRS5iaW1hcChsZWZ0Rm4pKHJpZ2h0Rm4pXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBFaXRoZXJcbn0pKClcblxuLy8gSU8gdHlwZVxuY29uc3QgSU8gPSAoKCkgPT4ge1xuICBjb25zdCBuZXdfaW8gPSAoZm4pID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZShPYmplY3QuY3JlYXRlKGlvLCB7IF9fdmFsdWU6IHsgdmFsdWU6IGZuIH19KSlcbiAgfVxuXG4gIGNvbnN0IGlvID0ge1xuICAgIHJ1bklPKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fX3ZhbHVlKHZhbHVlKVxuICAgIH0sXG4gICAgbWFwKGZuKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKCgpID0+IGZuKHRoaXMuX192YWx1ZSgpKSlcbiAgICB9LFxuICAgIGpvaW4oKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuSU8oKS5ydW5JTygpXG4gICAgICB9KVxuICAgIH0sXG4gICAgY2hhaW4oaW9fcmV0dXJuaW5nX2ZuKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAoaW9fcmV0dXJuaW5nX2ZuKS5qb2luKClcbiAgICB9LFxuICAgIGFwKGlvX3ZhbHVlKSB7XG4gICAgICByZXR1cm4gaW9fdmFsdWUubWFwKHRoaXMuX192YWx1ZSlcbiAgICB9XG4gIH1cblxuICBjb25zdCBJTyA9IChmbikgPT4ge1xuICAgIGlmIChmbiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKGZuKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJTyBjb25zdHJ1Y3RvciBleHBlY3RlZCBpbnN0YW5jZSBvZiBGdW5jdGlvbmApXG4gICAgfVxuICB9XG5cbiAgSU8ub2YgPSAoeCkgPT4ge1xuICAgIHJldHVybiBuZXdfaW8oKCkgPT4geClcbiAgfVxuXG4gIElPLnJ1biA9IChpbykgPT4ge1xuICAgIHJldHVybiBpby5ydW5JTygpXG4gIH1cblxuICAvLzo6IChhIC0+IGIpIC0+IGEgLT4gSU8gYlxuICBJTy53cmFwID0gKGZuKSA9PiAoX3ZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIElPLm9mKF92YWx1ZSkubWFwKGZuKVxuICB9XG5cbiAgLy86OiBbSU9dIC0+IElPIF9cbiAgSU8uc2VxdWVuY2UgPSBJTy53cmFwKFxuICAgIHBpcGUoXG4gICAgICBHZW5lcmF0b3Iuc2VxKElPLnJ1biksXG4gICAgICBHZW5lcmF0b3IuYXV0bygwKVxuICAgICkpXG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoSU8pXG59KSgpXG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHRyYWNlLCBwaXBlLCBwaXBlUCwgbWFwLCBpbnRlcnNlY3Rpb24sIGRpZmZlcmVuY2UsIGFwcGx5RnVuY3Rpb25zLFxuICBsYXN0LCBmbGlwLCBjdXJyeSwgbnRoLCBhZGp1c3QsIHRvUGFpcnMsIGlmRWxzZSxcbiAgTWF5YmUsIEVpdGhlciwgSU9cbn1cblxuXG5cblxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2Z1enp5c2V0LmpzJyk7XG4iLCIoZnVuY3Rpb24oKSB7XG5cbnZhciBGdXp6eVNldCA9IGZ1bmN0aW9uKGFyciwgdXNlTGV2ZW5zaHRlaW4sIGdyYW1TaXplTG93ZXIsIGdyYW1TaXplVXBwZXIpIHtcbiAgICB2YXIgZnV6enlzZXQgPSB7XG4gICAgICAgIHZlcnNpb246ICcwLjAuMSdcbiAgICB9O1xuXG4gICAgLy8gZGVmYXVsdCBvcHRpb25zXG4gICAgYXJyID0gYXJyIHx8IFtdO1xuICAgIGZ1enp5c2V0LmdyYW1TaXplTG93ZXIgPSBncmFtU2l6ZUxvd2VyIHx8IDI7XG4gICAgZnV6enlzZXQuZ3JhbVNpemVVcHBlciA9IGdyYW1TaXplVXBwZXIgfHwgMztcbiAgICBmdXp6eXNldC51c2VMZXZlbnNodGVpbiA9IHVzZUxldmVuc2h0ZWluIHx8IHRydWU7XG5cbiAgICAvLyBkZWZpbmUgYWxsIHRoZSBvYmplY3QgZnVuY3Rpb25zIGFuZCBhdHRyaWJ1dGVzXG4gICAgZnV6enlzZXQuZXhhY3RTZXQgPSB7fVxuICAgIGZ1enp5c2V0Lm1hdGNoRGljdCA9IHt9O1xuICAgIGZ1enp5c2V0Lml0ZW1zID0ge307XG5cbiAgICAvLyBoZWxwZXIgZnVuY3Rpb25zXG4gICAgdmFyIGxldmVuc2h0ZWluID0gZnVuY3Rpb24oc3RyMSwgc3RyMikge1xuICAgICAgICB2YXIgY3VycmVudCA9IFtdLCBwcmV2LCB2YWx1ZTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8PSBzdHIyLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPD0gc3RyMS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgaWYgKGkgJiYgailcbiAgICAgICAgICAgICAgICBpZiAoc3RyMS5jaGFyQXQoaiAtIDEpID09PSBzdHIyLmNoYXJBdChpIC0gMSkpXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBwcmV2O1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgubWluKGN1cnJlbnRbal0sIGN1cnJlbnRbaiAtIDFdLCBwcmV2KSArIDE7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBpICsgajtcblxuICAgICAgICAgICAgcHJldiA9IGN1cnJlbnRbal07XG4gICAgICAgICAgICBjdXJyZW50W2pdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnJlbnQucG9wKCk7XG4gICAgfTtcblxuICAgIC8vIHJldHVybiBhbiBlZGl0IGRpc3RhbmNlIGZyb20gMCB0byAxXG4gICAgdmFyIF9kaXN0YW5jZSA9IGZ1bmN0aW9uKHN0cjEsIHN0cjIpIHtcbiAgICAgICAgaWYgKHN0cjEgPT0gbnVsbCAmJiBzdHIyID09IG51bGwpIHRocm93ICdUcnlpbmcgdG8gY29tcGFyZSB0d28gbnVsbCB2YWx1ZXMnXG4gICAgICAgIGlmIChzdHIxID09IG51bGwgfHwgc3RyMiA9PSBudWxsKSByZXR1cm4gMDtcbiAgICAgICAgc3RyMSA9IFN0cmluZyhzdHIxKTsgc3RyMiA9IFN0cmluZyhzdHIyKTtcblxuICAgICAgICB2YXIgZGlzdGFuY2UgPSBsZXZlbnNodGVpbihzdHIxLCBzdHIyKTtcbiAgICAgICAgaWYgKHN0cjEubGVuZ3RoID4gc3RyMi5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiAxIC0gZGlzdGFuY2UgLyBzdHIxLmxlbmd0aDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAxIC0gZGlzdGFuY2UgLyBzdHIyLmxlbmd0aDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgdmFyIF9ub25Xb3JkUmUgPSAvW15cXHcsIF0rLztcblxuICAgIHZhciBfaXRlcmF0ZUdyYW1zID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIGdyYW1TaXplID0gZ3JhbVNpemUgfHwgMjtcbiAgICAgICAgdmFyIHNpbXBsaWZpZWQgPSAnLScgKyB2YWx1ZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoX25vbldvcmRSZSwgJycpICsgJy0nLFxuICAgICAgICAgICAgbGVuRGlmZiA9IGdyYW1TaXplIC0gc2ltcGxpZmllZC5sZW5ndGgsXG4gICAgICAgICAgICByZXN1bHRzID0gW107XG4gICAgICAgIGlmIChsZW5EaWZmID4gMCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5EaWZmOyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSArPSAnLSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzaW1wbGlmaWVkLmxlbmd0aCAtIGdyYW1TaXplICsgMTsgKytpKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goc2ltcGxpZmllZC5zbGljZShpLCBpICsgZ3JhbVNpemUpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH07XG5cbiAgICB2YXIgX2dyYW1Db3VudGVyID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIGdyYW1TaXplID0gZ3JhbVNpemUgfHwgMjtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHt9LFxuICAgICAgICAgICAgZ3JhbXMgPSBfaXRlcmF0ZUdyYW1zKHZhbHVlLCBncmFtU2l6ZSksXG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgZm9yIChpOyBpIDwgZ3JhbXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChncmFtc1tpXSBpbiByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbZ3JhbXNbaV1dICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtncmFtc1tpXV0gPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIC8vIHRoZSBtYWluIGZ1bmN0aW9uc1xuICAgIGZ1enp5c2V0LmdldCA9IGZ1bmN0aW9uKHZhbHVlLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHRoaXMuX2dldCh2YWx1ZSk7XG4gICAgICAgIGlmICghcmVzdWx0ICYmIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBmdXp6eXNldC5fZ2V0ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRWYWx1ZSA9IHRoaXMuX25vcm1hbGl6ZVN0cih2YWx1ZSksXG4gICAgICAgICAgICByZXN1bHQgPSB0aGlzLmV4YWN0U2V0W25vcm1hbGl6ZWRWYWx1ZV07XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgIHJldHVybiBbWzEsIHJlc3VsdF1dO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGZvciAodmFyIGdyYW1TaXplID0gdGhpcy5ncmFtU2l6ZVVwcGVyOyBncmFtU2l6ZSA+IHRoaXMuZ3JhbVNpemVMb3dlcjsgLS1ncmFtU2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHRoaXMuX19nZXQodmFsdWUsIGdyYW1TaXplKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIGZ1enp5c2V0Ll9fZ2V0ID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkVmFsdWUgPSB0aGlzLl9ub3JtYWxpemVTdHIodmFsdWUpLFxuICAgICAgICAgICAgbWF0Y2hlcyA9IHt9LFxuICAgICAgICAgICAgZ3JhbUNvdW50cyA9IF9ncmFtQ291bnRlcihub3JtYWxpemVkVmFsdWUsIGdyYW1TaXplKSxcbiAgICAgICAgICAgIGl0ZW1zID0gdGhpcy5pdGVtc1tncmFtU2l6ZV0sXG4gICAgICAgICAgICBzdW1PZlNxdWFyZUdyYW1Db3VudHMgPSAwLFxuICAgICAgICAgICAgZ3JhbSxcbiAgICAgICAgICAgIGdyYW1Db3VudCxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIG90aGVyR3JhbUNvdW50O1xuXG4gICAgICAgIGZvciAoZ3JhbSBpbiBncmFtQ291bnRzKSB7XG4gICAgICAgICAgICBncmFtQ291bnQgPSBncmFtQ291bnRzW2dyYW1dO1xuICAgICAgICAgICAgc3VtT2ZTcXVhcmVHcmFtQ291bnRzICs9IE1hdGgucG93KGdyYW1Db3VudCwgMik7XG4gICAgICAgICAgICBpZiAoZ3JhbSBpbiB0aGlzLm1hdGNoRGljdCkge1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLm1hdGNoRGljdFtncmFtXS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMubWF0Y2hEaWN0W2dyYW1dW2ldWzBdO1xuICAgICAgICAgICAgICAgICAgICBvdGhlckdyYW1Db3VudCA9IHRoaXMubWF0Y2hEaWN0W2dyYW1dW2ldWzFdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggaW4gbWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlc1tpbmRleF0gKz0gZ3JhbUNvdW50ICogb3RoZXJHcmFtQ291bnQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVzW2luZGV4XSA9IGdyYW1Db3VudCAqIG90aGVyR3JhbUNvdW50O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaXNFbXB0eU9iamVjdChvYmopIHtcbiAgICAgICAgICAgIGZvcih2YXIgcHJvcCBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICBpZihvYmouaGFzT3duUHJvcGVydHkocHJvcCkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzRW1wdHlPYmplY3QobWF0Y2hlcykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHZlY3Rvck5vcm1hbCA9IE1hdGguc3FydChzdW1PZlNxdWFyZUdyYW1Db3VudHMpLFxuICAgICAgICAgICAgcmVzdWx0cyA9IFtdLFxuICAgICAgICAgICAgbWF0Y2hTY29yZTtcbiAgICAgICAgLy8gYnVpbGQgYSByZXN1bHRzIGxpc3Qgb2YgW3Njb3JlLCBzdHJdXG4gICAgICAgIGZvciAodmFyIG1hdGNoSW5kZXggaW4gbWF0Y2hlcykge1xuICAgICAgICAgICAgbWF0Y2hTY29yZSA9IG1hdGNoZXNbbWF0Y2hJbmRleF07XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goW21hdGNoU2NvcmUgLyAodmVjdG9yTm9ybWFsICogaXRlbXNbbWF0Y2hJbmRleF1bMF0pLCBpdGVtc1ttYXRjaEluZGV4XVsxXV0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzb3J0RGVzY2VuZGluZyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChhWzBdIDwgYlswXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhWzBdID4gYlswXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlc3VsdHMuc29ydChzb3J0RGVzY2VuZGluZyk7XG4gICAgICAgIGlmICh0aGlzLnVzZUxldmVuc2h0ZWluKSB7XG4gICAgICAgICAgICB2YXIgbmV3UmVzdWx0cyA9IFtdLFxuICAgICAgICAgICAgICAgIGVuZEluZGV4ID0gTWF0aC5taW4oNTAsIHJlc3VsdHMubGVuZ3RoKTtcbiAgICAgICAgICAgIC8vIHRydW5jYXRlIHNvbWV3aGF0IGFyYml0cmFyaWx5IHRvIDUwXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVuZEluZGV4OyArK2kpIHtcbiAgICAgICAgICAgICAgICBuZXdSZXN1bHRzLnB1c2goW19kaXN0YW5jZShyZXN1bHRzW2ldWzFdLCBub3JtYWxpemVkVmFsdWUpLCByZXN1bHRzW2ldWzFdXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHRzID0gbmV3UmVzdWx0cztcbiAgICAgICAgICAgIHJlc3VsdHMuc29ydChzb3J0RGVzY2VuZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5ld1Jlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBpZiAocmVzdWx0c1tpXVswXSA9PSByZXN1bHRzWzBdWzBdKSB7XG4gICAgICAgICAgICAgICAgbmV3UmVzdWx0cy5wdXNoKFtyZXN1bHRzW2ldWzBdLCB0aGlzLmV4YWN0U2V0W3Jlc3VsdHNbaV1bMV1dXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld1Jlc3VsdHM7XG4gICAgfTtcblxuICAgIGZ1enp5c2V0LmFkZCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkVmFsdWUgPSB0aGlzLl9ub3JtYWxpemVTdHIodmFsdWUpO1xuICAgICAgICBpZiAobm9ybWFsaXplZFZhbHVlIGluIHRoaXMuZXhhY3RTZXQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gdGhpcy5ncmFtU2l6ZUxvd2VyO1xuICAgICAgICBmb3IgKGk7IGkgPCB0aGlzLmdyYW1TaXplVXBwZXIgKyAxOyArK2kpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZCh2YWx1ZSwgaSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnV6enlzZXQuX2FkZCA9IGZ1bmN0aW9uKHZhbHVlLCBncmFtU2l6ZSkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZFZhbHVlID0gdGhpcy5fbm9ybWFsaXplU3RyKHZhbHVlKSxcbiAgICAgICAgICAgIGl0ZW1zID0gdGhpcy5pdGVtc1tncmFtU2l6ZV0gfHwgW10sXG4gICAgICAgICAgICBpbmRleCA9IGl0ZW1zLmxlbmd0aDtcblxuICAgICAgICBpdGVtcy5wdXNoKDApO1xuICAgICAgICB2YXIgZ3JhbUNvdW50cyA9IF9ncmFtQ291bnRlcihub3JtYWxpemVkVmFsdWUsIGdyYW1TaXplKSxcbiAgICAgICAgICAgIHN1bU9mU3F1YXJlR3JhbUNvdW50cyA9IDAsXG4gICAgICAgICAgICBncmFtLCBncmFtQ291bnQ7XG4gICAgICAgIGZvciAodmFyIGdyYW0gaW4gZ3JhbUNvdW50cykge1xuICAgICAgICAgICAgZ3JhbUNvdW50ID0gZ3JhbUNvdW50c1tncmFtXTtcbiAgICAgICAgICAgIHN1bU9mU3F1YXJlR3JhbUNvdW50cyArPSBNYXRoLnBvdyhncmFtQ291bnQsIDIpO1xuICAgICAgICAgICAgaWYgKGdyYW0gaW4gdGhpcy5tYXRjaERpY3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1hdGNoRGljdFtncmFtXS5wdXNoKFtpbmRleCwgZ3JhbUNvdW50XSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0Y2hEaWN0W2dyYW1dID0gW1tpbmRleCwgZ3JhbUNvdW50XV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZlY3Rvck5vcm1hbCA9IE1hdGguc3FydChzdW1PZlNxdWFyZUdyYW1Db3VudHMpO1xuICAgICAgICBpdGVtc1tpbmRleF0gPSBbdmVjdG9yTm9ybWFsLCBub3JtYWxpemVkVmFsdWVdO1xuICAgICAgICB0aGlzLml0ZW1zW2dyYW1TaXplXSA9IGl0ZW1zO1xuICAgICAgICB0aGlzLmV4YWN0U2V0W25vcm1hbGl6ZWRWYWx1ZV0gPSB2YWx1ZTtcbiAgICB9O1xuXG4gICAgZnV6enlzZXQuX25vcm1hbGl6ZVN0ciA9IGZ1bmN0aW9uKHN0cikge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cikgIT09ICdbb2JqZWN0IFN0cmluZ10nKSB0aHJvdyAnTXVzdCB1c2UgYSBzdHJpbmcgYXMgYXJndW1lbnQgdG8gRnV6enlTZXQgZnVuY3Rpb25zJ1xuICAgICAgICByZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIC8vIHJldHVybiBsZW5ndGggb2YgaXRlbXMgaW4gc2V0XG4gICAgZnV6enlzZXQubGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjb3VudCA9IDAsXG4gICAgICAgICAgICBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gdGhpcy5leGFjdFNldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhY3RTZXQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBjb3VudCArPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb3VudDtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGlzIHNldCBpcyBlbXB0eVxuICAgIGZ1enp5c2V0LmlzRW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0aGlzLmV4YWN0U2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFjdFNldC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGxpc3Qgb2YgdmFsdWVzIGxvYWRlZCBpbnRvIHNldFxuICAgIGZ1enp5c2V0LnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWVzID0gW10sXG4gICAgICAgICAgICBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gdGhpcy5leGFjdFNldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhY3RTZXQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCh0aGlzLmV4YWN0U2V0W3Byb3BdKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgfTtcblxuXG4gICAgLy8gaW5pdGlhbGl6YXRpb25cbiAgICB2YXIgaSA9IGZ1enp5c2V0LmdyYW1TaXplTG93ZXI7XG4gICAgZm9yIChpOyBpIDwgZnV6enlzZXQuZ3JhbVNpemVVcHBlciArIDE7ICsraSkge1xuICAgICAgICBmdXp6eXNldC5pdGVtc1tpXSA9IFtdO1xuICAgIH1cbiAgICAvLyBhZGQgYWxsIHRoZSBpdGVtcyB0byB0aGUgc2V0XG4gICAgZm9yIChpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xuICAgICAgICBmdXp6eXNldC5hZGQoYXJyW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnV6enlzZXQ7XG59O1xuXG52YXIgcm9vdCA9IHRoaXM7XG4vLyBFeHBvcnQgdGhlIGZ1enp5c2V0IG9iamVjdCBmb3IgKipDb21tb25KUyoqLCB3aXRoIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5XG4vLyBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIG5vdCBpbiBDb21tb25KUywgYWRkIGBfYCB0byB0aGVcbi8vIGdsb2JhbCBvYmplY3QuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEZ1enp5U2V0O1xuICAgIHJvb3QuRnV6enlTZXQgPSBGdXp6eVNldDtcbn0gZWxzZSB7XG4gICAgcm9vdC5GdXp6eVNldCA9IEZ1enp5U2V0O1xufVxuXG59KSgpO1xuIiwidmFyIFZOb2RlID0gcmVxdWlyZSgnLi92bm9kZScpO1xudmFyIGlzID0gcmVxdWlyZSgnLi9pcycpO1xuXG5mdW5jdGlvbiBhZGROUyhkYXRhLCBjaGlsZHJlbikge1xuICBkYXRhLm5zID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJztcbiAgaWYgKGNoaWxkcmVuICE9PSB1bmRlZmluZWQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICBhZGROUyhjaGlsZHJlbltpXS5kYXRhLCBjaGlsZHJlbltpXS5jaGlsZHJlbik7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaChzZWwsIGIsIGMpIHtcbiAgdmFyIGRhdGEgPSB7fSwgY2hpbGRyZW4sIHRleHQsIGk7XG4gIGlmIChjICE9PSB1bmRlZmluZWQpIHtcbiAgICBkYXRhID0gYjtcbiAgICBpZiAoaXMuYXJyYXkoYykpIHsgY2hpbGRyZW4gPSBjOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGMpKSB7IHRleHQgPSBjOyB9XG4gIH0gZWxzZSBpZiAoYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGlzLmFycmF5KGIpKSB7IGNoaWxkcmVuID0gYjsgfVxuICAgIGVsc2UgaWYgKGlzLnByaW1pdGl2ZShiKSkgeyB0ZXh0ID0gYjsgfVxuICAgIGVsc2UgeyBkYXRhID0gYjsgfVxuICB9XG4gIGlmIChpcy5hcnJheShjaGlsZHJlbikpIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGlmIChpcy5wcmltaXRpdmUoY2hpbGRyZW5baV0pKSBjaGlsZHJlbltpXSA9IFZOb2RlKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNoaWxkcmVuW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKHNlbFswXSA9PT0gJ3MnICYmIHNlbFsxXSA9PT0gJ3YnICYmIHNlbFsyXSA9PT0gJ2cnKSB7XG4gICAgYWRkTlMoZGF0YSwgY2hpbGRyZW4pO1xuICB9XG4gIHJldHVybiBWTm9kZShzZWwsIGRhdGEsIGNoaWxkcmVuLCB0ZXh0LCB1bmRlZmluZWQpO1xufTtcbiIsImZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSl7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlVVJJLCBxdWFsaWZpZWROYW1lKXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUZXh0Tm9kZSh0ZXh0KXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpO1xufVxuXG5cbmZ1bmN0aW9uIGluc2VydEJlZm9yZShwYXJlbnROb2RlLCBuZXdOb2RlLCByZWZlcmVuY2VOb2RlKXtcbiAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobmV3Tm9kZSwgcmVmZXJlbmNlTm9kZSk7XG59XG5cblxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGQobm9kZSwgY2hpbGQpe1xuICBub2RlLnJlbW92ZUNoaWxkKGNoaWxkKTtcbn1cblxuZnVuY3Rpb24gYXBwZW5kQ2hpbGQobm9kZSwgY2hpbGQpe1xuICBub2RlLmFwcGVuZENoaWxkKGNoaWxkKTtcbn1cblxuZnVuY3Rpb24gcGFyZW50Tm9kZShub2RlKXtcbiAgcmV0dXJuIG5vZGUucGFyZW50RWxlbWVudDtcbn1cblxuZnVuY3Rpb24gbmV4dFNpYmxpbmcobm9kZSl7XG4gIHJldHVybiBub2RlLm5leHRTaWJsaW5nO1xufVxuXG5mdW5jdGlvbiB0YWdOYW1lKG5vZGUpe1xuICByZXR1cm4gbm9kZS50YWdOYW1lO1xufVxuXG5mdW5jdGlvbiBzZXRUZXh0Q29udGVudChub2RlLCB0ZXh0KXtcbiAgbm9kZS50ZXh0Q29udGVudCA9IHRleHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBjcmVhdGVFbGVtZW50OiBjcmVhdGVFbGVtZW50LFxuICBjcmVhdGVFbGVtZW50TlM6IGNyZWF0ZUVsZW1lbnROUyxcbiAgY3JlYXRlVGV4dE5vZGU6IGNyZWF0ZVRleHROb2RlLFxuICBhcHBlbmRDaGlsZDogYXBwZW5kQ2hpbGQsXG4gIHJlbW92ZUNoaWxkOiByZW1vdmVDaGlsZCxcbiAgaW5zZXJ0QmVmb3JlOiBpbnNlcnRCZWZvcmUsXG4gIHBhcmVudE5vZGU6IHBhcmVudE5vZGUsXG4gIG5leHRTaWJsaW5nOiBuZXh0U2libGluZyxcbiAgdGFnTmFtZTogdGFnTmFtZSxcbiAgc2V0VGV4dENvbnRlbnQ6IHNldFRleHRDb250ZW50XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFycmF5OiBBcnJheS5pc0FycmF5LFxuICBwcmltaXRpdmU6IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHR5cGVvZiBzID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgcyA9PT0gJ251bWJlcic7IH0sXG59O1xuIiwiZnVuY3Rpb24gdXBkYXRlQ2xhc3Mob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBjdXIsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZENsYXNzID0gb2xkVm5vZGUuZGF0YS5jbGFzcyB8fCB7fSxcbiAgICAgIGtsYXNzID0gdm5vZGUuZGF0YS5jbGFzcyB8fCB7fTtcbiAgZm9yIChuYW1lIGluIG9sZENsYXNzKSB7XG4gICAgaWYgKCFrbGFzc1tuYW1lXSkge1xuICAgICAgZWxtLmNsYXNzTGlzdC5yZW1vdmUobmFtZSk7XG4gICAgfVxuICB9XG4gIGZvciAobmFtZSBpbiBrbGFzcykge1xuICAgIGN1ciA9IGtsYXNzW25hbWVdO1xuICAgIGlmIChjdXIgIT09IG9sZENsYXNzW25hbWVdKSB7XG4gICAgICBlbG0uY2xhc3NMaXN0W2N1ciA/ICdhZGQnIDogJ3JlbW92ZSddKG5hbWUpO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZUNsYXNzLCB1cGRhdGU6IHVwZGF0ZUNsYXNzfTtcbiIsInZhciBpcyA9IHJlcXVpcmUoJy4uL2lzJyk7XG5cbmZ1bmN0aW9uIGFyckludm9rZXIoYXJyKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHJldHVybjtcbiAgICAvLyBTcGVjaWFsIGNhc2Ugd2hlbiBsZW5ndGggaXMgdHdvLCBmb3IgcGVyZm9ybWFuY2VcbiAgICBhcnIubGVuZ3RoID09PSAyID8gYXJyWzBdKGFyclsxXSkgOiBhcnJbMF0uYXBwbHkodW5kZWZpbmVkLCBhcnIuc2xpY2UoMSkpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBmbkludm9rZXIobykge1xuICByZXR1cm4gZnVuY3Rpb24oZXYpIHsgXG4gICAgaWYgKG8uZm4gPT09IG51bGwpIHJldHVybjtcbiAgICBvLmZuKGV2KTsgXG4gIH07XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgbmFtZSwgY3VyLCBvbGQsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZE9uID0gb2xkVm5vZGUuZGF0YS5vbiB8fCB7fSwgb24gPSB2bm9kZS5kYXRhLm9uO1xuICBpZiAoIW9uKSByZXR1cm47XG4gIGZvciAobmFtZSBpbiBvbikge1xuICAgIGN1ciA9IG9uW25hbWVdO1xuICAgIG9sZCA9IG9sZE9uW25hbWVdO1xuICAgIGlmIChvbGQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGlzLmFycmF5KGN1cikpIHtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgYXJySW52b2tlcihjdXIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN1ciA9IHtmbjogY3VyfTtcbiAgICAgICAgb25bbmFtZV0gPSBjdXI7XG4gICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGZuSW52b2tlcihjdXIpKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzLmFycmF5KG9sZCkpIHtcbiAgICAgIC8vIERlbGliZXJhdGVseSBtb2RpZnkgb2xkIGFycmF5IHNpbmNlIGl0J3MgY2FwdHVyZWQgaW4gY2xvc3VyZSBjcmVhdGVkIHdpdGggYGFyckludm9rZXJgXG4gICAgICBvbGQubGVuZ3RoID0gY3VyLmxlbmd0aDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgKytpKSBvbGRbaV0gPSBjdXJbaV07XG4gICAgICBvbltuYW1lXSAgPSBvbGQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZC5mbiA9IGN1cjtcbiAgICAgIG9uW25hbWVdID0gb2xkO1xuICAgIH1cbiAgfVxuICBpZiAob2xkT24pIHtcbiAgICBmb3IgKG5hbWUgaW4gb2xkT24pIHtcbiAgICAgIGlmIChvbltuYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZhciBvbGQgPSBvbGRPbltuYW1lXTtcbiAgICAgICAgaWYgKGlzLmFycmF5KG9sZCkpIHtcbiAgICAgICAgICBvbGQubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBvbGQuZm4gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnMsIHVwZGF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnN9O1xuIiwiZnVuY3Rpb24gdXBkYXRlUHJvcHMob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBrZXksIGN1ciwgb2xkLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRQcm9wcyA9IG9sZFZub2RlLmRhdGEucHJvcHMgfHwge30sIHByb3BzID0gdm5vZGUuZGF0YS5wcm9wcyB8fCB7fTtcbiAgZm9yIChrZXkgaW4gb2xkUHJvcHMpIHtcbiAgICBpZiAoIXByb3BzW2tleV0pIHtcbiAgICAgIGRlbGV0ZSBlbG1ba2V5XTtcbiAgICB9XG4gIH1cbiAgZm9yIChrZXkgaW4gcHJvcHMpIHtcbiAgICBjdXIgPSBwcm9wc1trZXldO1xuICAgIG9sZCA9IG9sZFByb3BzW2tleV07XG4gICAgaWYgKG9sZCAhPT0gY3VyICYmIChrZXkgIT09ICd2YWx1ZScgfHwgZWxtW2tleV0gIT09IGN1cikpIHtcbiAgICAgIGVsbVtrZXldID0gY3VyO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZVByb3BzLCB1cGRhdGU6IHVwZGF0ZVByb3BzfTtcbiIsInZhciByYWYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSkgfHwgc2V0VGltZW91dDtcbnZhciBuZXh0RnJhbWUgPSBmdW5jdGlvbihmbikgeyByYWYoZnVuY3Rpb24oKSB7IHJhZihmbik7IH0pOyB9O1xuXG5mdW5jdGlvbiBzZXROZXh0RnJhbWUob2JqLCBwcm9wLCB2YWwpIHtcbiAgbmV4dEZyYW1lKGZ1bmN0aW9uKCkgeyBvYmpbcHJvcF0gPSB2YWw7IH0pO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTdHlsZShvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGN1ciwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkU3R5bGUgPSBvbGRWbm9kZS5kYXRhLnN0eWxlIHx8IHt9LFxuICAgICAgc3R5bGUgPSB2bm9kZS5kYXRhLnN0eWxlIHx8IHt9LFxuICAgICAgb2xkSGFzRGVsID0gJ2RlbGF5ZWQnIGluIG9sZFN0eWxlO1xuICBmb3IgKG5hbWUgaW4gb2xkU3R5bGUpIHtcbiAgICBpZiAoIXN0eWxlW25hbWVdKSB7XG4gICAgICBlbG0uc3R5bGVbbmFtZV0gPSAnJztcbiAgICB9XG4gIH1cbiAgZm9yIChuYW1lIGluIHN0eWxlKSB7XG4gICAgY3VyID0gc3R5bGVbbmFtZV07XG4gICAgaWYgKG5hbWUgPT09ICdkZWxheWVkJykge1xuICAgICAgZm9yIChuYW1lIGluIHN0eWxlLmRlbGF5ZWQpIHtcbiAgICAgICAgY3VyID0gc3R5bGUuZGVsYXllZFtuYW1lXTtcbiAgICAgICAgaWYgKCFvbGRIYXNEZWwgfHwgY3VyICE9PSBvbGRTdHlsZS5kZWxheWVkW25hbWVdKSB7XG4gICAgICAgICAgc2V0TmV4dEZyYW1lKGVsbS5zdHlsZSwgbmFtZSwgY3VyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmFtZSAhPT0gJ3JlbW92ZScgJiYgY3VyICE9PSBvbGRTdHlsZVtuYW1lXSkge1xuICAgICAgZWxtLnN0eWxlW25hbWVdID0gY3VyO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseURlc3Ryb3lTdHlsZSh2bm9kZSkge1xuICB2YXIgc3R5bGUsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSwgcyA9IHZub2RlLmRhdGEuc3R5bGU7XG4gIGlmICghcyB8fCAhKHN0eWxlID0gcy5kZXN0cm95KSkgcmV0dXJuO1xuICBmb3IgKG5hbWUgaW4gc3R5bGUpIHtcbiAgICBlbG0uc3R5bGVbbmFtZV0gPSBzdHlsZVtuYW1lXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseVJlbW92ZVN0eWxlKHZub2RlLCBybSkge1xuICB2YXIgcyA9IHZub2RlLmRhdGEuc3R5bGU7XG4gIGlmICghcyB8fCAhcy5yZW1vdmUpIHtcbiAgICBybSgpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSwgZWxtID0gdm5vZGUuZWxtLCBpZHgsIGkgPSAwLCBtYXhEdXIgPSAwLFxuICAgICAgY29tcFN0eWxlLCBzdHlsZSA9IHMucmVtb3ZlLCBhbW91bnQgPSAwLCBhcHBsaWVkID0gW107XG4gIGZvciAobmFtZSBpbiBzdHlsZSkge1xuICAgIGFwcGxpZWQucHVzaChuYW1lKTtcbiAgICBlbG0uc3R5bGVbbmFtZV0gPSBzdHlsZVtuYW1lXTtcbiAgfVxuICBjb21wU3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGVsbSk7XG4gIHZhciBwcm9wcyA9IGNvbXBTdHlsZVsndHJhbnNpdGlvbi1wcm9wZXJ0eSddLnNwbGl0KCcsICcpO1xuICBmb3IgKDsgaSA8IHByb3BzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYoYXBwbGllZC5pbmRleE9mKHByb3BzW2ldKSAhPT0gLTEpIGFtb3VudCsrO1xuICB9XG4gIGVsbS5hZGRFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJywgZnVuY3Rpb24oZXYpIHtcbiAgICBpZiAoZXYudGFyZ2V0ID09PSBlbG0pIC0tYW1vdW50O1xuICAgIGlmIChhbW91bnQgPT09IDApIHJtKCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZVN0eWxlLCB1cGRhdGU6IHVwZGF0ZVN0eWxlLCBkZXN0cm95OiBhcHBseURlc3Ryb3lTdHlsZSwgcmVtb3ZlOiBhcHBseVJlbW92ZVN0eWxlfTtcbiIsIi8vIGpzaGludCBuZXdjYXA6IGZhbHNlXG4vKiBnbG9iYWwgcmVxdWlyZSwgbW9kdWxlLCBkb2N1bWVudCwgTm9kZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG52YXIgZG9tQXBpID0gcmVxdWlyZSgnLi9odG1sZG9tYXBpJyk7XG5cbmZ1bmN0aW9uIGlzVW5kZWYocykgeyByZXR1cm4gcyA9PT0gdW5kZWZpbmVkOyB9XG5mdW5jdGlvbiBpc0RlZihzKSB7IHJldHVybiBzICE9PSB1bmRlZmluZWQ7IH1cblxudmFyIGVtcHR5Tm9kZSA9IFZOb2RlKCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblxuZnVuY3Rpb24gc2FtZVZub2RlKHZub2RlMSwgdm5vZGUyKSB7XG4gIHJldHVybiB2bm9kZTEua2V5ID09PSB2bm9kZTIua2V5ICYmIHZub2RlMS5zZWwgPT09IHZub2RlMi5zZWw7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUtleVRvT2xkSWR4KGNoaWxkcmVuLCBiZWdpbklkeCwgZW5kSWR4KSB7XG4gIHZhciBpLCBtYXAgPSB7fSwga2V5O1xuICBmb3IgKGkgPSBiZWdpbklkeDsgaSA8PSBlbmRJZHg7ICsraSkge1xuICAgIGtleSA9IGNoaWxkcmVuW2ldLmtleTtcbiAgICBpZiAoaXNEZWYoa2V5KSkgbWFwW2tleV0gPSBpO1xuICB9XG4gIHJldHVybiBtYXA7XG59XG5cbnZhciBob29rcyA9IFsnY3JlYXRlJywgJ3VwZGF0ZScsICdyZW1vdmUnLCAnZGVzdHJveScsICdwcmUnLCAncG9zdCddO1xuXG5mdW5jdGlvbiBpbml0KG1vZHVsZXMsIGFwaSkge1xuICB2YXIgaSwgaiwgY2JzID0ge307XG5cbiAgaWYgKGlzVW5kZWYoYXBpKSkgYXBpID0gZG9tQXBpO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBob29rcy5sZW5ndGg7ICsraSkge1xuICAgIGNic1tob29rc1tpXV0gPSBbXTtcbiAgICBmb3IgKGogPSAwOyBqIDwgbW9kdWxlcy5sZW5ndGg7ICsraikge1xuICAgICAgaWYgKG1vZHVsZXNbal1baG9va3NbaV1dICE9PSB1bmRlZmluZWQpIGNic1tob29rc1tpXV0ucHVzaChtb2R1bGVzW2pdW2hvb2tzW2ldXSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW1wdHlOb2RlQXQoZWxtKSB7XG4gICAgcmV0dXJuIFZOb2RlKGFwaS50YWdOYW1lKGVsbSkudG9Mb3dlckNhc2UoKSwge30sIFtdLCB1bmRlZmluZWQsIGVsbSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVSbUNiKGNoaWxkRWxtLCBsaXN0ZW5lcnMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS1saXN0ZW5lcnMgPT09IDApIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGFwaS5wYXJlbnROb2RlKGNoaWxkRWxtKTtcbiAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudCwgY2hpbGRFbG0pO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBpLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICBpZiAoaXNEZWYoZGF0YSkpIHtcbiAgICAgIGlmIChpc0RlZihpID0gZGF0YS5ob29rKSAmJiBpc0RlZihpID0gaS5pbml0KSkge1xuICAgICAgICBpKHZub2RlKTtcbiAgICAgICAgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBlbG0sIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4sIHNlbCA9IHZub2RlLnNlbDtcbiAgICBpZiAoaXNEZWYoc2VsKSkge1xuICAgICAgLy8gUGFyc2Ugc2VsZWN0b3JcbiAgICAgIHZhciBoYXNoSWR4ID0gc2VsLmluZGV4T2YoJyMnKTtcbiAgICAgIHZhciBkb3RJZHggPSBzZWwuaW5kZXhPZignLicsIGhhc2hJZHgpO1xuICAgICAgdmFyIGhhc2ggPSBoYXNoSWR4ID4gMCA/IGhhc2hJZHggOiBzZWwubGVuZ3RoO1xuICAgICAgdmFyIGRvdCA9IGRvdElkeCA+IDAgPyBkb3RJZHggOiBzZWwubGVuZ3RoO1xuICAgICAgdmFyIHRhZyA9IGhhc2hJZHggIT09IC0xIHx8IGRvdElkeCAhPT0gLTEgPyBzZWwuc2xpY2UoMCwgTWF0aC5taW4oaGFzaCwgZG90KSkgOiBzZWw7XG4gICAgICBlbG0gPSB2bm9kZS5lbG0gPSBpc0RlZihkYXRhKSAmJiBpc0RlZihpID0gZGF0YS5ucykgPyBhcGkuY3JlYXRlRWxlbWVudE5TKGksIHRhZylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGFwaS5jcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgICBpZiAoaGFzaCA8IGRvdCkgZWxtLmlkID0gc2VsLnNsaWNlKGhhc2ggKyAxLCBkb3QpO1xuICAgICAgaWYgKGRvdElkeCA+IDApIGVsbS5jbGFzc05hbWUgPSBzZWwuc2xpY2UoZG90KzEpLnJlcGxhY2UoL1xcLi9nLCAnICcpO1xuICAgICAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBjcmVhdGVFbG0oY2hpbGRyZW5baV0sIGluc2VydGVkVm5vZGVRdWV1ZSkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzLnByaW1pdGl2ZSh2bm9kZS50ZXh0KSkge1xuICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCkpO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5jcmVhdGUubGVuZ3RoOyArK2kpIGNicy5jcmVhdGVbaV0oZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICBpID0gdm5vZGUuZGF0YS5ob29rOyAvLyBSZXVzZSB2YXJpYWJsZVxuICAgICAgaWYgKGlzRGVmKGkpKSB7XG4gICAgICAgIGlmIChpLmNyZWF0ZSkgaS5jcmVhdGUoZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICAgIGlmIChpLmluc2VydCkgaW5zZXJ0ZWRWbm9kZVF1ZXVlLnB1c2godm5vZGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSB2bm9kZS5lbG0gPSBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCk7XG4gICAgfVxuICAgIHJldHVybiB2bm9kZS5lbG07XG4gIH1cblxuICBmdW5jdGlvbiBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIHZub2Rlcywgc3RhcnRJZHgsIGVuZElkeCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgZm9yICg7IHN0YXJ0SWR4IDw9IGVuZElkeDsgKytzdGFydElkeCkge1xuICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGNyZWF0ZUVsbSh2bm9kZXNbc3RhcnRJZHhdLCBpbnNlcnRlZFZub2RlUXVldWUpLCBiZWZvcmUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGludm9rZURlc3Ryb3lIb29rKHZub2RlKSB7XG4gICAgdmFyIGksIGosIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIGlmIChpc0RlZihkYXRhKSkge1xuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmRlc3Ryb3kpKSBpKHZub2RlKTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMuZGVzdHJveS5sZW5ndGg7ICsraSkgY2JzLmRlc3Ryb3lbaV0odm5vZGUpO1xuICAgICAgaWYgKGlzRGVmKGkgPSB2bm9kZS5jaGlsZHJlbikpIHtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IHZub2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgaW52b2tlRGVzdHJveUhvb2sodm5vZGUuY2hpbGRyZW5bal0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4KSB7XG4gICAgZm9yICg7IHN0YXJ0SWR4IDw9IGVuZElkeDsgKytzdGFydElkeCkge1xuICAgICAgdmFyIGksIGxpc3RlbmVycywgcm0sIGNoID0gdm5vZGVzW3N0YXJ0SWR4XTtcbiAgICAgIGlmIChpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKGlzRGVmKGNoLnNlbCkpIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayhjaCk7XG4gICAgICAgICAgbGlzdGVuZXJzID0gY2JzLnJlbW92ZS5sZW5ndGggKyAxO1xuICAgICAgICAgIHJtID0gY3JlYXRlUm1DYihjaC5lbG0sIGxpc3RlbmVycyk7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5yZW1vdmUubGVuZ3RoOyArK2kpIGNicy5yZW1vdmVbaV0oY2gsIHJtKTtcbiAgICAgICAgICBpZiAoaXNEZWYoaSA9IGNoLmRhdGEpICYmIGlzRGVmKGkgPSBpLmhvb2spICYmIGlzRGVmKGkgPSBpLnJlbW92ZSkpIHtcbiAgICAgICAgICAgIGkoY2gsIHJtKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm0oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7IC8vIFRleHQgbm9kZVxuICAgICAgICAgIGFwaS5yZW1vdmVDaGlsZChwYXJlbnRFbG0sIGNoLmVsbSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVDaGlsZHJlbihwYXJlbnRFbG0sIG9sZENoLCBuZXdDaCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIG9sZFN0YXJ0SWR4ID0gMCwgbmV3U3RhcnRJZHggPSAwO1xuICAgIHZhciBvbGRFbmRJZHggPSBvbGRDaC5sZW5ndGggLSAxO1xuICAgIHZhciBvbGRTdGFydFZub2RlID0gb2xkQ2hbMF07XG4gICAgdmFyIG9sZEVuZFZub2RlID0gb2xkQ2hbb2xkRW5kSWR4XTtcbiAgICB2YXIgbmV3RW5kSWR4ID0gbmV3Q2gubGVuZ3RoIC0gMTtcbiAgICB2YXIgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWzBdO1xuICAgIHZhciBuZXdFbmRWbm9kZSA9IG5ld0NoW25ld0VuZElkeF07XG4gICAgdmFyIG9sZEtleVRvSWR4LCBpZHhJbk9sZCwgZWxtVG9Nb3ZlLCBiZWZvcmU7XG5cbiAgICB3aGlsZSAob2xkU3RhcnRJZHggPD0gb2xkRW5kSWR4ICYmIG5ld1N0YXJ0SWR4IDw9IG5ld0VuZElkeCkge1xuICAgICAgaWYgKGlzVW5kZWYob2xkU3RhcnRWbm9kZSkpIHtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdOyAvLyBWbm9kZSBoYXMgYmVlbiBtb3ZlZCBsZWZ0XG4gICAgICB9IGVsc2UgaWYgKGlzVW5kZWYob2xkRW5kVm5vZGUpKSB7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3U3RhcnRWbm9kZSkpIHtcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07XG4gICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdFbmRWbm9kZSkpIHtcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRFbmRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICBuZXdFbmRWbm9kZSA9IG5ld0NoWy0tbmV3RW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlKSkgeyAvLyBWbm9kZSBtb3ZlZCByaWdodFxuICAgICAgICBwYXRjaFZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgb2xkU3RhcnRWbm9kZS5lbG0sIGFwaS5uZXh0U2libGluZyhvbGRFbmRWbm9kZS5lbG0pKTtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICBuZXdFbmRWbm9kZSA9IG5ld0NoWy0tbmV3RW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlKSkgeyAvLyBWbm9kZSBtb3ZlZCBsZWZ0XG4gICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBvbGRFbmRWbm9kZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc1VuZGVmKG9sZEtleVRvSWR4KSkgb2xkS2V5VG9JZHggPSBjcmVhdGVLZXlUb09sZElkeChvbGRDaCwgb2xkU3RhcnRJZHgsIG9sZEVuZElkeCk7XG4gICAgICAgIGlkeEluT2xkID0gb2xkS2V5VG9JZHhbbmV3U3RhcnRWbm9kZS5rZXldO1xuICAgICAgICBpZiAoaXNVbmRlZihpZHhJbk9sZCkpIHsgLy8gTmV3IGVsZW1lbnRcbiAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSksIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWxtVG9Nb3ZlID0gb2xkQ2hbaWR4SW5PbGRdO1xuICAgICAgICAgIHBhdGNoVm5vZGUoZWxtVG9Nb3ZlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgIG9sZENoW2lkeEluT2xkXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtVG9Nb3ZlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAob2xkU3RhcnRJZHggPiBvbGRFbmRJZHgpIHtcbiAgICAgIGJlZm9yZSA9IGlzVW5kZWYobmV3Q2hbbmV3RW5kSWR4KzFdKSA/IG51bGwgOiBuZXdDaFtuZXdFbmRJZHgrMV0uZWxtO1xuICAgICAgYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCBuZXdDaCwgbmV3U3RhcnRJZHgsIG5ld0VuZElkeCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICB9IGVsc2UgaWYgKG5ld1N0YXJ0SWR4ID4gbmV3RW5kSWR4KSB7XG4gICAgICByZW1vdmVWbm9kZXMocGFyZW50RWxtLCBvbGRDaCwgb2xkU3RhcnRJZHgsIG9sZEVuZElkeCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGF0Y2hWbm9kZShvbGRWbm9kZSwgdm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBpLCBob29rO1xuICAgIGlmIChpc0RlZihpID0gdm5vZGUuZGF0YSkgJiYgaXNEZWYoaG9vayA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucHJlcGF0Y2gpKSB7XG4gICAgICBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgfVxuICAgIHZhciBlbG0gPSB2bm9kZS5lbG0gPSBvbGRWbm9kZS5lbG0sIG9sZENoID0gb2xkVm5vZGUuY2hpbGRyZW4sIGNoID0gdm5vZGUuY2hpbGRyZW47XG4gICAgaWYgKG9sZFZub2RlID09PSB2bm9kZSkgcmV0dXJuO1xuICAgIGlmICghc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHZhciBwYXJlbnRFbG0gPSBhcGkucGFyZW50Tm9kZShvbGRWbm9kZS5lbG0pO1xuICAgICAgZWxtID0gY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbSwgb2xkVm5vZGUuZWxtKTtcbiAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIFtvbGRWbm9kZV0sIDAsIDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaXNEZWYodm5vZGUuZGF0YSkpIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMudXBkYXRlLmxlbmd0aDsgKytpKSBjYnMudXBkYXRlW2ldKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICBpID0gdm5vZGUuZGF0YS5ob29rO1xuICAgICAgaWYgKGlzRGVmKGkpICYmIGlzRGVmKGkgPSBpLnVwZGF0ZSkpIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gICAgaWYgKGlzVW5kZWYodm5vZGUudGV4dCkpIHtcbiAgICAgIGlmIChpc0RlZihvbGRDaCkgJiYgaXNEZWYoY2gpKSB7XG4gICAgICAgIGlmIChvbGRDaCAhPT0gY2gpIHVwZGF0ZUNoaWxkcmVuKGVsbSwgb2xkQ2gsIGNoLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICAgIGFkZFZub2RlcyhlbG0sIG51bGwsIGNoLCAwLCBjaC5sZW5ndGggLSAxLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihvbGRDaCkpIHtcbiAgICAgICAgcmVtb3ZlVm5vZGVzKGVsbSwgb2xkQ2gsIDAsIG9sZENoLmxlbmd0aCAtIDEpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihvbGRWbm9kZS50ZXh0KSkge1xuICAgICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvbGRWbm9kZS50ZXh0ICE9PSB2bm9kZS50ZXh0KSB7XG4gICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCB2bm9kZS50ZXh0KTtcbiAgICB9XG4gICAgaWYgKGlzRGVmKGhvb2spICYmIGlzRGVmKGkgPSBob29rLnBvc3RwYXRjaCkpIHtcbiAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24ob2xkVm5vZGUsIHZub2RlKSB7XG4gICAgdmFyIGksIGVsbSwgcGFyZW50O1xuICAgIHZhciBpbnNlcnRlZFZub2RlUXVldWUgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnByZS5sZW5ndGg7ICsraSkgY2JzLnByZVtpXSgpO1xuXG4gICAgaWYgKGlzVW5kZWYob2xkVm5vZGUuc2VsKSkge1xuICAgICAgb2xkVm5vZGUgPSBlbXB0eU5vZGVBdChvbGRWbm9kZSk7XG4gICAgfVxuXG4gICAgaWYgKHNhbWVWbm9kZShvbGRWbm9kZSwgdm5vZGUpKSB7XG4gICAgICBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWxtID0gb2xkVm5vZGUuZWxtO1xuICAgICAgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoZWxtKTtcblxuICAgICAgY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuXG4gICAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50LCB2bm9kZS5lbG0sIGFwaS5uZXh0U2libGluZyhlbG0pKTtcbiAgICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudCwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGluc2VydGVkVm5vZGVRdWV1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgaW5zZXJ0ZWRWbm9kZVF1ZXVlW2ldLmRhdGEuaG9vay5pbnNlcnQoaW5zZXJ0ZWRWbm9kZVF1ZXVlW2ldKTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGNicy5wb3N0Lmxlbmd0aDsgKytpKSBjYnMucG9zdFtpXSgpO1xuICAgIHJldHVybiB2bm9kZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7aW5pdDogaW5pdH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIGVsbSkge1xuICB2YXIga2V5ID0gZGF0YSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZGF0YS5rZXk7XG4gIHJldHVybiB7c2VsOiBzZWwsIGRhdGE6IGRhdGEsIGNoaWxkcmVuOiBjaGlsZHJlbixcbiAgICAgICAgICB0ZXh0OiB0ZXh0LCBlbG06IGVsbSwga2V5OiBrZXl9O1xufTtcbiIsImNvbnN0IHsgcGlwZSwgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuY29uc3QgZnV6enlzZXQgPSByZXF1aXJlKCdmdXp6eXNldC5qcycpXG5cbmNvbnN0IGNvbW1hbmRzID0gKGRhdGEpID0+IHtcbiAgY29uc3QgZnV6enlfY2xpZW50cyA9IGZ1enp5c2V0KE9iamVjdC5rZXlzKGRhdGEuY2xpZW50cykpXG4gIFxuICBjb25zdCBfY29tbWFuZHMgPSB7XG4gICAgJ2NsaWVudCAqbmFtZSc6IHBpcGUoXG4gICAgICAobmFtZSkgPT4ge1xuICAgICAgICBjb25zdCByZXMgPSBmdXp6eV9jbGllbnRzLmdldChuYW1lKVxuICAgICAgICBjb25zb2xlLmxvZyhuYW1lLHJlcylcbiAgICAgICAgaWYgKHJlcyAhPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBFaXRoZXIuUmlnaHQoYGZ1enp5IGNsaWVudCBmb3VuZCAke3Jlc31gKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBFaXRoZXIuTGVmdChgY2xpZW50ICR7bmFtZX0gbm90IGZvdW5kIGJ5IGZ1enp5YClcbiAgICAgICAgfVxuICAgICAgfSwgXG4gICAgICBFaXRoZXIuYmltYXBcbiAgICAgICAgKGVyck1zZyA9PiB7IHJldHVybiB7IGVyck1zZyB9IH0pXG4gICAgICAgIChzdWNjZXNzTXNnID0+IHsgXG4gICAgICAgICAgY29uc3QgY2xvZ3MgPSBkYXRhLmNsb2dzLnNsaWNlKClcbiAgICAgICAgICBjbG9ncy5wdXNoKHN1Y2Nlc3NNc2cpXG4gICAgICAgICAgcmV0dXJuIHsgY2xvZ3MgfVxuICAgICAgICB9KVxuICAgICksXG4gICAgJ2luY3JlYXNlIDpsZXR0ZXInOiBwaXBlKFxuICAgICAgKGxldHRlcikgPT4ge1xuICAgICAgICBsZXR0ZXIgPSBsZXR0ZXIudG9Mb3dlckNhc2UoKVxuICAgICAgICBpZiAoZGF0YS5sZXR0ZXJzW2xldHRlcl0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGEubGV0dGVyc1tsZXR0ZXJdKytcbiAgICAgICAgICByZXR1cm4gRWl0aGVyLlJpZ2h0KGBpbmNyZWFzZWQgbGV0dGVyICR7bGV0dGVyfSAke0pTT04uc3RyaW5naWZ5KGRhdGEubGV0dGVycyl9YClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gRWl0aGVyLkxlZnQoYGNhbm5vdCBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tIGl0IGRvZXMgbm90IGV4aXN0YClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIEVpdGhlci5iaW1hcFxuICAgICAgICAoZXJyTXNnID0+IHsgcmV0dXJuIHsgZXJyTXNnIH0gfSlcbiAgICAgICAgKHN1Y2Nlc3NNc2cgPT4ge1xuICAgICAgICAgIGNvbnN0IGNsb2dzID0gZGF0YS5jbG9ncy5zbGljZSgpXG4gICAgICAgICAgY2xvZ3MucHVzaChzdWNjZXNzTXNnKVxuICAgICAgICAgIHJldHVybiB7IGNsb2dzIH1cbiAgICAgICAgfSlcbiAgICApLFxuICAgICdzaG93IGNvbW1hbmRzJzogKCkgPT4ge1xuICAgICAgdmFyIGNsb2dzID0gZGF0YS5jbG9ncy5zbGljZSgpXG4gICAgICBjbG9ncy5wdXNoKFJlZmxlY3Qub3duS2V5cyhfY29tbWFuZHMpLmpvaW4oJywgJykgKyAnXFxuJylcbiAgICAgIHJldHVybiBFaXRoZXIuUmlnaHQoeyBjbG9ncyB9KVxuICAgIH0sXG4gICAgJ2NsZWFyIHNjcmVlbic6ICgpID0+IHtcbiAgICAgIHJldHVybiBFaXRoZXIuUmlnaHQoeyBjbG9nczogW10gfSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIF9jb21tYW5kc1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbW1hbmRzIiwiY29uc3QgY2hhbm5lbCA9IFtdXG5cbmNvbnN0IGluaXQgPSAoY29tbWFuZHMpID0+IHtcbiAgZm9yICh2YXIgbmFtZSBpbiBjb21tYW5kcykge1xuICAgIGNvbW1hbmRzW25hbWVdID0gd3JhcHBlcihjb21tYW5kc1tuYW1lXSlcbiAgfVxuICByZXR1cm4geyBjb21tYW5kcywgY2hhbm5lbCB9XG59XG5cbmNvbnN0IHdyYXBwZXIgPSAoY2FsbGJhY2spID0+ICguLi5hcmdzKSA9PiB7XG4gIGNoYW5uZWwucHVzaChjYWxsYmFjayguLi5hcmdzKSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGluaXQgfSIsImNvbnN0IGggPSByZXF1aXJlKCdzbmFiYmRvbS9oJylcblxuY29uc3QgU3RhdGVDcmVhdG9yID0gKHtcbiAgZXJyTXNnLFxuICBjbG9nc1xufSkgPT4ge1xuICB3aGlsZSAoY2xvZ3MubGVuZ3RoID4gMzApIHtcbiAgICBjbG9ncy5zaGlmdCgpXG4gIH1cbiAgcmV0dXJuIGgoJ2RpdiNjb250ZW50JywgW1xuICAgICAgaCgnZGl2I2VycicsIFtlcnJNc2ddKSxcbiAgICAgIGgoJ2RpdiNjbG9nJywgY2xvZ3MubWFwKGxvZyA9PiBoKCdzcGFuJywgW2xvZ10pKSlcbiAgICBdKVxufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVDcmVhdG9yIiwiY29uc3Qgc25hYmJkb20gPSByZXF1aXJlKCdzbmFiYmRvbScpXG5jb25zdCBwYXRjaCA9IHNuYWJiZG9tLmluaXQoWyAvLyBJbml0IHBhdGNoIGZ1bmN0aW9uIHdpdGggY2hvb3NlbiBtb2R1bGVzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnKSwgLy8gbWFrZXMgaXQgZWFzeSB0byB0b2dnbGUgY2xhc3Nlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJyksIC8vIGZvciBzZXR0aW5nIHByb3BlcnRpZXMgb24gRE9NIGVsZW1lbnRzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvc3R5bGUnKSwgLy8gaGFuZGxlcyBzdHlsaW5nIG9uIGVsZW1lbnRzIHdpdGggc3VwcG9ydCBmb3IgYW5pbWF0aW9uc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJyksIC8vIGF0dGFjaGVzIGV2ZW50IGxpc3RlbmVyc1xuXSlcblxuY29uc3QgaW5pdCA9IChwYXJlbnROb2RlKSA9PiAoU3RhdGVDcmVhdG9yKSA9PiAoaW5pdF9wYXJhbXMpID0+IHtcbiAgdmFyIF92dHJlZSA9IHBhcmVudE5vZGVcbiAgY29uc3QgX3N0YXRlcyA9IFtdXG4gIFxuICAvLyBjdXJzb3Igc3RvcmVzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudGx5IHJlbmRlcmVkIHN0YXRlXG4gIC8vIGl0IG1vdmVzIGJhY2sgYW5kIGZvcndhcmQgZm9yIHVuZG8vcmVkbyBvcGVyYXRpb25zXG4gIGNvbnN0IGkgPSAwXG4gIFxuICAvLyByZXBsYWNlIG11c3QgYmUgdHJ1ZSBmb3IgZmlyc3Qgc3RhdGUgY2hhbmdlXG4gIGNvbnN0IGNoYW5nZSA9IChzdGF0ZSwgeyByZXBsYWNlIH0pID0+IHtcbiAgICBpZiAoIXJlcGxhY2UpIHtcbiAgICAgIHN0YXRlID0gT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCBfc3RhdGVzW2ldKSwgc3RhdGUpXG4gICAgfVxuXG4gICAgY29uc3QgbmV3X3Z0cmVlID0gU3RhdGVDcmVhdG9yKHN0YXRlKVxuICAgIFxuICAgIC8vIHJlbW92ZSBhbGwgc3RhdGUgcGFyYW1ldGVycyBpbiBmcm9udCBvZiBjdXJzb3IgcG9zaXRpb25cbiAgICBpZiAoaSAhPT0gMCkge1xuICAgICAgX3N0YXRlcy5zcGxpY2UoMCwgaSlcbiAgICAgIGkgPSAwXG4gICAgfVxuICAgIF9zdGF0ZXMudW5zaGlmdChzdGF0ZSlcbiAgICBcbiAgICBwYXRjaChfdnRyZWUsIG5ld192dHJlZSlcbiAgICBfdnRyZWUgPSBuZXdfdnRyZWVcbiAgfVxuICBcbiAgY29uc3QgdW5kbyA9ICgpID0+IHtcbiAgICByZXR1cm4gKGkgPCBzdGF0ZXMubGVuZ3RoIC0gMSlcbiAgICAgID8gKGNoYW5nZShzdGF0ZXNbKytpXSwgeyByZXBsYWNlOiB0cnVlIH0pLCB0cnVlKVxuICAgICAgOiBmYWxzZVxuICB9XG4gIFxuICBjb25zdCByZWRvID0gKCkgPT4ge1xuICAgIHJldHVybiAoaSA+IDApXG4gICAgICA/IChjaGFuZ2Uoc3RhdGVzWy0taV0sIHsgcmVwbGFjZTogdHJ1ZSB9KSwgdHJ1ZSlcbiAgICAgIDogZmFsc2VcbiAgfVxuICBcbiAgLy8gcmVwbGFjZSBtdXN0IGJlIHRydWUgZm9yIGZpcnN0IHN0YXRlIGNoYW5nZVxuICBjaGFuZ2UoaW5pdF9wYXJhbXMsIHsgcmVwbGFjZTogdHJ1ZSB9KVxuICBcbiAgcmV0dXJuIHsgY2hhbmdlLCB1bmRvLCByZWRvIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGluaXQgfSIsIi8qZ2xvYmFsIEhvcml6b24qL1xuY29uc3QgYW5ueWFuZyA9IHJlcXVpcmUoJ2FubnlhbmcnKVxuXG5jb25zdCBTdGF0ZU1hY2hpbmUgPSByZXF1aXJlKCcuL1N0YXRlTWFjaGluZScpXG5jb25zdCBFbnZpcm9ubWVudCA9IHJlcXVpcmUoJy4vRW52aXJvbm1lbnQnKVxuY29uc3QgZGF0YSA9IHtcbiAgbGV0dGVyczoge1xuICAgICBhOiAwLFxuICAgICBiOiAwLFxuICAgICBjOiAwXG4gICB9LFxuICBjbGllbnRzOiB7XG4gICAgICdCb2IgSm9uZXMnOiB7fSxcbiAgICAgJ0dyZWcgSGFybW9uJzoge30sXG4gICAgICdMZWFubiBMZXdpcyc6IHt9LFxuICAgICAnSGFybW9ueSBDaG9zdHdpdHonOiB7fVxuICAgfSxcbiAgIHZsb2dzOiBbXSxcbiAgIGNsb2dzOiBbXVxufVxuY29uc3QgY29tbWFuZHMgPSByZXF1aXJlKCcuL0NvbW1hbmRzJylcbmNvbnN0IHsgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuY29uc3QgU3RhdGVDcmVhdG9yID0gcmVxdWlyZSgnLi9TdGF0ZUNyZWF0b3InKVxuXG5jb25zdCBob3Jpem9uID0gSG9yaXpvbigpXG5ob3Jpem9uLnN0YXR1cyhzdGF0dXMgPT4ge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVhZGVyJykuY2xhc3NOYW1lID0gYHN0YXR1cy0ke3N0YXR1cy50eXBlfWBcbiAgaWYgKHN0YXR1cyA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICBcbiAgfVxufSlcbmhvcml6b24uY29ubmVjdCgpXG5cbmFubnlhbmcuZGVidWcoKVxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5jb25zdCBteUVudiA9IEVudmlyb25tZW50LmluaXQoY29tbWFuZHMoZGF0YSkpXG5nbG9iYWwubXlFbnYgPSBteUVudlxuZ2xvYmFsLmhvcml6b24gPSBob3Jpem9uXG5nbG9iYWwuYW5ueWFuZyA9IGFubnlhbmdcblxuY29uc3QgJGFjdGl2YXRlQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGl2YXRlLWJ0bicpXG5jb25zdCAkc2hvd0NvbW1hbmRzQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nob3ctY29tbWFuZHMtYnRuJylcbmNvbnN0IGRvbV9ldmVudHMgPSB7XG4gICdjbGljayc6IFt7XG4gICAgZWxlbWVudDogJGFjdGl2YXRlQnRuLFxuICAgIGNhbGxiYWNrOiBmdW5jdGlvbihfKSB7XG4gICAgICBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlLCBjb250aW51b3VzOiBmYWxzZSB9KVxuICAgIH1cbiAgfSwge1xuICAgIGVsZW1lbnQ6ICRzaG93Q29tbWFuZHNCdG4sXG4gICAgY2FsbGJhY2s6IGZ1bmN0aW9uKF8pIHtcbiAgICAgIGFubnlhbmcudHJpZ2dlcignc2hvdyBjb21tYW5kcycpXG4gICAgfVxuICB9XVxufVxuY29uc3QgYW5ueWFuZ19jYWxsYmFja3MgPSB7XG4gJ3N0YXJ0JzogKCkgPT4ge1xuICAgJGFjdGl2YXRlQnRuLmRpc2FibGVkID0gdHJ1ZVxuICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ0xpc3RlbmluZydcbiB9LFxuICdyZXN1bHQnOiAocmVzdWx0KSA9PiB7XG4gICAvL2NvbnNvbGUubG9nKHJlc3VsdClcbiB9LFxuICdyZXN1bHRNYXRjaCc6IChyZXN1bHQpID0+IHtcbiAgIC8vY29uc29sZS5sb2cocmVzdWx0KVxuIH0sXG4gJ3Jlc3VsdE5vTWF0Y2gnOiAocmVzdWx0KSA9PiB7XG4gICBjb25zb2xlLmxvZyhyZXN1bHQpXG4gICBteUVudi5jaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoeyBlcnJNc2c6IGBObyBtYXRjaCBmb3IgJHtyZXN1bHR9YCB9KSlcbiB9LFxuICdlbmQnOiAoKSA9PiB7XG4gICAkYWN0aXZhdGVCdG4uZGlzYWJsZWQgPSBmYWxzZVxuICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ1N0YXJ0J1xuIH1cbn1cblxuZm9yICh2YXIgY2IgaW4gYW5ueWFuZ19jYWxsYmFja3MpIHtcbiAgYW5ueWFuZy5hZGRDYWxsYmFjayhjYiwgYW5ueWFuZ19jYWxsYmFja3NbY2JdKVxufVxuZm9yICh2YXIgdHlwZSBpbiBkb21fZXZlbnRzKSB7XG4gIGRvbV9ldmVudHNbdHlwZV0uZm9yRWFjaChldmVudCA9PiB7XG4gICAgZXZlbnQuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGV2ZW50LmNhbGxiYWNrKVxuICB9KVxufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vIFxuXG5cblxuY29uc3QgU3RhdGUgPSBTdGF0ZU1hY2hpbmUuaW5pdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudCcpKShTdGF0ZUNyZWF0b3IpKHtcbiAgZXJyTXNnOiAnUG9vJyxcbiAgY2xvZ3M6IGRhdGEuY2xvZ3Ncbn0pXG5cbmNvbnN0IFN0YXRlQ2hhbmdlID0gKF8pID0+IHtcbiAgY29uc3QgZWl0aGVyX3N0YXRlID0gbXlFbnYuY2hhbm5lbC5zaGlmdCgpXG4gIFxuICBpZiAoZWl0aGVyX3N0YXRlICE9PSB1bmRlZmluZWQpIHsgXG4gICAgLy8gcGFzcyBpbnRlcm5hbCBlaXRoZXIgdmFsdWUgdG8gU3RhdGUuY2hhbmdlXG4gICAgRWl0aGVyLmJpbWFwXG4gICAgICAoZXJyX3N0YXRlID0+IHsgLy8gc2FtZSBiZWhhdmlvciBmb3IgZXJyb3Igc3RhdGVcbiAgICAgICAgU3RhdGUuY2hhbmdlKGVycl9zdGF0ZSwgeyByZXBsYWNlOiBmYWxzZSB9KSBcbiAgICAgIH0pXG4gICAgICAoc3RhdGUgPT4geyBcbiAgICAgICAgU3RhdGUuY2hhbmdlKHN0YXRlLCB7IHJlcGxhY2U6IGZhbHNlIH0pIFxuICAgICAgfSlcbiAgICAgIChlaXRoZXJfc3RhdGUpIFxuICB9XG4gICAgXG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoU3RhdGVDaGFuZ2UpXG59XG5cblxuYW5ueWFuZy5hZGRDb21tYW5kcyhteUVudi5jb21tYW5kcylcblxud2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShTdGF0ZUNoYW5nZSlcbiJdfQ==
