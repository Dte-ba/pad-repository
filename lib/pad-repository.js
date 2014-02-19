/*!
 * PAD-Repository
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
  , _ = require('underscore')
  , wrench = require('wrench')
  , express = require('express')
    // pad modules  
  , Repository = require('./repository')
  , HttpRepo = require('./http-repo')
  , Package = require('./package')
  , io = require('./utils/io')
  , wordsUtils = require('./utils/words')
  , RepoStats = require('./repo-stats')
  ;

var logger = require('custom-logger').config({ 
    level: 0,
    format: "pad-repo %event% %message%"
});


/**
 * Expose current version.
 */
 
module.exports.version = require("../package.json").version;

/**
 * Expose constructors.
 */

module.exports.Repository = Repository;
module.exports.HttpRepo = HttpRepo;

/*
 * Expose functionality
 */
module.exports.init  = initRepo;
module.exports.status  = statusRepo;
module.exports.add  = addRepo;
module.exports.serve  = serveRepo;
module.exports.find  = findPackages;
module.exports.restore  = restore;
module.exports.wordsUtils = wordsUtils;

/*
 * Vars
 */
var metadata = {}
  , stats = undefined
  , _repo;


/**
 * Create a repo with `ops` and handler the los
 *
 * @param {Object} ops
 */
function instanceRepo(ops) {
    
    if(_repo !== undefined && true === (_repo instanceof Repository)) {
        return _repo;
    }

    _repo = new Repository(ops.path);

    // log
    _repo
    .on('init', function(data) {
        logger.info('repository initialized on ' + _repo.path);
    })
    .on('log', function(msg) {
        logger.info(msg);
    });

    return _repo;
}

/**
 * Initialize the repository
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function initRepo(ops, fn) {
  
  // force create
  ops.withCreate = true;

  instanceRepo(ops).load(ops, fn);
}

/**
 * Show the status of the repo
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function statusRepo(ops, fn) {
  var repo = instanceRepo(ops);

  repo.status(ops, function(err, data){
    
    console.log(data);

    fn && fn(null, data);
  });

}

/**
 * Add the files with flag `ready`
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function addRepo(ops, fn) {
    instanceRepo(ops).add(ops, fn);
}

/**
 * Add the files with flag `ready`
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function findPackages(ops, fn) {
    var word = ops.word || '';
    instanceRepo(ops).find(word, fn);
}

/**
 * Initialize the repository on server mode
 *
 * @param {Object} ops
 */
function serveRepo(ops) {
    
  var port = process.env.PORT || ops.port;
  var app = express();

  var server = app.listen(port, function() {
    console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
  });

  app.configure(function() {
    app.set('port', port);
    
  });

  app.configure('development', function() {
    app.use(express.errorHandler());
    app.use(express.logger('dev'));
    // configure the path of the ImageMagick
    process.env.IMAGEMAGICK_PATH = 'D:\\bin\\ImageMagick-6.8.7-0\\';
  });

  var serverHeadRoute =  function(req, res) {
    res.charset = 'utf-8';
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      name: 'PAD Repository',
      version: module.exports.version,
      type: 'server'
    }));
  };
  
  ops.serverHeadRoute = serverHeadRoute;
  var repo = new HttpRepo(ops.path, app, serverHeadRoute);
  
  // the metadata information
  app.get('/',  serverHeadRoute);

  repo
  .on('init', function(data) {
    logger.info('repository initialized on ' + _repo.path);
  })
  .on('log', function(msg) {
    logger.info(msg);
  });

}

/**
 * Add the files with flag `ready`
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function restore(ops, fn) {
    instanceRepo(ops).restore(fn);
}

var env = process.env.NODE_ENV || 'dev';
