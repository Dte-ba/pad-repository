/*!
 * This file is part of PAD-Repository
 *
 * Please see the LICENSE file
 */


/**
 * Expose functions
 */
exports.confirm = confirm;
exports.prompt = prompt;
exports.abort = abort;

 /**
 * Prompt confirmation with the given `msg`.
 *
 * @param {String} msg
 * @param {Function} fn
 */

function confirm(msg, fn) {
  prompt(msg, function(val){
    fn(/^ *y(es)?/i.test(val));
  });
}

/**
 * Prompt input with the given `msg` and callback `fn`.
 *
 * @param {String} msg
 * @param {Function} fn
 */

function prompt(msg, fn) {
  // prompt
  if (' ' == msg[msg.length - 1]) {
    process.stdout.write(msg);
  } else {
    console.log(msg);
  }

  // stdin
  process.stdin.setEncoding('ascii');
  process.stdin.once('data', function(data){
    fn(data);
  }).resume();
}

/**
 * Exit with the given `str`.
 *
 * @param {String} str
 */

function abort(str) {
  console.log.apply(null, arguments);
  process.exit(1);
}