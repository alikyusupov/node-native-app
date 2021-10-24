//dependencies
const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const StringDecoder = require("string_decoder").StringDecoder
const config = require("./config")

const httpsOptions = {
    "key": fs.readFileSync("./https/key.pem"),
    "cert": fs.readFileSync("./https/cert.pem"),
}

const httpServer = http.createServer((req, res)=>{
    unifiedServer(req, res)
}).listen(config.httpPort, ()=>console.log("HTTP server is running on port " + config.httpPort))

const httpsServer = https.createServer(httpsOptions, (req, res)=>{
    unifiedServer(req, res)
}).listen(config.httpsPort, ()=>console.log("HTTPS server is running on port " + config.httpsPort))

function unifiedServer(req, res){
    //parse url
    const parsedUrl = url.parse(req.url, true)
    const path = parsedUrl.pathname
    const trimmedPath = path.replace(/^\/|\/+$/g,"")
    const queryStringObg = parsedUrl.query
    //get method
    const method = req.method.toLowerCase()
    //get headers
    const headers = req.method.headers
    const decoder = new StringDecoder("utf-8")
    let buffer = ""

    req.on("data",(chunk)=>{
        buffer += decoder.write(chunk)
    })

    req.on("end",()=>{
        buffer += decoder.end()
        const chosenHandler = (typeof router[trimmedPath] !== "undefined") ? router[trimmedPath] : handlers.notFound
        const data = {
            trimmedPath,
            queryStringObg,
            method,
            headers,
            payload:buffer
        }
        chosenHandler(data, (statusCode, payload)=>{
            statusCode = (typeof statusCode == "number") ? statusCode : 200
            payload = (typeof payload == "object") ? payload : {}
            const payloadString = JSON.stringify(payload)
            //return response
            res.setHeader("Content-Type","application/json")
            res.writeHead(statusCode)
            res.end(payloadString)
            console.log(trimmedPath, statusCode);
        })
    })
}

const handlers = {
    ping(data, callback){
        callback(200)
    },
    notFound(data, callback){
        callback(404)
    }
}

const router = {
    "ping":handlers.ping
}