/**
 * $.rateLimit is a wrapper for a function to ensure the method is not
 * called more than every [rate]ms. No calls will be dropped, and a
 * $.Deferred is returned for the caller to hold on to requests.
 *
 * $.rateLimit plays nicely with $.ajax, allowing access to .abort()
 * and the actual xhr through .xhr
 *
 * Loosely based off of https://gist.github.com/1084831
 *
 * Parameters:
 *   func: function to rate limit
 *   rate: rate to limit at in ms
 *   opts: optional options:
 *         - async: whether to wait until the function is completed executing
 *                  before starting up the next one
 *         - abortedResopnse: object to return to failure handler on abort
 *
 * To use:
 *   // To call fn once every second:
 *   var fn = function () {};
 *   var rateLimitedFn = $.rateLimit(fn, 1000);
 *
 */
$.rateLimit = function (func, rate, opts) {
  var queue = [];
  var currentlyEmptyingQueue = false;

  // default options
  opts = $.extend({
    async: false,
    abortedResponse: {
      statusText: 'abort' 
    }
  }, opts);

  // execute an individual request
  var executeReq = function (req) {
    var r = req.fn.apply(req.scope, req.args);
    var proxy = req.promise;
    if (r.promise) {
      proxy.xhr = r;
      proxy.abort = r.abort;
      r.then(proxy.resolve, proxy.reject);
    } else {
      proxy.resolve(r);
    }
  };

  // handle next item in the queue
  var emptyQueue = function () {
    if (queue.length > 0) {
      // if queue has contents, check each request 1 by 1,
      // inserting a delay in between valid requests
      currentlyEmptyingQueue = true;
      var req = queue.shift();
      if (req.promise._aborted) {
        // if request is aborted, go to next one
        emptyQueue();
      } else {
        // otherwise, start up the request
        if (opts.async) {
          setTimeout(function () { executeReq(req); }, 0);
        } else {
          executeReq(req);
        }
        
        // wait rate limit before starting up the next one
        setTimeout(emptyQueue, rate);
      }
    } else {
      // if queue is empty, we're not emptying it
      currentlyEmptyingQueue = false;
    }
  };

  // abort/set aborted flag on request
  var abort = function () {
    this._aborted = true;
    this.reject(opts.abortedResponse);
  };

  return function () {
    // create deferred and setup promise
    var deferred = $.Deferred();
    deferred.abort = $.proxy(abort, deferred);

    // create request
    var req = {
      fn: func, 
      scope: this, 
      args: arguments,
      promise: deferred
    };

    // push request onto queue
    queue.push(req);

    // empty queue if we're not running already
    if (!currentlyEmptyingQueue) emptyQueue();

    // return promise
    return deferred;
  };
};
