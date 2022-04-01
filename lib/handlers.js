const config = require("../config");
const _data = require("./data");
const helpers = require("./helpers");

/**
 * JSON API
 */

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
  checks(data, callback) {
    const allowedVerbs = ["post", "get", "put", "delete"];
    if (allowedVerbs.includes(data.method)) {
      handlers._checks[data.method](data, callback);
    } else {
      callback(405);
    }
  },
  notFound(data, callback) {
    callback(404);
  },
};

/**@USERS */

handlers._users = {
  post(data, callback) {
    console.log(data.payload);
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
    console.log(fName, lName, phone, pwd, tosAgreement);

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
    const phone = typeof (data.queryStringObj.phone == "string" && data.queryStringObj.phone.trim().length == 10)
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

/**@TOKENS */

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
      typeof data.payload.password == "string" && data.payload.password.trim().length > 0
        ? data.payload.password.trim()
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
      data.queryStringObj.id == "string" &&
      data.queryStringObj.id.trim().length == 20
    )
      ? data.queryStringObj.id.trim()
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

/**@CHECKS */

handlers._checks = {
  // Checks - post
  // Required data: protocol,url,method,successCodes,timeoutSeconds
  // Optional data: none
  post(data, callback) {
    // validate inputs
    const protocol =
      typeof data.payload.protocol == "string" &&
        data.payload.protocol.trim().length > 0
        ? data.payload.protocol
        : false;
    const url =
      typeof data.payload.url == "string" && data.payload.url.trim().length > 0
        ? data.payload.url
        : false;
    const method =
      typeof data.payload.method == "string" &&
        data.payload.method.trim().length > 0
        ? data.payload.method
        : false;
    const successCodes =
      Array.isArray(data.payload.successCodes) &&
        data.payload.successCodes.length > 0
        ? data.payload.successCodes
        : false;
    const timeoutSeconds =
      typeof data.payload.timeoutSeconds == "number" &&
        data.payload.timeoutSeconds % 1 == 0 &&
        data.payload.timeoutSeconds >= 1 &&
        data.payload.timeoutSeconds <= 5
        ? data.payload.timeoutSeconds
        : false;
    if (protocol && url && method && successCodes && timeoutSeconds) {
      //get token from headers
      const tokenId =
        typeof data.headers.token == "string" &&
          data.headers.token.trim().length > 0
          ? data.headers.token.trim()
          : false;
      // Lookup the user phone by reading the token
      _data.read("tokens", tokenId, (err, tokenData) => {
        if (!err && tokenData) {
          _data.read("users", tokenData.phone, (err, userData) => {
            if (!err && userData) {
              // Verify that user has less than the number of max-checks per user
              const userChecks = Array.isArray(userData.checks)
                ? userData.checks
                : [];
              if (userChecks.length < config.maxChecks) {
                // Create random id for check
                const checkId = helpers.randomString(20);
                // Create check object including userPhone
                const checkObj = {
                  id: checkId,
                  phone: tokenData.phone,
                  protocol,
                  url,
                  method,
                  successCodes,
                  timeoutSeconds,
                };
                // Save the object
                _data.create("checks", checkId, checkObj, (err) => {
                  if (!err) {
                    // Add check id to the user's object
                    userData.checks = userChecks;
                    userData.checks.push(checkId);
                    // Save the new user data
                    _data.update("users", userData.phone, userData, (err) => {
                      if (!err) {
                        // Return the data about the new check
                        callback(200, checkObj);
                      } else {
                        callback(500, { Error: "Could not update a user" });
                      }
                    });
                  } else {
                    callback(500, { Error: "Could not create a check" });
                  }
                });
              } else {
                callback(400, {
                  Error:
                    "The user already has the maximum number of checks (" +
                    config.maxChecks +
                    ").",
                });
              }
            } else {
              callback(403);
            }
          });
        } else {
          callback(403);
        }
      });
    } else {
      callback(400, {
        Error: "Missing required inputs, or inputs are invalid",
      });
    }
  },
  //Required data - ID
  //Optional data
  get(data, callback) {
    const checkId =
      typeof data.queryStringObj.checkId == "string" &&
        data.queryStringObj.checkId.trim().length == 20
        ? data.queryStringObj.checkId.trim()
        : false;
    if (checkId) {
      _data.read("checks", checkId, (err, checkData) => {
        if (!err && checkData) {
          const tokenId =
            typeof data.headers.token == "string" &&
              data.headers.token.trim().length == 20
              ? data.headers.token.trim()
              : false;
          handlers._tokens.verifyToken(
            tokenId,
            checkData.phone,
            (isValidToken) => {
              if (isValidToken) {
                callback(200, checkData);
              } else {
                callback(403);
              }
            }
          );
        } else {
          callback(404);
        }
      });
    } else {
      callback(400, { Error: "Missing required field, or field invalid" });
    }
  },
  //Required data - ID
  //Optional data - protocol, method, url, successCodes, timeoutSeconds
  put(data, callback) {
    const checkId =
      typeof data.payload.checkId == "string" &&
        data.payload.checkId.trim().length == 20
        ? data.payload.checkId.trim()
        : false;
    const protocol =
      typeof data.payload.protocol == "string" &&
        ["https", "http"].includes(data.payload.protocol.trim())
        ? data.payload.protocol
        : false;
    const url =
      typeof data.payload.url == "string" && data.payload.url.trim().length > 0
        ? data.payload.url
        : false;
    const method =
      typeof data.payload.method == "string" &&
        ["post", "get", "put", "delete"].includes(data.payload.method.trim())
        ? data.payload.method
        : false;
    const successCodes =
      Array.isArray(data.payload.successCodes) &&
        data.payload.successCodes.length > 0
        ? data.payload.successCodes
        : false;
    const timeoutSeconds =
      typeof data.payload.timeoutSeconds == "number" &&
        data.payload.timeoutSeconds % 1 == 0 &&
        data.payload.timeoutSeconds >= 1 &&
        data.payload.timeoutSeconds <= 5
        ? data.payload.timeoutSeconds
        : false;
    if (checkId) {
      if (protocol || url || method || successCodes || timeoutSeconds) {
        _data.read("checks", checkId, (err, checkData) => {
          if (!err && checkData) {
            const tokenId =
              typeof data.headers.token == "string" &&
                data.headers.token.trim().length == 20
                ? data.headers.token.trim()
                : false;
            handlers._tokens.verifyToken(
              tokenId,
              checkData.phone,
              (isValidToken) => {
                if (isValidToken) {
                  if (protocol) {
                    checkData.protocol = protocol;
                  }
                  if (url) {
                    checkData.url = url;
                  }
                  if (method) {
                    checkData.method = method;
                  }
                  if (successCodes) {
                    checkData.successCodes = successCodes;
                  }
                  if (timeoutSeconds) {
                    checkData.timeoutSeconds = timeoutSeconds;
                  }
                  _data.update("checks", checkId, checkData, (err) => {
                    if (!err) {
                      callback(200);
                    } else {
                      callback(500, { Error: "Could not update the check." });
                    }
                  });
                } else {
                  callback(403);
                }
              }
            );
          } else {
            callback(400, { Error: "Check ID did not exist." });
          }
        });
      } else {
        callback(400, { Error: "Missing fields to update." });
      }
    } else {
      callback(400, {
        Error: "Missing required inputs, or inputs are invalid",
      });
    }
  },
  delete(data, callback) {
    const checkId =
      typeof data.queryStringObj.checkId == "string" &&
        data.queryStringObj.checkId.trim().length == 20
        ? data.queryStringObj.checkId.trim()
        : false;
    if (checkId) {
      _data.read("checks", checkId, (err, checkData) => {
        if (!err && checkData) {
          const tokenId =
            typeof data.headers.token == "string" &&
              data.headers.token.trim().length == 20
              ? data.headers.token.trim()
              : false;
          handlers._tokens.verifyToken(
            tokenId,
            checkData.phone,
            (isValidToken) => {
              if (isValidToken) {
                _data.delete("checks", checkId, (err) => {
                  if (!err) {
                    _data.read("users", checkData.phone, (err, userData) => {
                      if (!err && userData) {
                        const userChecks = Array.isArray(userData.checks)
                          ? userData.checks
                          : [];
                        const checkPosition = userChecks.indexOf(checkId);
                        if (checkPosition > -1) {
                          userChecks.splice(checkPosition, 1);
                          userData.checks = userChecks;
                          _data.update(
                            "users",
                            checkData.phone,
                            userData,
                            (err) => {
                              if (!err) {
                                callback(200);
                              } else {
                                callback(500, {
                                  Error: "Could not update the user.",
                                });
                              }
                            }
                          );
                        } else {
                          callback(500, {
                            Error:
                              "Could not find the check on the user's object, so could not remove it.",
                          });
                        }
                      } else {
                        callback(500, { Error: "Could not fetch a user" });
                      }
                    });
                  } else {
                    callback(500, { Error: "Check deleting failure" });
                  }
                });
              } else {
                callback(403);
              }
            }
          );
        } else {
          callback(400, { Error: "Check ID did not exist." });
        }
      });
    } else {
      callback(400, { Error: "Missing required field, or field invalid" });
    }
  },
};

/**
 * HTML
 */

handlers.index = (data, callback) => {
  if (data.method === "get") {
    const templateData = {
      "body.title": "Update monitoring - made simple!",
      "head.title": "We offer free uptime monitoring for HTTP/HTTPS. WHen your site goes down we\'ll let you know",
      "body.class": "index",
    };
    helpers.getTemplate("index", templateData, (err, str) => {
      if (!err && str) {
        helpers.addUniversalTemplates(str, templateData, (err, str) => {
          if (!err && str) {
            callback(200, str, "html");
          } else {
            callback(500, undefined, "html");
          }
        });
      } else {
        callback(500, undefined, "html");
      }
    });
  } else {
    callback(405, undefined, "html");
  }
};

handlers.accountCreate = (data, callback) => {
  if (data.method === "get") {
    const templateData = {
      "body.title": "Create an account",
      "head.title": "Registration is easy and takes few seconds",
      "body.class": "accountCreate",
    };
    helpers.getTemplate("accountCreate", templateData, (err, str) => {
      if (!err && str) {
        helpers.addUniversalTemplates(str, templateData, (err, str) => {
          if (!err && str) {
            callback(200, str, "html");
          } else {
            callback(500, undefined, "html");
          }
        });
      } else {
        callback(500, undefined, "html");
      }
    });
  } else {
    callback(405, undefined, "html");
  }
}


handlers.sessionCreate = (data, callback) => {
  if (data.method === "get") {
    const templateData = {
      "body.title": "Login to an account",
      "head.title": "Please enter login and password",
      "body.class": "sessionCreate",
    };
    helpers.getTemplate("sessionCreate", templateData, (err, str) => {
      if (!err && str) {
        helpers.addUniversalTemplates(str, templateData, (err, str) => {
          if (!err && str) {
            callback(200, str, "html");
          } else {
            callback(500, undefined, "html");
          }
        });
      } else {
        callback(500, undefined, "html");
      }
    });
  } else {
    callback(405, undefined, "html");
  }
}

handlers.sessionDeleted = (data, callback) => {
  if (data.method === "get") {
    const templateData = {
      "body.title": "Logging Out",
      "head.title": "You've been successfully logged out",
      "body.class": "sessionDeleted",
    };
    helpers.getTemplate("sessionDeleted", templateData, (err, str) => {
      if (!err && str) {
        helpers.addUniversalTemplates(str, templateData, (err, str) => {
          if (!err && str) {
            callback(200, str, "html");
          } else {
            callback(500, undefined, "html");
          }
        });
      } else {
        callback(500, undefined, "html");
      }
    });
  } else {
    callback(405, undefined, "html");
  }
}

// Edit Your Account
handlers.accountEdit = function (data, callback) {
  // Reject any request that isn't a GET
  if (data.method == 'get') {
    // Prepare data for interpolation
    var templateData = {
      'head.title': 'Account Settings',
      'body.class': 'accountEdit'
    };
    // Read in a template as a string
    helpers.getTemplate('accountEdit', templateData, function (err, str) {
      if (!err && str) {
        // Add the universal header and footer
        helpers.addUniversalTemplates(str, templateData, function (err, str) {
          if (!err && str) {
            // Return that page as HTML
            callback(200, str, 'html');
          } else {
            callback(500, undefined, 'html');
          }
        });
      } else {
        callback(500, undefined, 'html');
      }
    });
  } else {
    callback(405, undefined, 'html');
  }
};





handlers.favicon = (data, callback) => {
  if (data.method === "get") {
    helpers.getStaticAsset("favicon.ico", (err, data) => {
      if (!err && data) {
        callback(200, data, "favicon");
      } else {
        callback(500);
      }
    });
  } else {
    callback(405);
  }
};

handlers.public = (data, callback) => {
  if (data.method === "get") {
    const trimmedAssetName = data.trimmedPath.replace("public/", "").trim();
    if (trimmedAssetName.length > 0) {
      helpers.getStaticAsset(trimmedAssetName, (err, data) => {
        if (!err && data) {
          let contentType = "plain";

          if (trimmedAssetName.indexOf(".css") > -1) {
            contentType = "css";
          }

          if (trimmedAssetName.indexOf(".png") > -1) {
            contentType = "png";
          }

          if (trimmedAssetName.indexOf(".jpg") > -1) {
            contentType = "jpg";
          }

          if (trimmedAssetName.indexOf(".ico") > -1) {
            contentType = "favicon";
          }
          callback(200, data, contentType);
        } else {
          callback(500);
        }
      });
    } else {
      callback(404);
    }
  } else {
    callback(405);
  }
};

module.exports = handlers;
