var aws = require("aws-lib");
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

    var _queueUrlToPath = function(queueUrl) {
        var toks = queueUrl.split('/');
        var path = '/' + toks[toks.length - 2] + '/' + toks[toks.length - 1] + '/';
        return path;
    };

    var _createSQSClient = function(config, options) {
        return aws.createSQSClient(config.awsKey, config.awsPrivateKey, options);
    };

    var _getOrCreateQueue = function(config, callback) {    

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
                        callback(new Error(error));
                    }
                    else if (result && result.Error) {
                        var msg = 'Failed to create a new queue';
                        if (result.Error.Message) {
                            msg = result.Error.Message;
                        }
                        callback(new Error(msg));
                    }
                    callback(null, result.CreateQueueResult.QueueUrl);
                });
            }
            else {
                callback(null, queueUrl);
            }
        });
    };


    var _addMessageToQueue = function(config, msg, callback) {

        var options = {
            "path" : config.queueUrlPath
        };

        var outbound = { 
            MessageBody: JSON.stringify(msg)
        };

        var sqs = _createSQSClient(config, options);
        sqs.call ( "SendMessage", outbound, function(error, result) {
            //console.log("SendMessage result: " + JSON.stringify(result));
            if (error) {
                callback(new Error(error));
            }
            else if( result && result.Error ) {
                var msg = 'Failed to add message to queue';
                if (result.Error.Message) {
                    msg = result.Error.Message;
                }
                callback(new Error(msg));
            }
            else {
                callback(null, result.SendMessageResult.MessageId);
            }
        });
    };

    var _receiveMessages = function(config, callback) {
        var options = {
            "path" : config.queueUrlPath
        };

        var outbound = { 
            MaxNumberOfMessages: 10
        };

        var sqs = _createSQSClient(config, options);
        sqs.call ( "ReceiveMessage", outbound, function(error, result) {
            //console.log("ReceiveMessage result: " + JSON.stringify(result) + '\n\n');
            if (error) {
                callback(new Error(error));
            }
            else if (result && result.Error) {
                var msg = 'Failed to receive messages from queue';
                if (result.Error.Message) {
                    msg = result.Error.Message;
                }
                callback(new Error(msg));
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
                callback(null, messages);

            }
        });
    }

    var _deleteMessage = function(config, msg, callback) {
        var options = {
            "path" : config.queueUrlPath
        };

        var outbound = {
            ReceiptHandle : msg.ReceiptHandle
        };

        var sqs = _createSQSClient(config, options);
        sqs.call ( "DeleteMessage", outbound, function(error, result) {
            //console.log("DeleteMessage result: " + JSON.stringify(result));
            if (error) {
                callback(new Error(error));
            }
            else if (result && result.Error) {
                var msg = 'Failed to delete messages from queue';
                if (result.Error.Message) {
                    msg = result.Error.Message;
                }
                callback(new Error(msg));
            }
            else {
                callback(null);
            }
        });
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

                    _deleteMessage(q.config, task, function(error, result) {
                        if (error) {
                            console.log(error);
                        }
                        else {
                            q.process();
                        }
                    });
                };
                var data = JSON.parse(task.Body);
                var cb = only_once(next);
                worker({ 
                    data: data,
                    messageId: task.MessageId
                }, cb);

                // call again in case we have more workers and tasks
                _innerProcess();
            }
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            initReady: false,
            receiveBusy: false,
            config: {},
            taskBuffer: [],
            init: function(config) {
                q.config = extend({}, config);

                _getOrCreateQueue(config, function(error, queueUrl) {
                    if (error) {
                        throw error;
                    }
                    else {
                        q.config.queueUrl = queueUrl;
                        q.config.queueUrlPath = _queueUrlToPath(q.config.queueUrl);                        
                        q.initReady = true;
                        q.clearBuffer();
                        // process any tasks were not aware of in sqs.
                        q.process();
                    }
                });
            },
            clearBuffer: function () {
                //console.log('push tasks: ' + q.tasks.length);

                q.taskBuffer.forEach(function(item) {
                    var task = item.task;
                    var callback = item.callback;

                    _addMessageToQueue(q.config, task, function(error, messageId) {
                        if (error) {
                            if (callback) {
                                callback(new Error(error));
                            }
                            else {
                                throw error;
                            }
                        }
                        else {
                            if (callback) {
                                callback(null, messageId);
                            }
                            q.process();
                        }
                    });

                });
            },
            push: function (data, callback) {
                //console.log('push tasks: ' + q.tasks.length);

                if(data.constructor !== Array) {
                    data = [data];
                }
                data.forEach(function(task) {
    
                    if (!q.initReady) {
                        q.taskBuffer.push({
                            task: task,
                            callback: callback
                        });
                    }
                    else {
                        _addMessageToQueue(q.config, task, function(error, messageId) {
                            if (error) {
                                if (callback) {
                                    callback(new Error(error));
                                }
                                else {
                                    throw error;
                                }
                            }
                            else {
                                if (callback) {
                                    callback(null, messageId);
                                }
                                q.process();
                            }
                        });
                    }
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
                            _receiveMessages(q.config, function(error, messages) {
                                q.receiveBusy = false;
                                if (error) {                                   
                                    console.log(error);
                                } 
                                else {
                                    q.receiveBusy = false;
                                    sqsqueue.receiveCalls += 1;
                                    //console.log('reseive:' + messages.length);

                                    messages.forEach(function(msg) {
                                        q.tasks.push(msg);
                                    });                        
                                    _innerProcess();
                                }

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

    module.exports = sqsqueue;    
}());