/**
 * Created by Jeremy on 10/25/2016.
 */
var _ = require('underscore');
GLOBAL.Config = {
    Namespace: process.env.Namespace || 'onereach-customdata-dev',
    Url:{
        Admin: process.env.AdminUrl || 'mongodb://localhost:27017/admin',
        Dev: process.env.DevUrl || 'mongodb://localhost:27017/DEV',
        Qa: process.env.QaUrl || 'mongodb://localhost:27017/QA',
        Prod: process.env.ProdUrl || 'mongodb://localhost:27017/PROD'
    },
    DiskPath: process.env.DiskPath || '/data,/',
    DiskUsageStatsRate: process.env.DiskUsageStatsRate || 60000,
    Stats:{
        objects:{Metric:'Objects',Name:'',Unit:'Count'},
        avgObjSize:{Metric:'AverageObjectSize',Name:'',Unit:'Bytes'},
        dataSize:{Metric:'DataSize',Name:'',Unit:'Bytes'},
        storageSize:{Metric:'StorageSize',Name:'',Unit:'Bytes'},
        indexSize:{Metric:'IndexSize',Name:'',Unit:'Bytes'},
        fileSize:{Metric:'FileSize',Name:'',Unit:'Bytes'},
        indexes:{Metric:'Indexes',Name:'',Unit:'Count'}
    },
    StatsInclude:{
        Admin: process.env.AdminStats || 'dataSize,storageSize,indexSize,fileSize',
        Dev: process.env.DevStats || 'dataSize,storageSize,indexSize,fileSize',
        Qa: process.env.QaStats || 'dataSize,storageSize,indexSize,fileSize',
        Prod: process.env.ProdStats || 'dataSize,storageSize,indexSize,fileSize'
    },
    StatsRate: process.env.StatsRate ? Number(process.env.StatsRate) : 300000,
    StatsPush: process.env.StatsPush ? Number(process.env.StatsPush) : 1,
    ReplStatsRate: process.env.ReplStatsRate ? Number(process.env.ReplStatsRate) : 300000,
    ReplStatsPush: process.env.ReplStatsPush ? Number(process.env.ReplStatsPush) : 1,
    QueryStatsRate: process.env.QueryStatsRate ? Number(process.env.QueryStatsRate) : 60000,
    QueryStatsPush: process.env.QueryStatsPush ? Number(process.env.QueryStatsPush) : 1,
    QueryStats:{
        millis:{Metric:'Millis',Unit:'Milliseconds'}
    },
    QueryStatsInclude:{
        Dev: process.env.DevQueryStats || 'millis',
        Qa: process.env.QaQueryStats || 'millis',
        Prod: process.env.ProdQueryStats || 'millis'
    },
    QueryStatsNsIgnore:{
        Dev: process.env.QueryStatsDevIgnore || ['DEV.system.profile','DEV.configurations'],
        Qa: process.env.QueryStatsQaIgnore || ['QA.system.profile','QA.configurations'],
        Prod: process.env.QueryStatsProdIgnore || ['PROD.system.profile','PROD.configurations']
    },
    ServerStats:{
        'backgroundFlushing.average_ms':{Metric:'BackgroundFlushTime',Unit:'Milliseconds'},
        'connections.current':{Metric:'Connections',Unit:'Count'},
        'globalLock.currentQueue.total':{Metric:'CurrentLocksTotal',Unit:'Count'},
        'globalLock.currentQueue.readers':{Metric:'CurrentLocksRead',Unit:'Count'},
        'globalLock.currentQueue.writers':{Metric:'CurrentLocksWrite',Unit:'Count'},
        'network.bytesIn':{Metric:'NetworkBytesIn',Unit:'Bytes',FigureDif:true},
        'network.bytesOut':{Metric:'NetworkBytesOut',Unit:'Bytes',FigureDif:true},
        'network.numRequests':{Metric:'NetworkRequests',Unit:'Count',FigureDif:true},
        'opcounters.insert':{Metric:'OpCountersInsert',Unit:'Count',FigureDif:true},
        'opcounters.query':{Metric:'OpCountersQuery',Unit:'Count',FigureDif:true},
        'opcounters.update':{Metric:'OpCountersUpdate',Unit:'Count',FigureDif:true},
        'opcounters.delete':{Metric:'OpCountersDelete',Unit:'Count',FigureDif:true},
        'opcounters.getmore':{Metric:'OpCountersGetMore',Unit:'Count',FigureDif:true},
        'opcounters.command':{Metric:'OpCountersCommand',Unit:'Count',FigureDif:true},
        'opcountersRepl.insert':{Metric:'OpCountersReplInsert',Unit:'Count',FigureDif:true},
        'opcountersRepl.query':{Metric:'OpCountersReplQuery',Unit:'Count',FigureDif:true},
        'opcountersRepl.update':{Metric:'OpCountersReplUpdate',Unit:'Count',FigureDif:true},
        'opcountersRepl.delete':{Metric:'OpCountersReplDelete',Unit:'Count',FigureDif:true},
        'opcountersRepl.getmore':{Metric:'OpCountersReplGetMore',Unit:'Count',FigureDif:true},
        'opcountersRepl.command':{Metric:'OpCountersReplCommand',Unit:'Count',FigureDif:true},
        'mem.resident':{Metric:'MemoryResident',Unit:'Megabytes'},
        'mem.virtual':{Metric:'MemoryVirtual',Unit:'Megabytes'},
        'mem.mapped':{Metric:'MemoryMapped',Unit:'Megabytes'},
    },
    ServerStatsInclude: process.env.ServerStats || 'ALL',
    ServerStatsRate: process.env.ServerStatsRate ? Number(process.env.ServerStatsRate) : 60000,
    ServerStatsPush: process.env.ServerStatsPush ? Number(process.env.ServerStatsPush) : 1,
    AwsCreds:{
        region: 'us-west-2',
        accessKeyId: 'AKIAJWKPOZPGZ3YNNVUA',
        secretAccessKey: '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',
        sslEnabled: true,
        maxRetries: 100
    }
}
if (process.env.AccessKeyId) GLOBAL.Config.AwsCreds.accessKeyId = process.env.AccessKeyId;
if (process.env.SecretAccessKey) GLOBAL.Config.AwsCreds.secretAccessKey = process.env.SecretAccessKey;
if (GLOBAL.Config.ServerStatsInclude == 'ALL') GLOBAL.Config.ServerStatsInclude = _.keys(GLOBAL.Config.ServerStats).join(',')
GLOBAL.Config.ServerStatsInclude = GLOBAL.Config.ServerStatsInclude.split(' ').join('').split(',');
console.log('Config:',GLOBAL.Config);