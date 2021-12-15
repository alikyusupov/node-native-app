// Dependencies

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Container for module (to be exported)
const lib = {};
// Base directory of data folder
lib.baseDir = path.join(__dirname + "/../.logs/");
// Append a string to a file. Create the file if it does not exist
lib.append = function (file, str, callback) {
  // Open the file for appending
  fs.open(lib.baseDir + file + ".log", "a", function (err, fileDescriptor) {
    if (!err && fileDescriptor) {
      // Append to file and close it
      fs.appendFile(fileDescriptor, str + "\n", function (err) {
        if (!err) {
          fs.close(fileDescriptor, function (err) {
            if (!err) {
              callback(false);
            } else {
              callback("Error closing file that was being appended");
            }
          });
        } else {
          callback("Error appending to file");
        }
      });
    } else {
      callback("Could open file for appending");
    }
  });
};

// List all the logs, and optionally include the compressed logs
lib.list = function (includeCompressedLogs, callback) {
  fs.readdir(lib.baseDir, (err, data) => {
    if (!err && data && data.length > 0) {
      const trimmedFileNames = [];
      data.forEach((file) => {
        // Add the .log files
        if (file.includes(".log")) {
          trimmedFileNames.push(file.replace(".log", ""));
        }
        // Add the .gz files
        if (file.includes(".gz.b64" && includeCompressedLogs)) {
          trimmedFileNames.push(file.replace(".gz.b64", ""));
        }
      });
      callback(false, trimmedFileNames);
    } else {
      callback("Could not read directory");
    }
  });
};

// Compress the contents of one .log file into a .gz.b64 file within the same directory
lib.compress = function (logId, newFileId, callback) {
  const srcFile = logId + ".log";
  const destFile = newFileId + ".gz.b64";
  // Read the source file
  fs.readFile(lib.baseDir + srcFile, "utf8", (err, inputString) => {
    if (!err && inputString) {
      // Compress the data using gzip
      zlib.gzip(inputString, (err, buffer) => {
        if (!err && buffer) {
          // Send the data to the destination file
          fs.open(lib.baseDir + destFile, "wx", (err, fileDescriptor) => {
            if (!err && fileDescriptor) {
              // Write to the destination file
              fs.writeFile(fileDescriptor, buffer.toString("base64"), (err) => {
                if (!err) {
                  // Close the destination file
                  fs.close(fileDescriptor, (err) => {
                    if (!err) {
                      callback(false);
                    } else {
                      callback("Could not close file");
                    }
                  });
                } else {
                  callback("Could not write compressed data");
                }
              });
            } else {
              callback("Could not open file");
            }
          });
        } else {
          callback("Could not start compressing");
        }
      });
    } else {
      callback("Could not read data");
    }
  });
};

// Decompress the contents of a .gz file into a string variable
lib.decompress = function (fileId, callback) {
  const fileName = fileId + ".gz.b64";
  fs.readFile(lib.baseDir + fileName, "utf8", (err, data) => {
    if (!err && data) {
      // Inflate the data
      const inputBuffer = Buffer.from(data, "base64");
      zlib.unzip(inputBuffer, (err, outputBuffer) => {
        if (!err && outputBuffer) {
          const str = outputBuffer.toString();
          // Callback
          callback(false, str);
        } else {
          callback("Could not decompress data");
        }
      });
    } else {
      callback("Could not read data from a file");
    }
  });
};

lib.truncate = function (logId, callback) {
  fs.truncate(lib.baseDir + logId + ".log", 0, (err) => {
    if (!err) {
      callback(false);
    } else {
      callback("Could not truncate file");
    }
  });
};

module.exports = lib;
