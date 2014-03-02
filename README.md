# sqsqueue.js

sqsqueue is a modified version of Caolan McMahon's [async.queue](https://github.com/caolan/async#queue) that is backed by Amazon AWS SQS which means your queued tasks will survive app crashes.

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
* push(task, [callback]) - add a new task to the queue, the callback is called
  once the worker has finished processing the task.
  instead of a single task, an array of tasks can be submitted. the respective callback is used for every task in the list.

__Example__

```js
// create a queue object with concurrency 2

var q = sqsqueue.queue(function (task, callback) {
    console.log('hello ' + task.name);
    callback();
}, 2);

q.init({
    awsKey = "YOUR KEY",
    awsPrivateKey = "YOUR PRIVATE KEY",
    sqsQueueName = "MyQueue"
})

// add some items to the queue

q.push({name: 'foo'}, function (err) {
    console.log('finished processing foo');
});
q.push({name: 'bar'}, function (err) {
    console.log('finished processing bar');
});

// add some items to the queue (batch-wise)

q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function (err) {
    console.log('finished processing bar');
});
```
