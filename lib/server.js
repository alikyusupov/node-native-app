//dependencies
const http = require("http");
const https = require("https");
const fs = require("fs");
const url = require("url");
const { StringDecoder } = require("string_decoder");
const config = require("../config");
const handlers = require("./handlers");
const helpers = require("./helpers");
const { debuglog } = require("util");
const debug = debuglog("server");

const server = {};

server.httpsOptions = {
  key: fs.readFileSync("./https/key.pem"),
  cert: fs.readFileSync("./https/cert.pem"),
};

server.serverHttp = http.createServer((req, res) => {
  server.unifiedServer(req, res);
});

server.serverHttps = https.createServer(server.httpsOptions, (req, res) => {
  server.unifiedServer(req, res);
});

server.unifiedServer = (req, res) => {
  //parse url
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/|\/+$/g, "");
  const queryStringObj = parsedUrl.query;
  //get method
  const method = req.method.toLowerCase();
  //get headers
  const headers = req.headers;
  const decoder = new StringDecoder("utf-8");
  let buffer = "";

  req.on("data", (chunk) => {
    buffer += decoder.write(chunk);
  });

  req.on("end", () => {
    buffer += decoder.end();
    let chosenHandler =
      typeof server.router[trimmedPath] !== "undefined"
        ? server.router[trimmedPath]
        : handlers.notFound;
    chosenHandler = trimmedPath.includes("public/")
      ? handlers.public
      : chosenHandler;
    const data = {
      trimmedPath,
      queryStringObj,
      method,
      headers,
      payload: helpers.convertToObject(buffer),
    };
    chosenHandler(data, (statusCode, payload, contentType) => {
      contentType = typeof contentType === "string" ? contentType : "json";
      statusCode = typeof statusCode == "number" ? statusCode : 200;
      let payloadString = "";
      if (contentType === "json") {
        res.setHeader("Content-Type", "application/json");
        payload = typeof payload === "object" ? payload : {};
        payloadString = JSON.stringify(payload);
      }
      if (contentType === "html") {
        res.setHeader("Content-Type", "text/html");
        payloadString = typeof payload === "string" ? payload : "";
      }
      if (contentType == "favicon") {
        res.setHeader("Content-Type", "image/x-icon");
        payloadString = typeof payload !== "undefined" ? payload : "";
      }

      if (contentType == "plain") {
        res.setHeader("Content-Type", "text/plain");
        payloadString = typeof payload !== "undefined" ? payload : "";
      }

      if (contentType == "css") {
        res.setHeader("Content-Type", "text/css");
        payloadString = typeof payload !== "undefined" ? payload : "";
      }

      if (contentType == "png") {
        res.setHeader("Content-Type", "image/png");
        payloadString = typeof payload !== "undefined" ? payload : "";
      }

      if (contentType == "jpg") {
        res.setHeader("Content-Type", "image/jpeg");
        payloadString = typeof payload !== "undefined" ? payload : "";
      }
      res.writeHead(statusCode);
      res.end(payloadString);

      if (statusCode === 200) {
        debug("\x1b[32m%s\x1b[0m", "/" + trimmedPath + " " + statusCode);
      } else {
        debug("\x1b[31m%s\x1b[0m", "/" + trimmedPath + " " + statusCode);
      }
    });
  });
};

server.router = {
  "": handlers.index,
  "account/create": handlers.accountCreate,
  "account/deleted": handlers.accountDeleted,
  "account/edit": handlers.accountEdit,
  "session/create": handlers.sessionCreate,
  "session/destroyed": handlers.sessionDestroyed,
  "checks/all": handlers.checkList,
  "checks/create": handlers.checkCreate,
  "checks/edit": handlers.checkEdit,
  ping: handlers.ping,
  "api/users": handlers.users,
  "api/tokens": handlers.tokens,
  "api/checks": handlers.checks,
  "favicon/ico": handlers.favicon,
  public: handlers.public,
};

server.init = () => {
  server.serverHttp.listen(config.httpPort, () =>
    console.log(
      "\x1b[36m%s\x1b[0m",
      "HTTP server is running on port " + config.httpPort
    )
  );
  server.serverHttps.listen(config.httpsPort, () =>
    console.log(
      "\x1b[35m%s\x1b[0m",
      "HTTPS server is running on port " + config.httpsPort
    )
  );
};
module.exports = server;
