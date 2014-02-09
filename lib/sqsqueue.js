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

    sqsqueue.iphits = 0;
    sqsqueue.ipGohits = 0;
    sqsqueue.receiveCalls = 0;

    sqsqueue.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _innerProcess() {
            sqsqueue.iphits += 1;
            if (workers < q.concurrency && q.tasks.length) {
                sqsqueue.ipGohits += 1;
                
                var task = q.tasks.shift();
                workers += 1;
                var next = function () {
                    workers -= 1;

                    _deleteMessage(task)
                    .then(function() {
                        q.process();
                    })
                    .catch(function(error) {
                        console.log(error);
                    });
                };
                var body = JSON.parse(task.Body);
                var cb = only_once(next);
                worker(body, cb);

                // call again in case we have more workers and tasks
                _innerProcess();
            }
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            receiveBusy: false,
            push: function (data, callback) {
                //console.log('push tasks: ' + q.tasks.length);

                if(data.constructor !== Array) {
                    data = [data];
                }
                data.forEach(function(task) {
    
                    _addMessageToQueue(task)
                    .then(function(messageId) {
                        q.process();
                    });                
                    
                });
            },
            process: function () {

                if (q.tasks.length) {
                    _innerProcess();
                }
                else {
                    if (workers < q.concurrency) {
                        if (!q.receiveBusy) {
                            q.receiveBusy = true;
                            _receiveMessages()
                            .then(function(messages) {
                                q.receiveBusy = false;
                                sqsqueue.receiveCalls += 1;
                                //console.log('reseive:' + messages.length);

                                messages.forEach(function(msg) {
                                    q.tasks.push(msg);
                                });                        
                                _innerProcess();
                            })
                            .catch(function(error) {
                                q.receiveBusy = false;
                                console.log(error);
                            });
                        }
                    }    
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