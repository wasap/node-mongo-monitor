/**
 * Created by Jeremy on 10/13/2016.
 */
console.log('\n\n*************\nStarting Mongo Monitor at '+ new Date());

var _ = require('underscore');
var Mongoose = require('mongoose').Mongoose;
require('./config');
var aws = require('aws-sdk');
var CW = new aws.CloudWatch(GLOBAL.Config.AwsCreds);
var GetValue = require('./Q').GetValueFromObjectString;
var Each = require('./Q').each;

process.on('uncaughtException', function (error) {
    console.error('uncaughtException : ', error.stack);
});

var Track = {
    ServerStats:{
        Current:{},
        Previous:{}
    },
    QueryStats: new Date()
}

var QueuedMetrics = {
    Stats:[],
    ServerStats:[],
    ReplStats:[],
    QueryStats:[],
    Count:{
        Stats:0,
        ServerStats:0,
        ReplStats:0,
        QueryStats:0
    }
};

var MaxMetrics = 20;

var PutMetrics = function(Which){
    return new Promise(function(Done, Fail){
        Which = Which || 'Stats';
        console.log(new Date()+' Putting '+(QueuedMetrics[Which] ? QueuedMetrics[Which].length : 0)+' '+Which+' metric(s) to Cloudwatch');
        if (!QueuedMetrics[Which] || !QueuedMetrics[Which].length) return Done();
        var Sets = [QueuedMetrics[Which]];
        if (QueuedMetrics[Which].length > MaxMetrics) {
            Sets = [];
            _(Math.ceil(QueuedMetrics[Which].length/MaxMetrics)).times(function(i){
                var Start = i * MaxMetrics;
                Sets.push(QueuedMetrics[Which].slice(Start,Start+MaxMetrics));
            })
        }
        Each(Sets, function(Set,i,Next){
            var params = {
                MetricData: Set,
                Namespace: GLOBAL.Config.Namespace
            };
            CW.putMetricData(params, function(err, data) {
                if (err) console.error(new Date()+' CloudWatch Error for '+Which+'('+i+'):',err, err.stack); // an error occurred
                if (!err) console.log(new Date()+' CloudWatch Put complete for '+Which+'('+i+')');
                Next(i);
            });
        }, function(){
            QueuedMetrics[Which] = [];
            QueuedMetrics.Count[Which] = 0;
            Done();
        }, this);

    })
}

var Connect = function(D, DbName){
    return new Promise(function(Done, Fail){
        var M = new Mongoose();
        M.set('debug', true);

        //var DbName = _.find(_.keys(GLOBAL.Config.Url), function(k){ return D.Db && D.Db[k] ? false : true});
        if (!DbName) return Done(D);
        var Murl = GLOBAL.Config.Url[DbName];
        var LogMurl = Murl.indexOf('@') > -1 ? Murl.split('@')[1] : Murl;
        var ConnectionParams = {replset: { auto_reconnect:true, poolSize: 2, reconnectTries: 1000, socketOptions:{keepAlive:120} } }
        ConnectionParams.server = ConnectionParams.replset;

        console.log('Starting '+DbName+': '+ LogMurl);
        M.connect(Murl, ConnectionParams);
        var Db = M.connection;
        Db.on('connecting', function() {
            console.log('... ' + DbName + ' connecting on '+LogMurl);
        });
        Db.on('error', function callback(a,b){
            console.error(DbName + ' Error',a,b);
        });
        Db.on('connection', function(){
            console.log('... ' + DbName + ' Connected on '+LogMurl);
        });
        Db.on('reconnect', function(){
            console.log('... ' + DbName + ' Reconnected on '+LogMurl);
        });
        Db.on('timeout', function(e){
            console.log('... ' + DbName + ' Timeout',e);
        });
        Db.on('disconnected', function(e){
            console.log('... ' + DbName + ' disconnected... '+(GLOBAL.Mongo.Connecting ? 'Already restarting' : ''),e2);
        });
        Db.once('open', function () {
            console.log('... ' + DbName + ' Open and Connected on '+LogMurl);
            D.Db[DbName] = Db;
            D.Db[DbName].DbName = DbName;
            Done(D);
        });
    });
}

