process.env.NODE_ENV = 'test';

var fs = require('fs')
  , ncp = require('ncp')
  , padRepo = require('../')
  , assert = require('assert')
  , should = require('should')
  ;

var rightPackages = './test/cases/right'
  , wrongPackages = './test/cases/wrong';

describe('Pad-Repository', function() {

    describe('#init()', function(){

      it('should init the repository without error', function(done){
        padRepo.init({path: './test/output/repo'}, function(err){
          if (err) throw err;
          done();
        });

      })

    })

    describe('#status()', function(){

      it('should show status without error', function(done){
        padRepo.status({path: './test/output/repo'}, function(err){
          if (err) throw err;
          done();
        });
      })

    })

    describe('#status()', function() {

      before(function(done){
        // copy packages
        ncp(rightPackages, './test/output/repo/data', function (err) {
         if (err) throw err;
         done();
        });
      });

      it('should show status with ready packages without errors', function(done){
        padRepo.status({path: './test/output/repo'}, function(err, data){
          if (err) throw err;
          
          assert.ok(data !== undefined);
          assert.ok(data.ready > 0);

          done();
        });
      })

    })

    describe('#add()', function() {
     
      it('should add packages without error', function(done){
        padRepo.add({path: './test/output/repo'}, function(err, data){
          if (err) throw err;
          
          assert.ok(data.length > 0);

          done();
        });
      })

    })

    describe('#status()', function() {

      it('now should show status with cached packages without errors', function(done){
        padRepo.status({path: './test/output/repo'}, function(err, data){
          if (err) throw err;
          
          assert.ok(data !== undefined);
          assert.ok(data.cached > 0);

          done();
        });
      })

    })
})