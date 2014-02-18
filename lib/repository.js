/*!
 * Pad Repository - Repository
 *
 * Copyright(c) 2013-2014 Dirección de Tecnología Educativa de Buenos Aires (Dte-ba)
 * GPL Plublic License v3
 */

var sys = require('sys')
  , events = require('events')
  , io = require('../lib/utils/io')
  , Cache = require('./repo-cache')
  ;

/**
 * Initialize a new Repository with the `options`.
 *
 * @param {Object} options
 */
var Repository = module.exports = function(options) {
  var self = this;

  if(false === (self instanceof Repository)) {
        return new Repository();
    }

  events.EventEmitter.call(self);

    return self;
};

sys.inherits(Repository, events.EventEmitter);