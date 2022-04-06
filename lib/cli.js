const readline = require('readline')
const util = require('util')
const events = require('events')
const debug = util.debuglog('cli')
const os = require("os")
const v8 = require("v8")
const _data = require("./data")
var _logs = require('./log');
var helpers = require('./helpers');

class Event extends events { }

const _event = new Event()

const cli = {}

// Input handlers
_event.on('man', function (str) {
  cli.responders.help();
});

_event.on('help', function (str) {
  cli.responders.help();
});

_event.on('exit', function (str) {
  cli.responders.exit();
});

_event.on('stats', function (str) {
  cli.responders.stats();
});

_event.on('list users', function (str) {
  cli.responders.listUsers();
});

_event.on('more user info', function (str) {
  cli.responders.moreUserInfo(str);
});

_event.on('list checks', function (str) {
  cli.responders.listChecks(str);
});

_event.on('more check info', function (str) {
  cli.responders.moreCheckInfo(str);
});

_event.on('list logs', function () {
  cli.responders.listLogs();
});

_event.on('more log info', function (str) {
  cli.responders.moreLogInfo(str);
});


// Responders object
cli.responders = {};

// Help / Man
cli.responders.help = function () {

  // Codify the commands and their explanations
  var commands = {
    'exit': 'Kill the CLI (and the rest of the application)',
    'man': 'Show this help page',
    'help': 'Alias of the "man" command',
    'stats': 'Get statistics on the underlying operating system and resource utilization',
    'List users': 'Show a list of all the registered (undeleted) users in the system',
    'More user info --{userId}': 'Show details of a specified user',
    'List checks --up --down': 'Show a list of all the active checks in the system, including their state. The "--up" and "--down flags are both optional."',
    'More check info --{checkId}': 'Show details of a specified check',
    'List logs': 'Show a list of all the log files available to be read (compressed and uncompressed)',
    'More log info --{logFileName}': 'Show details of a specified log file',
  };

  // Show a header for the help page that is as wide as the screen
  cli.horizontalLine();
  cli.centered('CLI MANUAL');
  cli.horizontalLine();
  cli.verticalSpace(2);

  // Show each command, followed by its explanation, in white and yellow respectively
  for (var key in commands) {
    if (commands.hasOwnProperty(key)) {
      var value = commands[key];
      var line = '\x1b[33m ' + key + ' \x1b[0m';
      var padding = 60 - line.length;
      for (i = 0; i < padding; i++) {
        line += ' ';
      }
      line += value;
      console.log(line);
      cli.verticalSpace();
    }
  }
  cli.verticalSpace(1);

  // End with another horizontal line
  cli.horizontalLine();

};


cli.horizontalLine = () => {
  const width = process.stdout.columns
  let line = ""
  for (let i = 0; i < width; i++) {
    line += "-"
  }
  console.log(line);
}

cli.centered = (str) => {
  str = typeof str === 'string' && str.trim().length > 0 ? str.trim() : 0
  const width = process.stdout.columns
  const center = Math.floor((width - str.length) / 2)
  let line = ""
  for (let i = 0; i < center; i++) {
    line += " "
  }
  line += str
  console.log(line);
}

cli.verticalSpace = lines => {
  lines = typeof lines === 'number' && lines > 0 ? lines : 0
  for (let i = 0; i < lines; i++) {
    console.log("");
  }
}


// Exit

cli.responders.exit = function () {
  process.exit(0)
};

// Stats
cli.responders.stats = function () {
  var stats = {
    'Load Average': os.loadavg().join(' '),
    'CPU Count': os.cpus().length,
    'Free Memory': os.freemem(),
    'Current Malloced Memory': v8.getHeapStatistics().malloced_memory,
    'Peak Malloced Memory': v8.getHeapStatistics().peak_malloced_memory,
    'Allocated Heap Used (%)': Math.round((v8.getHeapStatistics().used_heap_size / v8.getHeapStatistics().total_heap_size) * 100),
    'Available Heap Allocated (%)': Math.round((v8.getHeapStatistics().total_heap_size / v8.getHeapStatistics().heap_size_limit) * 100),
    'Uptime': os.uptime() + ' Seconds'
  };

  // Show a header for the help page that is as wide as the screen
  cli.horizontalLine();
  cli.centered('System Statistics');
  cli.horizontalLine();
  cli.verticalSpace(2);

  // Show each command, followed by its explanation, in white and yellow respectively
  for (var key in stats) {
    if (stats.hasOwnProperty(key)) {
      var value = stats[key];
      var line = '\x1b[33m ' + key + ' \x1b[0m';
      var padding = 60 - line.length;
      for (i = 0; i < padding; i++) {
        line += ' ';
      }
      line += value;
      console.log(line);
      cli.verticalSpace();
    }
  }
  cli.verticalSpace(1);

  // End with another horizontal line
  cli.horizontalLine();
};

