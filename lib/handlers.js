const _data = require("./data");

const helpers = require("./helpers");

const handlers = {
  ping(data, callback) {
    callback(200, { data: [1, 2, 3] });
  },
  users(data, callback) {
    const allowedVerbs = ["post", "get", "put", "delete"];
    if (allowedVerbs.includes(data.method)) {
      handlers._users[data.method](data, callback);
    } else {
      callback(405);
    }
  },
  tokens(data, callback) {
    const allowedVerbs = ["post", "get", "put", "delete"];
    if (allowedVerbs.includes(data.method)) {
      handlers._tokens[data.method](data, callback);
    } else {
      callback(405);
    }
  },
  notFound(data, callback) {
    callback(404);
  },
};

handlers._users = {
  post(data, callback) {
    //Sanity checking
    const fName =
      typeof data.payload.fName == "string" &&
      data.payload.fName.trim().length > 0
        ? data.payload.fName.trim()
        : false;
    const lName =
      typeof data.payload.lName == "string" &&
      data.payload.lName.trim().length > 0
        ? data.payload.lName.trim()
        : false;
    const phone =
      typeof data.payload.phone == "string" &&
      data.payload.phone.trim().length == 10
        ? data.payload.phone.trim()
        : false;
    const pwd =
      typeof data.payload.pwd == "string" && data.payload.pwd.trim().length > 0
        ? data.payload.pwd.trim()
        : false;
    const tosAgreement =
      typeof data.payload.tosAgreement == "boolean" &&
      data.payload.tosAgreement == true
        ? true
        : false;

    if (fName && lName && phone && pwd && tosAgreement) {
      _data.read("users", phone, (err, data) => {
        if (err) {
          //OK
          const hashedPassword = helpers.doHash(pwd);
          if (hashedPassword) {
            const user = {
              fName,
              lName,
              phone,
              password: hashedPassword,
              tosAgreement: true,
            };
            _data.create("users", phone, user, (err) => {
              if (!err) {
                callback(200);
              } else {
                callback(500, { Error: "Creating user failure" });
              }
            });
          } else {
            callback(500, { Error: "Hashing failure" });
          }
        } else {
          callback(400, {
            Error: "A user with that phone number already exists",
          });
        }
      });
    } else {
      callback(400, { error: "Missing required data" });
    }
  },
  get(data, callback) {
    const phone = typeof (
      data.queryStringObj.phone == "string" &&
      data.queryStringObj.phone.trim().length == 10
    )
      ? data.queryStringObj.phone.trim()
      : false;
    if (phone) {
      const tokenId =
        typeof data.headers.token == "string" ? data.headers.token : false;
      handlers._tokens.verifyToken(tokenId, phone, (isValidToken) => {
        if (isValidToken) {
          _data.read("users", phone, (err, data) => {
            if (!err && data) {
              delete data.password;
              callback(200, data);
            } else {
              callback(500, { Error: "Internal error" });
            }
          });
        } else {
          callback(403, { Error: "Access failure" });
        }
      });
    } else {
      callback(400, { Error: "Malformed query data" });
    }
  },
  put(data, callback) {
    try {
      const phone = typeof (
        data.payload.phone == "string" && data.payload.phone.trim().length == 10
      )
        ? data.payload.phone.trim()
        : false;
      //Checking fields to update
      const fName =
        typeof data.payload.fName == "string" &&
        data.payload.fName.trim().length > 0
          ? data.payload.fName.trim()
          : false;
      const lName =
        typeof data.payload.lName == "string" &&
        data.payload.lName.trim().length > 0
          ? data.payload.lName.trim()
          : false;
      const pwd =
        typeof data.payload.pwd == "string" &&
        data.payload.pwd.trim().length > 0
          ? data.payload.pwd.trim()
          : false;
      if (phone) {
        const tokenId =
          typeof data.headers.token == "string" ? data.headers.token : false;
        handlers._tokens.verifyToken(tokenId, phone, (isValidToken) => {
          if (isValidToken) {
            if (fName || lName || pwd) {
              _data.read("users", phone, (err, userData) => {
                if (!err && userData) {
                  if (fName) {
                    userData.fName = fName;
                  }
                  if (lName) {
                    userData.lName = lName;
                  }
                  if (pwd) {
                    userData.password = helpers.doHash(pwd);
                  }
                  _data.update("users", phone, userData, (err) => {
                    if (!err) {
                      callback(200);
                    } else {
                      callback(500, { Error: "User updating failure" });
                    }
                  });
                } else {
                  callback(500, { Error: "User updating failure" });
                }
              });
            } else {
              callback(400, { Error: "Malformed fileds" });
            }
          } else {
            callback(403, { Error: "Access failure" });
          }
        });
      } else {
        callback(400, { Error: "Malformed query data" });
      }
    } catch (err) {
      callback(500);
    }
  },
  /**@TODO Delete all data related to user - cascade deletion */
  delete(data, callback) {
    const phone = typeof (
      data.queryStringObj.phone == "string" &&
      data.queryStringObj.phone.trim().length == 10
    )
      ? data.queryStringObj.phone.trim()
      : false;
    if (phone) {
      const tokenId =
        typeof data.headers.token == "string" ? data.headers.token : false;
      handlers._tokens.verifyToken(tokenId, phone, (isValidToken) => {
        if (isValidToken) {
          _data.read("users", phone, (err, userData) => {
            if (!err && userData) {
              _data.delete("users", phone, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, { Error: "Could not delete user" });
                }
              });
            } else {
              callback(400, { Error: "User not found" });
            }
          });
        } else {
          callback(403, { Error: "Access failure" });
        }
      });
    } else {
      callback(400, { Error: "Malformed query data" });
    }
  },
};

