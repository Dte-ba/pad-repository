/*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
 */

// TODO: change me to global struct
// file status
var status = {
	  ready: 1,
	 cached: 2,
	missing: 32
};

var regexLib = {
	tagsSplit: /,\s*/ig
};

var specialChars = [
	{ val:'a', regex: /[áàãâä]/g },
	{ val:'e', regex: /[éèêë]/g },
	{ val:'i', regex: /[íìîï]/g },
	{ val:'o', regex: /[óòõôö]/g },
	{ val:'u', regex: /[úùûü]/g },
	{ val:'ñ', regex: /[ñ]/g },
	{ val:'A', regex: /[ÁÀÃÂÄ]/g },
	{ val:'E', regex: /[ÉÈÊË]/g },
	{ val:'I', regex: /[ÍÌÎÏ]/g },
	{ val:'O', regex: /[ÓÒÕÔÖ]/g },
	{ val:'U', regex: /[ÚÙÛ]/g },
	{ val:'N', regex: /[Ñ]/g }
];

/**
 * Initialize a new RepoStats
 *
 */
var RepoStats = module.exports = function(repo) {
	var self = this;

	if(false === (self instanceof RepoStats)) {
		return new RepoStats();
	}

	// initialize file counter
	self.fileStatus = {};
	self.fileStatus[status.ready] = 0;
	self.fileStatus[status.cached] = 0;
	self.fileStatus[status.ready] = 0;

	self.stats = {};
	self.alias = {};
	self.words = [];

	self.repository = repo;

	if (self.repository !== undefined) {
		self.repository.on('load', loadHandler);
	}

	return self;

	function loadHandler() {
		var mt = self.repository.metadata;
		
		// count the flags of the files
		for (var filename in mt.files) {
			var file = mt.files[filename];
			self.fileStatus[file.status]++;
		}
	}

};

RepoStats.prototype.add = function(target, type) {
	var self = this;

	var toAdd = [];

	if ("string" === typeof target) {

		if (type === 'tags' || type === 'tag') {
			toAdd = target.split(regexLib.tagsSplit);
		} else {
			toAdd = [ target ];
		}

	} else if (true === target instanceof Array) {
		toAdd = target;
	}

	toAdd.forEach(function(word) {
		
		var idx = getOrAdd(word);

		self.stats[type] = self.stats[type] !== undefined ? self.stats[type] : {};

		self.stats[type][idx] = self.stats[type][idx] === undefined 
											? 1 : self.stats[type][idx] + 1;

	});

	return self;

	function trim(word) {
		return word.replace(/(^\s+|\s+$)/g, '').replace(/\s+/g, ' ');
	}

	function scape(word) {
		var low = word.toLowerCase();

		specialChars.forEach(function(r){
			low = low.replace(r.regex, r.val);
		});

		return low;
	}

	function getOrAdd(word) {
		 var trimed = trim(word);
		 var scapdeWorg = scape(trimed);

		 self.alias[scapdeWorg] = self.alias[scapdeWorg] || [];

		 var idx = self.words.indexOf(trimed);
		 if (idx === -1) {
			idx = self.words.push(trimed);
		 }

		 if (self.alias[scapdeWorg].indexOf(idx) === -1) {
			self.alias[scapdeWorg].push(idx); 
		 }

		return idx;
	}

}

RepoStats.prototype.counterFor = function (type) {
	var self = this;
	var arr = self.stats[type];
	var ct = 0;

	for (var idx in arr) {
		ct++;
	}
	
	return ct;
}

RepoStats.prototype.getAlias = function() {
	var self = this;

	var res = [];

	for (var a in self.alias) {

		var obj = {};
		obj[a] = {
			alias: self.alias[a]
		};

		res.push(obj);
	}

	return res;
}

RepoStats.prototype.getFor = function(type) {
	var self = this;
	var arr = self.stats[type];
	var res = [];

	for (var idx in arr) {

		//console.log(idx);
		var ct = 0;
		var matches = self.stats[type][idx];
		var word = self.words[idx];
		
		var obj = {};
		obj[word] = { 
			matches: matches
		};

		res.push(obj);

	}

	return res;
}