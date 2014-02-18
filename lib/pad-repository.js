/*!
 * Pad Repository
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
    // pad modules  
  , Repository = require('./repository')
  , Package = require('./package')
  , io = require('./utils/io')
  , RepoStats = require('./repo-stats')
  ;

var logger = require('custom-logger').config({ 
    level: 0,
    format: "\x1b[36m[pad-repo]\x1b[0m %timestamp% - %event% :%padding%%message%"
});


/**
 * Expose current version.
 */
 
module.exports.version = require("../package.json").version;

/**
 * Expose constructors.
 */

module.exports.Repository = Repository;

/*
 * Expose functionality
 */
module.exports.init  = initRepo;
module.exports.status  = statusRepo;
module.exports.add  = addRepo;


module.exports.check = checkPackage;
module.exports.watch = watchRepo;
module.exports.cache = cacheRepo;
module.exports.clear = clearRepo;
module.exports.show  = showRepo;
module.exports.configureRoutes  = configureRoutes;

/*
 * Vars
 */
var metadata = {}
  , stats = undefined
  , _repo;

var isWatching = module.exports.isWatching = false;


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

    fn && fn(null);
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
 * Configure the Routes on `app`
 *
 * @param {Object} app ExpressJS Server
 */
function configureRoutes(ops, app) {
  
  app.get('/metadata/words', function(req, res) {
    var repoPath = ops.path;
    refreshStatsSync(ops);

    res.charset = 'utf-8';
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end( JSON.stringify( stats.getAlias() ));

  });

  console.log('[pad-repository] GET method /metadata/words added to app');

}














/**
 * Check a package
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function checkPackage(ops, fn) {

  var filename = ops.path;

  var pkg = new Package(filename);

  pkg.load(function(err){
      console.log('pkg callback ends');
      
      console.log(pkg.info);

      fn(err);
  });

}

/**
 * Create a repo cache
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function cacheRepo(ops, fn) {
  var repoPath = ops.path
    , force = ops.withForce
    , withCreate = ops.withCreate || true
    , silince = ops.silince || false
    , bufferSize = ops.bufferSize || 5;

  if (!isRepoSync(repoPath)) {
    return fn && fn(new Error('The path `' + repoPath + '` is not a repository.'))
  }

  loadMetadataSync(repoPath);

  var dpath = path.join(repoPath, '/data')
    , pattern = /^[a-zA-Z0-9]+\.(zip|rar|tar|tar.gz)$/i;

  // get the data packages
  io.getFiles(dpath, pattern, function(err, files){

    //TODO: make the bufferSize automatic calculate the speedUp

    // retrive the new packages
    var ffiles = files.filter(function(f){
      return metadata.filename_uid[f] === undefined;
    });

    if (!silince) { 
      console.log(ffiles.length, 'packages to add'); 
    }
    
    // map the function to create the cache for `ffiles`
    var fns = ffiles.map(function(f) {
      return function(callback){
          
        addPackage(ops, path.join(dpath, f), callback);

      };
    });

    // run `fns` in parallel with `bufferSize` limit
     async.parallelLimit(
        fns, 
        bufferSize,
        function(err, results){
          var mres = results.map(function(pkg){
            return pkg.serializeToCacheSync();

          });
          
          delete results;

          addMetadata(ops, mres, fn);
      });

  });

}

function addPackage(ops, filename, callback){
  async.waterfall([
    // load the package
    function(cb) {
      loadPackage(filename, cb);
    },
    // create the cache
    function(pkg, cb) {
      cachePackage(ops, pkg, cb);
    }],
    function(err, res) {
      //console.log('res for waterfall', res)
      callback(err, res);
    }
  );
}

/**
 * Load a package
 *
 * @param {String} filename
 * @param {Function} fn
 */
function loadPackage(filename, fn) {

  return new Package(filename).load(fn);

}

/**
 * Create a package cache
 *
 * @param {Object} ops
 * @param {Package} pkg
 * @param {Function} fn
 */
function cachePackage(ops, pkg, fn) {
  var repoPath = ops.path
    , force = ops.withForce
    , silince = ops.silince || false
    ;
  
  var pathTo = path.join(repoPath, '.cache', pkg.uid);

  io.mkdir(pathTo, function(err){
    io.write(
      path.join(pathTo, 'package.json'), 
      JSON.stringify(pkg.info), 

      function(err) {
        fn && fn(err, pkg);
      }
    );
  });

}

/**
 * Intialize and watch a repository
 *
 * @param {Object} ops
 * @param {Function} fn
 */
function watchRepo(ops, fn) {
  
  var repoPath = ops.path
    , force = ops.withForce
    , withCreate = ops.withCreate || true
    , silince = ops.silince || false;

  var isR = isRepoSync(repoPath);

  if (!withCreate && !isR) {
    return fn && fn(new Error('The path `' + repoPath + '` is not a repository.'))
  }

  if (!isR && withCreate) {
    initRepo(ops, function(err){
      initWatchRepo(ops, fn);
    });
  } else {
    cacheRepo(ops, function(err) { 
      initWatchRepo(ops, fn)
    });
  }

}

