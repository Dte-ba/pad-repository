/*!
 * Pad Repository - RepoCache
 *
 * Copyright(c) 2013-2014 Dirección de Tecnología Educativa de Buenos Aires (Dte-ba)
 * GPL Plublic License v3
 */

var fs = require('fs')
  , sys = require('sys')
  , events = require('events')
  , io = require('../lib/utils/io')
  , path = require('path')
  ;

/**
 * Initialize a new RepoCache for `repo`.
 *
 * @param {Object} repo
 */
var RepoCache = module.exports = function(repo) {
  var self = this;

  if(false === (self instanceof RepoCache)) {
      return new RepoCache(repo);
  }

  self.repository = repo;

  if (self.repository !== undefined) {
    self.repository.on('add', addHandler);
  }

  return self;

  function addHandler(pkg) {
    cachePackage({
      path: self.repository.path,
      withForce: true,
      silince: true
    }, pkg);
  }

};

/**
 * Initialize a repository with `ops`
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
RepoCache.prototype.create = function(fn) {
  var self = this;

  if (self.repository === undefined) {
    return fn && fn(new Error('The repository can not be undefined'));
  }

  var repoPath = self.repository.path;

  io.mkdir(path.join(repoPath, '/.cache'), fn);

  return self;
};


/**
 * Create a package cache
 *
 * @param {Object} ops
 * @param {Package} pkg
 * @param {Function} fn
 */
function cachePackage(ops, pkg, fn) {
  var repoPath = ops.path
    , force = ops.withForce
    , silince = ops.silince || false
    ;
  
  if (false === (pkg instanceof Array)) {
    pkg = [ pkg ];
  }

  pkg.forEach(function(p) {

    var pathTo = path.join(repoPath, '.cache', p.uid);

    io.mkdir(pathTo, function(err){
      io.write(
        path.join(pathTo, 'package.json'), 
        JSON.stringify(p.info),
        fn
      );
    });

  });
  
}