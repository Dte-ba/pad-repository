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
  , path = require('path')
  , chokidar = require('chokidar')
    // pad modules  
  , Repository = require('./repository')
  , Package = require('./package')
  , io = require('./utils/io')
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
module.exports.check = checkPackage;
module.exports.init  = initRepo;
module.exports.watch = watchRepo;
module.exports.cache = cacheRepo;
module.exports.clear = clearRepo;
module.exports.show  = showRepo;

/*
 * Vars
 */
var metadata = {};

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
 * Create a repo cache
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function cacheRepo(ops, fn) {
  var repoPath = ops.path
    , force = ops.withForce
    , withCreate = ops.withCreate || true
    , silince = ops.silince || false
    , bufferSize = ops.bufferSize || 5;

  if (!isRepoSync(repoPath)) {
    return fn && fn(new Error('The path `' + repoPath + '` is not a repository.'))
  }

  loadMetadataSync(repoPath);

  var dpath = path.join(repoPath, '/data')
    , pattern = /^.*.(zip|rar|tar|tar.gz)$/i;

  io.getFiles(dpath, pattern, function(err, files){

    var pkgs = files.map(function(f) {
      return function(callback){
          var pkg = new Package(path.join(dpath, f));
          pkg.load(callback);
        };
    });

    async.parallelLimit(pkgs, bufferSize,function(err, results){
      console.log(results);
      fn(err);
    });

  });

}

/**
 * Intialize and watch a repository
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function watchRepo(ops, fn) {
  
  var repoPath = ops.path
    , force = ops.withForce
    , withCreate = ops.withCreate || true
    , silince = ops.silince || false;

  var isR = isRepoSync(repoPath);

  if (!withCreate && !isR) {
    return fn && fn(new Error('The path `' + repoPath + '` is not a repository.'))
  }

  if (!isR && withCreate) {
    initRepo(ops, function(err){
      initWatchRepo(ops, fn);
    });
  } else {
    initWatchRepo(ops, fn);
  }

}

/**
 * Init to watch a existing repository
 *
 * @param {String} repoPath
 */
function initWatchRepo(ops, fn) {
  var repoPath = ops.path
    , silince = ops.silince || false
    , dpath = path.join(repoPath, '/data');

  var watcher = chokidar.watch(dpath, {ignored: /^\./, persistent: true});

  watcher
    .on('add', function(path) {console.log('File', path, 'has been added');})
    .on('change', function(path) {console.log('File', path, 'has been changed');})
    .on('unlink', function(path) {console.log('File', path, 'has been removed');})
    .on('error', function(error) {console.error('Error happened', error);});

  if (!silince) {
    console.log('watching the repository `' + dpath + '`');
  }
}

/**
 * Determine if the `repoPath` is a repository
 *
 * @param {String} repoPath
 */
function isRepoSync(repoPath) {

  if ( !fs.existsSync(repoPath) ) return false;
  
  if ( !fs.existsSync(path.join(repoPath, '/data')) ) return false;
  
  if ( !fs.existsSync(path.join(repoPath, '/.cache')) ) return false;
  
  if ( !fs.existsSync(path.join(repoPath, '/repository.json')) ) return false;

  return true;
}

function clearRepo(ops, fn) {

}

function showRepo(ops, fn) {
  
}


function loadMetadataSync(repoPath) {
  if (!isRepoSync(repoPath)) {
    throw new Error('The path `' + repoPath + '` is not a repository.');
  }
  var json = fs.readFileSync(path.join(repoPath, '/repository.json'), 'utf8');
  metadata = JSON.parse(json);
}