/**
 * Init to watch a existing repository
 *
 * @param {String} repoPath
 */
function initWatchRepo(ops, fn) {
  var repoPath = ops.path
    , silince = ops.silince || false
    , dpath = path.join(repoPath, '/data');

  loadMetadataSync(repoPath);

  var watcher = chokidar.watch(dpath, {ignored: /^\./, persistent: true});

  watcher
    .on('add', function(dir) {
      var fexist = metadata.filename_uid[path.basename(dir)] !== undefined;
      
      if (!fexist) {
        process.nextTick(function(){
          addPackage(ops, dir, function(err, pkg){
            addMetadata(ops, [pkg.serializeToCacheSync()], function(err){
            });
          });
        });
      }

    })
    .on('change', function(dir) {
      console.log('File', dir, 'has been changed');
    })
    .on('unlink', function(dir) {
      console.log('File', dir, 'has been removed');
    })
    .on('error', function(error) {
      console.error('Error happened', error);
    });

  if (!silince) {
    console.log('watching the repository `' + dpath + '`');
  }

  module.exports.isWatching = true;

  fn && fn(null);
}

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

/**
 * Clear the repository
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
function clearRepo(ops, fn) {
  var repoPath = ops.path
    , silince = ops.silince || false
    ;

  if (!isRepoSync(repoPath)) {
    return fn && fn(new Error('The path `' + repoPath + '` is not a repository.'))
  }

  var repoObj = {
    packages: []
  };

  async.series([
    function(callback){ 
      wrench.rmdirRecursive(path.join(repoPath, '/.cache'), callback);
    },
    function(callback){ 
      io.mkdir(path.join(repoPath, '/.cache'), !silince, callback);
    },
    function(callback){ 
      io.write(
        path.join(repoPath, '/repository.json'),
        JSON.stringify(repoObj),
        !silince,
        callback  
      );
    }
  ],
  
  function(err, results){
    fn(err);
  });

}

/**
 * Show info about a repository
 *
 * @param {Object} ops
 * @param {Function} fn callbacks
 */
function showRepo(ops, fn) {
  var repoPath = ops.path;
  if (!isRepoSync(repoPath)) {
    return fn && fn(new Error('The path `' + repoPath + '` is not a repository.'))
  }

  loadMetadataSync(repoPath);

  var stats = new RepoStats();

  metadata.packages.forEach(function(uid){
    var ct = metadata.content[uid];

    stats.add( ct.area, 'area');
    stats.add( ct.axis, 'axis');
    stats.add( ct.block, 'block');
    stats.add( ct.tags, 'tags');

  });

  console.log('  \x1b[36mAreas\x1b[0m :', stats.counterFor('area'));
  console.log('   \x1b[36mAxis\x1b[0m :', stats.counterFor('axis'));
  console.log('  \x1b[36mBlock\x1b[0m :', stats.counterFor('block'));
  console.log('   \x1b[36mTags\x1b[0m :', stats.counterFor('tags'));
  console.log('   \x1b[36mDiff\x1b[0m :', stats.words.length);
  console.log('  \x1b[36mAlias\x1b[0m :', stats.getAlias().length);
  console.log('');
  console.log(metadata.packages.length.toString(), "proccesed.");
  //console.log('alias', stats.getAlias());
  fn && fn(null);
}


function loadMetadataSync(repoPath) {
  if (!isRepoSync(repoPath)) {
    throw new Error('The path `' + repoPath + '` is not a repository.');
  }
  var json = fs.readFileSync(path.join(repoPath, '/repository.json'), 'utf8');
  metadata = JSON.parse(json);
  metadata.content = metadata.content || {};
  metadata.filename_uid = metadata.filename_uid || {};
}

function addMetadata(ops, pkgs, fn) {
    var repoPath = ops.path
      , silince = ops.silince || false;

  var toAdd = pkgs.filter(function(item) {
    return metadata.content[item.uid] === undefined;
  });

  // add to metadata
  toAdd.forEach(function(item){
    metadata.packages.push(item.uid);
    // to optimize the searchs
    metadata.content[item.uid] = item.content;
    metadata.filename_uid[item.filename] = item.uid;
  });

  console.log(toAdd.length, 'proccesed');

  if (toAdd.length !== 0) {
    saveMetadata(ops, fn);
  } else {
    fn && fn(null);
  }
}

function saveMetadata(ops, fn) {
  var repoPath = ops.path
      , silince = ops.silince || false;

  io.write(
    path.join(repoPath, '/repository.json'),
    JSON.stringify(metadata),
    !silince,
    fn
  );
}

function refreshStatsSync(ops) {
  var repoPath = ops.path
      , silince = ops.silince || false;

  loadMetadataSync(repoPath);

  stats = new RepoStats();

  metadata.packages.forEach(function(uid){
    var ct = metadata.content[uid];

    stats.add( ct.area, 'area');
    stats.add( ct.axis, 'axis');
    stats.add( ct.block, 'block');
    stats.add( ct.tags, 'tags');

  });
}

