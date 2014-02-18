/*!
 * Pad Repository - RepoCache
 *
 * Copyright(c) 2013-2014 Dirección de Tecnología Educativa de Buenos Aires (Dte-ba)
 * GPL Plublic License v3
 */

var sys = require('sys')
  , events = require('events');

 /**
 * Initialize a new RepoCache with the `options`.
 *
 * @param {Object} options
 */
var RepoCache = module.exports.RepoCache = function(options) {
  var self = this;

  if(false === (self instanceof RepoCache)) {
        return new RepoCache();
    }

  events.EventEmitter.call(self);

    return self;
};

sys.inherits(RepoCache, events.EventEmitter);