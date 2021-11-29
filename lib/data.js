const path = require("path");
const fs = require("fs");
const helpers = require("./helpers");

const lib = {};

lib.baseDir = path.join(__dirname, "/../.data/");

//CREATE

lib.create = function (dir, file, data, callback) {
  // Open the file for writing
  fs.open(
    lib.baseDir + dir + "/" + file + ".json",
    "wx",
    function (err, fileDescriptor) {
      if (!err && fileDescriptor) {
        // Convert data to string
        var stringData = JSON.stringify(data, null, 2);

        // Write to file and close it
        fs.writeFile(fileDescriptor, stringData, function (err) {
          if (!err) {
            fs.close(fileDescriptor, function (err) {
              if (!err) {
                callback(false);
              } else {
                callback("Error closing new file");
              }
            });
          } else {
            callback("Error writing to new file");
          }
        });
      } else {
        callback("Could not create new file, it may already exist");
      }
    }
  );
};

//READ
/**@TODO  only let the authenticated users access their object. Don't let them access anyone else's*/

lib.read = function (dir, file, cb) {
  fs.readFile(lib.baseDir + dir + "/" + file + ".json", "utf8", (err, data) => {
    if (!err && data) {
      const parsedObj = helpers.convertToObject(data);
      cb(null, parsedObj);
    } else {
      cb(err, data);
    }
  });
};

//UPDATE

lib.update = function (dir, file, data, callback) {
  fs.open(
    lib.baseDir + dir + "/" + file + ".json",
    "r+",
    (err, fileDescriptor) => {
      if (!err && fileDescriptor) {
        const stringData = JSON.stringify(data, null, 2);
        fs.ftruncate(fileDescriptor, (err) => {
          if (!err) {
            fs.writeFile(fileDescriptor, stringData, (err) => {
              if (!err) {
                callback(false);
              } else {
                callback("Error writing data");
              }
            });
          } else {
            callback("Error truncating data");
          }
        });
      } else {
        callback("Error opening a file");
      }
    }
  );
};

//DELETE

lib.delete = function (dir, file, cb) {
  fs.unlink(lib.baseDir + dir + "/" + file + ".json", (err) => {
    if (!err) {
      cb(false);
    } else {
      cb("Error deleting file");
    }
  });
};
module.exports = lib;
