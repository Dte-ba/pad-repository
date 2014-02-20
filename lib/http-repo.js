/*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
 */


var 
    // ext modules  
    fs = require('fs')
  , sys = require('sys')
  , events = require('events')
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
  , express = require('express')
  ;

/**
 * Initialize a new HttpRepo with the `dir`.
 * and configure Express.js `app`
 *
 * @param {String} dir
 * @param {Object} app
 * @param {Object} serverHeadRoute
 */
var HttpRepo = module.exports = function(dir, app, serverHeadRoute) {
	var self = this;

	if(false === (self instanceof HttpRepo)) {
	  return new HttpRepo(dir);
	}

	Repository.call(self, dir);

	self.cacheFiles = {
		content: {},
		images: {}
	};

	self.contentRegistered  = false;

	// configure the routes
	if (serverHeadRoute !== undefined && "function" === typeof serverHeadRoute) {
		app.get('/metadata', serverHeadRoute);	
	}
  	
	app.get('/metadata/words/:filter?', function(req, res) {
		var filter = req.params.filter
		  , forceLevel = req.query.fl;

		self.getWords({ filter: filter, forceLevel: forceLevel}, function(err, data){
			if (err) {
				responseError(res, err)
				return;
			}
			res.charset = 'utf-8';
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(data));
		});
	});

	self.emit('log', 'GET method /metadata/words added to app');

	app.get('/metadata/packages', function(req, res) {
		self.getPackages({}, function(err, data){
			if (err) {
				responseError(res, err)
				return;
			}

			res.charset = 'utf-8';
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(data));
		});
	});

	self.emit('log', 'GET method /metadata/packages added to app');

	// the package

	//app.param('uid', /^[a-zA-Z0-9]+$/);
	
	app.get('/package/:uid', function(req, res) {
		
		var uid = req.params.uid;

		self.getContent(uid, 'metadata', function(err, data){
			if (err) {
				responseError(res, err)
				return;
			}
			res.charset = 'utf-8';
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(data));
		});
		
	});

	self.emit('log', 'GET method /package/:uid added to app');

	app.get('/package/:uid/image/:img', function(req, res) {
		
		var uid = req.params.uid;
		var img = {
			name: req.params.img,
			size: req.query.size
		}

		var s = req.query.size !== undefined ? req.query.size : '';
		var hash = uid + req.params.img + s;

		if (self.cacheFiles.images[hash] !== undefined) {
			var data = self.cacheFiles.images[hash];
			send(data);
		} else {
			self.getContent(uid, 'image', img, function(err, data){
				if (err) {
					responseError(res, err)
					return;
				}
				send(data);
				self.cacheFiles.images[hash] = data;
			});
		}
		
		function send(data) {
			if (data.type === 'file') {
				res.sendfile(data.filename);
			}
		}

	});

	self.emit('log', 'GET method /package/:uid/image/:img added to app');

	app.get('/package/:uid/content', function(req, res, next) {
		
		var uid = req.params.uid;

		if (self.cacheFiles.content[uid] !== undefined) {
			var data = self.cacheFiles.content[uid];
			send(data);
		} else {
			self.getContent(uid, 'content', function(err, data){
				if (err) {
					responseError(res, err)
					return;
				}
				self.cacheFiles.content[uid] = data;
				send(data);
			});
		}
				
		function send(data) {
			if (data.type === 'file') {
				res.set('Content-Disposition', 'filename=' + path.basename(data.filename));
				res.sendfile(data.filename);
			} else if (data.type === 'folder') {
				
				if (self.contentRegistered === false) {
					var p = path.join(self.config.cachePath, 'content');
					app.use(express.static(p));
					app.use(express.directory(p));
					self.contentRegistered = true;
				}
				
				//res.sendfile('index.html', { root: path.join(self.config.cachePath, 'content/', uid) });

				res.redirect('/' + uid);
				
				//res.charset = 'utf-8';
				//res.writeHead(200, {'Content-Type': 'application/json'});
				//res.end(JSON.stringify({ folder: data.name }));
			}
		}

	});

	self.emit('log', 'GET method /metadata/package/:uid/content added to app');

	app.get('/packages/find/:word', function(req, res) {
		
		var word = req.params.word;

		self.find(word, function(err, data) {
			if (err) {
				responseError(res, err)
				return;
			}

			res.charset = 'utf-8';
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(data));
		});
		
	});

	self.emit('log', 'GET method /packages/find/:word added to app');

	self.on('restored', function(){
		clearCache();
		self.emit('log', 'Cache restored');

		console.log('restored');
	});

	return self;

	function responseError(res, err) {
		res.charset = 'utf-8';
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err));

		throw err;
	}

};

// inherits the Repository
sys.inherits(HttpRepo, Repository);
