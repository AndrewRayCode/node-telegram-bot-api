'use strict';

var debug = require('debug')('node-telegram-bot-api');
var Promise = require('bluebird');
var request = require('request');
var URL = require('url');

var requestPromise = Promise.promisify(request);

var TelegramBotPolling = function (token, options, callback) {
  options = options || {};
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.offset = 0;
  this.token = token;
  this.callback = callback;
  this.timeout = options.timeout || 10;
  this.interval = (typeof options.interval === 'number') ? options.interval : 300;
  this.lastUpdate = 0;
  this.lastRequest = null;
  this.abort = false;
  this._polling();
};

TelegramBotPolling.prototype._polling = function () {
  var self = this;

  this.lastRequest = this._getUpdates().then(function (updates) {
    self.lastUpdate = Date.now();
    debug('polling data %j', updates);
    updates.forEach(function (update, index) {
      // If is the latest, update the offset.
      if (index === updates.length - 1) {
        self.offset = update.update_id;
        debug('updated offset: %s', self.offset);
      }
      self.callback(update);
    });
  }).catch(function (err) {
    debug('polling error: %j', err);
  }).finally(function () {
    if (self.abort) {
      debug('Polling is aborted!');
      return;
    }

    debug('setTimeout for %s miliseconds', self.interval);
    setTimeout(self._polling.bind(self), self.interval);
  });
};

TelegramBotPolling.prototype._getUpdates = function () {
  var opts = {
    qs: {
      offset: this.offset+1,
      limit: this.limit,
      timeout: this.timeout
    },
    url: URL.format({
      protocol: 'https',
      host: 'api.telegram.org',
      pathname: '/bot'+this.token+'/getUpdates'
    })
  };
  debug('polling with options: %j', opts);
  return requestPromise(opts).cancellable().then(function (resp) {
    if (resp[0].statusCode !== 200) {
      throw new Error(resp[0].statusCode+' '+resp[0].body);
    }
    var data = JSON.parse(resp[0].body);
    if (data.ok) {
      return data.result;
    } else {
      throw new Error(data.error_code+' '+data.description);
    }
  });
};

module.exports = TelegramBotPolling;
