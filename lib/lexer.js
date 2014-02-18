 /*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
 */

var wordsUtils = require('../lib/utils/words')
  , _ = require('underscore');

var wordLevel = {
  area: 1,
  axis: 2,
  block: 4,
  tag: 8
};

 /**
 * Initialize a new RepoStats
 *
 */
var Lexer = module.exports = function(metadata) {
	var self = this;

	if(false === (self instanceof Lexer)) {
			return new Lexer();
	}

  self.metadata = metadata;
  
  self.packages = {};
  self.wordInfo = {};
  self.words = [];

	return self;
};

/**
 * Register the `content` of a package.
 *
 * @param {Object} content
 */
Lexer.prototype.register = function(content, pindex) {
  var self = this;

  // if is registerd
  if (self.packages[pindex] !== undefined) {
    return self;
  }

  // WORDS REGISTRATION
  // area
  self.add(content.area, wordLevel.area, pindex);
  
  // axis
  self.add(content.axis, wordLevel.axis, pindex);

  // block
  self.add(content.block, wordLevel.block, pindex);

  if (content.tags) {
    content.tags.forEach(function(tag){
      self.add(tag, wordLevel.tag, pindex);
    });
  }

  self.packages[pindex] = true;

  return self;
}

/**
 * Serialize to json for save.
 *
 */
Lexer.prototype.serialize = function() {
  var self = this;

  return {
    packages: self.packages,
    wordInfo: self.wordInfo,
    words: self.words
  };

}

/**
 * Serialize to json for save.
 *
 */
Lexer.prototype.fill = function(json) {
  var self = this;

  if (json === undefined) {
    json = {};
  } else if ("string" === typeof json) {
    json = JSON.parse(json);
  }

  self.packages = json.packages || {};
  self.wordInfo = json.wordInfo || {};
  self.words = json.words || [];

  return self;
}

/**
 * Add a word.
 *
 * @param {Object} content
 */
Lexer.prototype.add = function(word, level, pindex) {
  var self = this;

  var idx = self.indexWord(word);

  var we = wordsUtils.escape(word);

  if (self.wordInfo[we] === undefined) {

    var m = {};

    m[wordLevel.area] = [];
    m[wordLevel.axis] = [];
    m[wordLevel.block] = [];
    m[wordLevel.tag] = [];

    self.wordInfo[we] = {
      words: [],
      levels: 0,
      count: 0,
      matches: m
    };

  }

  var wi = self.wordInfo[we];
  
  getOrAdd(wi.words, idx); // add the word if not exists
  wi.levels |= level;      // register the level
  wi.count++;              // count the word
  getOrAdd(wi.matches[level], pindex); // register the packages mateches

  return self;
}

/**
 * Get matches for the `word`.
 *
 * @param {String} word
 * @param {Boolean} forceLevel true as default
 */
Lexer.prototype.getMatches = function(word, forceLevel) {
  var self = this
    , res = [];

  forceLevel = (forceLevel === undefined) ? true : forceLevel;

  var wi = self.wordInfo[wordsUtils.escape(word)];

  if (wi !== undefined) {

    if ((wi.levels & wordLevel.area) === wordLevel.area) {
      // first level return all
      var m = wi.matches[wordLevel.area];
      
      if (forceLevel) { return  m;  }

      res = _.union(res, m);
    }

    if ((wi.levels & wordLevel.axis) === wordLevel.axis) {
      // second level return all
      var m = wi.matches[wordLevel.axis];

      if (forceLevel) { return  m;  }

      res = _.union(res, m);
    }

    if ((wi.levels & wordLevel.block) === wordLevel.block) {
      // thirt level return all
      var m = wi.matches[wordLevel.block];

      if (forceLevel) { return  m;  }

      res = _.union(res, m);
    }

    if ((wi.levels & wordLevel.tag) === wordLevel.tag) {
      // level four return all
      var m = wi.matches[wordLevel.tag];
      
      if (forceLevel) { return  m;  }

      res = _.union(res, m);
    }
  }
  
  return res;
}

/**
 * Get diferets words with `ops`
 *
 * @param {Object} ops
 */
Lexer.prototype.getWords = function(ops) {

  return this.words.map(function(w){
    return {
      word: w,
      weight: _.random(1, 10)
    }
  });
};



// WORDS

/**
 * Get or add the index word
 *
 * @param {String} word
 */
Lexer.prototype.indexWord = function(word) {
  return getOrAdd(this.words, word);
};

/**
 * Get or add the index word
 *
 * @param {String} word
 */
Lexer.prototype.getindexWord = function(word) {
  return getIndex(this.words, word);
};

// /PACKAGES

//
// private functions

/**
 * Retrieve or adds the index the `key` in the `arr`.
 * If the `dictionary` is not null returns `dictionary[index]` 
 * otherwise return the index.
 * 
 * TODO: make me an utils please (don't copy paste)
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