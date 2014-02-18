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
	, _ = require('underscore')
	, words = require('../lib/utils/words')
	, Lexer = require('./lexer')
	;

// file status
var status = {
		ready: 1,
	 cached: 2,
	missing: 32
};


/**
 * Initialize a new Metadata.
 *
 */
var Metadata = module.exports = function(version) {
	var self = this;

	if(false === (self instanceof Metadata)) {
		return new Metadata();
	}

	self.version = version || '0.0.1';

	self.packages = [];
	self.files = [];

	self.filesStats = {};
	self.lexer = new Lexer(self);

	events.EventEmitter.call(self);

	return self;
};

sys.inherits(Metadata, events.EventEmitter);

/**
 * Serialize to json string
 */
Metadata.prototype.serialize = function() {
	var self = this;
	
	return JSON.stringify({
		packages: self.packages,
		files: self.files,
		filesStats: self.filesStats,
		content: self.content,
		lexer: self.lexer.serialize()
	});

};

/**
 * Load metadata from a json
 */
Metadata.prototype.load = function(filename) {
	var self = this;

	var json = fs.readFileSync(filename, 'utf8');
	var mt = json == '' ? {} : JSON.parse(json);
	self.version = mt.version || "0.0.1";
	self.packages = mt.packages || [];
	self.files = mt.files || [];
	self.filesStats = mt.filesStats || {};
	self.content = mt.content || {};

	self.lexer.fill(mt.lexer);

	return self;
};

/**
 * get file status
 */
Metadata.prototype.filesStatus = function() {
	var self = this;

	var st = {
		ready: 0,
		missing: 0,
		cached: 0
	};

	// file status
	for (var idx in self.filesStats) {
		var f = self.filesStats[idx];
		switch (f) {
			case status.ready:
				st.ready++;
			break;
			case status.cached:
				st.cached++;
			break;
			case status.missing:
				st.missing++;
			break;
			default:
				st[none] = st[none] !== undefined ? st[none]++ : 1;
			break;
		}
	}

	return st;
};

/**
 * get packages information
 */
Metadata.prototype.getPackges = function(excludeMissing) {
	var self = this;
	excludeMissing = excludeMissing === undefined ? true: excludeMissing;

	var contents = self.packages.map(function(uid) {
		return self.content[self.packages.indexOf(uid)];
	});

	if (excludeMissing) {
		contents = contents.filter(function(p){
			return !self.isMissingFile(self.getFilename(p.uid));
		});
	}

	return contents;
};

/**
 * Get the package metadata
 *
 * @param {uid} uid
 */
Metadata.prototype.getInfo = function(uid) {
	var self = this;
	
	var pkg = self.content[self.packages.indexOf(uid)];
	pkg.filename = self.files[pkg.fileIndex]

	return pkg;
};


/**
 * Get file with flag `ready`
 */
Metadata.prototype.getFilesToAdd = function() {
	var self = this
	  , res = [];
    
    for (var idx in self.filesStats) {
		if (self.filesStats[idx] !== status.ready) {
			continue;
		}

		res.push(idx);
	}

    return res.map(function(idx){
    	return self.files[idx];
    });
};

/**
 * File incoming to process
 *
 * @param {Array} files
 */
Metadata.prototype.incoming = function(files) {
	var self = this;

	var nf = []; // new files

	if (files.length > 0) {

		files.forEach(function(f) {
			var fname = path.basename(f);
			var idx = self.indexFile(fname);

			// if is not registered
			if (self.getFileStats(fname) === undefined || self.isMissingFile(fname)) {
				self.setFileStats(fname, status.ready);
				nf.push(fname);
			}
		}); 

		// other files are missing
		var diff = _.difference(self.files, files);

		self.setFileStats(diff, status.missing);
		if (diff.length > 0 || nf.length > 0) {
			self.hasChange = true;
		}
	} else if (self.files.length > 0) {
		// set all files on flag missing
		self.setFileStats(self.files, status.missing);
		self.hasChange = true;
	}

	return self;
};

/**
 * Register a package or an array of them.
 *
 * @param {Package|Array} pkg
 */
