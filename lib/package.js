/*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
 */


var fs = require('fs')
  , io = require('./utils/io')
  , stream = require('stream')
  , unzip = require('unzip')
  , path = require('path')
  , AdmZip = require('adm-zip')
  ;

/**
 * Initialize a new Package with the `options`.
 *
 * @param {String} zip The zip filename
 */
var Package = module.exports = function(zipfile) {
  var self = this;

  if(false === (self instanceof Package)) {
      return new Package();
  }

  self.filename = zipfile || '';
  self.loaded = false;

  self.uid = '';

  self.info = {};

  return self;
};

/**
 * Define if the package was errors
 * 
 */
Package.prototype.hasError = function() {
  return this.error !== undefined;
}

/**
 * Load the zip file read the info.
 * 
 * @param {Function} fn callback function
 * 
 */
Package.prototype.load = function(fn) {
  var self = this;
  
  // make sure that the package has not errors in the begining
  self.error = undefined;

  if (self.loaded === true && ( fn && "function" === typeof fn )) {
      fn(null, self.info);
      return self
  }

  try {
    
    var AdmZip = require('adm-zip');
    var zip = new AdmZip(path.resolve(self.filename));
    // extract the json
    var metadata = zip.readAsText('package.json');
    self.info = JSON.parse(metadata);
    self.uid = self.info.uid;

  } catch (e) {
    self.error = e;
  }
  
  fn && fn(null, self);

  return self;
};

/**
 * Serialize the content to save into the cache
 * 
 * @param {Function} fn callback function
 * 
 */
Package.prototype.serializeToCache = function() {
  var self = this;

  return {
    uid: self.uid,
    content: {
      area: self.info.content.area,
      axis: self.info.content.axis,
      block: self.info.content.block,
      tags: self.info.content.tags,
      title: self.info.content.title
    }
  };

}

/**
 * Extract the `entryName` file into de `relative` path
 * 
 * @param {String|Array} entryName
 * @param {String} relative
 * @param {Function} fn callback function
 * 
 */
Package.prototype.extract = function(entryName, relative, fn) {
  var self = this;

  var AdmZip = require('adm-zip');
  
  var zip = new AdmZip(path.resolve(self.filename));
  
  var ets = entryName;

  if (false === entryName instanceof Array) {
    ets = [ entryName ];
  }

  // has errors
  var he = false;

  ets.forEach(function(entry){

      try {
        if (!he) {
          zip.extractEntryTo(
            entry /*entry name*/, 
            relative /*target path*/, 
            true /*maintainEntryPath*/, 
            true /*overwrite*/
          );
        }
      } catch(e) {
        console.log(entry)
        he = true;
        //fn && fn(e, null);
      }
      
  });

  if (!he) {
    fn && fn(null);
  }

  return self;
}