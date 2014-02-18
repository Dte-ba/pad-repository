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

var version =  require("../package.json").version;

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

	self.metadata.on('log', function(msg){
		self.emit('log', msg);
	});

	events.EventEmitter.call(self);

	self.cache = new Cache(self);
	self.stats = new RepoStats(self);  

	self.errors = {};

	// init
	if (isRepoSync(dir)) {
		self.loadMetadata();
	}

	return self;
};

sys.inherits(Repository, events.EventEmitter);


Repository.prototype.construct = Repository;

/**
 * Reside an error
 */
Repository.prototype.resideError = function(err, fn) {
	var self = this;

	if (self.errors[err] !== undefined ) {
		// emit the error one time
		self.emit('error', err);
		self.errors[err] = err;
	}
	
	if (fn !== undefined) {
		fn(err);
		return self;
	}

	throw err;
}

/**
 * Load the metadata from a file
 */
Repository.prototype.loadMetadata = function() {
	var self = this;

	try {
		self.metadata.load(path.join(self.path, '/repository.json'));
		process.nextTick(function(){
			self.emit('log', 'metadata loaded');
		});
	} catch(e) {

	}

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
		if (err) { 
			return self.resideError(err, fn); 
		}
		
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
		return self.resideError(
			new Error('The directory `' + repoPath + '` is not empty and isn\'t a repository.'), 
			fn);
	}

	// make the cache folder if not exist
	if (!fs.existsSync(path.join(repoPath, '/.cache'))) {
		io.mkdirSync(path.join(repoPath, '/.cache'));
	}

	// reload metadata
	try {
		self.loadMetadata();
	} catch (e) {
		return self.resideError(e, fn);
	}

	// if i'm here so load the repo
	var dpath = path.join(repoPath, '/data')
	  , pattern = /^[a-zA-Z0-9]+\.(zip|rar|tar|tar.gz)$/i;

	// first: refresh files and set the status (use index for processed)
	io.getFiles(dpath, pattern, function(err, files){
		if (err) {
			return self.resideError(err, fn);
		}

		try {
			self.metadata.incoming(files);
			self.save(true);
		} catch (e) {
			return self.resideError(e, fn);
		}
		
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
		if (err) {
			return self.resideError(err, fn);
		}

		try {
			var fStats = self.metadata.filesStatus();
			fn && fn(null, fStats);
		} catch (e) {
			return self.resideError(e, fn);
		}

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
		if (err) {
			return self.resideError(err, fn);
		}

		// remove missing files
		var fremove = self.metadata.getFilesToRemove();

		if (fremove.length > 0) {
			//self.metadata.removeFile(fremove, true);
			//self.emit('log', fremove.length + ' missing file(s) removed');
			//self.save(true);
		}

		var fadd = self.metadata
				   .getFilesToAdd()
				   .map(function(f){
				   		// add the data path
				   		return path.join(dpath, f)
				   });

    async.eachSeries(fadd, function(filename, callback) {

    		async.waterfall([
    			function(cb) {
    				var pkg = new Package(filename);
						pkg.load();

						cb(null, pkg);
    			},
    			function(p, cb) {

    				try {
							self.metadata.register(p);
						} catch (e) {
							cb && cb(e);
						}

						delete p;
    				
    				cb && cb(null);
    			}
  			], function(err) {

  				if (err) {

						callback && callback(err);
					}

					callback && callback(null);
    		});


    }, function(err) {

    	try {
			  self.save(true);
			} catch (e) {
				return self.resideError(e, fn);
			}
		  
		  //self.emit('add', results);
		  fn && fn(null);
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
		if (err) {
			return self.resideError(err, fn);
		}

		var sts = self.metadata.filesStatus();

		if (sts.ready > 0 || sts.missing > 0) {
			// add the packages
			self.add({}, function(err){
				// wait to cache
				fn && fn(err);

			});
		} else {
			fn && fn(null);
		}

	});
	return self;
};

/**
 * Get packages with ops
 *
 * @param {Function} fn callbacks(data)
 */
Repository.prototype.getPackages = function(ops, fn) {
	var self = this;

	self.refresh(ops, function(err) {
		if (err) {
			return self.resideError(err, fn);
		}
		
		try {
			var pkgs = self.metadata.getPackges();
			fn && fn(null, pkgs);
		} catch (e) {
			return self.resideError(e, fn);
		}
	
	});

	return self;
};

/**
 * Get packages with ops
 *
 * @param {Function} fn callbacks(data)
 */
Repository.prototype.getPackage = function(uid, fn) {
	var self = this;
	
	self.getContent(uid, 'metadata', function(err, data) {
	    if (err) {
				return self.resideError(err, fn);
			}

			fn && fn(null, data);
	});

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
	  if (err) {
			return self.resideError(err, fn);
		}

		if ( !(/^(metadata|image|asset|content)$/i).test(type) ) {
			return self.resideError(new Error('No content "' + type + '" for '+ uid), fn);
		}

		// get package
		self.cache.resolve(uid, type, ops, function(cerr, data) {
	    if (cerr) {
				return self.resideError(cerr, fn);
			}

			fn && fn(null, data);
		});

	});
    
	return self;
};

/**
 * Find packages with match `word`
 *
 * @param {String} word
 * @param {Function} fn
 */
Repository.prototype.find = function(word, fn) {
	var self = this;
  
  self.refresh({}, function(err){

  	try {
  		var res = self.metadata.find(word);
  		fn && fn (null, res);
  	} catch (e) {
			return self.resideError(e, fn);
  	}

	});

	return self;
};

/**
 * Get diferets words with `ops`
 *
 * @param {Object} ops
 * @param {Function} fn callbacks(data)
 */
Repository.prototype.getWords = function(ops, fn) {
	var self = this;

	if ("function" === typeof ops) {
		fn = ops;
		ops = {};
	}

	self.refresh({}, function(err) {
		if (err) {
			return self.resideError(err, fn);
		}

		try {
  		var words = self.metadata.getWords(ops);
  		fn && fn(null, words);
  	} catch (e) {
			return self.resideError(e, fn);
  	}
		
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

