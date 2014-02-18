 /*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
 */
 
 /**
 * Initialize a new RepoStats
 *
 */
var Lexer = module.exports = function() {
	var self = this;

	if(false === (self instanceof Lexer)) {
			return new Lexer();
	}

	return self;
};