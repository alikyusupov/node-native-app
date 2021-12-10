//dependencies
const http = require("http");
const https = require("https");
const fs = require("fs");
const url = require("url");
const { StringDecoder } = require("string_decoder");
const config = require("../config");
const handlers = require("./handlers");
const helpers = require("./helpers");

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
    const chosenHandler =
      typeof server.router[trimmedPath] !== "undefined"
        ? server.router[trimmedPath]
        : handlers.notFound;
    const data = {
      trimmedPath,
      queryStringObj,
      method,
      headers,
      payload: helpers.convertToObject(buffer),
    };
    chosenHandler(data, (statusCode, payload) => {
      statusCode = typeof statusCode == "number" ? statusCode : 200;
      payload = typeof payload == "object" ? payload : {};
      const payloadString = JSON.stringify(payload);
      //return response
      res.setHeader("Content-Type", "application/json");
      res.writeHead(statusCode);
      res.end(payloadString);
      console.log(trimmedPath, statusCode);
    });
  });
};

server.router = {
  ping: handlers.ping,
  users: handlers.users,
  tokens: handlers.tokens,
  checks: handlers.checks,
};

server.init = () => {
  server.serverHttp.listen(config.httpPort, () =>
    console.log("HTTP server is running on port " + config.httpPort)
  );
  server.serverHttps.listen(config.httpsPort, () =>
    console.log("HTTPS server is running on port " + config.httpsPort)
  );
};
module.exports = server;
