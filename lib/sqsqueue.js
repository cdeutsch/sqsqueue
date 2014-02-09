var aws = require("aws-lib");
var RSVP = require('rsvp');
var extend = require('util')._extend;

(function () {

    var sqsqueue = {};

    // global on the server, window in the browser
    var root, previous_sqsqueue;

    root = this;
    if (root != null) {
      previous_sqsqueue = root.sqsqueue;
    }

    sqsqueue.noConflict = function () {
        root.sqsqueue = previous_sqsqueue;
        return sqsqueue;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// exported sqsqueue module functions ////

    var _queueUrlToPath = function() {
        var toks = sqsqueue.config.queueUrl.split('/');
        var path = '/' + toks[toks.length - 2] + '/' + toks[toks.length - 1] + '/';
        return path;
    };

    var _createSQSClient = function(options) {
        return aws.createSQSClient(sqsqueue.config.awsKey, sqsqueue.config.awsPrivateKey, options);
    };

    var _getOrCreateQueue = function(config) {
        var promise = new RSVP.Promise(function(resolve, reject) {

            sqsqueue.config = extend({}, config);

            // check for sqs queue
            var sqs = aws.createSQSClient(config.awsKey, config.awsPrivateKey);
            sqs.call ( "ListQueues", {}, function (err, result) {
                //console.log("ListQueues result: " + JSON.stringify(result));
                var queueUrl = null;
                if (result.ListQueuesResult.QueueUrl) {
                    if (result.ListQueuesResult.QueueUrl instanceof Array) {
                        for(var xx = 0; xx < result.ListQueuesResult.QueueUrl.length; xx++) {
                            var qq = result.ListQueuesResult.QueueUrl[xx];
                            //console.log(qq);
                            var toks = qq.split('/');
                            if (toks[toks.length -1 ].toLowerCase() == config.sqsQueueName) {
                                queueUrl = qq;
                                break;
                            }
                        }
                    }
                    else {
                        var toks = result.ListQueuesResult.QueueUrl.split('/');
                        if (toks[toks.length -1 ].toLowerCase() == config.sqsQueueName) {
                            queueUrl = result.ListQueuesResult.QueueUrl;
                        }
                    }
                }
                if (!queueUrl) {
                    var visibilityTimeout =  60; // seconds
                    if (config.visibilityTimeout) {
                        visibilityTimeout =  config.visibilityTimeout;
                    }
                    // create a new queue
                    var createParams = {
                        'QueueName': config.sqsQueueName,
                        'Attribute.1.Name': 'VisibilityTimeout',
                        'Attribute.1.Value': visibilityTimeout,
                        'Attribute.2.Name': 'MessageRetentionPeriod',
                        'Attribute.2.Value': 1209600 // set to max of 14 days
                    };

                    sqs.call ( "CreateQueue", createParams, function (err, result) {
                        //console.log("CreateQueue result: " + JSON.stringify(result));
                        if (err) {
                            reject(error);
                            return;
                        }
                        else if (result && result.Error) {
                            var msg = 'Failed to create a new queue';
                            if (result.Error.Message) {
                                msg = result.Error.Message;
                            }
                            reject({
                                msg: msg
                            });
                            return;
                        }
                        sqsqueue.config.queueUrl = result.CreateQueueResult.QueueUrl;
                        sqsqueue.config.queueUrlPath = _queueUrlToPath(sqsqueue.config.queueUrl);
                        resolve();
                    });
                }
                else {
                    sqsqueue.config.queueUrl = queueUrl;
                    sqsqueue.config.queueUrlPath = _queueUrlToPath(sqsqueue.config.queueUrl);
                    resolve();
                }
            });
        });

        return promise;
    };


    var _addMessageToQueue = function(msg) {
        var promise = new RSVP.Promise(function(resolve, reject) {

            var options = {
                "path" : sqsqueue.config.queueUrlPath
            };

            var outbound = { 
                MessageBody: JSON.stringify(msg)
            };

            var sqs = _createSQSClient(options);
            sqs.call ( "SendMessage", outbound, function ( error, result ) {
                //console.log("SendMessage result: " + JSON.stringify(result));
                if (error) {
                    reject(error);
                }
                else if( result && result.Error ) {
                    var msg = 'Failed to add message to queue';
                    if (result.Error.Message) {
                        msg = result.Error.Message;
                    }
                    reject({
                        msg: msg
                    });
                }
                else {
                    resolve(result.SendMessageResult.MessageId);
                }
            });
        });

        return promise;
    };

    var _receiveMessages = function() {
        var promise = new RSVP.Promise(function(resolve, reject) {

            var options = {
                "path" : sqsqueue.config.queueUrlPath
            };

            var outbound = { 
                MaxNumberOfMessages: 10
            };

            var sqs = _createSQSClient(options);
            sqs.call ( "ReceiveMessage", outbound, function ( error, result ) {
                //console.log("ReceiveMessage result: " + JSON.stringify(result) + '\n\n');
                if (error) {
                    reject(error);
                    return;
                }
                else if (result && result.Error) {
                    var msg = 'Failed to receive messages from queue';
                    if (result.Error.Message) {
                        msg = result.Error.Message;
                    }
                    reject({
                        msg: msg
                    });
                    return;
                }
                else {

                    // put Messages in a proper array
                    var messages = [];
                    if (result && result.ReceiveMessageResult && result.ReceiveMessageResult.Message) {
                        
                        if (result.ReceiveMessageResult.Message instanceof Array) {
                            for(var xx = 0; xx < result.ReceiveMessageResult.Message.length; xx++) {
                                var msgRslt = result.ReceiveMessageResult.Message[xx];
                                if (msgRslt.MessageId) {
                                    messages.push(msgRslt);
                                }
                            }
                        }
                        else if (result.ReceiveMessageResult.Message.MessageId) {
                            messages.push(result.ReceiveMessageResult.Message);
                        }
                    }
                    resolve(messages);

                }
            });
        });

        return promise;
    }

    var _deleteMessage = function(msg) {
        var promise = new RSVP.Promise(function(resolve, reject) {

            var options = {
                "path" : sqsqueue.config.queueUrlPath
            };

            var outbound = {
                ReceiptHandle : msg.ReceiptHandle
            };

            var sqs = _createSQSClient(options);
            sqs.call ( "DeleteMessage", outbound, function ( error, result ) {
                //console.log("DeleteMessage result: " + JSON.stringify(result));
                if (error) {
                    reject({
                        msg: error
                    });
                }
                else if (result && result.Error) {
                    var msg = 'Failed to delete messages from queue';
                    if (result.Error.Message) {
                        msg = result.Error.Message;
                    }
                    reject({
                        msg: msg
                    });
                }
                else {
                    resolve();
                }
            });
        });

        return promise;
    }

    sqsqueue.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _innerProcess() {
            if (q.tasks.length) {
                var task = q.tasks.shift();
                if (q.empty && q.messageIds.length === 0) {
                    q.empty();
                }
                workers += 1;
                var next = function () {
                    workers -= 1;
                    //console.log('next tasks: ' + q.tasks.length);
                    if (q.drain && q.messageIds.length + workers === 0) {
                        q.drain();
                    }

                    _deleteMessage(task)
                    .then(function() {
                        var index = q.messageIds.indexOf(task.MessageId);
                        q.messageIds.splice(index, 1);
                        q.process();
                    })
                    .catch(function(error) {
                        console.log(error);
                    });
                };
                var body = JSON.parse(task.Body);
                var cb = only_once(next);
                worker(body, cb);
            }
        }

        var workers = 0;
        var q = {
            messageIds: [],
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                //console.log('push tasks: ' + q.tasks.length);

                if(data.constructor !== Array) {
                    data = [data];
                }
                data.forEach(function(task) {
    
                    _addMessageToQueue(task)
                    .then(function(messageId) {
                        q.messageIds.push(messageId);
                        q.process();
                    });                
                    
                });
            },
            process: function () {
                if (workers < q.concurrency) {

                    if (q.tasks.length) {
                        setImmediate(_innerProcess);
                    }

                    _receiveMessages()
                    .then(function(messages) {
                        messages.forEach(function(msg) {
                            q.tasks.push(msg);
                        });                        
                        setImmediate(_innerProcess);                        
                    });
                    
                }
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    sqsqueue.init = _getOrCreateQueue;

    module.exports = sqsqueue;    
}());