var QueryStatsAll = function(D){
    return new Promise(function(Done, Fail){
        QueuedMetrics.Count.QueryStats++;
        var Stats = _.compact(_.map(_.keys(GLOBAL.Config.Url), function(k){ return k == 'Admin' || GLOBAL.Config.QueryStatsInclude[k] == 'NONE' ? null : QueryStats(Data.Db[k]); }));
        Promise.all(Stats).then(function(){
            if (QueuedMetrics.Count.QueryStats >= GLOBAL.Config.QueryStatsPush) {
                PutMetrics('QueryStats');
            }
            Track.QueryStats = new Date();
            Done(D);
        }).catch(Fail);
    })
}

var QueryStats = function(D){
    return new Promise(function(Done, Fail){
        console.log(new Date() + ' ' + D.DbName + ' starting QueryStats... looking for Ts >= '+Track.QueryStats+', omitting ns = '+GLOBAL.Config.QueryStatsNsIgnore[D.DbName].join(', '));
        var System = D.db.collection('system.profile');
        System.find({ts:{$gte: Track.QueryStats}, ns:{$nin: GLOBAL.Config.QueryStatsNsIgnore[D.DbName]}}).toArray(function(err, data){
            console.log(new Date() + ' ' + D.DbName + ' complete QueryStats', err || (data ? _.pluck(data,'ns') : 'no data found'));
            if (err) {
                console.error(new Date()+'Db QueryStats Error for '+D.DbName+':',err, err.stack);
                return Done(D);
            }
            PushQueryStats({DbName: D.DbName, Data:data}).then(Done).catch(Fail);
        })
    })
}

var PushQueryStats = function(D){
    return new Promise(function(Done, Fail){
        var Now = new Date();

        _.each(D.Data, function(Item){
            _.each(Item,function(V,K){
                if (GLOBAL.Config.QueryStats[K] && GLOBAL.Config.QueryStatsInclude[D.DbName] && GLOBAL.Config.QueryStatsInclude[D.DbName].indexOf(K) > -1) {
                    var Item = GLOBAL.Config.QueryStats[K]
                    QueuedMetrics.QueryStats.push({MetricName: Item.Metric, Dimensions:[{Name:'Database', Value:D.DbName}], Timestamp:Now, Unit:Item.Unit || 'Count', Value:V});
                }
            },this);
        },this);


        Done(D);
    });
}

var DbStats = function(D){
    return new Promise(function(Done, Fail){
        console.log(new Date() + ' ' + D.DbName + ' starting Stats...');
        D.db.stats(function(err, data){
            console.log(new Date() + ' ' + D.DbName + ' complete Stats', err || data);
            if (err) {
                console.error(new Date()+'Db Stats Error for '+D.DbName+':',err, err.stack);
                return Done(D);
            }
            PushStats({DbName: D.DbName, Data:data}).then(Done).catch(Fail);
        })
    })
}

var DbStatsAll = function(D){
    return new Promise(function(Done, Fail){
        QueuedMetrics.Count.Stats++;
        var Stats = _.compact(_.map(_.keys(GLOBAL.Config.Url), function(k){ return GLOBAL.Config.StatsInclude[k] == 'NONE' ? null : DbStats(Data.Db[k]); }));
        Promise.all(Stats).then(function(){
            if (QueuedMetrics.Count.Stats >= GLOBAL.Config.StatsPush) {
                PutMetrics('Stats');
            }
            Done(D);
        }).catch(Fail);
    })
}

var PushStats = function(D){
    return new Promise(function(Done, Fail){
        var Now = new Date();

        _.each(D.Data,function(V,K){
            if (GLOBAL.Config.Stats[K] && GLOBAL.Config.StatsInclude[D.DbName] && GLOBAL.Config.StatsInclude[D.DbName].indexOf(K) > -1) {
                var Item = GLOBAL.Config.Stats[K]
                QueuedMetrics.Stats.push({MetricName: Item.Metric, Dimensions:[{Name:'Database', Value:D.DbName}], Timestamp:Now, Unit:Item.Unit || 'Count', Value:V});
            }
        },this);

        Done(D);
    });
}

