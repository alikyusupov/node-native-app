const crypto = require("crypto");

const config = require("../config");

const helpers = {};

helpers.doHash = (str) => {
  if (typeof str == "string" && str.length > 0) {
    return crypto.createHmac("sha256", config.secret).update(str).digest("hex");
  } else {
    return false;
  }
};

helpers.convertToObject = (buffer) => {
  try {
    const parsed = JSON.parse(buffer);
    return parsed;
  } catch (err) {
    return {};
  }
};

helpers.randomString = (strLen) => {
  if (typeof strLen == "number" && !isNaN(strLen)) {
    const charSet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let output = "";
    while (output.length < strLen) {
      output += charSet.charAt(Math.floor(Math.random() * charSet.length));
    }
    return output;
  } else {
    return false;
  }
};

module.exports = helpers;
