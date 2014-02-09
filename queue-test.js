var config = require("./config");
var sqsqueue = require("./lib/sqsqueue");
var aws = require("aws-lib");
//var RSVP = require('rsvp');

var queue = sqsqueue.queue(function (task, callback) {
    console.log('hello ' + task);
    setTimeout(function() {
        
        callback();
    }, 3000);
    
}, 2);

queue.init(config);

queue.push('hi1');
queue.push('hi2');
queue.push('hi3');
queue.push('hi4');
queue.push('hi5');
queue.push('hi6');
queue.push('hi7');
queue.push('hi8');

setTimeout(function() {
    console.log('iphits:' + sqsqueue.iphits);
    console.log('ipGohits:' + sqsqueue.ipGohits);
    console.log('receiveCalls:' + sqsqueue.receiveCalls);
}, 30000);

    var xx = 6;
/*
    var interval = setInterval(function() {
        xx += 1;
        queue.push('hi' + xx);
        xx += 1;
        queue.push('hi' + xx);
        xx += 1;
        queue.push('hi' + xx);

        if (xx > 20) {
            console.log('iphits:' + sqsqueue.iphits);
            console.log('ipGohits:' + sqsqueue.ipGohits);
            console.log('receiveCalls:' + sqsqueue.receiveCalls);
            clearInterval(interval);
        }
    },3000);
*/

// throw unhandled RSVP errors.
//RSVP.on('error', function(reason) {
//    console.assert(false, reason);
//});