var RsStatus = function(D){
    return new Promise(function(Done, Fail){
        console.log(new Date()+' Replica Set...');
        Data.Db.Admin.db.command({"replSetGetStatus":1 },function(err,result) {
            if (err) {
                console.error(new Date()+' Replica Set Error:',err, err.stack);
                return Fail(err);
            }
            if (!result) {
                console.error(new Date()+' Replica Set No Data:',result);
                return Fail(err);
            }
            console.log(new Date()+' Replica Set:',result);
            if (result && result.members && result.members.length){
                var Now = new Date();
                QueuedMetrics.Count.ReplStats++;

                _.each(result.members,function(V,K){
                    QueuedMetrics.ReplStats.push({MetricName: 'ReplicaInstanceHealth', Dimensions:[{Name:'ReplicaState', Value: V.stateStr}], Timestamp:Now, Unit:'Count', Value: V.health});
                },this);

                if (QueuedMetrics.Count.ReplStats >= GLOBAL.Config.ReplStatsPush) {
                    PutMetrics('ReplStats');
                }
            }
            Done(D);
        });
    })
}

var ServerStatus = function(D){
    return new Promise(function(Done, Fail){
        console.log(new Date()+' ServerStatus...');
        var adminDb = Data.Db.Admin.db.admin();
        adminDb.command({"serverStatus":1 },function(err,r) {
            if (err) {
                console.error(new Date()+' ServerStatus Error:',err, err.stack);
                return Fail(err);
            }
            if (!r) {
                console.error(new Date()+' ServerStatus No Data:',r);
                return Fail(err);
            }
            console.log(new Date()+' ServerStatus Complete');
            QueuedMetrics.Count.ServerStats++;
            var ReplState = r && r.repl && r.repl.secondary ? 'SECONDARY' : 'PRIMARY';
            var Now = new Date();
            _.each(GLOBAL.Config.ServerStatsInclude,function(Key){
                var Val = GetValue(r,Key),
                    Item = GLOBAL.Config.ServerStats[Key];
                if (!Item) Item = {Metric:Key, Unit:'Count'};
                if (Val !== null && typeof Val !== 'undefined' && Val !== '') {
                    if (Item.FigureDif) {
                        if (!Track.ServerStats.Previous[Key]) return Track.ServerStats.Previous[Key] = Val;
                        var Dif = Val - Track.ServerStats.Previous[Key];
                        Track.ServerStats.Previous[Key] = Val;
                        Val = Dif;
                    }
                    QueuedMetrics.ServerStats.push({MetricName: Item.Metric, Dimensions:[{Name:'ReplicaState', Value: ReplState}], Timestamp:Now, Unit:Item.Unit || 'Count', Value: Val});
                }
            },this);
            if (QueuedMetrics.Count.ServerStats >= GLOBAL.Config.ServerStatsPush) {
                PutMetrics('ServerStats');
            }
            Done(D);
        });
    })
}

var StartPolling = function(D){
    return new Promise(function(Done, Fail){
        console.log('\n\n'+new Date()+' StartPolling');
        PutMetrics('Stats').catch(console.error);
        PutMetrics('ReplStats').catch(console.error);
        PutMetrics('ServerStats').catch(console.error);
        PutMetrics('QueryStats').catch(console.error);
        QueuedMetrics.Count.Stats = 0;
        QueuedMetrics.Count.ReplStats = 0;
        QueuedMetrics.Count.ServerStats = 0;
        QueuedMetrics.Count.QueryStats = 0;

        setInterval(function(){
            DbStatsAll({}).then().catch(function(e){ console.error('DbStats Error',e) });
        },GLOBAL.Config.StatsRate);

        setInterval(function(){
            RsStatus({}).then().catch(function(e){ console.error('RsStatus Error',e) });
        },GLOBAL.Config.ReplStatsRate);

        setInterval(function(){
            ServerStatus({}).then().catch(function(e){ console.error('ServerStatus Error',e) });
        },GLOBAL.Config.ServerStatsRate);

        setInterval(function(){
            QueryStatsAll({}).then().catch(function(e){ console.error('QueryStats Error',e) });
        },GLOBAL.Config.QueryStatsRate);
    })
}

var Data = {Db:{}}
var Connections = _.map(_.keys(GLOBAL.Config.Url), function(k){ return Connect(Data, k); });
Promise.all(Connections).then(DbStatsAll).then(QueryStatsAll).then(RsStatus).then(ServerStatus).then(StartPolling).catch(function(e){
    console.error(e);
    if (e.stack) console.error(e.stack);
})