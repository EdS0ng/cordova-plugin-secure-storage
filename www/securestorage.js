var sjcl_ss = cordova.require('cordova-plugin-secure-storage.sjcl_ss');
var _AES_PARAM = {
    ks: 256,
    ts: 128,
    mode: 'ccm',
    cipher: 'aes'
 };
var CRED_FILE_PATH;

var _checkCallbacks = function (success, error) {

    if (typeof success != "function")  {
        console.log("SecureStorage failure: success callback parameter must be a function");
        return false;
    }

    if (typeof error != "function") {
        console.log("SecureStorage failure: error callback parameter must be a function");
        return false;
    }

    return true;
};

function _checkFileName (fileName) {
  if (fileName[0] === '/') {
    return false;
  }

  return true;
}

var SecureStorageiOS = function (success, error, service) {
    this.service = service;
    setTimeout(success, 0);
    return this;
};

SecureStorageiOS.prototype = {

    get: function (success, error, key) {
        if (_checkCallbacks(success, error))
            cordova.exec(success, error, "SecureStorage", "get", [this.service, key]);
    },

    set: function (success, error, key, value) {
        if (_checkCallbacks(success, error))
            cordova.exec(success, error, "SecureStorage", "set", [this.service, key, value]);
    },

    remove: function(success, error, key) {
        if (_checkCallbacks(success, error))
            cordova.exec(success, error, "SecureStorage", "remove", [this.service, key]);
    }
};

var SecureStorageAndroid = function (success, error, service) {
    this.service = service;
    cordova.exec(success, error, "SecureStorage", "init", [this.service]);
    return this;
};

SecureStorageAndroid.prototype = {

    get: function (success, error, fileName) {
        if (!_checkCallbacks(success, error)) return;
        if (!_checkFileName(fileName)) {
          error(new Error('File Name Cannot Start with /'));
          return;
        }
        if (!CRED_FILE_PATH) {
          CRED_FILE_PATH = cordova.file.dataDirectory;
        }

        window.resolveLocalFileSystemURL(CRED_FILE_PATH, function (fileSystem) {
          fileSystem.getFile(fileName+'.txt', {create:false}, function (fileEntry) {
            fileEntry.file(function (fileData) {
              var reader = new FileReader();

              reader.onloadend = function (evt) {
                if (evt.target.result !== undefined || evt.target.result !== null) {
                  var payload = evt.target.result;
                  try {
                    payload = JSON.parse(payload);
                  } catch (e) {
                    error(e);
                  }
                  // if (!payload) {
                  //   error(new);
                  //   return;
                  // }

                  var AESKey = payload.Key;

                  var successCB = function (AESKey) {
                    try {
                        var value = sjcl_ss.decrypt(sjcl_ss.codec.base64.toBits(AESKey), payload.value);
                        success(value);
                    } catch (e) {
                        error(e);
                    }
                  };

                  cordova.exec(successCB, error, "SecureStorage", "decrypt", [AESKey]);

                } else if (evt.target.error !== undefined || evt.target.error !== null) {
                  error(evt.target.error);
                } else {
                  error({code: null, message: 'READER_ONLOADEND_ERR'});
                }
              };

              reader.readAsText(fileData);
            }, function (err) {
              error(err);
            });
          }, function (err) {
            error(err);
          });
        }, function (err) {
          error(err);
        });
    },

    set: function (success, error, fileName, value) {
        if (!_checkCallbacks(success, error)) return;

        if (!CRED_FILE_PATH) {
          CRED_FILE_PATH = cordova.file.dataDirectory;
        }

        var AESKey = sjcl_ss.random.randomWords(8);
        _AES_PARAM.adata = this.service;
        value = sjcl_ss.encrypt(AESKey, value, _AES_PARAM);

        var successCB = function (encKey) {
          try {
            var encInfo = JSON.stringify({
              Key:encKey,
              value:value
            });
          }catch (e) {
            error(e);
          }

          window.resolveLocalFileSystemURL(CRED_FILE_PATH, function (fileSystem) {
            fileSystem.getFile(fileName+'.txt', {create:true, exclusive:false}, function (fileEntry) {
              fileEntry.createWriter(function (writer) {
                writer.onwriteend = function (evt) {
                  if (this.error) {
                    error(this.error);
                  }else {
                    success(fileName);
                  }
                };

                writer.write(encInfo);
              }, function (err) {
                error(err);
              });
            }, function (er) {
              error(er);
            });
          }, function (e) {
            error(e);
          });
        };

        // Encrypt the AES key
        cordova.exec(successCB,error,"SecureStorage", "encrypt", [sjcl_ss.codec.base64.fromBits(AESKey)]);
    },

    remove: function(success, error, fileName) {
      if (!CRED_FILE_PATH) {
        CRED_FILE_PATH = cordova.file.dataDirectory;
      }

        window.resolveLocalFileSystemURL(CRED_FILE_PATH, function (fileSystem) {
          fileSystem.getFile(fileName+'.txt', {create:false}, function (fileEntry) {
            fileEntry.remove(function () {
              success(fileName);
            }, function (err) {
              error(err);
            });
          }, function (e) {
            error(e);
          });
        }, function (er) {
          error(er);
        });
    }
};


var SecureStorageBrowser = function (success, error, service) {
    this.service = service;
    setTimeout(success, 0);
    return this;
};

SecureStorageBrowser.prototype = {

    get: function (success, error, key) {
        if (!_checkCallbacks(success, error))
            return;
        var value = localStorage.getItem('_SS_' + key);
        if (!value) {
            error('Key "' + key + '"not found.');
        } else {
            success(value);
        }
    },

    set: function (success, error, key, value) {
        if (!_checkCallbacks(success, error))
            return;

        localStorage.setItem('_SS_' + key, value);
        success(key);
    },

    remove: function(success, error, key) {
        localStorage.removeItem('_SS_' + key);
        success(key);
    }
};



var SecureStorage;

switch(cordova.platformId) {

    case 'ios':
        SecureStorage = SecureStorageiOS;
        break;

    case 'android':
        SecureStorage = SecureStorageAndroid;
        break;

    case 'browser':
        SecureStorage = SecureStorageBrowser;
        break;

    default:
        SecureStorage = null;
}

if (!cordova.plugins) {
    cordova.plugins = {};
}

if (!cordova.plugins.SecureStorage) {
    cordova.plugins.SecureStorage = SecureStorage;
}

if (typeof module != 'undefined' && module.exports) {
  module.exports = SecureStorage;
}
