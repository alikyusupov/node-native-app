const crypto = require("crypto");
const { stringify } = require("querystring");
const { request } = require("https");
const { readFile } = require("fs");
const path = require("path");
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

helpers.sendTwillioSms = (phone, msg, callback) => {
  phone = typeof phone == "string" && phone.trim().length == 10 ? phone : false;
  msg =
    typeof msg == "string" && msg.trim().length > 0 && msg.trim().length < 1000
      ? msg
      : false;
  if (phone && msg) {
    const payload = {
      From: config.twilio.fromPhone,
      To: phone,
      Body: msg,
    };
    const stringData = stringify(payload);
    const requestDetails = {
      protocol: "https:",
      hostname: "api.twilio.com",
      method: "POST",
      path:
        "/2010-04-01/Accounts/" + config.twilio.accountSid + "/Messages.json",
      auth: config.twilio.accountSid + ":" + config.twilio.authToken,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(stringData),
      },
    };
    const httpsReq = request(requestDetails, (res) => {
      const code = res.statusCode;
      if ([200, 201, 301, 302].includes(code)) {
        callback(false);
      } else {
        callback("Status code returned was " + code);
      }
    });
    httpsReq.on("error", (err) => callback(err));
    httpsReq.write(stringData);
    httpsReq.end();
  } else {
    callback("Given parameters were wrong or missing");
  }
};

helpers.getTemplate = (templateName, data, callback) => {
  templateName =
    typeof templateName === "string" && templateName.length > 0
      ? templateName
      : false;
  data = typeof data !== null ? data : {};
  if (templateName) {
    const templateDir = path.join(__dirname, "/../templates/");
    readFile(templateDir + templateName + ".html", "utf8", (err, str) => {
      if (!err && str && str.length > 0) {
        const finalStr = helpers.interpolate(str, data);
        callback(false, finalStr);
      } else {
        callback("No template found!");
      }
    });
  } else {
    callback("Malformed name of template!");
  }
};

// Add the universal header and footer to a string, and pass provided data object to header and footer for interpolation
helpers.addUniversalTemplates = function (str, data, callback) {
  str = typeof str == "string" && str.length > 0 ? str : "";
  data = typeof data == "object" && data !== null ? data : {};
  // Get the header
  helpers.getTemplate("_header", data, function (err, headerString) {
    if (!err && headerString) {
      // Get the footer
      helpers.getTemplate("_footer", data, function (err, footerString) {
        if (!err && headerString) {
          // Add them all together
          var fullString = headerString + str + footerString;
          callback(false, fullString);
        } else {
          callback("Could not find the footer template");
        }
      });
    } else {
      callback("Could not find the header template");
    }
  });
};

helpers.interpolate = (str, data) => {
  str = typeof str === "string" && str.length > 0 ? str : "";
  data = typeof data !== null ? data : {};
  for (const [key, value] of Object.entries(config.templateGlobals)) {
    data["global." + key] = value;
  }
  for (const key of Object.keys(data)) {
    const replace = data[key];
    const find = "{" + key + "}";
    str = str.replace(find, replace);
  }
  return str;
};

helpers.getStaticAsset = (filename, callback) => {
  filename =
    typeof filename === "string" && filename.length > 0 ? filename : false;
  if (filename) {
    const publicDir = path.join(__dirname, "/../public/");
    readFile(publicDir + filename, (err, data) => {
      if (!err && data) {
        callback(false, data);
      } else {
        callback("Problem during reading a file");
      }
    });
  } else {
    callback("No file is found");
  }
};
module.exports = helpers;