Metadata.prototype.register = function(pkg) {
	var self = this;

	if (false === (pkg instanceof Array)) {
		pkg = [ pkg ];
	}

	pkg.forEach(function(p) {

		if (p.hasError()) {
			self.emit('log', 'WARNING: the packages ' + path.basename(p.filename)+ ' have errors')
		} else {
			var idx = self.indexPackage(p.uid)
			  , fname = path.basename(p.filename);

			var idxFile = self.getIndexFile(fname);

			var obj = {
				uid: p.uid,
				fileIndex: idxFile,
			    content: {
			      area: p.info.content.area,
			      axis: p.info.content.axis,
			      block: p.info.content.block,
			      tags: words.splitTags(p.info.content.tags),
			      title: p.info.content.title
			    }
			};

			self.content[idx] = obj;
			self.setFileStats(fname, status.cached);
			// register into the lexer
			self.lexer.register(obj.content, idx);
			self.hasChange = true;
		}
	});

	return self;
};


/**
 * Find packages with match `word`
 *
 * @param {String} word
 */
Metadata.prototype.find = function(word) {
	var self = this;

	var pkgIndexs = self.lexer.getMatches(word);

	return pkgIndexs.map(function(idx){
			return self.content[idx];
	});

};


/**
 * Get diferets words with `ops`
 *
 * @param {Object} ops
 */
Metadata.prototype.getWords = function(ops) {
	return this.lexer.getWords(ops)	
};

// PACKAGES

/**
 * Get the index package
 *
 * @param {String} uid
 */
Metadata.prototype.indexPackage = function(uid) {
	return getOrAdd(this.packages, uid);
};

/**
 * Get the index for a package
 *
 * @param {String} uid
 */
Metadata.prototype.getIndexPackage = function(uid) {
	return getIndex(this.packages, uid);
};

// /PACKAGES

// FILES

/**
 * Get the index file
 *
 * @param {String} filename
 */
Metadata.prototype.indexFile = function(filename) {
	return getOrAdd(this.files, filename);
};

/**
 * Get the index for a file
 *
 * @param {String} filename
 */
Metadata.prototype.getIndexFile = function(filename) {
	return getIndex(this.files, filename);
};

/**
 * Get the index for a file
 *
 * @param {String} filename
 */
Metadata.prototype.getFileStats = function(filename) {
	return this.filesStats[this.getIndexFile(filename)];
};

/**
 * Get the index for a file
 *
 * @param {String} filename
 */
Metadata.prototype.getFilename = function(uid) {
	var pkg = this.content[this.getIndexPackage(uid)];
	return this.files[pkg.fileIndex];
};

/**
 * Set the index for a file
 *
 * @param {String} filename
 */
Metadata.prototype.setFileStats = function(file, stat) {
	var self = this;
	if (file instanceof Array) {
		file.forEach(function(f){
			self.filesStats[self.getIndexFile(f)] = stat;
		});
	} else {
		self.filesStats[self.getIndexFile(file)] = stat;
	}
};

/**
 * Is missing?
 *
 * @param {String} filename
 */
Metadata.prototype.isMissingFile = function(filename) {
	return this.isInFlagFile(filename, status.missing);
};

/**
 * Is ready?
 *
 * @param {String} filename
 */
Metadata.prototype.isReadyFile = function(filename) {
	return this.isInFlagFile(filename, status.ready);
};


/**
 * Is cached?
 *
 * @param {String} filename
 */
Metadata.prototype.isCachedFile = function(filename) {
	return this.isInFlagFile(filename, status.cached);
};

/**
 * Is in `flag`?
 *
 * @param {String} filename
 */
Metadata.prototype.isInFlagFile = function(filename, flag) {
	var f = this.filesStats[this.getIndexFile(filename)];
	if (f === undefined) {
		return false;
	}

	return (f & flag) === flag;
};
// /FILES


/**
 * Get the current index
 */
function getIndex(arr, key) {
	return arr.indexOf(key);
}

//
// private functions

/**
 * Retrieve or adds the index the `key` in the `arr`.
 * If the `dictionary` is not null returns `dictionary[index]` 
 * otherwise return the index.
 * 
 *
 * @param {Array} arr
 * @param {Object} key
 *
 */
function getOrAdd(arr, key) {
	if (arr.indexOf(key) === -1) {
		arr.push(key);    
	}

	return arr.indexOf(key);
}