// List Users
cli.responders.listUsers = function () {
  _data.list('users', (err, userIds) => {
    if (!err && userIds && userIds.length > 0) {
      userIds.forEach(userId => {
        _data.read('users', userId, (err, userData) => {
          if (!err && userData) {
            const numOfChecks = Array.isArray(userData.checks) && userData.checks.length > 0 ? userData.checks.length : 0
            console.log(userData.fName + " " + userData.phone + " num of checks " + numOfChecks)
          }
        })
      })
    }
  })
};

// More user info
cli.responders.moreUserInfo = function (str) {
  // Get ID from string
  var arr = str.split('--');
  var userId = typeof (arr[1]) == 'string' && arr[1].trim().length > 0 ? arr[1].trim() : false;
  if (userId) {
    // Lookup the user
    _data.read('users', userId, function (err, userData) {
      if (!err && userData) {
        // Remove the hashed password
        delete userData.password;

        // Print their JSON object with text highlighting
        cli.verticalSpace();
        console.dir(userData, { 'colors': true });
        cli.verticalSpace();
      }
    });
  }

};

// List Checks
cli.responders.listChecks = function (str) {
  _data.list('checks', function (err, checkIds) {
    if (!err && checkIds && checkIds.length > 0) {
      cli.verticalSpace();
      checkIds.forEach(function (checkId) {
        _data.read('checks', checkId, function (err, checkData) {
          if (!err && checkData) {
            var includeCheck = false;
            var lowerString = str.toLowerCase();
            // Get the state, default to down
            var state = typeof (checkData.state) == 'string' ? checkData.state : 'down';
            // Get the state, default to unknown
            var stateOrUnknown = typeof (checkData.state) == 'string' ? checkData.state : 'unknown';
            // If the user has specified that state, or hasn't specified any state
            if ((lowerString.indexOf('--' + state) > -1) || (lowerString.indexOf('--down') == -1 && lowerString.indexOf('--up') == -1)) {
              var line = 'ID: ' + checkData.id + ' ' + checkData.method.toUpperCase() + ' ' + checkData.protocol + '://' + checkData.url + ' State: ' + stateOrUnknown;
              console.log(line);
              cli.verticalSpace();
            }
          }
        });
      });
    }
  });
};

// More check info
cli.responders.moreCheckInfo = function (str) {
  // Get ID from string
  var arr = str.split('--');
  var checkId = typeof (arr[1]) == 'string' && arr[1].trim().length > 0 ? arr[1].trim() : false;
  if (checkId) {
    // Lookup the user
    _data.read('checks', checkId, function (err, checkData) {
      if (!err && checkData) {

        // Print their JSON object with text highlighting
        cli.verticalSpace();
        console.dir(checkData, { 'colors': true });
        cli.verticalSpace();
      }
    });
  }
};

// List Logs
cli.responders.listLogs = function () {
  _logs.list(true, function (err, logFileNames) {
    console.log(logFileNames);
    if (!err && logFileNames && logFileNames.length > 0) {
      cli.verticalSpace();
      logFileNames.forEach(function (logFileName) {
        if (logFileName.indexOf('-') > -1) {
          console.log(logFileName);
          cli.verticalSpace();
        }
      });
    }
  });
};

// More logs info
cli.responders.moreLogInfo = function (str) {
  // Get logFileName from string
  var arr = str.split('--');
  var logFileName = typeof (arr[1]) == 'string' && arr[1].trim().length > 0 ? arr[1].trim() : false;
  if (logFileName) {
    cli.verticalSpace();
    // Decompress it
    _logs.decompress(logFileName, function (err, strData) {
      if (!err && strData) {
        // Split it into lines
        var arr = strData.split('\n');
        arr.forEach(function (jsonString) {
          var logObject = helpers.parseJsonToObject(jsonString);
          if (logObject && JSON.stringify(logObject) !== '{}') {
            console.dir(logObject, { 'colors': true });
            cli.verticalSpace();
          }
        });
      }
    });
  }
};



cli.processInput = str => {

  str = typeof str === 'string' && str.trim().length > 0 ? str.trim() : false
  if (str) {
    const uniqueInputs = [
      'man',
      'help',
      'exit',
      'stats',
      'list users',
      'more user info',
      'list checks',
      'more check info',
      'list logs',
      'more log info'
    ];
    let matchFound = false
    uniqueInputs.some(input => {
      if (str.indexOf(input) > -1) {
        matchFound = true
        _event.emit(input, str)
        return true
      }
    })
    if (!matchFound) {
      console.log('Sorry, try again')
    }
  }
}



cli.init = () => {

  // Send to console, in dark blue
  console.log('\x1b[34m%s\x1b[0m', 'The CLI is running');

  const interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ""
  })

  interface.prompt()

  interface.on('line', str => {
    cli.processInput(str)
    interface.prompt()
  })

  interface.on('close', () => process.exit(0))
}


module.exports = cli

