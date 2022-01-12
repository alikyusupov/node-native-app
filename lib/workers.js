/*
 * Worker-related tasks
 *
 */

// Dependencies
const http = require("http");
const https = require("https");
const _data = require("./data");
const _log = require("./log");
const helpers = require("./helpers");
const url = require("url");
const { debuglog } = require("util");
const debug = debuglog("workers");

// Instantiate the worker module object
const workers = {};

// Lookup all checks, get their data, send to validator
workers.gatherAllChecks = function () {
  // Get all the checks
  _data.list("checks", (err, checks) => {
    if (!err && checks && checks.length > 0) {
      checks.forEach((check) => {
        // Read in the check data
        _data.read("checks", check, (err, originalCheckData) => {
          if (!err && originalCheckData) {
            // Pass it to the check validator, and let that function continue the function or log the error(s) as needed
            workers.validateCheckData(originalCheckData);
          } else {
            debug("Error while reading check data");
          }
        });
      });
    } else {
      debug("Could not find any checks");
    }
  });
};
// Sanity-check the check-data,
workers.validateCheckData = function (originalCheckData) {
  originalCheckData =
    typeof originalCheckData == "object" && originalCheckData !== null
      ? originalCheckData
      : {};
  originalCheckData.id =
    typeof originalCheckData.id == "string" &&
    originalCheckData.id.trim().length == 20
      ? originalCheckData.id.trim()
      : false;
  originalCheckData.phone =
    typeof originalCheckData.phone == "string" &&
    originalCheckData.phone.trim().length == 10
      ? originalCheckData.phone.trim()
      : false;
  originalCheckData.protocol =
    typeof originalCheckData.protocol == "string" &&
    ["http", "https"].indexOf(originalCheckData.protocol) > -1
      ? originalCheckData.protocol
      : false;
  originalCheckData.url =
    typeof originalCheckData.url == "string" &&
    originalCheckData.url.trim().length > 0
      ? originalCheckData.url.trim()
      : false;
  originalCheckData.method =
    typeof originalCheckData.method == "string" &&
    ["post", "get", "put", "delete"].indexOf(originalCheckData.method) > -1
      ? originalCheckData.method
      : false;
  originalCheckData.successCodes =
    Array.isArray(originalCheckData.successCodes) &&
    originalCheckData.successCodes.length > 0
      ? originalCheckData.successCodes
      : false;
  originalCheckData.timeoutSeconds =
    typeof originalCheckData.timeoutSeconds == "number" &&
    originalCheckData.timeoutSeconds % 1 === 0 &&
    originalCheckData.timeoutSeconds >= 1 &&
    originalCheckData.timeoutSeconds <= 5
      ? originalCheckData.timeoutSeconds
      : false;
  // Set the keys that may not be set (if the workers have never seen this check before)
  originalCheckData.state =
    typeof originalCheckData.state == "string" &&
    ["up", "down"].indexOf(originalCheckData.state) > -1
      ? originalCheckData.state
      : "down";
  originalCheckData.lastChecked =
    typeof originalCheckData.lastChecked == "number" &&
    originalCheckData.lastChecked > 0
      ? originalCheckData.lastChecked
      : false;
  // If all checks pass, pass the data along to the next step in the process
  if (
    originalCheckData &&
    originalCheckData.id &&
    originalCheckData.phone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds
  ) {
    workers.performCheck(originalCheckData);
  } else {
    // If checks fail, log the error and fail silently
    debug("Error: one of the checks is not properly formatted. Skipping.");
  }
};

