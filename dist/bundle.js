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

//:: Object -> [v]
const objectValues = (obj) => {
  return Reflect.ownKeys(obj).map(key => obj[key])
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

//:: String -> Object -> a
const prop = (str) => (obj) => {
  return obj[str]
}

//:: String -> [a] -> [Maybe]
const pluck = (str) => (xs) => {
  return map(prop(str))(xs)
}

//:: a -> a -> Boolean
const is = (test_value) => (value) => {
  return value === test_value
}

//:: (a -> b) -> [a] -> [b]
const map = (fn) => (f) => {
  return f.map(fn)
}

//:: (a -> b) -> [a] -> [b]
const filter = (fn) => (xs) => {
  return xs.filter(fn)
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
    chain(fn) {
      return this
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
    chain(fn) {
      return fn(this.__value)
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
  Maybe, Either, IO, objectValues, prop, pluck, is, filter
}


// OTHER IDEAS //////////////////////////////////////////////////

const recurse_reduce = (f) => (a) => ([x, ...xs]) => {
  return x === undefined ? a : recurse_reduce(f, f(a, x), xs)
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

module.exports = callbacks
},{"fp-lib":2}],15:[function(require,module,exports){
const commands = (horizon) => (manualCommandEntry) => (channel) => {
  const fuzzyset = require('fuzzyset.js')
  const h = require('snabbdom/h')
  const { Either, pluck } = require('fp-lib')
  
  const letters = horizon('letters')
  const clients = horizon('clients')
  
  let fuzzy_clients = fuzzyset([])
  let fuzzy_addresses = fuzzyset([])
  
  clients.watch().subscribe(
    (res) => { 
      if (res.length === 0) {} 
      else {
        console.log('received update', res)
        console.log(pluck('name')(res))
        fuzzy_clients = fuzzyset(pluck('name')(res), false, 1)
        //fuzzy_addresses = fuzzyset(pluck('address')(res))
      }
    },
    (err) => console.error(`clients.watch(): ${err}`))
  
  const _commands = {
    'client *name': (name) => {
      const res = fuzzy_clients.get(name)

      if (res !== null) {
        channel.push(Either.Right(`fuzzy client found ${res}`))
      } else {
        channel.push(Either.Left(`client ${name} not found by fuzzy`))
      }
    },
    'new client': () => {
      const name = window.prompt(`Enter new client name`)
      
      if (fuzzy_clients.values().includes(name)) {
        channel.push(Either.Left(`Error new client ${name} -- that name already exists`))
      } else {
        clients.store({ name }).subscribe(
          (res) => channel.push(Either.Right(`Created new client ${name}`)),
          (err) => channel.push(Either.Left(`Error new client ${name} -- ${err}`)))
      }
    },
    [`what's nearby`]: () => {},
    'client address *addr': (addr) => {
            
    },
    'increase :letter': (letter) => {
      letters.find(letter.toLowerCase()).fetch().defaultIfEmpty().subscribe(
        (res) => {
          if (res === null) {
            channel.push(Either.Left(`cannot increase letter ${letter} -- it does not exist`)) 
          } else {
            letters.replace({ id: letter, count: res.count + 1 }).subscribe(
              (id) => { 
                channel.push(Either.Right(`increased letter ${letter} to ${res.count}`)) 
              },
              (err) => { 
                channel.push(Either.Left(`Error on replace: increase letter ${letter} -- ${err} `))
              }
            )  
          }
        },
        (err) => {
          channel.push(Either.Left(`Error on find: increase letter ${letter} -- ${err}`)) 
        }
      )
    },
    'show commands': () => {
      const state = (names) => {
        return [names.map(name => {
          return h('button', { on: { click: [manualCommandEntry, name] } }, name)
        })]
      }
      channel.push(Either.Right(state(Reflect.ownKeys(_commands))))
    }
  }
  /*
  const wrapper = (f) => (...args) => {
    channel.push(f(...args))
  }
  
  for (let name of Object.keys(_commands)) {
    _commands[name] = wrapper(_commands[name])
  }
  */
  return _commands
} 

module.exports = commands
},{"fp-lib":2,"fuzzyset.js":3,"snabbdom/h":5}],16:[function(require,module,exports){
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

module.exports = dom_events
},{}],17:[function(require,module,exports){
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
},{"fp-lib":2}],18:[function(require,module,exports){
const { Either } = require('fp-lib')

const StateChange = (State) => (channel) => (_) => {
  const either_state = channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (msgs => { // currently, it is same behavior for error state
        State.change({ logs: msgs }) 
      })
      (msgs => { 
        State.change({ logs: msgs }) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange(State)(channel))
}

module.exports = StateChange
},{"fp-lib":2}],19:[function(require,module,exports){
const h = require('snabbdom/h')
let _logs = []
let _key = 0

const myStyles = {
  fadeIn: {
    opacity: '0', 
    transition: 'opacity 1s', 
    delayed: { opacity: '1'}
  }
}

const createLog = (log) => {
  const date = new Date()
  const log_date =  `${date.getMonth()}-${date.getDate()} @ ${date.getHours()}:${date.getMinutes()}`

  return h('div.log', {
    style: myStyles.fadeIn,
    key: _key++
  }, [
    h('span.log_date', log_date), 
    h('span.log_msg', log)
  ])
}

const StateCreator = ({ logs }) => {
  if (!Array.isArray(logs)) {
    logs = [logs]
  }
  _logs = logs.map(createLog).concat(_logs)
  
  while (_logs.length > 30) {
    _logs.shift()
  }
  
  return h('div#content', [
    h('div#logs', _logs)
  ])
}

module.exports = StateCreator
},{"snabbdom/h":5}],20:[function(require,module,exports){
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  let _vtree = parentNode

  const change = (state) => {
    const new_vtree = StateCreator(state)
    patch(_vtree, new_vtree)
    _vtree = new_vtree
  }
  
  change(init_params)
  
  return { change }
}

module.exports = { init }
},{"snabbdom":12,"snabbdom/modules/class":8,"snabbdom/modules/eventlisteners":9,"snabbdom/modules/props":10,"snabbdom/modules/style":11}],21:[function(require,module,exports){

const StateSystem = (channel) => {
  const StateChange = require('./StateChange')
  const StateMachine = require('./StateMachine')
  const StateCreator = require('./StateCreator')
  const $contentSpace = document.getElementById('content')
  const myStateMachine = StateMachine.init($contentSpace)(StateCreator)({ logs: [] })
  const myStateChange = StateChange(myStateMachine)(channel)
  
  return myStateChange  
}

module.exports = StateSystem
},{"./StateChange":18,"./StateCreator":19,"./StateMachine":20}],22:[function(require,module,exports){
(function (global){
/*global Horizon*/
const horizon = Horizon()
const annyang = require('annyang')
const channel = []

horizon.connect()
annyang.debug()
global.annyang = annyang
/////////////////////

// Setup horizon status indicator
{
  const $header = document.getElementById('header')
  horizon.status(status => {
    $header.className = `status-${status.type}`
  })
}

/////////////////////

// Setup annyang callbacks and dom events
{
  const $activateBtn = document.getElementById('activate-btn')
  const $showCommandsBtn = document.getElementById('show-commands-btn')
  
  const myCallbacks = require('./Callbacks')({ $activateBtn })(channel)
  const myDomEvents = require('./DomEvents')({ $activateBtn, $showCommandsBtn })(annyang)
  
  for (var cb in myCallbacks) {
    annyang.addCallback(cb, myCallbacks[cb])
  }
  for (var type in myDomEvents) {
    myDomEvents[type].forEach(event => {
      event.element.addEventListener(type, event.callback)
    })
  }
}

/////////////////// 

// Setup annyang command entry and manual command entry
{
  const myManualCommandEntry = require('./ManualCommandEntry')(annyang)(channel)
  const myCommands = require('./Commands')(horizon)(myManualCommandEntry)(channel)
  annyang.addCommands(myCommands)
  global.myCommands = myCommands
}

/////////////////// 

// Setup state machine
{
const StateSystem = require('./StateSystem')
const myStateChange = StateSystem(channel)

window.requestAnimationFrame(myStateChange)
}

/////////////////// 
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./Callbacks":14,"./Commands":15,"./DomEvents":16,"./ManualCommandEntry":17,"./StateSystem":21,"annyang":1}]},{},[22])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYW5ueWFuZy9hbm55YW5nLmpzIiwibm9kZV9tb2R1bGVzL2ZwLWxpYi9mcC1saWIuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvbGliL2Z1enp5c2V0LmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL3N0eWxlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwic3JjL0NhbGxiYWNrcy5qcyIsInNyYy9Db21tYW5kcy5qcyIsInNyYy9Eb21FdmVudHMuanMiLCJzcmMvTWFudWFsQ29tbWFuZEVudHJ5LmpzIiwic3JjL1N0YXRlQ2hhbmdlLmpzIiwic3JjL1N0YXRlQ3JlYXRvci5qcyIsInNyYy9TdGF0ZU1hY2hpbmUuanMiLCJzcmMvU3RhdGVTeXN0ZW0uanMiLCJzcmMvcGxhdGZvcm0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2p3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFRBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8hIGFubnlhbmdcbi8vISB2ZXJzaW9uIDogMi40LjBcbi8vISBhdXRob3IgIDogVGFsIEF0ZXIgQFRhbEF0ZXJcbi8vISBsaWNlbnNlIDogTUlUXG4vLyEgaHR0cHM6Ly93d3cuVGFsQXRlci5jb20vYW5ueWFuZy9cbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICBcInVzZSBzdHJpY3RcIjtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkgeyAvLyBBTUQgKyBnbG9iYWxcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiAocm9vdC5hbm55YW5nID0gZmFjdG9yeShyb290KSk7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHsgLy8gQ29tbW9uSlNcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3Rvcnkocm9vdCk7XG4gIH0gZWxzZSB7IC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIHJvb3QuYW5ueWFuZyA9IGZhY3Rvcnkocm9vdCk7XG4gIH1cbn0odHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0aGlzLCBmdW5jdGlvbiAocm9vdCwgdW5kZWZpbmVkKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIC8qKlxuICAgKiAjIFF1aWNrIFR1dG9yaWFsLCBJbnRybyBhbmQgRGVtb3NcbiAgICpcbiAgICogVGhlIHF1aWNrZXN0IHdheSB0byBnZXQgc3RhcnRlZCBpcyB0byB2aXNpdCB0aGUgW2FubnlhbmcgaG9tZXBhZ2VdKGh0dHBzOi8vd3d3LnRhbGF0ZXIuY29tL2FubnlhbmcvKS5cbiAgICpcbiAgICogRm9yIGEgbW9yZSBpbi1kZXB0aCBsb29rIGF0IGFubnlhbmcsIHJlYWQgb24uXG4gICAqXG4gICAqICMgQVBJIFJlZmVyZW5jZVxuICAgKi9cblxuICB2YXIgYW5ueWFuZztcblxuICAvLyBHZXQgdGhlIFNwZWVjaFJlY29nbml0aW9uIG9iamVjdCwgd2hpbGUgaGFuZGxpbmcgYnJvd3NlciBwcmVmaXhlc1xuICB2YXIgU3BlZWNoUmVjb2duaXRpb24gPSByb290LlNwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3Qud2Via2l0U3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5tb3pTcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290Lm1zU3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5vU3BlZWNoUmVjb2duaXRpb247XG5cbiAgLy8gQ2hlY2sgYnJvd3NlciBzdXBwb3J0XG4gIC8vIFRoaXMgaXMgZG9uZSBhcyBlYXJseSBhcyBwb3NzaWJsZSwgdG8gbWFrZSBpdCBhcyBmYXN0IGFzIHBvc3NpYmxlIGZvciB1bnN1cHBvcnRlZCBicm93c2Vyc1xuICBpZiAoIVNwZWVjaFJlY29nbml0aW9uKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2YXIgY29tbWFuZHNMaXN0ID0gW107XG4gIHZhciByZWNvZ25pdGlvbjtcbiAgdmFyIGNhbGxiYWNrcyA9IHsgc3RhcnQ6IFtdLCBlcnJvcjogW10sIGVuZDogW10sIHJlc3VsdDogW10sIHJlc3VsdE1hdGNoOiBbXSwgcmVzdWx0Tm9NYXRjaDogW10sIGVycm9yTmV0d29yazogW10sIGVycm9yUGVybWlzc2lvbkJsb2NrZWQ6IFtdLCBlcnJvclBlcm1pc3Npb25EZW5pZWQ6IFtdIH07XG4gIHZhciBhdXRvUmVzdGFydDtcbiAgdmFyIGxhc3RTdGFydGVkQXQgPSAwO1xuICB2YXIgZGVidWdTdGF0ZSA9IGZhbHNlO1xuICB2YXIgZGVidWdTdHlsZSA9ICdmb250LXdlaWdodDogYm9sZDsgY29sb3I6ICMwMGY7JztcbiAgdmFyIHBhdXNlTGlzdGVuaW5nID0gZmFsc2U7XG4gIHZhciBpc0xpc3RlbmluZyA9IGZhbHNlO1xuXG4gIC8vIFRoZSBjb21tYW5kIG1hdGNoaW5nIGNvZGUgaXMgYSBtb2RpZmllZCB2ZXJzaW9uIG9mIEJhY2tib25lLlJvdXRlciBieSBKZXJlbXkgQXNoa2VuYXMsIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAgdmFyIG9wdGlvbmFsUGFyYW0gPSAvXFxzKlxcKCguKj8pXFwpXFxzKi9nO1xuICB2YXIgb3B0aW9uYWxSZWdleCA9IC8oXFwoXFw/OlteKV0rXFwpKVxcPy9nO1xuICB2YXIgbmFtZWRQYXJhbSAgICA9IC8oXFwoXFw/KT86XFx3Ky9nO1xuICB2YXIgc3BsYXRQYXJhbSAgICA9IC9cXCpcXHcrL2c7XG4gIHZhciBlc2NhcGVSZWdFeHAgID0gL1tcXC17fVxcW1xcXSs/LixcXFxcXFxeJHwjXS9nO1xuICB2YXIgY29tbWFuZFRvUmVnRXhwID0gZnVuY3Rpb24oY29tbWFuZCkge1xuICAgIGNvbW1hbmQgPSBjb21tYW5kLnJlcGxhY2UoZXNjYXBlUmVnRXhwLCAnXFxcXCQmJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUGFyYW0sICcoPzokMSk/JylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG5hbWVkUGFyYW0sIGZ1bmN0aW9uKG1hdGNoLCBvcHRpb25hbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9uYWwgPyBtYXRjaCA6ICcoW15cXFxcc10rKSc7XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2Uoc3BsYXRQYXJhbSwgJyguKj8pJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUmVnZXgsICdcXFxccyokMT9cXFxccyonKTtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cCgnXicgKyBjb21tYW5kICsgJyQnLCAnaScpO1xuICB9O1xuXG4gIC8vIFRoaXMgbWV0aG9kIHJlY2VpdmVzIGFuIGFycmF5IG9mIGNhbGxiYWNrcyB0byBpdGVyYXRlIG92ZXIsIGFuZCBpbnZva2VzIGVhY2ggb2YgdGhlbVxuICB2YXIgaW52b2tlQ2FsbGJhY2tzID0gZnVuY3Rpb24oY2FsbGJhY2tzKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjay5jYWxsYmFjay5hcHBseShjYWxsYmFjay5jb250ZXh0LCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgaXNJbml0aWFsaXplZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiByZWNvZ25pdGlvbiAhPT0gdW5kZWZpbmVkO1xuICB9O1xuXG4gIHZhciBpbml0SWZOZWVkZWQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIWlzSW5pdGlhbGl6ZWQoKSkge1xuICAgICAgYW5ueWFuZy5pbml0KHt9LCBmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciByZWdpc3RlckNvbW1hbmQgPSBmdW5jdGlvbihjb21tYW5kLCBjYiwgcGhyYXNlKSB7XG4gICAgY29tbWFuZHNMaXN0LnB1c2goeyBjb21tYW5kOiBjb21tYW5kLCBjYWxsYmFjazogY2IsIG9yaWdpbmFsUGhyYXNlOiBwaHJhc2UgfSk7XG4gICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdDb21tYW5kIHN1Y2Nlc3NmdWxseSBsb2FkZWQ6ICVjJytwaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgcGFyc2VSZXN1bHRzID0gZnVuY3Rpb24ocmVzdWx0cykge1xuICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0LCByZXN1bHRzKTtcbiAgICB2YXIgY29tbWFuZFRleHQ7XG4gICAgLy8gZ28gb3ZlciBlYWNoIG9mIHRoZSA1IHJlc3VsdHMgYW5kIGFsdGVybmF0aXZlIHJlc3VsdHMgcmVjZWl2ZWQgKHdlJ3ZlIHNldCBtYXhBbHRlcm5hdGl2ZXMgdG8gNSBhYm92ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaTxyZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyB0aGUgdGV4dCByZWNvZ25pemVkXG4gICAgICBjb21tYW5kVGV4dCA9IHJlc3VsdHNbaV0udHJpbSgpO1xuICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCByZWNvZ25pemVkOiAlYycrY29tbWFuZFRleHQsIGRlYnVnU3R5bGUpO1xuICAgICAgfVxuXG4gICAgICAvLyB0cnkgYW5kIG1hdGNoIHJlY29nbml6ZWQgdGV4dCB0byBvbmUgb2YgdGhlIGNvbW1hbmRzIG9uIHRoZSBsaXN0XG4gICAgICBmb3IgKHZhciBqID0gMCwgbCA9IGNvbW1hbmRzTGlzdC5sZW5ndGg7IGogPCBsOyBqKyspIHtcbiAgICAgICAgdmFyIGN1cnJlbnRDb21tYW5kID0gY29tbWFuZHNMaXN0W2pdO1xuICAgICAgICB2YXIgcmVzdWx0ID0gY3VycmVudENvbW1hbmQuY29tbWFuZC5leGVjKGNvbW1hbmRUZXh0KTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIHZhciBwYXJhbWV0ZXJzID0gcmVzdWx0LnNsaWNlKDEpO1xuICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29tbWFuZCBtYXRjaGVkOiAlYycrY3VycmVudENvbW1hbmQub3JpZ2luYWxQaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd3aXRoIHBhcmFtZXRlcnMnLCBwYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZXhlY3V0ZSB0aGUgbWF0Y2hlZCBjb21tYW5kXG4gICAgICAgICAgY3VycmVudENvbW1hbmQuY2FsbGJhY2suYXBwbHkodGhpcywgcGFyYW1ldGVycyk7XG4gICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHRNYXRjaCwgY29tbWFuZFRleHQsIGN1cnJlbnRDb21tYW5kLm9yaWdpbmFsUGhyYXNlLCByZXN1bHRzKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHROb01hdGNoLCByZXN1bHRzKTtcbiAgfTtcblxuICBhbm55YW5nID0ge1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBhbm55YW5nIHdpdGggYSBsaXN0IG9mIGNvbW1hbmRzIHRvIHJlY29nbml6ZS5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvIDpuYW1lJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICogdmFyIGNvbW1hbmRzMiA9IHsnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIC8vIGluaXRpYWxpemUgYW5ueWFuZywgb3ZlcndyaXRpbmcgYW55IHByZXZpb3VzbHkgYWRkZWQgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLmluaXQoY29tbWFuZHMsIHRydWUpO1xuICAgICAqIC8vIGFkZHMgYW4gYWRkaXRpb25hbCBjb21tYW5kIHdpdGhvdXQgcmVtb3ZpbmcgdGhlIHByZXZpb3VzIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5pbml0KGNvbW1hbmRzMiwgZmFsc2UpO1xuICAgICAqIGBgYGBcbiAgICAgKiBBcyBvZiB2MS4xLjAgaXQgaXMgbm8gbG9uZ2VyIHJlcXVpcmVkIHRvIGNhbGwgaW5pdCgpLiBKdXN0IHN0YXJ0KCkgbGlzdGVuaW5nIHdoZW5ldmVyIHlvdSB3YW50LCBhbmQgYWRkQ29tbWFuZHMoKSB3aGVuZXZlciwgYW5kIGFzIG9mdGVuIGFzIHlvdSBsaWtlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbW1hbmRzIC0gQ29tbWFuZHMgdGhhdCBhbm55YW5nIHNob3VsZCBsaXN0ZW4gdG9cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtyZXNldENvbW1hbmRzPXRydWVdIC0gUmVtb3ZlIGFsbCBjb21tYW5kcyBiZWZvcmUgaW5pdGlhbGl6aW5nP1xuICAgICAqIEBtZXRob2QgaW5pdFxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogQHNlZSBbQ29tbWFuZHMgT2JqZWN0XSgjY29tbWFuZHMtb2JqZWN0KVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbW1hbmRzLCByZXNldENvbW1hbmRzKSB7XG5cbiAgICAgIC8vIHJlc2V0Q29tbWFuZHMgZGVmYXVsdHMgdG8gdHJ1ZVxuICAgICAgaWYgKHJlc2V0Q29tbWFuZHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXNldENvbW1hbmRzID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc2V0Q29tbWFuZHMgPSAhIXJlc2V0Q29tbWFuZHM7XG4gICAgICB9XG5cbiAgICAgIC8vIEFib3J0IHByZXZpb3VzIGluc3RhbmNlcyBvZiByZWNvZ25pdGlvbiBhbHJlYWR5IHJ1bm5pbmdcbiAgICAgIGlmIChyZWNvZ25pdGlvbiAmJiByZWNvZ25pdGlvbi5hYm9ydCkge1xuICAgICAgICByZWNvZ25pdGlvbi5hYm9ydCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBpbml0aWF0ZSBTcGVlY2hSZWNvZ25pdGlvblxuICAgICAgcmVjb2duaXRpb24gPSBuZXcgU3BlZWNoUmVjb2duaXRpb24oKTtcblxuICAgICAgLy8gU2V0IHRoZSBtYXggbnVtYmVyIG9mIGFsdGVybmF0aXZlIHRyYW5zY3JpcHRzIHRvIHRyeSBhbmQgbWF0Y2ggd2l0aCBhIGNvbW1hbmRcbiAgICAgIHJlY29nbml0aW9uLm1heEFsdGVybmF0aXZlcyA9IDU7XG5cbiAgICAgIC8vIEluIEhUVFBTLCB0dXJuIG9mZiBjb250aW51b3VzIG1vZGUgZm9yIGZhc3RlciByZXN1bHRzLlxuICAgICAgLy8gSW4gSFRUUCwgIHR1cm4gb24gIGNvbnRpbnVvdXMgbW9kZSBmb3IgbXVjaCBzbG93ZXIgcmVzdWx0cywgYnV0IG5vIHJlcGVhdGluZyBzZWN1cml0eSBub3RpY2VzXG4gICAgICByZWNvZ25pdGlvbi5jb250aW51b3VzID0gcm9vdC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHA6JztcblxuICAgICAgLy8gU2V0cyB0aGUgbGFuZ3VhZ2UgdG8gdGhlIGRlZmF1bHQgJ2VuLVVTJy4gVGhpcyBjYW4gYmUgY2hhbmdlZCB3aXRoIGFubnlhbmcuc2V0TGFuZ3VhZ2UoKVxuICAgICAgcmVjb2duaXRpb24ubGFuZyA9ICdlbi1VUyc7XG5cbiAgICAgIHJlY29nbml0aW9uLm9uc3RhcnQgICA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpc0xpc3RlbmluZyA9IHRydWU7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3Muc3RhcnQpO1xuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25lcnJvciAgID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvcik7XG4gICAgICAgIHN3aXRjaCAoZXZlbnQuZXJyb3IpIHtcbiAgICAgICAgY2FzZSAnbmV0d29yayc6XG4gICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvck5ldHdvcmspO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdub3QtYWxsb3dlZCc6XG4gICAgICAgIGNhc2UgJ3NlcnZpY2Utbm90LWFsbG93ZWQnOlxuICAgICAgICAgIC8vIGlmIHBlcm1pc3Npb24gdG8gdXNlIHRoZSBtaWMgaXMgZGVuaWVkLCB0dXJuIG9mZiBhdXRvLXJlc3RhcnRcbiAgICAgICAgICBhdXRvUmVzdGFydCA9IGZhbHNlO1xuICAgICAgICAgIC8vIGRldGVybWluZSBpZiBwZXJtaXNzaW9uIHdhcyBkZW5pZWQgYnkgdXNlciBvciBhdXRvbWF0aWNhbGx5LlxuICAgICAgICAgIGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKS1sYXN0U3RhcnRlZEF0IDwgMjAwKSB7XG4gICAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yUGVybWlzc2lvbkJsb2NrZWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yUGVybWlzc2lvbkRlbmllZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbmVuZCAgICAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaXNMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lbmQpO1xuICAgICAgICAvLyBhbm55YW5nIHdpbGwgYXV0byByZXN0YXJ0IGlmIGl0IGlzIGNsb3NlZCBhdXRvbWF0aWNhbGx5IGFuZCBub3QgYnkgdXNlciBhY3Rpb24uXG4gICAgICAgIGlmIChhdXRvUmVzdGFydCkge1xuICAgICAgICAgIC8vIHBsYXkgbmljZWx5IHdpdGggdGhlIGJyb3dzZXIsIGFuZCBuZXZlciByZXN0YXJ0IGFubnlhbmcgYXV0b21hdGljYWxseSBtb3JlIHRoYW4gb25jZSBwZXIgc2Vjb25kXG4gICAgICAgICAgdmFyIHRpbWVTaW5jZUxhc3RTdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLWxhc3RTdGFydGVkQXQ7XG4gICAgICAgICAgaWYgKHRpbWVTaW5jZUxhc3RTdGFydCA8IDEwMDApIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoYW5ueWFuZy5zdGFydCwgMTAwMC10aW1lU2luY2VMYXN0U3RhcnQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbm55YW5nLnN0YXJ0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbnJlc3VsdCAgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZihwYXVzZUxpc3RlbmluZykge1xuICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIGhlYXJkLCBidXQgYW5ueWFuZyBpcyBwYXVzZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWFwIHRoZSByZXN1bHRzIHRvIGFuIGFycmF5XG4gICAgICAgIHZhciBTcGVlY2hSZWNvZ25pdGlvblJlc3VsdCA9IGV2ZW50LnJlc3VsdHNbZXZlbnQucmVzdWx0SW5kZXhdO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrID0gMDsgazxTcGVlY2hSZWNvZ25pdGlvblJlc3VsdC5sZW5ndGg7IGsrKykge1xuICAgICAgICAgIHJlc3VsdHNba10gPSBTcGVlY2hSZWNvZ25pdGlvblJlc3VsdFtrXS50cmFuc2NyaXB0O1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyc2VSZXN1bHRzKHJlc3VsdHMpO1xuICAgICAgfTtcblxuICAgICAgLy8gYnVpbGQgY29tbWFuZHMgbGlzdFxuICAgICAgaWYgKHJlc2V0Q29tbWFuZHMpIHtcbiAgICAgICAgY29tbWFuZHNMaXN0ID0gW107XG4gICAgICB9XG4gICAgICBpZiAoY29tbWFuZHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBsaXN0ZW5pbmcuXG4gICAgICogSXQncyBhIGdvb2QgaWRlYSB0byBjYWxsIHRoaXMgYWZ0ZXIgYWRkaW5nIHNvbWUgY29tbWFuZHMgZmlyc3QsIGJ1dCBub3QgbWFuZGF0b3J5LlxuICAgICAqXG4gICAgICogUmVjZWl2ZXMgYW4gb3B0aW9uYWwgb3B0aW9ucyBvYmplY3Qgd2hpY2ggc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBvcHRpb25zOlxuICAgICAqXG4gICAgICogLSBgYXV0b1Jlc3RhcnRgIChib29sZWFuLCBkZWZhdWx0OiB0cnVlKSBTaG91bGQgYW5ueWFuZyByZXN0YXJ0IGl0c2VsZiBpZiBpdCBpcyBjbG9zZWQgaW5kaXJlY3RseSwgYmVjYXVzZSBvZiBzaWxlbmNlIG9yIHdpbmRvdyBjb25mbGljdHM/XG4gICAgICogLSBgY29udGludW91c2AgIChib29sZWFuLCBkZWZhdWx0OiB1bmRlZmluZWQpIEFsbG93IGZvcmNpbmcgY29udGludW91cyBtb2RlIG9uIG9yIG9mZi4gQW5ueWFuZyBpcyBwcmV0dHkgc21hcnQgYWJvdXQgdGhpcywgc28gb25seSBzZXQgdGhpcyBpZiB5b3Uga25vdyB3aGF0IHlvdSdyZSBkb2luZy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiAvLyBTdGFydCBsaXN0ZW5pbmcsIGRvbid0IHJlc3RhcnQgYXV0b21hdGljYWxseVxuICAgICAqIGFubnlhbmcuc3RhcnQoeyBhdXRvUmVzdGFydDogZmFsc2UgfSk7XG4gICAgICogLy8gU3RhcnQgbGlzdGVuaW5nLCBkb24ndCByZXN0YXJ0IGF1dG9tYXRpY2FsbHksIHN0b3AgcmVjb2duaXRpb24gYWZ0ZXIgZmlyc3QgcGhyYXNlIHJlY29nbml6ZWRcbiAgICAgKiBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlLCBjb250aW51b3VzOiBmYWxzZSB9KTtcbiAgICAgKiBgYGBgXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQG1ldGhvZCBzdGFydFxuICAgICAqL1xuICAgIHN0YXJ0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBwYXVzZUxpc3RlbmluZyA9IGZhbHNlO1xuICAgICAgaW5pdElmTmVlZGVkKCk7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIGlmIChvcHRpb25zLmF1dG9SZXN0YXJ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXV0b1Jlc3RhcnQgPSAhIW9wdGlvbnMuYXV0b1Jlc3RhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdXRvUmVzdGFydCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5jb250aW51b3VzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVjb2duaXRpb24uY29udGludW91cyA9ICEhb3B0aW9ucy5jb250aW51b3VzO1xuICAgICAgfVxuXG4gICAgICBsYXN0U3RhcnRlZEF0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICB0cnkge1xuICAgICAgICByZWNvZ25pdGlvbi5zdGFydCgpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coZS5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdG9wIGxpc3RlbmluZywgYW5kIHR1cm4gb2ZmIG1pYy5cbiAgICAgKlxuICAgICAqIEFsdGVybmF0aXZlbHksIHRvIG9ubHkgdGVtcG9yYXJpbHkgcGF1c2UgYW5ueWFuZyByZXNwb25kaW5nIHRvIGNvbW1hbmRzIHdpdGhvdXQgc3RvcHBpbmcgdGhlIFNwZWVjaFJlY29nbml0aW9uIGVuZ2luZSBvciBjbG9zaW5nIHRoZSBtaWMsIHVzZSBwYXVzZSgpIGluc3RlYWQuXG4gICAgICogQHNlZSBbcGF1c2UoKV0oI3BhdXNlKVxuICAgICAqXG4gICAgICogQG1ldGhvZCBhYm9ydFxuICAgICAqL1xuICAgIGFib3J0OiBmdW5jdGlvbigpIHtcbiAgICAgIGF1dG9SZXN0YXJ0ID0gZmFsc2U7XG4gICAgICBpZiAoaXNJbml0aWFsaXplZCgpKSB7XG4gICAgICAgIHJlY29nbml0aW9uLmFib3J0KCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFBhdXNlIGxpc3RlbmluZy4gYW5ueWFuZyB3aWxsIHN0b3AgcmVzcG9uZGluZyB0byBjb21tYW5kcyAodW50aWwgdGhlIHJlc3VtZSBvciBzdGFydCBtZXRob2RzIGFyZSBjYWxsZWQpLCB3aXRob3V0IHR1cm5pbmcgb2ZmIHRoZSBicm93c2VyJ3MgU3BlZWNoUmVjb2duaXRpb24gZW5naW5lIG9yIHRoZSBtaWMuXG4gICAgICpcbiAgICAgKiBBbHRlcm5hdGl2ZWx5LCB0byBzdG9wIHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBlbmdpbmUgYW5kIGNsb3NlIHRoZSBtaWMsIHVzZSBhYm9ydCgpIGluc3RlYWQuXG4gICAgICogQHNlZSBbYWJvcnQoKV0oI2Fib3J0KVxuICAgICAqXG4gICAgICogQG1ldGhvZCBwYXVzZVxuICAgICAqL1xuICAgIHBhdXNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHBhdXNlTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyBsaXN0ZW5pbmcgYW5kIHJlc3RvcmVzIGNvbW1hbmQgY2FsbGJhY2sgZXhlY3V0aW9uIHdoZW4gYSByZXN1bHQgbWF0Y2hlcy5cbiAgICAgKiBJZiBTcGVlY2hSZWNvZ25pdGlvbiB3YXMgYWJvcnRlZCAoc3RvcHBlZCksIHN0YXJ0IGl0LlxuICAgICAqXG4gICAgICogQG1ldGhvZCByZXN1bWVcbiAgICAgKi9cbiAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xuICAgICAgYW5ueWFuZy5zdGFydCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUdXJuIG9uIG91dHB1dCBvZiBkZWJ1ZyBtZXNzYWdlcyB0byB0aGUgY29uc29sZS4gVWdseSwgYnV0IHN1cGVyLWhhbmR5IVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbmV3U3RhdGU9dHJ1ZV0gLSBUdXJuIG9uL29mZiBkZWJ1ZyBtZXNzYWdlc1xuICAgICAqIEBtZXRob2QgZGVidWdcbiAgICAgKi9cbiAgICBkZWJ1ZzogZnVuY3Rpb24obmV3U3RhdGUpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBkZWJ1Z1N0YXRlID0gISFuZXdTdGF0ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlYnVnU3RhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGxhbmd1YWdlIHRoZSB1c2VyIHdpbGwgc3BlYWsgaW4uIElmIHRoaXMgbWV0aG9kIGlzIG5vdCBjYWxsZWQsIGRlZmF1bHRzIHRvICdlbi1VUycuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbGFuZ3VhZ2UgLSBUaGUgbGFuZ3VhZ2UgKGxvY2FsZSlcbiAgICAgKiBAbWV0aG9kIHNldExhbmd1YWdlXG4gICAgICogQHNlZSBbTGFuZ3VhZ2VzXSgjbGFuZ3VhZ2VzKVxuICAgICAqL1xuICAgIHNldExhbmd1YWdlOiBmdW5jdGlvbihsYW5ndWFnZSkge1xuICAgICAgaW5pdElmTmVlZGVkKCk7XG4gICAgICByZWNvZ25pdGlvbi5sYW5nID0gbGFuZ3VhZ2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBjb21tYW5kcyB0aGF0IGFubnlhbmcgd2lsbCByZXNwb25kIHRvLiBTaW1pbGFyIGluIHN5bnRheCB0byBpbml0KCksIGJ1dCBkb2Vzbid0IHJlbW92ZSBleGlzdGluZyBjb21tYW5kcy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvIDpuYW1lJzogaGVsbG9GdW5jdGlvbiwgJ2hvd2R5JzogaGVsbG9GdW5jdGlvbn07XG4gICAgICogdmFyIGNvbW1hbmRzMiA9IHsnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMyKTtcbiAgICAgKiAvLyBhbm55YW5nIHdpbGwgbm93IGxpc3RlbiB0byBhbGwgdGhyZWUgY29tbWFuZHNcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY29tbWFuZHMgLSBDb21tYW5kcyB0aGF0IGFubnlhbmcgc2hvdWxkIGxpc3RlbiB0b1xuICAgICAqIEBtZXRob2QgYWRkQ29tbWFuZHNcbiAgICAgKiBAc2VlIFtDb21tYW5kcyBPYmplY3RdKCNjb21tYW5kcy1vYmplY3QpXG4gICAgICovXG4gICAgYWRkQ29tbWFuZHM6IGZ1bmN0aW9uKGNvbW1hbmRzKSB7XG4gICAgICB2YXIgY2I7XG5cbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuXG4gICAgICBmb3IgKHZhciBwaHJhc2UgaW4gY29tbWFuZHMpIHtcbiAgICAgICAgaWYgKGNvbW1hbmRzLmhhc093blByb3BlcnR5KHBocmFzZSkpIHtcbiAgICAgICAgICBjYiA9IHJvb3RbY29tbWFuZHNbcGhyYXNlXV0gfHwgY29tbWFuZHNbcGhyYXNlXTtcbiAgICAgICAgICBpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IGNvbW1hbmQgdG8gcmVnZXggdGhlbiByZWdpc3RlciB0aGUgY29tbWFuZFxuICAgICAgICAgICAgcmVnaXN0ZXJDb21tYW5kKGNvbW1hbmRUb1JlZ0V4cChwaHJhc2UpLCBjYiwgcGhyYXNlKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjYiA9PT0gJ29iamVjdCcgJiYgY2IucmVnZXhwIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgICAvLyByZWdpc3RlciB0aGUgY29tbWFuZFxuICAgICAgICAgICAgcmVnaXN0ZXJDb21tYW5kKG5ldyBSZWdFeHAoY2IucmVnZXhwLnNvdXJjZSwgJ2knKSwgY2IuY2FsbGJhY2ssIHBocmFzZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW4gbm90IHJlZ2lzdGVyIGNvbW1hbmQ6ICVjJytwaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBleGlzdGluZyBjb21tYW5kcy4gQ2FsbGVkIHdpdGggYSBzaW5nbGUgcGhyYXNlLCBhcnJheSBvZiBwaHJhc2VzLCBvciBtZXRob2RpY2FsbHkuIFBhc3Mgbm8gcGFyYW1zIHRvIHJlbW92ZSBhbGwgY29tbWFuZHMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyc6IGhlbGxvRnVuY3Rpb24sICdob3dkeSc6IGhlbGxvRnVuY3Rpb24sICdoaSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIGFsbCBleGlzdGluZyBjb21tYW5kc1xuICAgICAqIGFubnlhbmcucmVtb3ZlQ29tbWFuZHMoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBzb21lIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5hZGRDb21tYW5kcyhjb21tYW5kcyk7XG4gICAgICpcbiAgICAgKiAvLyBEb24ndCByZXNwb25kIHRvIGhlbGxvXG4gICAgICogYW5ueWFuZy5yZW1vdmVDb21tYW5kcygnaGVsbG8nKTtcbiAgICAgKlxuICAgICAqIC8vIERvbid0IHJlc3BvbmQgdG8gaG93ZHkgb3IgaGlcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNvbW1hbmRzKFsnaG93ZHknLCAnaGknXSk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fFVuZGVmaW5lZH0gW2NvbW1hbmRzVG9SZW1vdmVdIC0gQ29tbWFuZHMgdG8gcmVtb3ZlXG4gICAgICogQG1ldGhvZCByZW1vdmVDb21tYW5kc1xuICAgICAqL1xuICAgIHJlbW92ZUNvbW1hbmRzOiBmdW5jdGlvbihjb21tYW5kc1RvUmVtb3ZlKSB7XG4gICAgICBpZiAoY29tbWFuZHNUb1JlbW92ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbW1hbmRzTGlzdCA9IFtdO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb21tYW5kc1RvUmVtb3ZlID0gQXJyYXkuaXNBcnJheShjb21tYW5kc1RvUmVtb3ZlKSA/IGNvbW1hbmRzVG9SZW1vdmUgOiBbY29tbWFuZHNUb1JlbW92ZV07XG4gICAgICBjb21tYW5kc0xpc3QgPSBjb21tYW5kc0xpc3QuZmlsdGVyKGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGk8Y29tbWFuZHNUb1JlbW92ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChjb21tYW5kc1RvUmVtb3ZlW2ldID09PSBjb21tYW5kLm9yaWdpbmFsUGhyYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBpbiBjYXNlIG9uZSBvZiB0aGUgZm9sbG93aW5nIGV2ZW50cyBoYXBwZW5zOlxuICAgICAqXG4gICAgICogKiBgc3RhcnRgIC0gRmlyZWQgYXMgc29vbiBhcyB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUgc3RhcnRzIGxpc3RlbmluZ1xuICAgICAqICogYGVycm9yYCAtIEZpcmVkIHdoZW4gdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2dudGlvbiBlbmdpbmUgcmV0dXJucyBhbiBlcnJvciwgdGhpcyBnZW5lcmljIGVycm9yIGNhbGxiYWNrIHdpbGwgYmUgZm9sbG93ZWQgYnkgbW9yZSBhY2N1cmF0ZSBlcnJvciBjYWxsYmFja3MgKGJvdGggd2lsbCBmaXJlIGlmIGJvdGggYXJlIGRlZmluZWQpXG4gICAgICogKiBgZXJyb3JOZXR3b3JrYCAtIEZpcmVkIHdoZW4gU3BlZWNoIFJlY29nbml0aW9uIGZhaWxzIGJlY2F1c2Ugb2YgYSBuZXR3b3JrIGVycm9yXG4gICAgICogKiBgZXJyb3JQZXJtaXNzaW9uQmxvY2tlZGAgLSBGaXJlZCB3aGVuIHRoZSBicm93c2VyIGJsb2NrcyB0aGUgcGVybWlzc2lvbiByZXF1ZXN0IHRvIHVzZSBTcGVlY2ggUmVjb2duaXRpb24uXG4gICAgICogKiBgZXJyb3JQZXJtaXNzaW9uRGVuaWVkYCAtIEZpcmVkIHdoZW4gdGhlIHVzZXIgYmxvY2tzIHRoZSBwZXJtaXNzaW9uIHJlcXVlc3QgdG8gdXNlIFNwZWVjaCBSZWNvZ25pdGlvbi5cbiAgICAgKiAqIGBlbmRgIC0gRmlyZWQgd2hlbiB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUgc3RvcHNcbiAgICAgKiAqIGByZXN1bHRgIC0gRmlyZWQgYXMgc29vbiBhcyBzb21lIHNwZWVjaCB3YXMgaWRlbnRpZmllZC4gVGhpcyBnZW5lcmljIGNhbGxiYWNrIHdpbGwgYmUgZm9sbG93ZWQgYnkgZWl0aGVyIHRoZSBgcmVzdWx0TWF0Y2hgIG9yIGByZXN1bHROb01hdGNoYCBjYWxsYmFja3MuXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIGFuIGFycmF5IG9mIHBvc3NpYmxlIHBocmFzZXMgdGhlIHVzZXIgc2FpZCBhcyB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgKiAqIGByZXN1bHRNYXRjaGAgLSBGaXJlZCB3aGVuIGFubnlhbmcgd2FzIGFibGUgdG8gbWF0Y2ggYmV0d2VlbiB3aGF0IHRoZSB1c2VyIHNhaWQgYW5kIGEgcmVnaXN0ZXJlZCBjb21tYW5kXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIHRocmVlIGFyZ3VtZW50cyBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICAgICAqICAgICAgICogVGhlIHBocmFzZSB0aGUgdXNlciBzYWlkIHRoYXQgbWF0Y2hlZCBhIGNvbW1hbmRcbiAgICAgKiAgICAgICAqIFRoZSBjb21tYW5kIHRoYXQgd2FzIG1hdGNoZWRcbiAgICAgKiAgICAgICAqIEFuIGFycmF5IG9mIHBvc3NpYmxlIGFsdGVybmF0aXZlIHBocmFzZXMgdGhlIHVzZXIgbWlnaHQndmUgc2FpZFxuICAgICAqICogYHJlc3VsdE5vTWF0Y2hgIC0gRmlyZWQgd2hlbiB3aGF0IHRoZSB1c2VyIHNhaWQgZGlkbid0IG1hdGNoIGFueSBvZiB0aGUgcmVnaXN0ZXJlZCBjb21tYW5kcy5cbiAgICAgKiAgICAgQ2FsbGJhY2sgZnVuY3Rpb25zIHJlZ2lzdGVyZWQgdG8gdGhpcyBldmVudCB3aWxsIGluY2x1ZGUgYW4gYXJyYXkgb2YgcG9zc2libGUgcGhyYXNlcyB0aGUgdXNlciBtaWdodCd2ZSBzYWlkIGFzIHRoZSBmaXJzdCBhcmd1bWVudFxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2Vycm9yJywgZnVuY3Rpb24oKSB7XG4gICAgICogICAkKCcubXlFcnJvclRleHQnKS50ZXh0KCdUaGVyZSB3YXMgYW4gZXJyb3IhJyk7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdyZXN1bHRNYXRjaCcsIGZ1bmN0aW9uKHVzZXJTYWlkLCBjb21tYW5kVGV4dCwgcGhyYXNlcykge1xuICAgICAqICAgY29uc29sZS5sb2codXNlclNhaWQpOyAvLyBzYW1wbGUgb3V0cHV0OiAnaGVsbG8nXG4gICAgICogICBjb25zb2xlLmxvZyhjb21tYW5kVGV4dCk7IC8vIHNhbXBsZSBvdXRwdXQ6ICdoZWxsbyAodGhlcmUpJ1xuICAgICAqICAgY29uc29sZS5sb2cocGhyYXNlcyk7IC8vIHNhbXBsZSBvdXRwdXQ6IFsnaGVsbG8nLCAnaGFsbycsICd5ZWxsb3cnLCAncG9sbycsICdoZWxsbyBraXR0eSddXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBwYXNzIGxvY2FsIGNvbnRleHQgdG8gYSBnbG9iYWwgZnVuY3Rpb24gY2FsbGVkIG5vdENvbm5lY3RlZFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2Vycm9yTmV0d29yaycsIG5vdENvbm5lY3RlZCwgdGhpcyk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0gTmFtZSBvZiBldmVudCB0aGF0IHdpbGwgdHJpZ2dlciB0aGlzIGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGV2ZW50IGlzIHRyaWdnZXJlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAbWV0aG9kIGFkZENhbGxiYWNrXG4gICAgICovXG4gICAgYWRkQ2FsbGJhY2s6IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgICBpZiAoY2FsbGJhY2tzW3R5cGVdICA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBjYiA9IHJvb3RbY2FsbGJhY2tdIHx8IGNhbGxiYWNrO1xuICAgICAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjYWxsYmFja3NbdHlwZV0ucHVzaCh7Y2FsbGJhY2s6IGNiLCBjb250ZXh0OiBjb250ZXh0IHx8IHRoaXN9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGNhbGxiYWNrcyBmcm9tIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIC0gUGFzcyBhbiBldmVudCBuYW1lIGFuZCBhIGNhbGxiYWNrIGNvbW1hbmQgdG8gcmVtb3ZlIHRoYXQgY2FsbGJhY2sgY29tbWFuZCBmcm9tIHRoYXQgZXZlbnQgdHlwZS5cbiAgICAgKiAtIFBhc3MganVzdCBhbiBldmVudCBuYW1lIHRvIHJlbW92ZSBhbGwgY2FsbGJhY2sgY29tbWFuZHMgZnJvbSB0aGF0IGV2ZW50IHR5cGUuXG4gICAgICogLSBQYXNzIHVuZGVmaW5lZCBhcyBldmVudCBuYW1lIGFuZCBhIGNhbGxiYWNrIGNvbW1hbmQgdG8gcmVtb3ZlIHRoYXQgY2FsbGJhY2sgY29tbWFuZCBmcm9tIGFsbCBldmVudCB0eXBlcy5cbiAgICAgKiAtIFBhc3Mgbm8gcGFyYW1zIHRvIHJlbW92ZSBhbGwgY2FsbGJhY2sgY29tbWFuZHMgZnJvbSBhbGwgZXZlbnQgdHlwZXMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMSk7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMik7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnZW5kJywgbXlGdW5jdGlvbjEpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2VuZCcsIG15RnVuY3Rpb24yKTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBhbGwgY2FsbGJhY2tzIGZyb20gYWxsIGV2ZW50czpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKCk7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgYWxsIGNhbGxiYWNrcyBhdHRhY2hlZCB0byBlbmQgZXZlbnQ6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygnZW5kJyk7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgbXlGdW5jdGlvbjIgZnJvbSBiZWluZyBjYWxsZWQgb24gc3RhcnQ6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMik7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgbXlGdW5jdGlvbjEgZnJvbSBiZWluZyBjYWxsZWQgb24gYWxsIGV2ZW50czpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKHVuZGVmaW5lZCwgbXlGdW5jdGlvbjEpO1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0eXBlIE5hbWUgb2YgZXZlbnQgdHlwZSB0byByZW1vdmUgY2FsbGJhY2sgZnJvbVxuICAgICAqIEBwYXJhbSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcmVtb3ZlXG4gICAgICogQHJldHVybnMgdW5kZWZpbmVkXG4gICAgICogQG1ldGhvZCByZW1vdmVDYWxsYmFja1xuICAgICAqL1xuICAgIHJlbW92ZUNhbGxiYWNrOiBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGNvbXBhcmVXaXRoQ2FsbGJhY2tQYXJhbWV0ZXIgPSBmdW5jdGlvbihjYikge1xuICAgICAgICByZXR1cm4gY2IuY2FsbGJhY2sgIT09IGNhbGxiYWNrO1xuICAgICAgfTtcbiAgICAgIC8vIEdvIG92ZXIgZWFjaCBjYWxsYmFjayB0eXBlIGluIGNhbGxiYWNrcyBzdG9yZSBvYmplY3RcbiAgICAgIGZvciAodmFyIGNhbGxiYWNrVHlwZSBpbiBjYWxsYmFja3MpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShjYWxsYmFja1R5cGUpKSB7XG4gICAgICAgICAgLy8gaWYgdGhpcyBpcyB0aGUgdHlwZSB1c2VyIGFza2VkIHRvIGRlbGV0ZSwgb3IgaGUgYXNrZWQgdG8gZGVsZXRlIGFsbCwgZ28gYWhlYWQuXG4gICAgICAgICAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCB8fCB0eXBlID09PSBjYWxsYmFja1R5cGUpIHtcbiAgICAgICAgICAgIC8vIElmIHVzZXIgYXNrZWQgdG8gZGVsZXRlIGFsbCBjYWxsYmFja3MgaW4gdGhpcyB0eXBlIG9yIGFsbCB0eXBlc1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXSA9IFtdO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhbGwgbWF0Y2hpbmcgY2FsbGJhY2tzXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0gPSBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXS5maWx0ZXIoY29tcGFyZVdpdGhDYWxsYmFja1BhcmFtZXRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBzcGVlY2ggcmVjb2duaXRpb24gaXMgY3VycmVudGx5IG9uLlxuICAgICAqIFJldHVybnMgZmFsc2UgaWYgc3BlZWNoIHJlY29nbml0aW9uIGlzIG9mZiBvciBhbm55YW5nIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm4gYm9vbGVhbiB0cnVlID0gU3BlZWNoUmVjb2duaXRpb24gaXMgb24gYW5kIGFubnlhbmcgaXMgbGlzdGVuaW5nXG4gICAgICogQG1ldGhvZCBpc0xpc3RlbmluZ1xuICAgICAqL1xuICAgIGlzTGlzdGVuaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBpc0xpc3RlbmluZyAmJiAhcGF1c2VMaXN0ZW5pbmc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGluc3RhbmNlIG9mIHRoZSBicm93c2VyJ3MgU3BlZWNoUmVjb2duaXRpb24gb2JqZWN0IHVzZWQgYnkgYW5ueWFuZy5cbiAgICAgKiBVc2VmdWwgaW4gY2FzZSB5b3Ugd2FudCBkaXJlY3QgYWNjZXNzIHRvIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml0aW9uIGVuZ2luZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIFNwZWVjaFJlY29nbml0aW9uIFRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml6ZXIgY3VycmVudGx5IHVzZWQgYnkgYW5ueWFuZ1xuICAgICAqIEBtZXRob2QgZ2V0U3BlZWNoUmVjb2duaXplclxuICAgICAqL1xuICAgIGdldFNwZWVjaFJlY29nbml6ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlY29nbml0aW9uO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTaW11bGF0ZSBzcGVlY2ggYmVpbmcgcmVjb2duaXplZC4gVGhpcyB3aWxsIHRyaWdnZXIgdGhlIHNhbWUgZXZlbnRzIGFuZCBiZWhhdmlvciBhcyB3aGVuIHRoZSBTcGVlY2ggUmVjb2duaXRpb25cbiAgICAgKiBkZXRlY3RzIHNwZWVjaC5cbiAgICAgKlxuICAgICAqIENhbiBhY2NlcHQgZWl0aGVyIGEgc3RyaW5nIGNvbnRhaW5pbmcgYSBzaW5nbGUgc2VudGVuY2UsIG9yIGFuIGFycmF5IGNvbnRhaW5pbmcgbXVsdGlwbGUgc2VudGVuY2VzIHRvIGJlIGNoZWNrZWRcbiAgICAgKiBpbiBvcmRlciB1bnRpbCBvbmUgb2YgdGhlbSBtYXRjaGVzIGEgY29tbWFuZCAoc2ltaWxhciB0byB0aGUgd2F5IFNwZWVjaCBSZWNvZ25pdGlvbiBBbHRlcm5hdGl2ZXMgYXJlIHBhcnNlZClcbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiBhbm55YW5nLnRyaWdnZXIoJ1RpbWUgZm9yIHNvbWUgdGhyaWxsaW5nIGhlcm9pY3MnKTtcbiAgICAgKiBhbm55YW5nLnRyaWdnZXIoXG4gICAgICogICAgIFsnVGltZSBmb3Igc29tZSB0aHJpbGxpbmcgaGVyb2ljcycsICdUaW1lIGZvciBzb21lIHRocmlsbGluZyBhZXJvYmljcyddXG4gICAgICogICApO1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSBzdHJpbmd8YXJyYXkgc2VudGVuY2VzIEEgc2VudGVuY2UgYXMgYSBzdHJpbmcgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvZiBwb3NzaWJsZSBzZW50ZW5jZXNcbiAgICAgKiBAcmV0dXJucyB1bmRlZmluZWRcbiAgICAgKiBAbWV0aG9kIHRyaWdnZXJcbiAgICAgKi9cbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihzZW50ZW5jZXMpIHtcbiAgICAgIC8qXG4gICAgICBpZighYW5ueWFuZy5pc0xpc3RlbmluZygpKSB7XG4gICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgaWYgKCFpc0xpc3RlbmluZykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Nhbm5vdCB0cmlnZ2VyIHdoaWxlIGFubnlhbmcgaXMgYWJvcnRlZCcpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIGhlYXJkLCBidXQgYW5ueWFuZyBpcyBwYXVzZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgKi9cblxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHNlbnRlbmNlcykpIHtcbiAgICAgICAgc2VudGVuY2VzID0gW3NlbnRlbmNlc107XG4gICAgICB9XG5cbiAgICAgIHBhcnNlUmVzdWx0cyhzZW50ZW5jZXMpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gYW5ueWFuZztcblxufSkpO1xuXG4vKipcbiAqICMgR29vZCB0byBLbm93XG4gKlxuICogIyMgQ29tbWFuZHMgT2JqZWN0XG4gKlxuICogQm90aCB0aGUgW2luaXQoKV0oKSBhbmQgYWRkQ29tbWFuZHMoKSBtZXRob2RzIHJlY2VpdmUgYSBgY29tbWFuZHNgIG9iamVjdC5cbiAqXG4gKiBhbm55YW5nIHVuZGVyc3RhbmRzIGNvbW1hbmRzIHdpdGggYG5hbWVkIHZhcmlhYmxlc2AsIGBzcGxhdHNgLCBhbmQgYG9wdGlvbmFsIHdvcmRzYC5cbiAqXG4gKiAqIFVzZSBgbmFtZWQgdmFyaWFibGVzYCBmb3Igb25lIHdvcmQgYXJndW1lbnRzIGluIHlvdXIgY29tbWFuZC5cbiAqICogVXNlIGBzcGxhdHNgIHRvIGNhcHR1cmUgbXVsdGktd29yZCB0ZXh0IGF0IHRoZSBlbmQgb2YgeW91ciBjb21tYW5kIChncmVlZHkpLlxuICogKiBVc2UgYG9wdGlvbmFsIHdvcmRzYCBvciBwaHJhc2VzIHRvIGRlZmluZSBhIHBhcnQgb2YgdGhlIGNvbW1hbmQgYXMgb3B0aW9uYWwuXG4gKlxuICogIyMjIyBFeGFtcGxlczpcbiAqIGBgYGBodG1sXG4gKiA8c2NyaXB0PlxuICogdmFyIGNvbW1hbmRzID0ge1xuICogICAvLyBhbm55YW5nIHdpbGwgY2FwdHVyZSBhbnl0aGluZyBhZnRlciBhIHNwbGF0ICgqKSBhbmQgcGFzcyBpdCB0byB0aGUgZnVuY3Rpb24uXG4gKiAgIC8vIGUuZy4gc2F5aW5nIFwiU2hvdyBtZSBCYXRtYW4gYW5kIFJvYmluXCIgd2lsbCBjYWxsIHNob3dGbGlja3IoJ0JhdG1hbiBhbmQgUm9iaW4nKTtcbiAqICAgJ3Nob3cgbWUgKnRhZyc6IHNob3dGbGlja3IsXG4gKlxuICogICAvLyBBIG5hbWVkIHZhcmlhYmxlIGlzIGEgb25lIHdvcmQgdmFyaWFibGUsIHRoYXQgY2FuIGZpdCBhbnl3aGVyZSBpbiB5b3VyIGNvbW1hbmQuXG4gKiAgIC8vIGUuZy4gc2F5aW5nIFwiY2FsY3VsYXRlIE9jdG9iZXIgc3RhdHNcIiB3aWxsIGNhbGwgY2FsY3VsYXRlU3RhdHMoJ09jdG9iZXInKTtcbiAqICAgJ2NhbGN1bGF0ZSA6bW9udGggc3RhdHMnOiBjYWxjdWxhdGVTdGF0cyxcbiAqXG4gKiAgIC8vIEJ5IGRlZmluaW5nIGEgcGFydCBvZiB0aGUgZm9sbG93aW5nIGNvbW1hbmQgYXMgb3B0aW9uYWwsIGFubnlhbmcgd2lsbCByZXNwb25kXG4gKiAgIC8vIHRvIGJvdGg6IFwic2F5IGhlbGxvIHRvIG15IGxpdHRsZSBmcmllbmRcIiBhcyB3ZWxsIGFzIFwic2F5IGhlbGxvIGZyaWVuZFwiXG4gKiAgICdzYXkgaGVsbG8gKHRvIG15IGxpdHRsZSkgZnJpZW5kJzogZ3JlZXRpbmdcbiAqIH07XG4gKlxuICogdmFyIHNob3dGbGlja3IgPSBmdW5jdGlvbih0YWcpIHtcbiAqICAgdmFyIHVybCA9ICdodHRwOi8vYXBpLmZsaWNrci5jb20vc2VydmljZXMvcmVzdC8/dGFncz0nK3RhZztcbiAqICAgJC5nZXRKU09OKHVybCk7XG4gKiB9XG4gKlxuICogdmFyIGNhbGN1bGF0ZVN0YXRzID0gZnVuY3Rpb24obW9udGgpIHtcbiAqICAgJCgnI3N0YXRzJykudGV4dCgnU3RhdGlzdGljcyBmb3IgJyttb250aCk7XG4gKiB9XG4gKlxuICogdmFyIGdyZWV0aW5nID0gZnVuY3Rpb24oKSB7XG4gKiAgICQoJyNncmVldGluZycpLnRleHQoJ0hlbGxvIScpO1xuICogfVxuICogPC9zY3JpcHQ+XG4gKiBgYGBgXG4gKlxuICogIyMjIFVzaW5nIFJlZ3VsYXIgRXhwcmVzc2lvbnMgaW4gY29tbWFuZHNcbiAqIEZvciBhZHZhbmNlZCBjb21tYW5kcywgeW91IGNhbiBwYXNzIGEgcmVndWxhciBleHByZXNzaW9uIG9iamVjdCwgaW5zdGVhZCBvZlxuICogYSBzaW1wbGUgc3RyaW5nIGNvbW1hbmQuXG4gKlxuICogVGhpcyBpcyBkb25lIGJ5IHBhc3NpbmcgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdHdvIHByb3BlcnRpZXM6IGByZWdleHBgLCBhbmRcbiAqIGBjYWxsYmFja2AgaW5zdGVhZCBvZiB0aGUgZnVuY3Rpb24uXG4gKlxuICogIyMjIyBFeGFtcGxlczpcbiAqIGBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgY2FsY3VsYXRlRnVuY3Rpb24gPSBmdW5jdGlvbihtb250aCkgeyBjb25zb2xlLmxvZyhtb250aCk7IH1cbiAqIHZhciBjb21tYW5kcyA9IHtcbiAqICAgLy8gVGhpcyBleGFtcGxlIHdpbGwgYWNjZXB0IGFueSB3b3JkIGFzIHRoZSBcIm1vbnRoXCJcbiAqICAgJ2NhbGN1bGF0ZSA6bW9udGggc3RhdHMnOiBjYWxjdWxhdGVGdW5jdGlvbixcbiAqICAgLy8gVGhpcyBleGFtcGxlIHdpbGwgb25seSBhY2NlcHQgbW9udGhzIHdoaWNoIGFyZSBhdCB0aGUgc3RhcnQgb2YgYSBxdWFydGVyXG4gKiAgICdjYWxjdWxhdGUgOnF1YXJ0ZXIgc3RhdHMnOiB7J3JlZ2V4cCc6IC9eY2FsY3VsYXRlIChKYW51YXJ5fEFwcmlsfEp1bHl8T2N0b2Jlcikgc3RhdHMkLywgJ2NhbGxiYWNrJzogY2FsY3VsYXRlRnVuY3Rpb259XG4gKiB9XG4gYGBgYFxuICpcbiAqICMjIExhbmd1YWdlc1xuICpcbiAqIFdoaWxlIHRoZXJlIGlzbid0IGFuIG9mZmljaWFsIGxpc3Qgb2Ygc3VwcG9ydGVkIGxhbmd1YWdlcyAoY3VsdHVyZXM/IGxvY2FsZXM/KSwgaGVyZSBpcyBhIGxpc3QgYmFzZWQgb24gW2FuZWNkb3RhbCBldmlkZW5jZV0oaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTQzMDIxMzQvMzM4MDM5KS5cbiAqXG4gKiAqIEFmcmlrYWFucyBgYWZgXG4gKiAqIEJhc3F1ZSBgZXVgXG4gKiAqIEJ1bGdhcmlhbiBgYmdgXG4gKiAqIENhdGFsYW4gYGNhYFxuICogKiBBcmFiaWMgKEVneXB0KSBgYXItRUdgXG4gKiAqIEFyYWJpYyAoSm9yZGFuKSBgYXItSk9gXG4gKiAqIEFyYWJpYyAoS3V3YWl0KSBgYXItS1dgXG4gKiAqIEFyYWJpYyAoTGViYW5vbikgYGFyLUxCYFxuICogKiBBcmFiaWMgKFFhdGFyKSBgYXItUUFgXG4gKiAqIEFyYWJpYyAoVUFFKSBgYXItQUVgXG4gKiAqIEFyYWJpYyAoTW9yb2NjbykgYGFyLU1BYFxuICogKiBBcmFiaWMgKElyYXEpIGBhci1JUWBcbiAqICogQXJhYmljIChBbGdlcmlhKSBgYXItRFpgXG4gKiAqIEFyYWJpYyAoQmFocmFpbikgYGFyLUJIYFxuICogKiBBcmFiaWMgKEx5YmlhKSBgYXItTFlgXG4gKiAqIEFyYWJpYyAoT21hbikgYGFyLU9NYFxuICogKiBBcmFiaWMgKFNhdWRpIEFyYWJpYSkgYGFyLVNBYFxuICogKiBBcmFiaWMgKFR1bmlzaWEpIGBhci1UTmBcbiAqICogQXJhYmljIChZZW1lbikgYGFyLVlFYFxuICogKiBDemVjaCBgY3NgXG4gKiAqIER1dGNoIGBubC1OTGBcbiAqICogRW5nbGlzaCAoQXVzdHJhbGlhKSBgZW4tQVVgXG4gKiAqIEVuZ2xpc2ggKENhbmFkYSkgYGVuLUNBYFxuICogKiBFbmdsaXNoIChJbmRpYSkgYGVuLUlOYFxuICogKiBFbmdsaXNoIChOZXcgWmVhbGFuZCkgYGVuLU5aYFxuICogKiBFbmdsaXNoIChTb3V0aCBBZnJpY2EpIGBlbi1aQWBcbiAqICogRW5nbGlzaChVSykgYGVuLUdCYFxuICogKiBFbmdsaXNoKFVTKSBgZW4tVVNgXG4gKiAqIEZpbm5pc2ggYGZpYFxuICogKiBGcmVuY2ggYGZyLUZSYFxuICogKiBHYWxpY2lhbiBgZ2xgXG4gKiAqIEdlcm1hbiBgZGUtREVgXG4gKiAqIEhlYnJldyBgaGVgXG4gKiAqIEh1bmdhcmlhbiBgaHVgXG4gKiAqIEljZWxhbmRpYyBgaXNgXG4gKiAqIEl0YWxpYW4gYGl0LUlUYFxuICogKiBJbmRvbmVzaWFuIGBpZGBcbiAqICogSmFwYW5lc2UgYGphYFxuICogKiBLb3JlYW4gYGtvYFxuICogKiBMYXRpbiBgbGFgXG4gKiAqIE1hbmRhcmluIENoaW5lc2UgYHpoLUNOYFxuICogKiBUcmFkaXRpb25hbCBUYWl3YW4gYHpoLVRXYFxuICogKiBTaW1wbGlmaWVkIENoaW5hIHpoLUNOIGA/YFxuICogKiBTaW1wbGlmaWVkIEhvbmcgS29uZyBgemgtSEtgXG4gKiAqIFl1ZSBDaGluZXNlIChUcmFkaXRpb25hbCBIb25nIEtvbmcpIGB6aC15dWVgXG4gKiAqIE1hbGF5c2lhbiBgbXMtTVlgXG4gKiAqIE5vcndlZ2lhbiBgbm8tTk9gXG4gKiAqIFBvbGlzaCBgcGxgXG4gKiAqIFBpZyBMYXRpbiBgeHgtcGlnbGF0aW5gXG4gKiAqIFBvcnR1Z3Vlc2UgYHB0LVBUYFxuICogKiBQb3J0dWd1ZXNlIChCcmFzaWwpIGBwdC1CUmBcbiAqICogUm9tYW5pYW4gYHJvLVJPYFxuICogKiBSdXNzaWFuIGBydWBcbiAqICogU2VyYmlhbiBgc3ItU1BgXG4gKiAqIFNsb3ZhayBgc2tgXG4gKiAqIFNwYW5pc2ggKEFyZ2VudGluYSkgYGVzLUFSYFxuICogKiBTcGFuaXNoIChCb2xpdmlhKSBgZXMtQk9gXG4gKiAqIFNwYW5pc2ggKENoaWxlKSBgZXMtQ0xgXG4gKiAqIFNwYW5pc2ggKENvbG9tYmlhKSBgZXMtQ09gXG4gKiAqIFNwYW5pc2ggKENvc3RhIFJpY2EpIGBlcy1DUmBcbiAqICogU3BhbmlzaCAoRG9taW5pY2FuIFJlcHVibGljKSBgZXMtRE9gXG4gKiAqIFNwYW5pc2ggKEVjdWFkb3IpIGBlcy1FQ2BcbiAqICogU3BhbmlzaCAoRWwgU2FsdmFkb3IpIGBlcy1TVmBcbiAqICogU3BhbmlzaCAoR3VhdGVtYWxhKSBgZXMtR1RgXG4gKiAqIFNwYW5pc2ggKEhvbmR1cmFzKSBgZXMtSE5gXG4gKiAqIFNwYW5pc2ggKE1leGljbykgYGVzLU1YYFxuICogKiBTcGFuaXNoIChOaWNhcmFndWEpIGBlcy1OSWBcbiAqICogU3BhbmlzaCAoUGFuYW1hKSBgZXMtUEFgXG4gKiAqIFNwYW5pc2ggKFBhcmFndWF5KSBgZXMtUFlgXG4gKiAqIFNwYW5pc2ggKFBlcnUpIGBlcy1QRWBcbiAqICogU3BhbmlzaCAoUHVlcnRvIFJpY28pIGBlcy1QUmBcbiAqICogU3BhbmlzaCAoU3BhaW4pIGBlcy1FU2BcbiAqICogU3BhbmlzaCAoVVMpIGBlcy1VU2BcbiAqICogU3BhbmlzaCAoVXJ1Z3VheSkgYGVzLVVZYFxuICogKiBTcGFuaXNoIChWZW5lenVlbGEpIGBlcy1WRWBcbiAqICogU3dlZGlzaCBgc3YtU0VgXG4gKiAqIFR1cmtpc2ggYHRyYFxuICogKiBadWx1IGB6dWBcbiAqXG4gKiAjIyBEZXZlbG9waW5nXG4gKlxuICogUHJlcmVxdWlzaXRpZXM6IG5vZGUuanNcbiAqXG4gKiBGaXJzdCwgaW5zdGFsbCBkZXBlbmRlbmNpZXMgaW4geW91ciBsb2NhbCBhbm55YW5nIGNvcHk6XG4gKlxuICogICAgIG5wbSBpbnN0YWxsXG4gKlxuICogTWFrZSBzdXJlIHRvIHJ1biB0aGUgZGVmYXVsdCBncnVudCB0YXNrIGFmdGVyIGVhY2ggY2hhbmdlIHRvIGFubnlhbmcuanMuIFRoaXMgY2FuIGFsc28gYmUgZG9uZSBhdXRvbWF0aWNhbGx5IGJ5IHJ1bm5pbmc6XG4gKlxuICogICAgIGdydW50IHdhdGNoXG4gKlxuICogWW91IGNhbiBhbHNvIHJ1biBhIGxvY2FsIHNlcnZlciBmb3IgdGVzdGluZyB5b3VyIHdvcmsgd2l0aDpcbiAqXG4gKiAgICAgZ3J1bnQgZGV2XG4gKlxuICogUG9pbnQgeW91ciBicm93c2VyIHRvIGBodHRwczovL2xvY2FsaG9zdDo4NDQzL2RlbW8vYCB0byBzZWUgdGhlIGRlbW8gcGFnZS5cbiAqIFNpbmNlIGl0J3MgdXNpbmcgc2VsZi1zaWduZWQgY2VydGlmaWNhdGUsIHlvdSBtaWdodCBuZWVkIHRvIGNsaWNrICpcIlByb2NlZWQgQW55d2F5XCIqLlxuICpcbiAqIEZvciBtb3JlIGluZm8sIGNoZWNrIG91dCB0aGUgW0NPTlRSSUJVVElOR10oaHR0cHM6Ly9naXRodWIuY29tL1RhbEF0ZXIvYW5ueWFuZy9ibG9iL21hc3Rlci9DT05UUklCVVRJTkcubWQpIGZpbGVcbiAqXG4gKi9cbiIsIi8vIEZVTkNUSU9OUyAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLzo6IGEgLT4gYVxuY29uc3QgdHJhY2UgPSAoeCkgPT4ge1xuICBjb25zb2xlLmxvZyh4KVxuICByZXR1cm4geFxufVxuXG4vLzo6IE9iamVjdCAtPiBbdl1cbmNvbnN0IG9iamVjdFZhbHVlcyA9IChvYmopID0+IHtcbiAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyhvYmopLm1hcChrZXkgPT4gb2JqW2tleV0pXG59XG5cbi8vOjogKChhLCBiLCAuLi4gLT4gZSksIChlIC0+IGYpLCAuLi4sICh5IC0+IHopKSAtPiAoYSwgYiwgLi4uKSAtPiB6XG5jb25zdCBwaXBlID0gKC4uLmZucykgPT4gKC4uLnhzKSA9PiB7XG4gIHJldHVybiBmbnNcbiAgICAuc2xpY2UoMSlcbiAgICAucmVkdWNlKCh4LCBmbikgPT4gZm4oeCksIGZuc1swXSguLi54cykpXG59XG5jb25zdCBwaXBlUCA9ICguLi5mbnMpID0+ICguLi54cykgPT4ge1xuICByZXR1cm4gZm5zXG4gICAgLnNsaWNlKDEpXG4gICAgLnJlZHVjZSgoeFAsIGZuKSA9PiB4UC50aGVuKGZuKSwgUHJvbWlzZS5yZXNvbHZlKGZuc1swXSguLi54cykpKVxufVxuXG4vLzo6IFN0cmluZyAtPiBPYmplY3QgLT4gYVxuY29uc3QgcHJvcCA9IChzdHIpID0+IChvYmopID0+IHtcbiAgcmV0dXJuIG9ialtzdHJdXG59XG5cbi8vOjogU3RyaW5nIC0+IFthXSAtPiBbTWF5YmVdXG5jb25zdCBwbHVjayA9IChzdHIpID0+ICh4cykgPT4ge1xuICByZXR1cm4gbWFwKHByb3Aoc3RyKSkoeHMpXG59XG5cbi8vOjogYSAtPiBhIC0+IEJvb2xlYW5cbmNvbnN0IGlzID0gKHRlc3RfdmFsdWUpID0+ICh2YWx1ZSkgPT4ge1xuICByZXR1cm4gdmFsdWUgPT09IHRlc3RfdmFsdWVcbn1cblxuLy86OiAoYSAtPiBiKSAtPiBbYV0gLT4gW2JdXG5jb25zdCBtYXAgPSAoZm4pID0+IChmKSA9PiB7XG4gIHJldHVybiBmLm1hcChmbilcbn1cblxuLy86OiAoYSAtPiBiKSAtPiBbYV0gLT4gW2JdXG5jb25zdCBmaWx0ZXIgPSAoZm4pID0+ICh4cykgPT4ge1xuICByZXR1cm4geHMuZmlsdGVyKGZuKVxufVxuLy86OiBbYV0gLT4gW2FdIC0+IFthXVxuY29uc3QgaW50ZXJzZWN0aW9uID0gKHhzKSA9PiAoeHMyKSA9PiB7XG4gIHJldHVybiB4cy5maWx0ZXIoeCA9PiB4czIuaW5jbHVkZXMoeCkpXG59XG5cbi8vOjogW2FdIC0+IFthXSAtPiBbYV1cbmNvbnN0IGRpZmZlcmVuY2UgPSAoeHMpID0+ICh4czIpID0+IHtcbiAgcmV0dXJuIHhzLmZpbHRlcih4ID0+ICF4czIuaW5jbHVkZXMoeCkpXG59XG5cbi8vOjogWyhhLCBiLCAuLi4pIC0+IG5dIC0+IFthLCBiLCAuLi5dIC0+IFtuXVxuY29uc3QgYXBwbHlGdW5jdGlvbnMgPSAoZm5zKSA9PiAoeHMpID0+IHtcbiAgcmV0dXJuIGZucy5tYXAoZm4gPT5cbiAgICB4cy5zbGljZSgxKS5yZWR1Y2UoKHBhcnRpYWwsIHgpID0+IHBhcnRpYWwoeCksIGZuKHhzWzBdKSkpXG59XG5cbi8vOjogW2FdIC0+IGFcbmNvbnN0IGxhc3QgPSAoeHMpID0+IHtcbiAgcmV0dXJuIHhzW3hzLmxlbmd0aCAtIDFdXG59XG5cbi8vOjogKGEgLT4gYiAtPiBjKSAtPiBiIC0+IGEgLT4gY1xuY29uc3QgZmxpcCA9IChmbikgPT4gKGIpID0+IChhKSA9PiB7XG4gIHJldHVybiBmbihhKShiKVxufVxuXG5jb25zdCBjdXJyeSA9IChmbikgPT4ge1xuICB2YXIgX2FyZ3MgPSBbXVxuICBjb25zdCBjb3VudEFyZ3MgPSAoLi4ueHMpID0+IHtcbiAgICBfYXJncyA9IF9hcmdzLmNvbmNhdCh4cylcbiAgICByZXR1cm4gKF9hcmdzLmxlbmd0aCA+PSBmbi5sZW5ndGgpXG4gICAgICA/IGZuLmFwcGx5KHRoaXMsIF9hcmdzKVxuICAgICAgOiBjb3VudEFyZ3NcbiAgfVxuICByZXR1cm4gY291bnRBcmdzXG59XG5cbi8vOjogSW50IC0+IFthXSAtPiBhXG5jb25zdCBudGggPSAobikgPT4gKHhzKSA9PiB7XG4gIHJldHVybiB4c1tuXVxufVxuXG4vLzo6IChhIC0+IGEpIC0+IE51bWJlciAtPiBbYV0gLT4gW2FdXG5jb25zdCBhZGp1c3QgPSAoZm4pID0+IChpKSA9PiAobGlzdCkgPT4ge1xuICB2YXIgY29weSA9IGxpc3Quc2xpY2UoKVxuICBjb3B5LnNwbGljZShpLCAxLCBmbihsaXN0W2ldKSlcbiAgcmV0dXJuIGNvcHlcbn1cblxuLy86OiBPYmplY3QgLT4gQXJyYXlcbmNvbnN0IHRvUGFpcnMgPSAob2JqKSA9PiB7XG4gIHJldHVybiBSZWZsZWN0Lm93bktleXMob2JqKS5tYXAoa2V5ID0+IFtrZXksIG9ialtrZXldXSlcbn1cblxuLy86OiAoYSAtPiBCb29sKSAtPiAoYSAtPiBiKSAtPiAoYSAtPiBiKSAtPiBhIC0+IGJcbmNvbnN0IGlmRWxzZSA9IChwcmVkRm4pID0+ICh3aGVuVHJ1ZUZuKSA9PiAod2hlbkZhbHNlRm4pID0+IChhKSA9PntcbiAgcmV0dXJuIHByZWRGbihhKVxuICAgID8gd2hlblRydWVGbihhKVxuICAgIDogd2hlbkZhbHNlRm4oYSlcbn1cblxuXG4vLyB0aGlzIGlzbid0IGluIGV4cG9ydHMsIGl0IGlzIHVzZWQgYnkgSU8uc2VxdWVuY2UgLy8vLy8vLy8vLy8vLy9cbmNvbnN0IEdlbmVyYXRvciA9IE9iamVjdC5mcmVlemUoe1xuICAvLzo6IChhIC0+IGIpIC0+IChHZW5lcmF0b3IgKFthXSAtPiBiKSlcbiAgLyogcmV0dXJucyBhIGdlbmVyYXRvciB3aGljaCB3aWxsIGFwcGx5XG4gICAgIGFjdGlvbiB0byBlYSB2YWx1ZSBzZXF1ZW50aWFsbHkgaW4geHNcbiAgICovXG4gIHNlcShhY3Rpb24pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24qIGFwcGx5QWN0aW9uKHhzKSB7XG4gICAgICBmb3IgKHZhciB4IG9mIHhzKSB7XG4gICAgICAgIHlpZWxkIGFjdGlvbih4KVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgLy86OiBHZW5lcmF0b3IgLT4gX1xuICAvKiBhdXRvbWF0aWNhbGx5IHN0ZXBzIGdlbmVyYXRvciBldmVyeSB+eCBtc1xuICAgICB1bnRpbCB0aGUgZ2VuZXJhdG9yIGlzIGV4aGF1c3RlZFxuICAgKi9cbiAgYXV0bzogKG1zKSA9PiAoZ2VuKSA9PiB7XG4gICAgaWYgKCFnZW4ubmV4dCgpLmRvbmUpIHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gR2VuZXJhdG9yLmF1dG8obXMpKGdlbiksIG1zKVxuICAgIH1cbiAgfVxufSlcblxuXG4vLyBNT05BRFMgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLyBNYXliZSB0eXBlXG5jb25zdCBNYXliZSA9ICgoKSA9PiB7XG4gIGNvbnN0IG5ld00gPSAodHlwZSkgPT4gKHZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUoT2JqZWN0LmNyZWF0ZSh0eXBlLCB7IF9fdmFsdWU6IHsgdmFsdWU6IHZhbHVlIH19KSlcbiAgfVxuXG4gIGNvbnN0IE5vdGhpbmcgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoXykge1xuICAgICAgcmV0dXJuIG5ld00oTm90aGluZykobnVsbClcbiAgICB9LFxuICAgIGlzTm90aGluZzogdHJ1ZSxcbiAgICBpc0p1c3Q6IGZhbHNlXG4gIH0pXG5cbiAgY29uc3QgSnVzdCA9IE9iamVjdC5mcmVlemUoe1xuICAgIG1hcChmbikge1xuICAgICAgcmV0dXJuIG5ld00oSnVzdCkoZm4odGhpcy5fX3ZhbHVlKSlcbiAgICB9LFxuICAgIGlzTm90aGluZzogZmFsc2UsXG4gICAgaXNKdXN0OiB0cnVlXG4gIH0pXG5cbiAgY29uc3QgTWF5YmUgPSAoeCkgPT4ge1xuICAgIHJldHVybiAoeCA9PSBudWxsKVxuICAgICAgPyBuZXdNKE5vdGhpbmcpKG51bGwpXG4gICAgICA6IG5ld00oSnVzdCkoeClcbiAgfVxuXG4gIE1heWJlLmlzTm90aGluZyA9IChNKSA9PiB7XG4gICAgcmV0dXJuIE5vdGhpbmcuaXNQcm90b3R5cGVPZihNKVxuICB9XG5cbiAgTWF5YmUuaXNKdXN0ID0gKE0pID0+IHtcbiAgICByZXR1cm4gSnVzdC5pc1Byb3RvdHlwZU9mKE0pXG4gIH1cblxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShNYXliZSlcbn0pKClcblxuLy8gRWl0aGVyIHR5cGVcbmNvbnN0IEVpdGhlciA9ICgoKSA9PiB7XG4gIGNvbnN0IG5ld0UgPSAodHlwZSkgPT4gKHZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUoT2JqZWN0LmNyZWF0ZSh0eXBlLCB7IF9fdmFsdWU6IHsgdmFsdWU6IHZhbHVlIH0gfSkpXG4gIH1cblxuICBjb25zdCBMZWZ0ID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgbWFwKF8pIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcbiAgICBiaW1hcChmbikge1xuICAgICAgY29uc3QgbWUgPSB0aGlzXG4gICAgICByZXR1cm4gKF8pID0+IHtcbiAgICAgICAgcmV0dXJuIG5ld0UoTGVmdCkoZm4obWUuX192YWx1ZSkpXG4gICAgICB9XG4gICAgfSxcbiAgICBjaGFpbihmbikge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIGlzTGVmdDogdHJ1ZSxcbiAgICBpc1JpZ2h0OiBmYWxzZVxuICB9KVxuXG4gIGNvbnN0IFJpZ2h0ID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgbWFwKGZuKSB7XG4gICAgICByZXR1cm4gbmV3RShSaWdodCkoZm4odGhpcy5fX3ZhbHVlKSlcbiAgICB9LFxuICAgIGJpbWFwKF8pIHtcbiAgICAgIGNvbnN0IG1lID0gdGhpc1xuICAgICAgcmV0dXJuIChmbikgPT4ge1xuICAgICAgICByZXR1cm4gbWUubWFwKGZuKVxuICAgICAgfVxuICAgIH0sXG4gICAgY2hhaW4oZm4pIHtcbiAgICAgIHJldHVybiBmbih0aGlzLl9fdmFsdWUpXG4gICAgfSxcbiAgICBpc0xlZnQ6IGZhbHNlLFxuICAgIGlzUmlnaHQ6IHRydWVcbiAgfSlcblxuICBjb25zdCBFaXRoZXIgPSBPYmplY3QuZnJlZXplKHtcbiAgICBMZWZ0KHgpIHtcbiAgICAgIHJldHVybiBuZXdFKExlZnQpKHgpXG4gICAgfSxcbiAgICBSaWdodCh4KSB7XG4gICAgICByZXR1cm4gbmV3RShSaWdodCkoeClcbiAgICB9LFxuICAgIGlzUmlnaHQoRSkge1xuICAgICAgcmV0dXJuIFJpZ2h0LmlzUHJvdG90eXBlT2YoRSlcbiAgICB9LFxuICAgIGlzTGVmdChFKSB7XG4gICAgICByZXR1cm4gTGVmdC5pc1Byb3RvdHlwZU9mKEUpXG4gICAgfSxcbiAgICBiaW1hcDogKGxlZnRGbikgPT4gKHJpZ2h0Rm4pID0+IChFKSA9PiB7XG4gICAgICByZXR1cm4gRS5iaW1hcChsZWZ0Rm4pKHJpZ2h0Rm4pXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBFaXRoZXJcbn0pKClcblxuLy8gSU8gdHlwZVxuY29uc3QgSU8gPSAoKCkgPT4ge1xuICBjb25zdCBuZXdfaW8gPSAoZm4pID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZShPYmplY3QuY3JlYXRlKGlvLCB7IF9fdmFsdWU6IHsgdmFsdWU6IGZuIH19KSlcbiAgfVxuXG4gIGNvbnN0IGlvID0ge1xuICAgIHJ1bklPKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fX3ZhbHVlKHZhbHVlKVxuICAgIH0sXG4gICAgbWFwKGZuKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKCgpID0+IGZuKHRoaXMuX192YWx1ZSgpKSlcbiAgICB9LFxuICAgIGpvaW4oKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuSU8oKS5ydW5JTygpXG4gICAgICB9KVxuICAgIH0sXG4gICAgY2hhaW4oaW9fcmV0dXJuaW5nX2ZuKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAoaW9fcmV0dXJuaW5nX2ZuKS5qb2luKClcbiAgICB9LFxuICAgIGFwKGlvX3ZhbHVlKSB7XG4gICAgICByZXR1cm4gaW9fdmFsdWUubWFwKHRoaXMuX192YWx1ZSlcbiAgICB9XG4gIH1cblxuICBjb25zdCBJTyA9IChmbikgPT4ge1xuICAgIGlmIChmbiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKGZuKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJTyBjb25zdHJ1Y3RvciBleHBlY3RlZCBpbnN0YW5jZSBvZiBGdW5jdGlvbmApXG4gICAgfVxuICB9XG5cbiAgSU8ub2YgPSAoeCkgPT4ge1xuICAgIHJldHVybiBuZXdfaW8oKCkgPT4geClcbiAgfVxuXG4gIElPLnJ1biA9IChpbykgPT4ge1xuICAgIHJldHVybiBpby5ydW5JTygpXG4gIH1cblxuICAvLzo6IChhIC0+IGIpIC0+IGEgLT4gSU8gYlxuICBJTy53cmFwID0gKGZuKSA9PiAoX3ZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIElPLm9mKF92YWx1ZSkubWFwKGZuKVxuICB9XG5cbiAgLy86OiBbSU9dIC0+IElPIF9cbiAgSU8uc2VxdWVuY2UgPSBJTy53cmFwKFxuICAgIHBpcGUoXG4gICAgICBHZW5lcmF0b3Iuc2VxKElPLnJ1biksXG4gICAgICBHZW5lcmF0b3IuYXV0bygwKVxuICAgICkpXG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoSU8pXG59KSgpXG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHRyYWNlLCBwaXBlLCBwaXBlUCwgbWFwLCBpbnRlcnNlY3Rpb24sIGRpZmZlcmVuY2UsIGFwcGx5RnVuY3Rpb25zLFxuICBsYXN0LCBmbGlwLCBjdXJyeSwgbnRoLCBhZGp1c3QsIHRvUGFpcnMsIGlmRWxzZSxcbiAgTWF5YmUsIEVpdGhlciwgSU8sIG9iamVjdFZhbHVlcywgcHJvcCwgcGx1Y2ssIGlzLCBmaWx0ZXJcbn1cblxuXG4vLyBPVEhFUiBJREVBUyAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5jb25zdCByZWN1cnNlX3JlZHVjZSA9IChmKSA9PiAoYSkgPT4gKFt4LCAuLi54c10pID0+IHtcbiAgcmV0dXJuIHggPT09IHVuZGVmaW5lZCA/IGEgOiByZWN1cnNlX3JlZHVjZShmLCBmKGEsIHgpLCB4cylcbn1cblxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2Z1enp5c2V0LmpzJyk7XG4iLCIoZnVuY3Rpb24oKSB7XG5cbnZhciBGdXp6eVNldCA9IGZ1bmN0aW9uKGFyciwgdXNlTGV2ZW5zaHRlaW4sIGdyYW1TaXplTG93ZXIsIGdyYW1TaXplVXBwZXIpIHtcbiAgICB2YXIgZnV6enlzZXQgPSB7XG4gICAgICAgIHZlcnNpb246ICcwLjAuMSdcbiAgICB9O1xuXG4gICAgLy8gZGVmYXVsdCBvcHRpb25zXG4gICAgYXJyID0gYXJyIHx8IFtdO1xuICAgIGZ1enp5c2V0LmdyYW1TaXplTG93ZXIgPSBncmFtU2l6ZUxvd2VyIHx8IDI7XG4gICAgZnV6enlzZXQuZ3JhbVNpemVVcHBlciA9IGdyYW1TaXplVXBwZXIgfHwgMztcbiAgICBmdXp6eXNldC51c2VMZXZlbnNodGVpbiA9IHVzZUxldmVuc2h0ZWluIHx8IHRydWU7XG5cbiAgICAvLyBkZWZpbmUgYWxsIHRoZSBvYmplY3QgZnVuY3Rpb25zIGFuZCBhdHRyaWJ1dGVzXG4gICAgZnV6enlzZXQuZXhhY3RTZXQgPSB7fVxuICAgIGZ1enp5c2V0Lm1hdGNoRGljdCA9IHt9O1xuICAgIGZ1enp5c2V0Lml0ZW1zID0ge307XG5cbiAgICAvLyBoZWxwZXIgZnVuY3Rpb25zXG4gICAgdmFyIGxldmVuc2h0ZWluID0gZnVuY3Rpb24oc3RyMSwgc3RyMikge1xuICAgICAgICB2YXIgY3VycmVudCA9IFtdLCBwcmV2LCB2YWx1ZTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8PSBzdHIyLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPD0gc3RyMS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgaWYgKGkgJiYgailcbiAgICAgICAgICAgICAgICBpZiAoc3RyMS5jaGFyQXQoaiAtIDEpID09PSBzdHIyLmNoYXJBdChpIC0gMSkpXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBwcmV2O1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgubWluKGN1cnJlbnRbal0sIGN1cnJlbnRbaiAtIDFdLCBwcmV2KSArIDE7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBpICsgajtcblxuICAgICAgICAgICAgcHJldiA9IGN1cnJlbnRbal07XG4gICAgICAgICAgICBjdXJyZW50W2pdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnJlbnQucG9wKCk7XG4gICAgfTtcblxuICAgIC8vIHJldHVybiBhbiBlZGl0IGRpc3RhbmNlIGZyb20gMCB0byAxXG4gICAgdmFyIF9kaXN0YW5jZSA9IGZ1bmN0aW9uKHN0cjEsIHN0cjIpIHtcbiAgICAgICAgaWYgKHN0cjEgPT0gbnVsbCAmJiBzdHIyID09IG51bGwpIHRocm93ICdUcnlpbmcgdG8gY29tcGFyZSB0d28gbnVsbCB2YWx1ZXMnXG4gICAgICAgIGlmIChzdHIxID09IG51bGwgfHwgc3RyMiA9PSBudWxsKSByZXR1cm4gMDtcbiAgICAgICAgc3RyMSA9IFN0cmluZyhzdHIxKTsgc3RyMiA9IFN0cmluZyhzdHIyKTtcblxuICAgICAgICB2YXIgZGlzdGFuY2UgPSBsZXZlbnNodGVpbihzdHIxLCBzdHIyKTtcbiAgICAgICAgaWYgKHN0cjEubGVuZ3RoID4gc3RyMi5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiAxIC0gZGlzdGFuY2UgLyBzdHIxLmxlbmd0aDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAxIC0gZGlzdGFuY2UgLyBzdHIyLmxlbmd0aDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgdmFyIF9ub25Xb3JkUmUgPSAvW15cXHcsIF0rLztcblxuICAgIHZhciBfaXRlcmF0ZUdyYW1zID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIGdyYW1TaXplID0gZ3JhbVNpemUgfHwgMjtcbiAgICAgICAgdmFyIHNpbXBsaWZpZWQgPSAnLScgKyB2YWx1ZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoX25vbldvcmRSZSwgJycpICsgJy0nLFxuICAgICAgICAgICAgbGVuRGlmZiA9IGdyYW1TaXplIC0gc2ltcGxpZmllZC5sZW5ndGgsXG4gICAgICAgICAgICByZXN1bHRzID0gW107XG4gICAgICAgIGlmIChsZW5EaWZmID4gMCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5EaWZmOyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSArPSAnLSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzaW1wbGlmaWVkLmxlbmd0aCAtIGdyYW1TaXplICsgMTsgKytpKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goc2ltcGxpZmllZC5zbGljZShpLCBpICsgZ3JhbVNpemUpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH07XG5cbiAgICB2YXIgX2dyYW1Db3VudGVyID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIGdyYW1TaXplID0gZ3JhbVNpemUgfHwgMjtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHt9LFxuICAgICAgICAgICAgZ3JhbXMgPSBfaXRlcmF0ZUdyYW1zKHZhbHVlLCBncmFtU2l6ZSksXG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgZm9yIChpOyBpIDwgZ3JhbXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChncmFtc1tpXSBpbiByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbZ3JhbXNbaV1dICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtncmFtc1tpXV0gPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIC8vIHRoZSBtYWluIGZ1bmN0aW9uc1xuICAgIGZ1enp5c2V0LmdldCA9IGZ1bmN0aW9uKHZhbHVlLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHRoaXMuX2dldCh2YWx1ZSk7XG4gICAgICAgIGlmICghcmVzdWx0ICYmIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBmdXp6eXNldC5fZ2V0ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRWYWx1ZSA9IHRoaXMuX25vcm1hbGl6ZVN0cih2YWx1ZSksXG4gICAgICAgICAgICByZXN1bHQgPSB0aGlzLmV4YWN0U2V0W25vcm1hbGl6ZWRWYWx1ZV07XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgIHJldHVybiBbWzEsIHJlc3VsdF1dO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGZvciAodmFyIGdyYW1TaXplID0gdGhpcy5ncmFtU2l6ZVVwcGVyOyBncmFtU2l6ZSA+IHRoaXMuZ3JhbVNpemVMb3dlcjsgLS1ncmFtU2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHRoaXMuX19nZXQodmFsdWUsIGdyYW1TaXplKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIGZ1enp5c2V0Ll9fZ2V0ID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkVmFsdWUgPSB0aGlzLl9ub3JtYWxpemVTdHIodmFsdWUpLFxuICAgICAgICAgICAgbWF0Y2hlcyA9IHt9LFxuICAgICAgICAgICAgZ3JhbUNvdW50cyA9IF9ncmFtQ291bnRlcihub3JtYWxpemVkVmFsdWUsIGdyYW1TaXplKSxcbiAgICAgICAgICAgIGl0ZW1zID0gdGhpcy5pdGVtc1tncmFtU2l6ZV0sXG4gICAgICAgICAgICBzdW1PZlNxdWFyZUdyYW1Db3VudHMgPSAwLFxuICAgICAgICAgICAgZ3JhbSxcbiAgICAgICAgICAgIGdyYW1Db3VudCxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIG90aGVyR3JhbUNvdW50O1xuXG4gICAgICAgIGZvciAoZ3JhbSBpbiBncmFtQ291bnRzKSB7XG4gICAgICAgICAgICBncmFtQ291bnQgPSBncmFtQ291bnRzW2dyYW1dO1xuICAgICAgICAgICAgc3VtT2ZTcXVhcmVHcmFtQ291bnRzICs9IE1hdGgucG93KGdyYW1Db3VudCwgMik7XG4gICAgICAgICAgICBpZiAoZ3JhbSBpbiB0aGlzLm1hdGNoRGljdCkge1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLm1hdGNoRGljdFtncmFtXS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMubWF0Y2hEaWN0W2dyYW1dW2ldWzBdO1xuICAgICAgICAgICAgICAgICAgICBvdGhlckdyYW1Db3VudCA9IHRoaXMubWF0Y2hEaWN0W2dyYW1dW2ldWzFdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggaW4gbWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlc1tpbmRleF0gKz0gZ3JhbUNvdW50ICogb3RoZXJHcmFtQ291bnQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVzW2luZGV4XSA9IGdyYW1Db3VudCAqIG90aGVyR3JhbUNvdW50O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaXNFbXB0eU9iamVjdChvYmopIHtcbiAgICAgICAgICAgIGZvcih2YXIgcHJvcCBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICBpZihvYmouaGFzT3duUHJvcGVydHkocHJvcCkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzRW1wdHlPYmplY3QobWF0Y2hlcykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHZlY3Rvck5vcm1hbCA9IE1hdGguc3FydChzdW1PZlNxdWFyZUdyYW1Db3VudHMpLFxuICAgICAgICAgICAgcmVzdWx0cyA9IFtdLFxuICAgICAgICAgICAgbWF0Y2hTY29yZTtcbiAgICAgICAgLy8gYnVpbGQgYSByZXN1bHRzIGxpc3Qgb2YgW3Njb3JlLCBzdHJdXG4gICAgICAgIGZvciAodmFyIG1hdGNoSW5kZXggaW4gbWF0Y2hlcykge1xuICAgICAgICAgICAgbWF0Y2hTY29yZSA9IG1hdGNoZXNbbWF0Y2hJbmRleF07XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goW21hdGNoU2NvcmUgLyAodmVjdG9yTm9ybWFsICogaXRlbXNbbWF0Y2hJbmRleF1bMF0pLCBpdGVtc1ttYXRjaEluZGV4XVsxXV0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzb3J0RGVzY2VuZGluZyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChhWzBdIDwgYlswXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhWzBdID4gYlswXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlc3VsdHMuc29ydChzb3J0RGVzY2VuZGluZyk7XG4gICAgICAgIGlmICh0aGlzLnVzZUxldmVuc2h0ZWluKSB7XG4gICAgICAgICAgICB2YXIgbmV3UmVzdWx0cyA9IFtdLFxuICAgICAgICAgICAgICAgIGVuZEluZGV4ID0gTWF0aC5taW4oNTAsIHJlc3VsdHMubGVuZ3RoKTtcbiAgICAgICAgICAgIC8vIHRydW5jYXRlIHNvbWV3aGF0IGFyYml0cmFyaWx5IHRvIDUwXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVuZEluZGV4OyArK2kpIHtcbiAgICAgICAgICAgICAgICBuZXdSZXN1bHRzLnB1c2goW19kaXN0YW5jZShyZXN1bHRzW2ldWzFdLCBub3JtYWxpemVkVmFsdWUpLCByZXN1bHRzW2ldWzFdXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHRzID0gbmV3UmVzdWx0cztcbiAgICAgICAgICAgIHJlc3VsdHMuc29ydChzb3J0RGVzY2VuZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5ld1Jlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBpZiAocmVzdWx0c1tpXVswXSA9PSByZXN1bHRzWzBdWzBdKSB7XG4gICAgICAgICAgICAgICAgbmV3UmVzdWx0cy5wdXNoKFtyZXN1bHRzW2ldWzBdLCB0aGlzLmV4YWN0U2V0W3Jlc3VsdHNbaV1bMV1dXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld1Jlc3VsdHM7XG4gICAgfTtcblxuICAgIGZ1enp5c2V0LmFkZCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkVmFsdWUgPSB0aGlzLl9ub3JtYWxpemVTdHIodmFsdWUpO1xuICAgICAgICBpZiAobm9ybWFsaXplZFZhbHVlIGluIHRoaXMuZXhhY3RTZXQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gdGhpcy5ncmFtU2l6ZUxvd2VyO1xuICAgICAgICBmb3IgKGk7IGkgPCB0aGlzLmdyYW1TaXplVXBwZXIgKyAxOyArK2kpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZCh2YWx1ZSwgaSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnV6enlzZXQuX2FkZCA9IGZ1bmN0aW9uKHZhbHVlLCBncmFtU2l6ZSkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZFZhbHVlID0gdGhpcy5fbm9ybWFsaXplU3RyKHZhbHVlKSxcbiAgICAgICAgICAgIGl0ZW1zID0gdGhpcy5pdGVtc1tncmFtU2l6ZV0gfHwgW10sXG4gICAgICAgICAgICBpbmRleCA9IGl0ZW1zLmxlbmd0aDtcblxuICAgICAgICBpdGVtcy5wdXNoKDApO1xuICAgICAgICB2YXIgZ3JhbUNvdW50cyA9IF9ncmFtQ291bnRlcihub3JtYWxpemVkVmFsdWUsIGdyYW1TaXplKSxcbiAgICAgICAgICAgIHN1bU9mU3F1YXJlR3JhbUNvdW50cyA9IDAsXG4gICAgICAgICAgICBncmFtLCBncmFtQ291bnQ7XG4gICAgICAgIGZvciAodmFyIGdyYW0gaW4gZ3JhbUNvdW50cykge1xuICAgICAgICAgICAgZ3JhbUNvdW50ID0gZ3JhbUNvdW50c1tncmFtXTtcbiAgICAgICAgICAgIHN1bU9mU3F1YXJlR3JhbUNvdW50cyArPSBNYXRoLnBvdyhncmFtQ291bnQsIDIpO1xuICAgICAgICAgICAgaWYgKGdyYW0gaW4gdGhpcy5tYXRjaERpY3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1hdGNoRGljdFtncmFtXS5wdXNoKFtpbmRleCwgZ3JhbUNvdW50XSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0Y2hEaWN0W2dyYW1dID0gW1tpbmRleCwgZ3JhbUNvdW50XV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZlY3Rvck5vcm1hbCA9IE1hdGguc3FydChzdW1PZlNxdWFyZUdyYW1Db3VudHMpO1xuICAgICAgICBpdGVtc1tpbmRleF0gPSBbdmVjdG9yTm9ybWFsLCBub3JtYWxpemVkVmFsdWVdO1xuICAgICAgICB0aGlzLml0ZW1zW2dyYW1TaXplXSA9IGl0ZW1zO1xuICAgICAgICB0aGlzLmV4YWN0U2V0W25vcm1hbGl6ZWRWYWx1ZV0gPSB2YWx1ZTtcbiAgICB9O1xuXG4gICAgZnV6enlzZXQuX25vcm1hbGl6ZVN0ciA9IGZ1bmN0aW9uKHN0cikge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cikgIT09ICdbb2JqZWN0IFN0cmluZ10nKSB0aHJvdyAnTXVzdCB1c2UgYSBzdHJpbmcgYXMgYXJndW1lbnQgdG8gRnV6enlTZXQgZnVuY3Rpb25zJ1xuICAgICAgICByZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIC8vIHJldHVybiBsZW5ndGggb2YgaXRlbXMgaW4gc2V0XG4gICAgZnV6enlzZXQubGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjb3VudCA9IDAsXG4gICAgICAgICAgICBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gdGhpcy5leGFjdFNldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhY3RTZXQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBjb3VudCArPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb3VudDtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGlzIHNldCBpcyBlbXB0eVxuICAgIGZ1enp5c2V0LmlzRW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0aGlzLmV4YWN0U2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFjdFNldC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGxpc3Qgb2YgdmFsdWVzIGxvYWRlZCBpbnRvIHNldFxuICAgIGZ1enp5c2V0LnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWVzID0gW10sXG4gICAgICAgICAgICBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gdGhpcy5leGFjdFNldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhY3RTZXQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCh0aGlzLmV4YWN0U2V0W3Byb3BdKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgfTtcblxuXG4gICAgLy8gaW5pdGlhbGl6YXRpb25cbiAgICB2YXIgaSA9IGZ1enp5c2V0LmdyYW1TaXplTG93ZXI7XG4gICAgZm9yIChpOyBpIDwgZnV6enlzZXQuZ3JhbVNpemVVcHBlciArIDE7ICsraSkge1xuICAgICAgICBmdXp6eXNldC5pdGVtc1tpXSA9IFtdO1xuICAgIH1cbiAgICAvLyBhZGQgYWxsIHRoZSBpdGVtcyB0byB0aGUgc2V0XG4gICAgZm9yIChpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xuICAgICAgICBmdXp6eXNldC5hZGQoYXJyW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnV6enlzZXQ7XG59O1xuXG52YXIgcm9vdCA9IHRoaXM7XG4vLyBFeHBvcnQgdGhlIGZ1enp5c2V0IG9iamVjdCBmb3IgKipDb21tb25KUyoqLCB3aXRoIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5XG4vLyBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIG5vdCBpbiBDb21tb25KUywgYWRkIGBfYCB0byB0aGVcbi8vIGdsb2JhbCBvYmplY3QuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEZ1enp5U2V0O1xuICAgIHJvb3QuRnV6enlTZXQgPSBGdXp6eVNldDtcbn0gZWxzZSB7XG4gICAgcm9vdC5GdXp6eVNldCA9IEZ1enp5U2V0O1xufVxuXG59KSgpO1xuIiwidmFyIFZOb2RlID0gcmVxdWlyZSgnLi92bm9kZScpO1xudmFyIGlzID0gcmVxdWlyZSgnLi9pcycpO1xuXG5mdW5jdGlvbiBhZGROUyhkYXRhLCBjaGlsZHJlbikge1xuICBkYXRhLm5zID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJztcbiAgaWYgKGNoaWxkcmVuICE9PSB1bmRlZmluZWQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICBhZGROUyhjaGlsZHJlbltpXS5kYXRhLCBjaGlsZHJlbltpXS5jaGlsZHJlbik7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaChzZWwsIGIsIGMpIHtcbiAgdmFyIGRhdGEgPSB7fSwgY2hpbGRyZW4sIHRleHQsIGk7XG4gIGlmIChjICE9PSB1bmRlZmluZWQpIHtcbiAgICBkYXRhID0gYjtcbiAgICBpZiAoaXMuYXJyYXkoYykpIHsgY2hpbGRyZW4gPSBjOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGMpKSB7IHRleHQgPSBjOyB9XG4gIH0gZWxzZSBpZiAoYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGlzLmFycmF5KGIpKSB7IGNoaWxkcmVuID0gYjsgfVxuICAgIGVsc2UgaWYgKGlzLnByaW1pdGl2ZShiKSkgeyB0ZXh0ID0gYjsgfVxuICAgIGVsc2UgeyBkYXRhID0gYjsgfVxuICB9XG4gIGlmIChpcy5hcnJheShjaGlsZHJlbikpIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGlmIChpcy5wcmltaXRpdmUoY2hpbGRyZW5baV0pKSBjaGlsZHJlbltpXSA9IFZOb2RlKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNoaWxkcmVuW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKHNlbFswXSA9PT0gJ3MnICYmIHNlbFsxXSA9PT0gJ3YnICYmIHNlbFsyXSA9PT0gJ2cnKSB7XG4gICAgYWRkTlMoZGF0YSwgY2hpbGRyZW4pO1xuICB9XG4gIHJldHVybiBWTm9kZShzZWwsIGRhdGEsIGNoaWxkcmVuLCB0ZXh0LCB1bmRlZmluZWQpO1xufTtcbiIsImZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSl7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlVVJJLCBxdWFsaWZpZWROYW1lKXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUZXh0Tm9kZSh0ZXh0KXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpO1xufVxuXG5cbmZ1bmN0aW9uIGluc2VydEJlZm9yZShwYXJlbnROb2RlLCBuZXdOb2RlLCByZWZlcmVuY2VOb2RlKXtcbiAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobmV3Tm9kZSwgcmVmZXJlbmNlTm9kZSk7XG59XG5cblxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGQobm9kZSwgY2hpbGQpe1xuICBub2RlLnJlbW92ZUNoaWxkKGNoaWxkKTtcbn1cblxuZnVuY3Rpb24gYXBwZW5kQ2hpbGQobm9kZSwgY2hpbGQpe1xuICBub2RlLmFwcGVuZENoaWxkKGNoaWxkKTtcbn1cblxuZnVuY3Rpb24gcGFyZW50Tm9kZShub2RlKXtcbiAgcmV0dXJuIG5vZGUucGFyZW50RWxlbWVudDtcbn1cblxuZnVuY3Rpb24gbmV4dFNpYmxpbmcobm9kZSl7XG4gIHJldHVybiBub2RlLm5leHRTaWJsaW5nO1xufVxuXG5mdW5jdGlvbiB0YWdOYW1lKG5vZGUpe1xuICByZXR1cm4gbm9kZS50YWdOYW1lO1xufVxuXG5mdW5jdGlvbiBzZXRUZXh0Q29udGVudChub2RlLCB0ZXh0KXtcbiAgbm9kZS50ZXh0Q29udGVudCA9IHRleHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBjcmVhdGVFbGVtZW50OiBjcmVhdGVFbGVtZW50LFxuICBjcmVhdGVFbGVtZW50TlM6IGNyZWF0ZUVsZW1lbnROUyxcbiAgY3JlYXRlVGV4dE5vZGU6IGNyZWF0ZVRleHROb2RlLFxuICBhcHBlbmRDaGlsZDogYXBwZW5kQ2hpbGQsXG4gIHJlbW92ZUNoaWxkOiByZW1vdmVDaGlsZCxcbiAgaW5zZXJ0QmVmb3JlOiBpbnNlcnRCZWZvcmUsXG4gIHBhcmVudE5vZGU6IHBhcmVudE5vZGUsXG4gIG5leHRTaWJsaW5nOiBuZXh0U2libGluZyxcbiAgdGFnTmFtZTogdGFnTmFtZSxcbiAgc2V0VGV4dENvbnRlbnQ6IHNldFRleHRDb250ZW50XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFycmF5OiBBcnJheS5pc0FycmF5LFxuICBwcmltaXRpdmU6IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHR5cGVvZiBzID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgcyA9PT0gJ251bWJlcic7IH0sXG59O1xuIiwiZnVuY3Rpb24gdXBkYXRlQ2xhc3Mob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBjdXIsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZENsYXNzID0gb2xkVm5vZGUuZGF0YS5jbGFzcyB8fCB7fSxcbiAgICAgIGtsYXNzID0gdm5vZGUuZGF0YS5jbGFzcyB8fCB7fTtcbiAgZm9yIChuYW1lIGluIG9sZENsYXNzKSB7XG4gICAgaWYgKCFrbGFzc1tuYW1lXSkge1xuICAgICAgZWxtLmNsYXNzTGlzdC5yZW1vdmUobmFtZSk7XG4gICAgfVxuICB9XG4gIGZvciAobmFtZSBpbiBrbGFzcykge1xuICAgIGN1ciA9IGtsYXNzW25hbWVdO1xuICAgIGlmIChjdXIgIT09IG9sZENsYXNzW25hbWVdKSB7XG4gICAgICBlbG0uY2xhc3NMaXN0W2N1ciA/ICdhZGQnIDogJ3JlbW92ZSddKG5hbWUpO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZUNsYXNzLCB1cGRhdGU6IHVwZGF0ZUNsYXNzfTtcbiIsInZhciBpcyA9IHJlcXVpcmUoJy4uL2lzJyk7XG5cbmZ1bmN0aW9uIGFyckludm9rZXIoYXJyKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHJldHVybjtcbiAgICAvLyBTcGVjaWFsIGNhc2Ugd2hlbiBsZW5ndGggaXMgdHdvLCBmb3IgcGVyZm9ybWFuY2VcbiAgICBhcnIubGVuZ3RoID09PSAyID8gYXJyWzBdKGFyclsxXSkgOiBhcnJbMF0uYXBwbHkodW5kZWZpbmVkLCBhcnIuc2xpY2UoMSkpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBmbkludm9rZXIobykge1xuICByZXR1cm4gZnVuY3Rpb24oZXYpIHsgXG4gICAgaWYgKG8uZm4gPT09IG51bGwpIHJldHVybjtcbiAgICBvLmZuKGV2KTsgXG4gIH07XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgbmFtZSwgY3VyLCBvbGQsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZE9uID0gb2xkVm5vZGUuZGF0YS5vbiB8fCB7fSwgb24gPSB2bm9kZS5kYXRhLm9uO1xuICBpZiAoIW9uKSByZXR1cm47XG4gIGZvciAobmFtZSBpbiBvbikge1xuICAgIGN1ciA9IG9uW25hbWVdO1xuICAgIG9sZCA9IG9sZE9uW25hbWVdO1xuICAgIGlmIChvbGQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGlzLmFycmF5KGN1cikpIHtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgYXJySW52b2tlcihjdXIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN1ciA9IHtmbjogY3VyfTtcbiAgICAgICAgb25bbmFtZV0gPSBjdXI7XG4gICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGZuSW52b2tlcihjdXIpKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzLmFycmF5KG9sZCkpIHtcbiAgICAgIC8vIERlbGliZXJhdGVseSBtb2RpZnkgb2xkIGFycmF5IHNpbmNlIGl0J3MgY2FwdHVyZWQgaW4gY2xvc3VyZSBjcmVhdGVkIHdpdGggYGFyckludm9rZXJgXG4gICAgICBvbGQubGVuZ3RoID0gY3VyLmxlbmd0aDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgKytpKSBvbGRbaV0gPSBjdXJbaV07XG4gICAgICBvbltuYW1lXSAgPSBvbGQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZC5mbiA9IGN1cjtcbiAgICAgIG9uW25hbWVdID0gb2xkO1xuICAgIH1cbiAgfVxuICBpZiAob2xkT24pIHtcbiAgICBmb3IgKG5hbWUgaW4gb2xkT24pIHtcbiAgICAgIGlmIChvbltuYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZhciBvbGQgPSBvbGRPbltuYW1lXTtcbiAgICAgICAgaWYgKGlzLmFycmF5KG9sZCkpIHtcbiAgICAgICAgICBvbGQubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBvbGQuZm4gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnMsIHVwZGF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnN9O1xuIiwiZnVuY3Rpb24gdXBkYXRlUHJvcHMob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBrZXksIGN1ciwgb2xkLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRQcm9wcyA9IG9sZFZub2RlLmRhdGEucHJvcHMgfHwge30sIHByb3BzID0gdm5vZGUuZGF0YS5wcm9wcyB8fCB7fTtcbiAgZm9yIChrZXkgaW4gb2xkUHJvcHMpIHtcbiAgICBpZiAoIXByb3BzW2tleV0pIHtcbiAgICAgIGRlbGV0ZSBlbG1ba2V5XTtcbiAgICB9XG4gIH1cbiAgZm9yIChrZXkgaW4gcHJvcHMpIHtcbiAgICBjdXIgPSBwcm9wc1trZXldO1xuICAgIG9sZCA9IG9sZFByb3BzW2tleV07XG4gICAgaWYgKG9sZCAhPT0gY3VyICYmIChrZXkgIT09ICd2YWx1ZScgfHwgZWxtW2tleV0gIT09IGN1cikpIHtcbiAgICAgIGVsbVtrZXldID0gY3VyO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZVByb3BzLCB1cGRhdGU6IHVwZGF0ZVByb3BzfTtcbiIsInZhciByYWYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSkgfHwgc2V0VGltZW91dDtcbnZhciBuZXh0RnJhbWUgPSBmdW5jdGlvbihmbikgeyByYWYoZnVuY3Rpb24oKSB7IHJhZihmbik7IH0pOyB9O1xuXG5mdW5jdGlvbiBzZXROZXh0RnJhbWUob2JqLCBwcm9wLCB2YWwpIHtcbiAgbmV4dEZyYW1lKGZ1bmN0aW9uKCkgeyBvYmpbcHJvcF0gPSB2YWw7IH0pO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTdHlsZShvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGN1ciwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkU3R5bGUgPSBvbGRWbm9kZS5kYXRhLnN0eWxlIHx8IHt9LFxuICAgICAgc3R5bGUgPSB2bm9kZS5kYXRhLnN0eWxlIHx8IHt9LFxuICAgICAgb2xkSGFzRGVsID0gJ2RlbGF5ZWQnIGluIG9sZFN0eWxlO1xuICBmb3IgKG5hbWUgaW4gb2xkU3R5bGUpIHtcbiAgICBpZiAoIXN0eWxlW25hbWVdKSB7XG4gICAgICBlbG0uc3R5bGVbbmFtZV0gPSAnJztcbiAgICB9XG4gIH1cbiAgZm9yIChuYW1lIGluIHN0eWxlKSB7XG4gICAgY3VyID0gc3R5bGVbbmFtZV07XG4gICAgaWYgKG5hbWUgPT09ICdkZWxheWVkJykge1xuICAgICAgZm9yIChuYW1lIGluIHN0eWxlLmRlbGF5ZWQpIHtcbiAgICAgICAgY3VyID0gc3R5bGUuZGVsYXllZFtuYW1lXTtcbiAgICAgICAgaWYgKCFvbGRIYXNEZWwgfHwgY3VyICE9PSBvbGRTdHlsZS5kZWxheWVkW25hbWVdKSB7XG4gICAgICAgICAgc2V0TmV4dEZyYW1lKGVsbS5zdHlsZSwgbmFtZSwgY3VyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmFtZSAhPT0gJ3JlbW92ZScgJiYgY3VyICE9PSBvbGRTdHlsZVtuYW1lXSkge1xuICAgICAgZWxtLnN0eWxlW25hbWVdID0gY3VyO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseURlc3Ryb3lTdHlsZSh2bm9kZSkge1xuICB2YXIgc3R5bGUsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSwgcyA9IHZub2RlLmRhdGEuc3R5bGU7XG4gIGlmICghcyB8fCAhKHN0eWxlID0gcy5kZXN0cm95KSkgcmV0dXJuO1xuICBmb3IgKG5hbWUgaW4gc3R5bGUpIHtcbiAgICBlbG0uc3R5bGVbbmFtZV0gPSBzdHlsZVtuYW1lXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseVJlbW92ZVN0eWxlKHZub2RlLCBybSkge1xuICB2YXIgcyA9IHZub2RlLmRhdGEuc3R5bGU7XG4gIGlmICghcyB8fCAhcy5yZW1vdmUpIHtcbiAgICBybSgpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSwgZWxtID0gdm5vZGUuZWxtLCBpZHgsIGkgPSAwLCBtYXhEdXIgPSAwLFxuICAgICAgY29tcFN0eWxlLCBzdHlsZSA9IHMucmVtb3ZlLCBhbW91bnQgPSAwLCBhcHBsaWVkID0gW107XG4gIGZvciAobmFtZSBpbiBzdHlsZSkge1xuICAgIGFwcGxpZWQucHVzaChuYW1lKTtcbiAgICBlbG0uc3R5bGVbbmFtZV0gPSBzdHlsZVtuYW1lXTtcbiAgfVxuICBjb21wU3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGVsbSk7XG4gIHZhciBwcm9wcyA9IGNvbXBTdHlsZVsndHJhbnNpdGlvbi1wcm9wZXJ0eSddLnNwbGl0KCcsICcpO1xuICBmb3IgKDsgaSA8IHByb3BzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYoYXBwbGllZC5pbmRleE9mKHByb3BzW2ldKSAhPT0gLTEpIGFtb3VudCsrO1xuICB9XG4gIGVsbS5hZGRFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJywgZnVuY3Rpb24oZXYpIHtcbiAgICBpZiAoZXYudGFyZ2V0ID09PSBlbG0pIC0tYW1vdW50O1xuICAgIGlmIChhbW91bnQgPT09IDApIHJtKCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZVN0eWxlLCB1cGRhdGU6IHVwZGF0ZVN0eWxlLCBkZXN0cm95OiBhcHBseURlc3Ryb3lTdHlsZSwgcmVtb3ZlOiBhcHBseVJlbW92ZVN0eWxlfTtcbiIsIi8vIGpzaGludCBuZXdjYXA6IGZhbHNlXG4vKiBnbG9iYWwgcmVxdWlyZSwgbW9kdWxlLCBkb2N1bWVudCwgTm9kZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG52YXIgZG9tQXBpID0gcmVxdWlyZSgnLi9odG1sZG9tYXBpJyk7XG5cbmZ1bmN0aW9uIGlzVW5kZWYocykgeyByZXR1cm4gcyA9PT0gdW5kZWZpbmVkOyB9XG5mdW5jdGlvbiBpc0RlZihzKSB7IHJldHVybiBzICE9PSB1bmRlZmluZWQ7IH1cblxudmFyIGVtcHR5Tm9kZSA9IFZOb2RlKCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblxuZnVuY3Rpb24gc2FtZVZub2RlKHZub2RlMSwgdm5vZGUyKSB7XG4gIHJldHVybiB2bm9kZTEua2V5ID09PSB2bm9kZTIua2V5ICYmIHZub2RlMS5zZWwgPT09IHZub2RlMi5zZWw7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUtleVRvT2xkSWR4KGNoaWxkcmVuLCBiZWdpbklkeCwgZW5kSWR4KSB7XG4gIHZhciBpLCBtYXAgPSB7fSwga2V5O1xuICBmb3IgKGkgPSBiZWdpbklkeDsgaSA8PSBlbmRJZHg7ICsraSkge1xuICAgIGtleSA9IGNoaWxkcmVuW2ldLmtleTtcbiAgICBpZiAoaXNEZWYoa2V5KSkgbWFwW2tleV0gPSBpO1xuICB9XG4gIHJldHVybiBtYXA7XG59XG5cbnZhciBob29rcyA9IFsnY3JlYXRlJywgJ3VwZGF0ZScsICdyZW1vdmUnLCAnZGVzdHJveScsICdwcmUnLCAncG9zdCddO1xuXG5mdW5jdGlvbiBpbml0KG1vZHVsZXMsIGFwaSkge1xuICB2YXIgaSwgaiwgY2JzID0ge307XG5cbiAgaWYgKGlzVW5kZWYoYXBpKSkgYXBpID0gZG9tQXBpO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBob29rcy5sZW5ndGg7ICsraSkge1xuICAgIGNic1tob29rc1tpXV0gPSBbXTtcbiAgICBmb3IgKGogPSAwOyBqIDwgbW9kdWxlcy5sZW5ndGg7ICsraikge1xuICAgICAgaWYgKG1vZHVsZXNbal1baG9va3NbaV1dICE9PSB1bmRlZmluZWQpIGNic1tob29rc1tpXV0ucHVzaChtb2R1bGVzW2pdW2hvb2tzW2ldXSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW1wdHlOb2RlQXQoZWxtKSB7XG4gICAgcmV0dXJuIFZOb2RlKGFwaS50YWdOYW1lKGVsbSkudG9Mb3dlckNhc2UoKSwge30sIFtdLCB1bmRlZmluZWQsIGVsbSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVSbUNiKGNoaWxkRWxtLCBsaXN0ZW5lcnMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS1saXN0ZW5lcnMgPT09IDApIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGFwaS5wYXJlbnROb2RlKGNoaWxkRWxtKTtcbiAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudCwgY2hpbGRFbG0pO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBpLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICBpZiAoaXNEZWYoZGF0YSkpIHtcbiAgICAgIGlmIChpc0RlZihpID0gZGF0YS5ob29rKSAmJiBpc0RlZihpID0gaS5pbml0KSkge1xuICAgICAgICBpKHZub2RlKTtcbiAgICAgICAgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBlbG0sIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4sIHNlbCA9IHZub2RlLnNlbDtcbiAgICBpZiAoaXNEZWYoc2VsKSkge1xuICAgICAgLy8gUGFyc2Ugc2VsZWN0b3JcbiAgICAgIHZhciBoYXNoSWR4ID0gc2VsLmluZGV4T2YoJyMnKTtcbiAgICAgIHZhciBkb3RJZHggPSBzZWwuaW5kZXhPZignLicsIGhhc2hJZHgpO1xuICAgICAgdmFyIGhhc2ggPSBoYXNoSWR4ID4gMCA/IGhhc2hJZHggOiBzZWwubGVuZ3RoO1xuICAgICAgdmFyIGRvdCA9IGRvdElkeCA+IDAgPyBkb3RJZHggOiBzZWwubGVuZ3RoO1xuICAgICAgdmFyIHRhZyA9IGhhc2hJZHggIT09IC0xIHx8IGRvdElkeCAhPT0gLTEgPyBzZWwuc2xpY2UoMCwgTWF0aC5taW4oaGFzaCwgZG90KSkgOiBzZWw7XG4gICAgICBlbG0gPSB2bm9kZS5lbG0gPSBpc0RlZihkYXRhKSAmJiBpc0RlZihpID0gZGF0YS5ucykgPyBhcGkuY3JlYXRlRWxlbWVudE5TKGksIHRhZylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGFwaS5jcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgICBpZiAoaGFzaCA8IGRvdCkgZWxtLmlkID0gc2VsLnNsaWNlKGhhc2ggKyAxLCBkb3QpO1xuICAgICAgaWYgKGRvdElkeCA+IDApIGVsbS5jbGFzc05hbWUgPSBzZWwuc2xpY2UoZG90KzEpLnJlcGxhY2UoL1xcLi9nLCAnICcpO1xuICAgICAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBjcmVhdGVFbG0oY2hpbGRyZW5baV0sIGluc2VydGVkVm5vZGVRdWV1ZSkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzLnByaW1pdGl2ZSh2bm9kZS50ZXh0KSkge1xuICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCkpO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5jcmVhdGUubGVuZ3RoOyArK2kpIGNicy5jcmVhdGVbaV0oZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICBpID0gdm5vZGUuZGF0YS5ob29rOyAvLyBSZXVzZSB2YXJpYWJsZVxuICAgICAgaWYgKGlzRGVmKGkpKSB7XG4gICAgICAgIGlmIChpLmNyZWF0ZSkgaS5jcmVhdGUoZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICAgIGlmIChpLmluc2VydCkgaW5zZXJ0ZWRWbm9kZVF1ZXVlLnB1c2godm5vZGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSB2bm9kZS5lbG0gPSBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCk7XG4gICAgfVxuICAgIHJldHVybiB2bm9kZS5lbG07XG4gIH1cblxuICBmdW5jdGlvbiBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIHZub2Rlcywgc3RhcnRJZHgsIGVuZElkeCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgZm9yICg7IHN0YXJ0SWR4IDw9IGVuZElkeDsgKytzdGFydElkeCkge1xuICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGNyZWF0ZUVsbSh2bm9kZXNbc3RhcnRJZHhdLCBpbnNlcnRlZFZub2RlUXVldWUpLCBiZWZvcmUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGludm9rZURlc3Ryb3lIb29rKHZub2RlKSB7XG4gICAgdmFyIGksIGosIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIGlmIChpc0RlZihkYXRhKSkge1xuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmRlc3Ryb3kpKSBpKHZub2RlKTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMuZGVzdHJveS5sZW5ndGg7ICsraSkgY2JzLmRlc3Ryb3lbaV0odm5vZGUpO1xuICAgICAgaWYgKGlzRGVmKGkgPSB2bm9kZS5jaGlsZHJlbikpIHtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IHZub2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgaW52b2tlRGVzdHJveUhvb2sodm5vZGUuY2hpbGRyZW5bal0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4KSB7XG4gICAgZm9yICg7IHN0YXJ0SWR4IDw9IGVuZElkeDsgKytzdGFydElkeCkge1xuICAgICAgdmFyIGksIGxpc3RlbmVycywgcm0sIGNoID0gdm5vZGVzW3N0YXJ0SWR4XTtcbiAgICAgIGlmIChpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKGlzRGVmKGNoLnNlbCkpIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayhjaCk7XG4gICAgICAgICAgbGlzdGVuZXJzID0gY2JzLnJlbW92ZS5sZW5ndGggKyAxO1xuICAgICAgICAgIHJtID0gY3JlYXRlUm1DYihjaC5lbG0sIGxpc3RlbmVycyk7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5yZW1vdmUubGVuZ3RoOyArK2kpIGNicy5yZW1vdmVbaV0oY2gsIHJtKTtcbiAgICAgICAgICBpZiAoaXNEZWYoaSA9IGNoLmRhdGEpICYmIGlzRGVmKGkgPSBpLmhvb2spICYmIGlzRGVmKGkgPSBpLnJlbW92ZSkpIHtcbiAgICAgICAgICAgIGkoY2gsIHJtKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm0oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7IC8vIFRleHQgbm9kZVxuICAgICAgICAgIGFwaS5yZW1vdmVDaGlsZChwYXJlbnRFbG0sIGNoLmVsbSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVDaGlsZHJlbihwYXJlbnRFbG0sIG9sZENoLCBuZXdDaCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIG9sZFN0YXJ0SWR4ID0gMCwgbmV3U3RhcnRJZHggPSAwO1xuICAgIHZhciBvbGRFbmRJZHggPSBvbGRDaC5sZW5ndGggLSAxO1xuICAgIHZhciBvbGRTdGFydFZub2RlID0gb2xkQ2hbMF07XG4gICAgdmFyIG9sZEVuZFZub2RlID0gb2xkQ2hbb2xkRW5kSWR4XTtcbiAgICB2YXIgbmV3RW5kSWR4ID0gbmV3Q2gubGVuZ3RoIC0gMTtcbiAgICB2YXIgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWzBdO1xuICAgIHZhciBuZXdFbmRWbm9kZSA9IG5ld0NoW25ld0VuZElkeF07XG4gICAgdmFyIG9sZEtleVRvSWR4LCBpZHhJbk9sZCwgZWxtVG9Nb3ZlLCBiZWZvcmU7XG5cbiAgICB3aGlsZSAob2xkU3RhcnRJZHggPD0gb2xkRW5kSWR4ICYmIG5ld1N0YXJ0SWR4IDw9IG5ld0VuZElkeCkge1xuICAgICAgaWYgKGlzVW5kZWYob2xkU3RhcnRWbm9kZSkpIHtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdOyAvLyBWbm9kZSBoYXMgYmVlbiBtb3ZlZCBsZWZ0XG4gICAgICB9IGVsc2UgaWYgKGlzVW5kZWYob2xkRW5kVm5vZGUpKSB7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3U3RhcnRWbm9kZSkpIHtcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07XG4gICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdFbmRWbm9kZSkpIHtcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRFbmRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICBuZXdFbmRWbm9kZSA9IG5ld0NoWy0tbmV3RW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlKSkgeyAvLyBWbm9kZSBtb3ZlZCByaWdodFxuICAgICAgICBwYXRjaFZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgb2xkU3RhcnRWbm9kZS5lbG0sIGFwaS5uZXh0U2libGluZyhvbGRFbmRWbm9kZS5lbG0pKTtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICBuZXdFbmRWbm9kZSA9IG5ld0NoWy0tbmV3RW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlKSkgeyAvLyBWbm9kZSBtb3ZlZCBsZWZ0XG4gICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBvbGRFbmRWbm9kZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc1VuZGVmKG9sZEtleVRvSWR4KSkgb2xkS2V5VG9JZHggPSBjcmVhdGVLZXlUb09sZElkeChvbGRDaCwgb2xkU3RhcnRJZHgsIG9sZEVuZElkeCk7XG4gICAgICAgIGlkeEluT2xkID0gb2xkS2V5VG9JZHhbbmV3U3RhcnRWbm9kZS5rZXldO1xuICAgICAgICBpZiAoaXNVbmRlZihpZHhJbk9sZCkpIHsgLy8gTmV3IGVsZW1lbnRcbiAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSksIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWxtVG9Nb3ZlID0gb2xkQ2hbaWR4SW5PbGRdO1xuICAgICAgICAgIHBhdGNoVm5vZGUoZWxtVG9Nb3ZlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgIG9sZENoW2lkeEluT2xkXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtVG9Nb3ZlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAob2xkU3RhcnRJZHggPiBvbGRFbmRJZHgpIHtcbiAgICAgIGJlZm9yZSA9IGlzVW5kZWYobmV3Q2hbbmV3RW5kSWR4KzFdKSA/IG51bGwgOiBuZXdDaFtuZXdFbmRJZHgrMV0uZWxtO1xuICAgICAgYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCBuZXdDaCwgbmV3U3RhcnRJZHgsIG5ld0VuZElkeCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICB9IGVsc2UgaWYgKG5ld1N0YXJ0SWR4ID4gbmV3RW5kSWR4KSB7XG4gICAgICByZW1vdmVWbm9kZXMocGFyZW50RWxtLCBvbGRDaCwgb2xkU3RhcnRJZHgsIG9sZEVuZElkeCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGF0Y2hWbm9kZShvbGRWbm9kZSwgdm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBpLCBob29rO1xuICAgIGlmIChpc0RlZihpID0gdm5vZGUuZGF0YSkgJiYgaXNEZWYoaG9vayA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucHJlcGF0Y2gpKSB7XG4gICAgICBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgfVxuICAgIHZhciBlbG0gPSB2bm9kZS5lbG0gPSBvbGRWbm9kZS5lbG0sIG9sZENoID0gb2xkVm5vZGUuY2hpbGRyZW4sIGNoID0gdm5vZGUuY2hpbGRyZW47XG4gICAgaWYgKG9sZFZub2RlID09PSB2bm9kZSkgcmV0dXJuO1xuICAgIGlmICghc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHZhciBwYXJlbnRFbG0gPSBhcGkucGFyZW50Tm9kZShvbGRWbm9kZS5lbG0pO1xuICAgICAgZWxtID0gY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbSwgb2xkVm5vZGUuZWxtKTtcbiAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIFtvbGRWbm9kZV0sIDAsIDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaXNEZWYodm5vZGUuZGF0YSkpIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMudXBkYXRlLmxlbmd0aDsgKytpKSBjYnMudXBkYXRlW2ldKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICBpID0gdm5vZGUuZGF0YS5ob29rO1xuICAgICAgaWYgKGlzRGVmKGkpICYmIGlzRGVmKGkgPSBpLnVwZGF0ZSkpIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gICAgaWYgKGlzVW5kZWYodm5vZGUudGV4dCkpIHtcbiAgICAgIGlmIChpc0RlZihvbGRDaCkgJiYgaXNEZWYoY2gpKSB7XG4gICAgICAgIGlmIChvbGRDaCAhPT0gY2gpIHVwZGF0ZUNoaWxkcmVuKGVsbSwgb2xkQ2gsIGNoLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICAgIGFkZFZub2RlcyhlbG0sIG51bGwsIGNoLCAwLCBjaC5sZW5ndGggLSAxLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihvbGRDaCkpIHtcbiAgICAgICAgcmVtb3ZlVm5vZGVzKGVsbSwgb2xkQ2gsIDAsIG9sZENoLmxlbmd0aCAtIDEpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihvbGRWbm9kZS50ZXh0KSkge1xuICAgICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvbGRWbm9kZS50ZXh0ICE9PSB2bm9kZS50ZXh0KSB7XG4gICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCB2bm9kZS50ZXh0KTtcbiAgICB9XG4gICAgaWYgKGlzRGVmKGhvb2spICYmIGlzRGVmKGkgPSBob29rLnBvc3RwYXRjaCkpIHtcbiAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24ob2xkVm5vZGUsIHZub2RlKSB7XG4gICAgdmFyIGksIGVsbSwgcGFyZW50O1xuICAgIHZhciBpbnNlcnRlZFZub2RlUXVldWUgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnByZS5sZW5ndGg7ICsraSkgY2JzLnByZVtpXSgpO1xuXG4gICAgaWYgKGlzVW5kZWYob2xkVm5vZGUuc2VsKSkge1xuICAgICAgb2xkVm5vZGUgPSBlbXB0eU5vZGVBdChvbGRWbm9kZSk7XG4gICAgfVxuXG4gICAgaWYgKHNhbWVWbm9kZShvbGRWbm9kZSwgdm5vZGUpKSB7XG4gICAgICBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWxtID0gb2xkVm5vZGUuZWxtO1xuICAgICAgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoZWxtKTtcblxuICAgICAgY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuXG4gICAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50LCB2bm9kZS5lbG0sIGFwaS5uZXh0U2libGluZyhlbG0pKTtcbiAgICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudCwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGluc2VydGVkVm5vZGVRdWV1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgaW5zZXJ0ZWRWbm9kZVF1ZXVlW2ldLmRhdGEuaG9vay5pbnNlcnQoaW5zZXJ0ZWRWbm9kZVF1ZXVlW2ldKTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGNicy5wb3N0Lmxlbmd0aDsgKytpKSBjYnMucG9zdFtpXSgpO1xuICAgIHJldHVybiB2bm9kZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7aW5pdDogaW5pdH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIGVsbSkge1xuICB2YXIga2V5ID0gZGF0YSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZGF0YS5rZXk7XG4gIHJldHVybiB7c2VsOiBzZWwsIGRhdGE6IGRhdGEsIGNoaWxkcmVuOiBjaGlsZHJlbixcbiAgICAgICAgICB0ZXh0OiB0ZXh0LCBlbG06IGVsbSwga2V5OiBrZXl9O1xufTtcbiIsImNvbnN0IGNhbGxiYWNrcyA9ICh7ICRhY3RpdmF0ZUJ0biB9KSA9PiAoY2hhbm5lbCkgPT4ge1xuICBjb25zdCB7IEVpdGhlciB9ID0gcmVxdWlyZSgnZnAtbGliJylcbiAgXG4gIHJldHVybiB7XG4gICAgJ3N0YXJ0JzogKCkgPT4ge1xuICAgICAgJGFjdGl2YXRlQnRuLmRpc2FibGVkID0gdHJ1ZVxuICAgICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ0xpc3RlbmluZydcbiAgICB9LFxuICAgICdyZXN1bHQnOiAocmVzdWx0KSA9PiB7XG4gICAgICAvL2NvbnNvbGUubG9nKHJlc3VsdClcbiAgICB9LFxuICAgICdyZXN1bHRNYXRjaCc6IChyZXN1bHQpID0+IHtcbiAgICAgIC8vY29uc29sZS5sb2cocmVzdWx0KVxuICAgIH0sXG4gICAgJ3Jlc3VsdE5vTWF0Y2gnOiAocmVzdWx0KSA9PiB7XG4gICAgICBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYE5vIGNvbW1hbmQgbWF0Y2hlcyBmb3IgJHtyZXN1bHRbMF19YCkpXG4gICAgfSxcbiAgICAnZW5kJzogKCkgPT4ge1xuICAgICAgJGFjdGl2YXRlQnRuLmRpc2FibGVkID0gZmFsc2VcbiAgICAgICRhY3RpdmF0ZUJ0bi50ZXh0Q29udGVudCA9ICdTdGFydCdcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsYmFja3MiLCJjb25zdCBjb21tYW5kcyA9IChob3Jpem9uKSA9PiAobWFudWFsQ29tbWFuZEVudHJ5KSA9PiAoY2hhbm5lbCkgPT4ge1xuICBjb25zdCBmdXp6eXNldCA9IHJlcXVpcmUoJ2Z1enp5c2V0LmpzJylcbiAgY29uc3QgaCA9IHJlcXVpcmUoJ3NuYWJiZG9tL2gnKVxuICBjb25zdCB7IEVpdGhlciwgcGx1Y2sgfSA9IHJlcXVpcmUoJ2ZwLWxpYicpXG4gIFxuICBjb25zdCBsZXR0ZXJzID0gaG9yaXpvbignbGV0dGVycycpXG4gIGNvbnN0IGNsaWVudHMgPSBob3Jpem9uKCdjbGllbnRzJylcbiAgXG4gIGxldCBmdXp6eV9jbGllbnRzID0gZnV6enlzZXQoW10pXG4gIGxldCBmdXp6eV9hZGRyZXNzZXMgPSBmdXp6eXNldChbXSlcbiAgXG4gIGNsaWVudHMud2F0Y2goKS5zdWJzY3JpYmUoXG4gICAgKHJlcykgPT4geyBcbiAgICAgIGlmIChyZXMubGVuZ3RoID09PSAwKSB7fSBcbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygncmVjZWl2ZWQgdXBkYXRlJywgcmVzKVxuICAgICAgICBjb25zb2xlLmxvZyhwbHVjaygnbmFtZScpKHJlcykpXG4gICAgICAgIGZ1enp5X2NsaWVudHMgPSBmdXp6eXNldChwbHVjaygnbmFtZScpKHJlcyksIGZhbHNlLCAxKVxuICAgICAgICAvL2Z1enp5X2FkZHJlc3NlcyA9IGZ1enp5c2V0KHBsdWNrKCdhZGRyZXNzJykocmVzKSlcbiAgICAgIH1cbiAgICB9LFxuICAgIChlcnIpID0+IGNvbnNvbGUuZXJyb3IoYGNsaWVudHMud2F0Y2goKTogJHtlcnJ9YCkpXG4gIFxuICBjb25zdCBfY29tbWFuZHMgPSB7XG4gICAgJ2NsaWVudCAqbmFtZSc6IChuYW1lKSA9PiB7XG4gICAgICBjb25zdCByZXMgPSBmdXp6eV9jbGllbnRzLmdldChuYW1lKVxuXG4gICAgICBpZiAocmVzICE9PSBudWxsKSB7XG4gICAgICAgIGNoYW5uZWwucHVzaChFaXRoZXIuUmlnaHQoYGZ1enp5IGNsaWVudCBmb3VuZCAke3Jlc31gKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoYW5uZWwucHVzaChFaXRoZXIuTGVmdChgY2xpZW50ICR7bmFtZX0gbm90IGZvdW5kIGJ5IGZ1enp5YCkpXG4gICAgICB9XG4gICAgfSxcbiAgICAnbmV3IGNsaWVudCc6ICgpID0+IHtcbiAgICAgIGNvbnN0IG5hbWUgPSB3aW5kb3cucHJvbXB0KGBFbnRlciBuZXcgY2xpZW50IG5hbWVgKVxuICAgICAgXG4gICAgICBpZiAoZnV6enlfY2xpZW50cy52YWx1ZXMoKS5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYEVycm9yIG5ldyBjbGllbnQgJHtuYW1lfSAtLSB0aGF0IG5hbWUgYWxyZWFkeSBleGlzdHNgKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNsaWVudHMuc3RvcmUoeyBuYW1lIH0pLnN1YnNjcmliZShcbiAgICAgICAgICAocmVzKSA9PiBjaGFubmVsLnB1c2goRWl0aGVyLlJpZ2h0KGBDcmVhdGVkIG5ldyBjbGllbnQgJHtuYW1lfWApKSxcbiAgICAgICAgICAoZXJyKSA9PiBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYEVycm9yIG5ldyBjbGllbnQgJHtuYW1lfSAtLSAke2Vycn1gKSkpXG4gICAgICB9XG4gICAgfSxcbiAgICBbYHdoYXQncyBuZWFyYnlgXTogKCkgPT4ge30sXG4gICAgJ2NsaWVudCBhZGRyZXNzICphZGRyJzogKGFkZHIpID0+IHtcbiAgICAgICAgICAgIFxuICAgIH0sXG4gICAgJ2luY3JlYXNlIDpsZXR0ZXInOiAobGV0dGVyKSA9PiB7XG4gICAgICBsZXR0ZXJzLmZpbmQobGV0dGVyLnRvTG93ZXJDYXNlKCkpLmZldGNoKCkuZGVmYXVsdElmRW1wdHkoKS5zdWJzY3JpYmUoXG4gICAgICAgIChyZXMpID0+IHtcbiAgICAgICAgICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYGNhbm5vdCBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tIGl0IGRvZXMgbm90IGV4aXN0YCkpIFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXR0ZXJzLnJlcGxhY2UoeyBpZDogbGV0dGVyLCBjb3VudDogcmVzLmNvdW50ICsgMSB9KS5zdWJzY3JpYmUoXG4gICAgICAgICAgICAgIChpZCkgPT4geyBcbiAgICAgICAgICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLlJpZ2h0KGBpbmNyZWFzZWQgbGV0dGVyICR7bGV0dGVyfSB0byAke3Jlcy5jb3VudH1gKSkgXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgY2hhbm5lbC5wdXNoKEVpdGhlci5MZWZ0KGBFcnJvciBvbiByZXBsYWNlOiBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tICR7ZXJyfSBgKSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSAgXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAoZXJyKSA9PiB7XG4gICAgICAgICAgY2hhbm5lbC5wdXNoKEVpdGhlci5MZWZ0KGBFcnJvciBvbiBmaW5kOiBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tICR7ZXJyfWApKSBcbiAgICAgICAgfVxuICAgICAgKVxuICAgIH0sXG4gICAgJ3Nob3cgY29tbWFuZHMnOiAoKSA9PiB7XG4gICAgICBjb25zdCBzdGF0ZSA9IChuYW1lcykgPT4ge1xuICAgICAgICByZXR1cm4gW25hbWVzLm1hcChuYW1lID0+IHtcbiAgICAgICAgICByZXR1cm4gaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogW21hbnVhbENvbW1hbmRFbnRyeSwgbmFtZV0gfSB9LCBuYW1lKVxuICAgICAgICB9KV1cbiAgICAgIH1cbiAgICAgIGNoYW5uZWwucHVzaChFaXRoZXIuUmlnaHQoc3RhdGUoUmVmbGVjdC5vd25LZXlzKF9jb21tYW5kcykpKSlcbiAgICB9XG4gIH1cbiAgLypcbiAgY29uc3Qgd3JhcHBlciA9IChmKSA9PiAoLi4uYXJncykgPT4ge1xuICAgIGNoYW5uZWwucHVzaChmKC4uLmFyZ3MpKVxuICB9XG4gIFxuICBmb3IgKGxldCBuYW1lIG9mIE9iamVjdC5rZXlzKF9jb21tYW5kcykpIHtcbiAgICBfY29tbWFuZHNbbmFtZV0gPSB3cmFwcGVyKF9jb21tYW5kc1tuYW1lXSlcbiAgfVxuICAqL1xuICByZXR1cm4gX2NvbW1hbmRzXG59IFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbW1hbmRzIiwiY29uc3QgZG9tX2V2ZW50cyA9ICh7ICRhY3RpdmF0ZUJ0biwgJHNob3dDb21tYW5kc0J0biB9KSA9PiAoYW5ueWFuZykgPT4ge1xuICByZXR1cm4ge1xuICAgICdjbGljayc6IFt7XG4gICAgICBlbGVtZW50OiAkYWN0aXZhdGVCdG4sXG4gICAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgICBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlLCBjb250aW51b3VzOiBmYWxzZSB9KVxuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGVsZW1lbnQ6ICRzaG93Q29tbWFuZHNCdG4sXG4gICAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgICBhbm55YW5nLnRyaWdnZXIoJ3Nob3cgY29tbWFuZHMnKVxuICAgICAgfVxuICAgIH1dXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb21fZXZlbnRzIiwiY29uc3QgbWFudWFsQ29tbWFuZEVudHJ5ID0gKGFubnlhbmcpID0+IChjaGFubmVsKSA9PiB7XG4gIGNvbnN0IHsgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuICBjb25zdCBlcnIgPSB7XG4gICAgMDogKGNtZCkgPT4gYENhbid0IGNvbXBsZXRlIFske2NtZH1dLiBNaXNzaW5nIHJlcXVpcmVkIGlucHV0LmAsXG4gICAgMTogKGNtZCwgbGVuKSA9PiBgQ2FuJ3QgY29tcGxldGUgWyR7Y21kfV0uIEl0IHJlcXVpcmVzIGV4YWN0bHkgJHtsZW59IGlucHV0cy5gXG4gIH1cbiAgY29uc3QgcmVneCA9IHtcbiAgICAwOiBuZXcgUmVnRXhwKC8oOlxcdyt8XFwqXFx3KykvLCAnZ2knKSwgLy8gY29tbWFuZCBhcmd1bWVudHNcbiAgICAxOiBuZXcgUmVnRXhwKC8oXFx3KykvLCAnZ2knKSAvLyB3b3Jkc1xuICB9XG4gIGNvbnN0IHByZWQgPSB7XG4gICAgMDogKHgpID0+IHggPT09ICcnLFxuICAgIDE6ICh4LCB5KSA9PiB4Lmxlbmd0aCAhPT0geS5sZW5ndGhcbiAgfSAgXG4gIFxuICAvLzo6IChTdHJpbmcsIFN0cmluZykgLT4gRWl0aGVyIFN0cmluZyBudWxsXG4gIGNvbnN0IGhhc0lucHV0ID0gKHgsIGNtZCkgPT4ge1xuICAgIHJldHVybiAocHJlZFswXSh4KSlcbiAgICAgID8gRWl0aGVyLkxlZnQoZXJyWzBdKGNtZCkpXG4gICAgICA6IEVpdGhlci5SaWdodChudWxsKVxuICB9XG4gIFxuICAvLzo6IChTdHJpbmcsIFN0cmluZykgLT4gRWl0aGVyIFN0cmluZyBudWxsIC0+IEVpdGhlciBTdHJpbmcgU3RyaW5nIFxuICBjb25zdCBoYXNDb3JyZWN0TnVtYmVyT2ZJbnB1dHMgPSAoeCwgY21kKSA9PiAoXykgPT4ge1xuICAgIGNvbnN0IGFyZ3MgPSBjbWQubWF0Y2gocmVneFswXSlcbiAgICBjb25zdCB4cyA9IHgubWF0Y2gocmVneFsxXSlcbiAgICBsZXQgaSA9IDAgIFxuICAgIHJldHVybiAocHJlZFsxXSh4cywgYXJncykpXG4gICAgICA/IEVpdGhlci5MZWZ0KGVyclsxXShjbWQsIGFyZ3MubGVuZ3RoKSlcbiAgICAgIDogRWl0aGVyLlJpZ2h0KGNtZC5yZXBsYWNlKHJlZ3hbMF0sIChtYXRjaCkgPT4geHNbaSsrXSkpXG4gIH1cbiAgXG4gIC8vOjogU3RyaW5nIC0+IEVpdGhlciBTdHJpbmcgU3RyaW5nXG4gIGNvbnN0IGdldFVzZXJJbnB1dCA9IChjbWQpID0+IHtcbiAgICBjb25zdCB4ID0gd2luZG93LnByb21wdChjbWQpXG4gICAgcmV0dXJuIGhhc0lucHV0KHgsIGNtZCkuY2hhaW4oaGFzQ29ycmVjdE51bWJlck9mSW5wdXRzKHgsIGNtZCkpXG4gIH1cbiAgXG4gIC8vOjogU3RyaW5nIC0+IEJvb2xcbiAgY29uc3QgcmVxdWlyZXNBcmd1bWVudHMgPSAoY21kKSA9PiAge1xuICAgIHJldHVybiByZWd4WzBdLnRlc3QoY21kKVxuICB9XG4gIFxuICAvLzo6IFN0cmluZyAtPiBfICBcbiAgcmV0dXJuIChjbWQpID0+IHtcbiAgICBpZiAocmVxdWlyZXNBcmd1bWVudHMoY21kKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZ2V0VXNlcklucHV0KGNtZClcbiAgICAgIFxuICAgICAgRWl0aGVyLmJpbWFwXG4gICAgICAgIChsZWZ0ID0+IHsgY2hhbm5lbC5wdXNoKHJlc3VsdCkgfSlcbiAgICAgICAgKHJpZ2h0ID0+IHsgYW5ueWFuZy50cmlnZ2VyKHJpZ2h0KSB9KVxuICAgICAgICAocmVzdWx0KVxuICAgICAgICBcbiAgICB9IGVsc2Uge1xuICAgICAgYW5ueWFuZy50cmlnZ2VyKGNtZClcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtYW51YWxDb21tYW5kRW50cnkiLCJjb25zdCB7IEVpdGhlciB9ID0gcmVxdWlyZSgnZnAtbGliJylcblxuY29uc3QgU3RhdGVDaGFuZ2UgPSAoU3RhdGUpID0+IChjaGFubmVsKSA9PiAoXykgPT4ge1xuICBjb25zdCBlaXRoZXJfc3RhdGUgPSBjaGFubmVsLnNoaWZ0KClcbiAgXG4gIGlmIChlaXRoZXJfc3RhdGUgIT09IHVuZGVmaW5lZCkgeyBcbiAgICAvLyBwYXNzIGludGVybmFsIGVpdGhlciB2YWx1ZSB0byBTdGF0ZS5jaGFuZ2VcbiAgICBFaXRoZXIuYmltYXBcbiAgICAgIChtc2dzID0+IHsgLy8gY3VycmVudGx5LCBpdCBpcyBzYW1lIGJlaGF2aW9yIGZvciBlcnJvciBzdGF0ZVxuICAgICAgICBTdGF0ZS5jaGFuZ2UoeyBsb2dzOiBtc2dzIH0pIFxuICAgICAgfSlcbiAgICAgIChtc2dzID0+IHsgXG4gICAgICAgIFN0YXRlLmNoYW5nZSh7IGxvZ3M6IG1zZ3MgfSkgXG4gICAgICB9KVxuICAgICAgKGVpdGhlcl9zdGF0ZSkgXG4gIH1cbiAgICBcbiAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShTdGF0ZUNoYW5nZShTdGF0ZSkoY2hhbm5lbCkpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVDaGFuZ2UiLCJjb25zdCBoID0gcmVxdWlyZSgnc25hYmJkb20vaCcpXG5sZXQgX2xvZ3MgPSBbXVxubGV0IF9rZXkgPSAwXG5cbmNvbnN0IG15U3R5bGVzID0ge1xuICBmYWRlSW46IHtcbiAgICBvcGFjaXR5OiAnMCcsIFxuICAgIHRyYW5zaXRpb246ICdvcGFjaXR5IDFzJywgXG4gICAgZGVsYXllZDogeyBvcGFjaXR5OiAnMSd9XG4gIH1cbn1cblxuY29uc3QgY3JlYXRlTG9nID0gKGxvZykgPT4ge1xuICBjb25zdCBkYXRlID0gbmV3IERhdGUoKVxuICBjb25zdCBsb2dfZGF0ZSA9ICBgJHtkYXRlLmdldE1vbnRoKCl9LSR7ZGF0ZS5nZXREYXRlKCl9IEAgJHtkYXRlLmdldEhvdXJzKCl9OiR7ZGF0ZS5nZXRNaW51dGVzKCl9YFxuXG4gIHJldHVybiBoKCdkaXYubG9nJywge1xuICAgIHN0eWxlOiBteVN0eWxlcy5mYWRlSW4sXG4gICAga2V5OiBfa2V5KytcbiAgfSwgW1xuICAgIGgoJ3NwYW4ubG9nX2RhdGUnLCBsb2dfZGF0ZSksIFxuICAgIGgoJ3NwYW4ubG9nX21zZycsIGxvZylcbiAgXSlcbn1cblxuY29uc3QgU3RhdGVDcmVhdG9yID0gKHsgbG9ncyB9KSA9PiB7XG4gIGlmICghQXJyYXkuaXNBcnJheShsb2dzKSkge1xuICAgIGxvZ3MgPSBbbG9nc11cbiAgfVxuICBfbG9ncyA9IGxvZ3MubWFwKGNyZWF0ZUxvZykuY29uY2F0KF9sb2dzKVxuICBcbiAgd2hpbGUgKF9sb2dzLmxlbmd0aCA+IDMwKSB7XG4gICAgX2xvZ3Muc2hpZnQoKVxuICB9XG4gIFxuICByZXR1cm4gaCgnZGl2I2NvbnRlbnQnLCBbXG4gICAgaCgnZGl2I2xvZ3MnLCBfbG9ncylcbiAgXSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZUNyZWF0b3IiLCJjb25zdCBzbmFiYmRvbSA9IHJlcXVpcmUoJ3NuYWJiZG9tJylcbmNvbnN0IHBhdGNoID0gc25hYmJkb20uaW5pdChbIC8vIEluaXQgcGF0Y2ggZnVuY3Rpb24gd2l0aCBjaG9vc2VuIG1vZHVsZXNcbiAgcmVxdWlyZSgnc25hYmJkb20vbW9kdWxlcy9jbGFzcycpLCAvLyBtYWtlcyBpdCBlYXN5IHRvIHRvZ2dsZSBjbGFzc2VzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvcHJvcHMnKSwgLy8gZm9yIHNldHRpbmcgcHJvcGVydGllcyBvbiBET00gZWxlbWVudHNcbiAgcmVxdWlyZSgnc25hYmJkb20vbW9kdWxlcy9zdHlsZScpLCAvLyBoYW5kbGVzIHN0eWxpbmcgb24gZWxlbWVudHMgd2l0aCBzdXBwb3J0IGZvciBhbmltYXRpb25zXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnKSwgLy8gYXR0YWNoZXMgZXZlbnQgbGlzdGVuZXJzXG5dKVxuXG5jb25zdCBpbml0ID0gKHBhcmVudE5vZGUpID0+IChTdGF0ZUNyZWF0b3IpID0+IChpbml0X3BhcmFtcykgPT4ge1xuICBsZXQgX3Z0cmVlID0gcGFyZW50Tm9kZVxuXG4gIGNvbnN0IGNoYW5nZSA9IChzdGF0ZSkgPT4ge1xuICAgIGNvbnN0IG5ld192dHJlZSA9IFN0YXRlQ3JlYXRvcihzdGF0ZSlcbiAgICBwYXRjaChfdnRyZWUsIG5ld192dHJlZSlcbiAgICBfdnRyZWUgPSBuZXdfdnRyZWVcbiAgfVxuICBcbiAgY2hhbmdlKGluaXRfcGFyYW1zKVxuICBcbiAgcmV0dXJuIHsgY2hhbmdlIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGluaXQgfSIsIlxuY29uc3QgU3RhdGVTeXN0ZW0gPSAoY2hhbm5lbCkgPT4ge1xuICBjb25zdCBTdGF0ZUNoYW5nZSA9IHJlcXVpcmUoJy4vU3RhdGVDaGFuZ2UnKVxuICBjb25zdCBTdGF0ZU1hY2hpbmUgPSByZXF1aXJlKCcuL1N0YXRlTWFjaGluZScpXG4gIGNvbnN0IFN0YXRlQ3JlYXRvciA9IHJlcXVpcmUoJy4vU3RhdGVDcmVhdG9yJylcbiAgY29uc3QgJGNvbnRlbnRTcGFjZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250ZW50JylcbiAgY29uc3QgbXlTdGF0ZU1hY2hpbmUgPSBTdGF0ZU1hY2hpbmUuaW5pdCgkY29udGVudFNwYWNlKShTdGF0ZUNyZWF0b3IpKHsgbG9nczogW10gfSlcbiAgY29uc3QgbXlTdGF0ZUNoYW5nZSA9IFN0YXRlQ2hhbmdlKG15U3RhdGVNYWNoaW5lKShjaGFubmVsKVxuICBcbiAgcmV0dXJuIG15U3RhdGVDaGFuZ2UgIFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlU3lzdGVtIiwiLypnbG9iYWwgSG9yaXpvbiovXG5jb25zdCBob3Jpem9uID0gSG9yaXpvbigpXG5jb25zdCBhbm55YW5nID0gcmVxdWlyZSgnYW5ueWFuZycpXG5jb25zdCBjaGFubmVsID0gW11cblxuaG9yaXpvbi5jb25uZWN0KClcbmFubnlhbmcuZGVidWcoKVxuZ2xvYmFsLmFubnlhbmcgPSBhbm55YW5nXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLy8gU2V0dXAgaG9yaXpvbiBzdGF0dXMgaW5kaWNhdG9yXG57XG4gIGNvbnN0ICRoZWFkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVhZGVyJylcbiAgaG9yaXpvbi5zdGF0dXMoc3RhdHVzID0+IHtcbiAgICAkaGVhZGVyLmNsYXNzTmFtZSA9IGBzdGF0dXMtJHtzdGF0dXMudHlwZX1gXG4gIH0pXG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLyBTZXR1cCBhbm55YW5nIGNhbGxiYWNrcyBhbmQgZG9tIGV2ZW50c1xue1xuICBjb25zdCAkYWN0aXZhdGVCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aXZhdGUtYnRuJylcbiAgY29uc3QgJHNob3dDb21tYW5kc0J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaG93LWNvbW1hbmRzLWJ0bicpXG4gIFxuICBjb25zdCBteUNhbGxiYWNrcyA9IHJlcXVpcmUoJy4vQ2FsbGJhY2tzJykoeyAkYWN0aXZhdGVCdG4gfSkoY2hhbm5lbClcbiAgY29uc3QgbXlEb21FdmVudHMgPSByZXF1aXJlKCcuL0RvbUV2ZW50cycpKHsgJGFjdGl2YXRlQnRuLCAkc2hvd0NvbW1hbmRzQnRuIH0pKGFubnlhbmcpXG4gIFxuICBmb3IgKHZhciBjYiBpbiBteUNhbGxiYWNrcykge1xuICAgIGFubnlhbmcuYWRkQ2FsbGJhY2soY2IsIG15Q2FsbGJhY2tzW2NiXSlcbiAgfVxuICBmb3IgKHZhciB0eXBlIGluIG15RG9tRXZlbnRzKSB7XG4gICAgbXlEb21FdmVudHNbdHlwZV0uZm9yRWFjaChldmVudCA9PiB7XG4gICAgICBldmVudC5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZXZlbnQuY2FsbGJhY2spXG4gICAgfSlcbiAgfVxufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vIFxuXG4vLyBTZXR1cCBhbm55YW5nIGNvbW1hbmQgZW50cnkgYW5kIG1hbnVhbCBjb21tYW5kIGVudHJ5XG57XG4gIGNvbnN0IG15TWFudWFsQ29tbWFuZEVudHJ5ID0gcmVxdWlyZSgnLi9NYW51YWxDb21tYW5kRW50cnknKShhbm55YW5nKShjaGFubmVsKVxuICBjb25zdCBteUNvbW1hbmRzID0gcmVxdWlyZSgnLi9Db21tYW5kcycpKGhvcml6b24pKG15TWFudWFsQ29tbWFuZEVudHJ5KShjaGFubmVsKVxuICBhbm55YW5nLmFkZENvbW1hbmRzKG15Q29tbWFuZHMpXG4gIGdsb2JhbC5teUNvbW1hbmRzID0gbXlDb21tYW5kc1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vIFxuXG4vLyBTZXR1cCBzdGF0ZSBtYWNoaW5lXG57XG5jb25zdCBTdGF0ZVN5c3RlbSA9IHJlcXVpcmUoJy4vU3RhdGVTeXN0ZW0nKVxuY29uc3QgbXlTdGF0ZUNoYW5nZSA9IFN0YXRlU3lzdGVtKGNoYW5uZWwpXG5cbndpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobXlTdGF0ZUNoYW5nZSlcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLyAiXX0=
