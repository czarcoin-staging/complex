/**
 * @module complex/config
 */

'use strict';

var fs = require('fs');
var assert = require('assert');
var inherits = require('util').inherits;
var merge = require('merge');
var _ = require('lodash');

var CONFIG_OVERRIDES = {
  amqpUrl: process.env.RABBITMQ_URL
};

/**
 * Abstract config for renters and landlords
 * @constructor
 * @param {Object} config
 * @param {String} config.amqpUrl - The URL for RabbitMQ
 * @param {Object} config.amqpOpts - Options to pass to Rabbit.js
 * @param {Number} config.logLevel - Verbosity level for logging
 */
function BaseConfig(config) {
  if (!(this instanceof BaseConfig)) {
    return new BaseConfig(config);
  }

  function compact(collection) {
    var _compact = function(result, overrideValue, overrideKey) {
      if (overrideValue != null && typeof(overrideValue) === 'object') {
        result[overrideKey] = _.reduce(overrideValue, reduceConfig, {});
      } else if (!!overrideValue) {
        result[overrideKey] = overrideValue;
      }
      return result;
    };

    return _.reduce(collection, _compact, {});
  }
  
  var compacted_overrides = compact(CONFIG_OVERRIDES);
  merge.recursive(Object.create(config), compacted_overrides);
  this._ = {};

  assert.ok(config, 'No config supplied');
  assert(typeof config.logLevel === 'number', 'Invalid logLevel');
  assert(typeof config.amqpUrl === 'string', 'Invalid amqpUrl');
  assert(typeof config.amqpOpts === 'object', 'Invalid amqpOpts');

  this._.logLevel = config.logLevel;
  this._.amqpUrl = config.amqpUrl;
  this._.amqpOpts = config.amqpOpts;
}

/**
 * Returns an plain object
 */
BaseConfig.prototype.toObject = function() {
  return Object.create(this._);
};

/**
 * Config for renters
 * @constructor
 * @extends {BaseConfig}
 * @param {Object} options
 * @param {String} options.mongoUrl - The URL for the MongoDB
 * @param {Object} options.mongoOpts - Options to pass to Mongoose
 * @param {String} options.networkPrivateKey - The private key for the renter
 * @param {Object} options.networkOpts - Options to pass to RenterInterface
 */
function RenterConfig(options) {
  if (!(this instanceof RenterConfig)) {
    return new RenterConfig(options);
  }

  BaseConfig.call(this, options);
  assert(typeof options.mongoUrl === 'string', 'Invalid mongoUrl');
  assert(typeof options.mongoOpts === 'object', 'Invalid mongoOpts');
  assert(
    typeof options.networkPrivateKey === 'string',
    'Invalid networkPrivateKey'
  );
  assert(typeof options.networkOpts === 'object', 'Invalid networkOpts');

  this._.networkPrivateKey = options.networkPrivateKey;
  this._.networkOpts = options.networkOpts;
  this._.mongoUrl = options.mongoUrl;
  this._.mongoOpts = options.mongoOpts;
}

inherits(RenterConfig, BaseConfig);

/**
 * Config for landlords
 * @constructor
 * @extends {BaseConfig}
 * @param {Object} options
 * @param {Number} options.serverPort - The port to listen on
 * @param {Object} options.serverOpts
 * @param {String} options.serverOpts.certificate - PEM SSL certificate
 * @param {String} options.serverOpts.key - PEM SSL key
 */
function LandlordConfig(options) {
  if (!(this instanceof LandlordConfig)) {
    return new LandlordConfig(options);
  }

  BaseConfig.call(this, options);
  assert(typeof options.serverPort === 'number', 'Invalid serverPort');
  assert(typeof options.serverOpts === 'object', 'Invalid serverOpts');

  this._.serverPort = options.serverPort;
  this._.serverOpts = options.serverOpts;
  this._.serverOpts.authorization = options.serverOpts.authorization || {};
}

inherits(LandlordConfig, BaseConfig);

/**
 * Loads the appropriate config type
 * @function
 * @param {String} configFilePath - The path to the config file on disk
 */
module.exports= function(configFilePath) {
  // TODO: this will raise an error if there's no config...
  // also, there are no defaults...
  var configBuffer = fs.readFileSync(configFilePath);
  var parsedConfig = JSON.parse(configBuffer.toString());

  function _createConfig(config) {
    assert(typeof config.type === 'string', 'Invalid type supplied');
    assert(
      ['Renter', 'Landlord'].indexOf(config.type) !== -1,
      'Invalid type supplied'
    );
    assert(typeof config.opts === 'object', 'Invalid opts supplied');

    switch (config.type) {
      case 'Renter':
        config = new RenterConfig(config.opts);
        config._.networkPrivateKey = fs.readFileSync(
          config._.networkPrivateKey
        ).toString('utf8').split('\n').join('');
        break;
      case 'Landlord':
        config = new LandlordConfig(config.opts);
        if (config._.serverOpts.certificate) {
          config._.serverOpts.certificate = fs.readFileSync(
            config._.serverOpts.certificate
          ).toString('utf8');
        }
        if (config._.serverOpts.key) {
          config._.serverOpts.key = fs.readFileSync(
            config._.serverOpts.key
          ).toString('utf8');
        }
        break;
      default:
        // noop
    }

    return config;
  }

  if (!Array.isArray(parsedConfig)) {
    return _createConfig(parsedConfig);
  } else {
    return parsedConfig.map(_createConfig);
  }
};

module.exports.RenterConfig = RenterConfig;
module.exports.LandlordConfig = LandlordConfig;
module.exports.BaseConfig = BaseConfig;
