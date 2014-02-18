/*!
 * Pad Repository
 *
 * Copyright(c) 2013-2014 Dirección de Tecnología Educativa de Buenos Aires (Dte-ba)
 * GPL Plublic License v3
 */

/**
  * Module dependencies.
  */
var 
    // ext modules  
    fs = require('fs')
  , async = require('async')
    // pad modules  
  , Repository = require('./repository')
  , Package = require('./package')
  , io = require('./utils/io')
  , path = require('path')
  ;


/**
 * Expose current version.
 */
 
 module.exports.version = require("../package.json").version;

 
/**
 * Expose constructors.
 */

module.exports.Repository = Repository;

/*
 * Expose functionality
 */

/*
module.exports.cache = cacheRepo;
module.exports.clear = clearRepo;
module.exports.check = checkFile;
module.exports.show  = showRepo;
*/

module.exports.check = checkPackage;
module.exports.init  = initRepo;
module.exports.watch = watchRepo;

/**
 * Check a package
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function checkPackage(ops, fn) {

  var filename = ops.path;

  var pkg = new Package(filename);

  pkg.load(function(err){
      console.log('pkg callback ends');
      
      console.log(pkg.info);

      fn(err);
  });

}

/**
 * Initialize the repository
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function initRepo(ops, fn) {
  
  var repoPath = ops.path
    , force = ops.withForce
    , silince = ops.silince || false;
  
  if (fs.existsSync(repoPath) && !io.emptyDirectorySync(repoPath)) {
    return fn && fn(new Error('The directory `' + repoPath + '` is not empty.'))
  }

  var repoObj = {
    packages: []
  };

  async.series([
    function(callback){ 
      io.mkdir(repoPath, !silince, callback);
    },
    function(callback){ 
      io.mkdir(path.join(repoPath, '/data'), !silince, callback);
    },
    function(callback){ 
      io.mkdir(path.join(repoPath, '/.cache'), !silince, callback);
    },
    function(callback){ 
      io.write(
        path.join(repoPath, '/repository.json'),
        JSON.stringify(repoObj),
        !silince,
        callback  
      );
    }
  ],
  function(err, results){
    fn(err);
  });

}

/**
 * Intialize and watch a repository
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function watchRepo(ops, fn) {

}