// Perform the check, send the originalCheck data and the outcome of the check process to the next step in the process
workers.performCheck = function (originalCheckData) {
  // Prepare the intial check outcome
  const checkOutcome = {
    error: false,
    responseCode: false,
  };
  // Mark that the outcome has not been sent yet
  let outcomeSent = false;

  // Parse the hostname and path out of the originalCheckData
  const parsedUrl = url.parse(
    originalCheckData.protocol + "://" + originalCheckData.url,
    true
  );
  const hostname = parsedUrl.hostname;
  // Using path not pathname because we want the query string
  const path = parsedUrl.path;
  // Construct the request
  const { protocol, method, timeoutSeconds } = originalCheckData;
  const requestDetails = {
    protocol: protocol + ":",
    hostname,
    method: method.toUpperCase(),
    path,
    timeout: timeoutSeconds * 10000,
  };

  // Instantiate the request object (using either the http or https module)
  const _moduleToUse = protocol == "https" ? https : http;
  const req = _moduleToUse.request(requestDetails, (res) => {
    // Grab the status of the sent request
    const status = res.statusCode;
    // Update the checkOutcome and pass the data along
    checkOutcome.responseCode = status;
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });
  // Bind to the error event so it doesn't get thrown
  req.on("error", (err) => {
    // Update the checkOutcome and pass the data along
    checkOutcome.error = { error: true, value: err };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });
  // Bind to the timeout event

  req.on("timeout", () => {
    // Update the checkOutcome and pass the data along
    checkOutcome.error = { error: true, value: "timeout" };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // End the request
  req.end();
};
// Process the check outcome, update the check data as needed, trigger an alert if needed
// Special logic for accomodating a check that has never been tested before (don't alert on that one)
workers.processCheckOutcome = function (originalCheckData, checkOutcome) {
  // Decide if the check is considered up or down
  const state =
    !checkOutcome.error &&
    checkOutcome.responseCode &&
    originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1
      ? "up"
      : "down";
  // Decide if an alert is warranted
  const alertWarranted =
    originalCheckData.lastChecked && originalCheckData.state !== state
      ? true
      : false;
  // Update the check data
  const newCheckData = {
    ...originalCheckData,
    lastChecked: Date.now(),
    state,
  };
  const timeOfCheck = Date.now();
  workers.log(
    originalCheckData,
    checkOutcome,
    state,
    alertWarranted,
    timeOfCheck
  );
  // Save the updates
  _data.update("checks", newCheckData.id, newCheckData, (err) => {
    if (!err) {
      // Send the new check data to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData);
      } else {
        debug("Check outcome has not changed, no alert needed");
      }
    } else {
      debug("Error when trying to update one of the checks");
    }
  });
};
// Alert the user as to a change in their check status
workers.alertUserToStatusChange = function (newCheckData) {
  const msg =
    "Alert: Your check for " +
    newCheckData.method.toUpperCase() +
    " " +
    newCheckData.protocol +
    "://" +
    newCheckData.url +
    " is currently " +
    newCheckData.state;
  helpers.sendTwillioSms(newCheckData.phone, msg, (err) => {
    if (!err) {
      debug(
        "Success: User was alerted to a status change in their check, via sms: ",
        msg
      );
    } else {
      debug(
        "Error: Could not send sms alert to user who had a state change in their check",
        err
      );
    }
  });
};

// Send check data to a log file
workers.log = function (
  originalCheckData,
  checkOutcome,
  state,
  alertWarranted,
  timeOfCheck
) {
  // Form the log data
  const logData = {
    check: originalCheckData,
    outcome: checkOutcome,
    state: state,
    alert: alertWarranted,
    time: timeOfCheck,
  };
  // Convert the data to a string
  const logString = JSON.stringify(logData);

  // Determine the name of the log file
  const logFileName = originalCheckData.id;

  // Append the log string to the file
  _log.append(logFileName, logString, (err) => {
    if (!err) {
      debug("Logging to file succeeded");
    } else {
      debug("Logging to file failed");
    }
  });
};

// Timer to execute the worker-process once per minute
workers.loop = function () {
  setInterval(() => workers.gatherAllChecks(), 1000 * 5);
};

// Rotate (compress) the log files
workers.rotateLogs = function () {
  // List all the (non compressed) log files
  _log.list(false, (err, logs) => {
    if (!err && logs && logs.length > 0) {
      logs.forEach((logName) => {
        const logId = logName.replace(".log", "");
        const newFileId = logId + "-" + Date.now();
        // Compress the data to a different file
        _log.compress(logId, newFileId, (err) => {
          if (!err) {
            _log.truncate(logId, (err) => {
              if (!err) {
                debug("Success truncating logFile");
              } else {
                debug("Could not truncate file");
              }
            });
          } else {
            debug("Could not compress one of the logs");
          }
        });
      });
    } else {
      debug("Could not fetch logs");
    }
  });
};

workers.logRotationLoop = () => {
  setInterval(() => {
    workers.rotateLogs();
  }, 10000);
};

// Init script
workers.init = function () {
  // send to console in yellow
  console.log("\x1b[33m%s\x1b[0m", "Workers are running...");

  // Execute all the checks immediately
  workers.gatherAllChecks();
  // Call the loop so the checks will execute later on
  workers.loop();

  workers.rotateLogs();

  workers.logRotationLoop();
};
// Export the module
module.exports = workers;
