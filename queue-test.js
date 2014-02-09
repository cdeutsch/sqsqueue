var config = require("./config");
var sqsqueue = require("./lib/sqsqueue");
var aws = require("aws-lib");
var RSVP = require('rsvp');

sqsqueue.init(config)
.then(function() {

    var queue = sqsqueue.queue(function (task, callback) {
        console.log('hello ' + task);
        setTimeout(function() {
            
            callback();    
        }, 1000);
        
    }, 1);

    queue.drain = function() {
        console.log('drained');
    }

    queue.push('hi1');
    queue.push('hi2');
    queue.push('hi3');

    var xx = 3;

    setInterval(function() {
        xx += 1;
        queue.push('hi' + xx);
        xx += 1;
        queue.push('hi' + xx);
        xx += 1;
        queue.push('hi' + xx);
    },5000);

});

// throw unhandled RSVP errors.
RSVP.on('error', function(reason) {
    console.assert(false, reason);
});

