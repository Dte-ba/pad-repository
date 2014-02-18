/*!
 * Pad Repository - Repository
 *
 * Copyright(c) 2013-2014 Dirección de Tecnología Educativa de Buenos Aires (Dte-ba)
 * GPL Plublic License v3
 */

var fs = require('fs')
  , sys = require('sys')
  , events = require('events')
  , io = require('../lib/utils/io')
  , path = require('path')
  , async = require('async')
  , Cache = require('./repo-cache')
  , Package = require('./package')
  , RepoStats = require('./repo-stats')
  , Metadata = require('./metadata')
  ;

var version =  '0.0.3';

// file status
var status = {
    ready: 1,
   cached: 2,
  missing: 32
};


/**
 * Initialize a new Repository with the `dir`.
 *
 * @param {String} dir
 */
var Repository = module.exports = function(dir) {
  var self = this;

  if(false === (self instanceof Repository)) {
    return new Repository(dir);
  }

  self.path = dir;

  self.metadata = new Metadata(version);

  events.EventEmitter.call(self);

  self.cache = new Cache(self);
  self.stats = new RepoStats(self);  

  // save on when metadata change
  self.metadata.on('change', function(){
    self.save(true);
    self.emit('log', 'data saved');
  });

  // init
  if (isRepoSync(dir)) {
    self.loadMetadata();
  }

  return self;
};

sys.inherits(Repository, events.EventEmitter);

/**
 * Load the metadata from a file
 */
Repository.prototype.loadMetadata = function() {
  var self = this;

  self.metadata.load(path.join(self.path, '/repository.json'));

  self.emit('log', 'metadata loaded');

  return self;
};

/**
 * Save metadata on /path/repo/to/repository.json
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
Repository.prototype.save = function(force) {
  var self = this;

  if ("function" === typeof force) {
    fn = force;
    force = false;
  }

  var repoPath = self.path
    , fileTo = path.join(repoPath, '/repository.json')
  ;

  force = force === undefined 
      ?  false 
      : force;

  if (!force && fs.existsSync(fileTo)) {
    throw new Error('The file', fileTo, 'exists, you can use override mode');
  }

  //write the file
  fs.writeFileSync(fileTo, self.metadata.serialize());

  return self;
};

/**
 * Initialize a repository with `ops`
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
Repository.prototype.create = function(ops, fn) {
  var self = this;
  var repoPath = self.path;

  async.series([
    function(callback) { 
      // create the path
      io.mkdir(repoPath, callback);
    },
    function(callback) {
      // create the path 
      io.mkdir(path.join(repoPath, '/data'), callback);
    },
    function(callback) { 
      // initialize the cache
      self.cache.create(callback);
    },
    function(callback){ 
      self.save(true, callback);
    }
  ],
  function(err, results){
    self.emit('init');
    fn(err);
  });

  return self;
};

/**
 * Load or Initialize a repository with `ops`
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
Repository.prototype.load = function(ops, fn) {
  var self = this;

  if ("function" === typeof ops) {
    fn = ops;
    ops = {};
  }

  var withCreate = ops.withCreate == undefined ? true : ops.withCreate
    , repoPath = self.path
    ;

  if (!fs.existsSync(repoPath) && withCreate) {
    // create the repository 
    // nothing to load
    return self.create(ops, fn);
  } else if (!io.emptyDirectorySync(repoPath) && !isRepoSync(repoPath)) {
    return fn && fn(new Error('The directory `' + repoPath + '` is not empty and isn\'t a repository.'));
  }

  // if i'm here so load the repo
  var dpath = path.join(repoPath, '/data')
    , pattern = /^[a-zA-Z0-9]+\.(zip|rar|tar|tar.gz)$/i;

  // first: refresh files and set the status (use index for processed)
  io.getFiles(dpath, pattern, function(err, files){

    self.metadata.incoming(files);

    // save information
    self.emit('load');

    fn && fn(null);
  });

  return self;
};

/**
 * Load a repository with `ops`
 *
 * @param {Object} ops
 * @param {Function} fn callbacks(data)
 */
Repository.prototype.status = function(ops, fn) {
  var self = this;

  if ("function" === typeof ops) {
    fn = ops;
    ops = {};
  }

  self.load(ops, function(err){
    fn && fn(err, self.metadata.filesStatus()); 
  })

  return self;
};

/**
 * Register the files with flag `ready` into the cache and metadata
 *
 * @param {Object} ops
 * @param {Function} fn callbacks(data)
 */
Repository.prototype.add = function(ops, fn) {
  var self = this
    , bufferSize = ops.bufferSize || 5
    , dpath = path.join(self.path, '/data');

  if ("function" === typeof ops) {
    fn = ops;
    ops = {};
  }

  self.load(ops, function(err){

    var fadd = self.metadata
           .getFilesToAdd()
           .map(function(f){
              // add the data path
              return path.join(dpath, f)
           });

    // load the packages in parallel
    var fns = fadd.map(function(filename) {
      return function(cb) {
        return new Package(filename).load(cb);
      };
    });

    // run `fns` in parallel with `bufferSize` limit
    async.parallelLimit(
      fns, 
      bufferSize,
      function(err, results){
        
        self.metadata.register(results);

        self.emit('add', results);
    });

    fn && fn(err);  
  })

  return self;
};

//
// private functions

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