handlers._tokens = {
  //Required data: phone, password
  //Optional: none
  post(data, callback) {
    const phone =
      typeof data.payload.phone == "string" &&
      data.payload.phone.trim().length == 10
        ? data.payload.phone.trim()
        : false;
    const pwd =
      typeof data.payload.pwd == "string" && data.payload.pwd.trim().length > 0
        ? data.payload.pwd.trim()
        : false;
    if (phone && pwd) {
      _data.read("users", phone, (err, userData) => {
        if (!err && userData) {
          const hashedPassword = helpers.doHash(pwd);
          if (hashedPassword === userData.password) {
            const tokenId = helpers.randomString(20);
            const expires = Date.now() + 1000 * 60 * 60;
            const tokenObj = {
              id: tokenId,
              expiresAt: expires,
              phone: userData.phone,
            };
            _data.create("tokens", tokenId, tokenObj, (err) => {
              if (!err) {
                callback(200, tokenObj);
              } else {
                callback(500, { Error: "Internal error!" });
              }
            });
          } else {
            callback(400, { Error: "Passwords mismatch" });
          }
        } else {
          callback(400, { Error: "User not found" });
        }
      });
    } else {
      callback(400, { Error: "Malformed phone/password" });
    }
  },
  get(data, callback) {
    const tokenId = typeof (
      data.queryStringObj.tokenId == "string" &&
      data.queryStringObj.tokenId.trim().length == 20
    )
      ? data.queryStringObj.tokenId.trim()
      : false;
    if (tokenId) {
      _data.read("tokens", tokenId, (err, data) => {
        if (!err && data) {
          callback(200, data);
        } else {
          callback(404);
        }
      });
    } else {
      callback(400, { Error: "Malformed query data" });
    }
  },
  put(data, callback) {
    try {
      const tokenId = typeof (
        data.payload.tokenId == "string" &&
        data.payload.tokenId.trim().length == 20
      )
        ? data.payload.tokenId.trim()
        : false;
      const extend =
        typeof data.payload.extend == "boolean" && data.payload.extend == true
          ? true
          : false;
      if (tokenId && extend) {
        _data.read("tokens", tokenId, (err, tokenData) => {
          if (!err && tokenData) {
            tokenData.expiresAt = Date.now() + 1000 * 60 * 60;
            _data.update("tokens", tokenId, tokenData, (err) => {
              if (!err) {
                callback(200);
              } else {
                callback(500, { Error: "Internal server error!" });
              }
            });
          } else {
            callback(400, { error: "Token not found" });
          }
        });
      } else {
        callback(400, { error: "Malformed tokenId/extend" });
      }
    } catch (error) {
      callback(400, { error: "Malformed tokenId/extend" });
    }
  },
  delete(data, callback) {
    const tokenId = typeof (
      data.queryStringObj.tokenId == "string" &&
      data.queryStringObj.tokenId.trim().length == 20
    )
      ? data.queryStringObj.tokenId.trim()
      : false;
    if (tokenId) {
      _data.read("tokens", tokenId, (err, tokenData) => {
        if (!err && tokenData) {
          _data.delete("tokens", tokenId, (err) => {
            if (!err) {
              callback(200);
            } else {
              callback(500, { Error: "Internal error" });
            }
          });
        } else {
          callback(400, { Error: "Token not found" });
        }
      });
    } else {
      callback(400, { Error: "Malformed tokenId" });
    }
  },
  verifyToken(tokenId, phone, callback) {
    _data.read("tokens", tokenId, (err, tokenData) => {
      if (!err && tokenData) {
        if (tokenData.phone == phone && tokenData.expiresAt > Date.now()) {
          callback(true);
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    });
  },
};

module.exports = handlers;
