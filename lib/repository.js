 /*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
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

	self.path = path.resolve(dir);

	self.config = {
		dataPath: path.join(self.path, 'data'),
		cachePath: path.join(self.path, '.cache')
	};

	self.metadata = new Metadata(version);

	events.EventEmitter.call(self);

	self.cache = new Cache(self);
	self.stats = new RepoStats(self);  

	// init
	if (isRepoSync(dir)) {
		self.loadMetadata();
	}

	return self;
};

sys.inherits(Repository, events.EventEmitter);


Repository.prototype.construct = Repository;

/**
 * Load the metadata from a file
 */
Repository.prototype.loadMetadata = function() {
	var self = this;

	self.metadata.load(path.join(self.path, '/repository.json'));

	process.nextTick(function(){
		self.emit('log', 'metadata loaded');
	});

	return self;
};

/**
 * Save metadata on /path/repo/to/repository.json
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
Repository.prototype.save = function(force, first) {
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
		throw new Error('The file %s exists, you can use override mode', fileTo);
	}

	//write the file
	if (first === true || self.metadata.hasChange === true) {
		fs.writeFileSync(fileTo, self.metadata.serialize());
		self.metadata.hasChange = false;
		self.emit('log', 'data saved');
	}
	
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
		  self.save(true, true);
		  callback && callback();
		}
	],
	function(err, results){
		if (err) throw true;

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

	// make the cache folder if not exist
	if (!fs.existsSync(path.join(repoPath, '/.cache'))) {
		io.mkdirSync(path.join(repoPath, '/.cache'));
	}

	// reload metadata
	self.loadMetadata();

	// if i'm here so load the repo
	var dpath = path.join(repoPath, '/data')
	  , pattern = /^[a-zA-Z0-9]+\.(zip|rar|tar|tar.gz)$/i;

	// first: refresh files and set the status (use index for processed)
	io.getFiles(dpath, pattern, function(err, files){
		if (err) throw true;

		self.metadata.incoming(files);
		self.save(true);

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

	self.load(ops, function(err) {
		if (err) throw true;

		fn && fn(err, self.metadata.filesStatus());	
	});

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
		if (err) throw true;

		var fadd = self.metadata
				   .getFilesToAdd()
				   .map(function(f){
				   		// add the data path
				   		return path.join(dpath, f)
				   });

		// load the packages in parallel
		var fns = fadd.map(function(filename) {
			return function(cb) {
				var pkg = new Package(filename);
				pkg.load.apply(pkg, [cb]);
			};
		});

		// run `fns` in parallel with `bufferSize` limit
		async.parallelLimit(
			fns, 
			bufferSize,
			function(err, results){
			  if (err) throw true;

			  self.metadata.register(results);
			  self.save(true);
			  self.emit('add', results);

			  if (fn !== undefined) {
			  	process.nextTick(function() {
			  		fn(null, results);
			  	});	
			  }
		});

		
	})

	return self;
};

/**
 * Refresh the repository information a repository with `ops`
 *
 * @param {Object} ops
 * @param {Function} fn callbacks(data)
 */
Repository.prototype.refresh = function(ops, fn) {
	var self = this;

	if ("function" === typeof ops) {
		fn = ops;
		ops = {};
	}

	self.load(ops, function(err) {
		if (err) throw true;

		var sts = self.metadata.filesStatus();

		if (sts.ready > 0) {
			// add the packages
			self.add({}, function(err){
				// wait to cache
				process.nextTick(function(){
					fn && fn(null);
				});

			});
		} else {
			fn && fn(null);
		}

	});
	return self;
};

/**
 * Get package content
 *
 * Pre-condition: The function asume that the package was cached before
 *
 * @param {String} uid
 * @param {String} type
 * @param {String} ops
 * @param {Function} fn
 */
Repository.prototype.getContent = function(uid, type, ops, fn) {
	var self = this
	  , type = type.toLowerCase();

    if ("function" === typeof ops) {
		fn = ops;
		ops = '';
	}

    self.refresh({}, function(err){
	  
		if ( !(/^(metadata|image|asset|content)$/i).test(type) ) {
		  return fn && fn(new Error('No content "' + type + '" for '+ uid));
		}

		// get package
		self.cache.resolve(uid, type, ops, fn);

	});
    
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
  
  if ( !fs.existsSync(path.join(repoPath, '/repository.json')) ) return false;

  return true;
}