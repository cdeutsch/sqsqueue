var sqsqueue = require("./lib/sqsqueue");

// Create the configuration
var config = {
    awsKey: "TODO:",
    awsPrivateKey: "TODO:",
    sqsQueueName: "sqsqueue"
}

// create a new queue
var queue = sqsqueue.queue(function (task, callback) {
    
    console.log(task.messageId + ' : ' + task.data);
    
    setTimeout(function() {
        
        callback();
    }, 3000);
    
}, 2);

queue.init(config);

// create a callback
function showId(error, messageId) {
    if (error) {
        throw error;
    }
    else {
        console.log(messageId);
    }
}

// add jobs, when each job is finished it will call showId
queue.push('hi1', showId);
console.log('1');
queue.push('hi2', showId);
queue.push('hi3', showId);
queue.push('hi4', showId);
queue.push('hi5', showId);
queue.push('hi6', showId);
queue.push('hi7', showId);
queue.push('hi8', showId);
console.log('8');

setTimeout(function() {
    console.log('iphits:' + sqsqueue.iphits);
    console.log('ipGohits:' + sqsqueue.ipGohits);
    console.log('receiveCalls:' + sqsqueue.receiveCalls);
}, 15000);
