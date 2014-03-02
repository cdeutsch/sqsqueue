# sqsqueue.js

sqsqueue is a modified version of Caolan McMahon's [async.queue](https://github.com/caolan/async#queue) that is backed by [Amazon AWS SQS](http://aws.amazon.com/sqs/) which means your queued tasks will survive app crashes.

## Download

The source is available for download from
[GitHub](http://github.com/crdeutsch/sqsqueue).
Alternatively, you can install using Node Package Manager (npm):

    npm install sqsqueue

__Development:__ [sqsqueue.js](https://github.com/crdeutsch/sqsqueue/raw/master/lib/sqsqueue.js)

## Documentation

### queue(worker, concurrency)

Creates a queue object with the specified concurrency. Tasks added to the
queue will be saved to AWS SQS and processed in parallel (up to the concurrency limit). 

__Arguments__

* worker(task, callback) - An asynchronous function for processing a queued
  task, which must call its callback(err) argument when finished, with an 
  optional error as an argument.
  * task object
    * messageId - SQS MessageId
    * data - the original data passed in on "push"
* concurrency - An integer for determining how many worker functions should be
  run in parallel.

__Queue objects__

The queue object returned by this function has the following properties and
methods:

* init(config) - gets or creats the specified AWS SQS queue.
  * config object
    * awsKey - Your AWS key
    * awsPrivateKey - Your AWS private key
    * sqsQueueName - SQS queue name to use. If it doesn't exist it will be created.
* concurrency - an integer for determining how many worker functions should be
  run in parallel. This property can be changed after a queue is created to
  alter the concurrency on-the-fly.
* push(data, [callback]) - add a new task to the queue, the callback is called
  once the task has been saved in SQS (this is different then async.queue, where the callback is fired once the task is complete)
  instead of a single task, an array of tasks can be submitted. the respective callback is used for every task in the list.
    * callback(error, messageId)
      * error - null if there were no errors
      * SQS MessageId

__Example__

```js
// create a queue object with concurrency 2

var q = sqsqueue.queue(function (task, callback) {
    console.log(task.messageId + ' : ' + task.data);
    callback();
}, 2);

q.init({
    awsKey: "YOUR KEY",
    awsPrivateKey: "YOUR PRIVATE KEY",
    sqsQueueName: "MyQueue"
})

// add some items to the queue

q.push({name: 'foo'}, function (error, messageId) {
    console.log('Message added to queue: ' + messageId);
});
q.push({name: 'bar'}, function (error, messageId) {
    console.log('Message added to queue: ' + messageId);
});

// add some items to the queue (batch-wise)

q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function (error, messageId) {
    console.log('Message added to queue: ' + messageId);
});
```
