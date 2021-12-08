const crypto = require("crypto");
const { stringify } = require("querystring");
const { request } = require("https");

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
      console.log(res);
      const code = res.statusCode;
      if ([200, 201].includes(code)) {
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
module.exports = helpers;
