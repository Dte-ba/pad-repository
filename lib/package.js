/*!
 * Pad Repository - Package
 *
 * Copyright(c) 2013-2014 Dirección de Tecnología Educativa de Buenos Aires (Dte-ba)
 * GPL Plublic License v3
 */

var fs = require('fs')
  , archive = require('archiver')
  , io = require('./utils/io')
  , stream = require('stream')
  , unzip = require('unzip')
  , path = require('path')
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
 * Load the zip file read the info.
 * 
 * @param {Function} fn callback function
 * 
 */
Package.prototype.load = function(fn) {
  var self = this;
  
  if (self.loaded && ( fn && "function" === typeof fn )) {
      fn(null, self.info);
      return self
  }

  extractMetadata(self.filename, function(metadata){
      self.info = JSON.parse(metadata);
      self.uid = self.info.uid;
      self.loaded = true;
      fn(null, self);
  });

  return self;
};

/**
 * Serialize the content to save into the cache
 * 
 * @param {Function} fn callback function
 * 
 */
Package.prototype.serializeToCacheSync = function() {
  var self = this;

  return {
    uid: self.uid,
    filename: path.basename(self.filename),
    content: {
      area: self.info.content.area,
      axis: self.info.content.axis,
      block: self.info.content.block,
      tags: self.info.content.tags
    }
  };

}

/**
 * Extract the metadata of a package.zip
 */
function extractMetadata(filename, fn) {

  var writestream =  new stream.Stream();
  writestream.writable = true
  var metadata = '';
  
  writestream.write = function (data) {
    metadata = data.toString('utf-8');
    return true
  }

  writestream.end = function (data) {
    fn(metadata);
  }

  fs.createReadStream(filename)
  .pipe(unzip.Parse())
  .on('entry', function (entry) {
    var fileName = entry.path;

    if ((/^package.json$/i).test(fileName)) {
      entry.pipe(writestream);
    } else {
      entry.autodrain();
    }

  });

}