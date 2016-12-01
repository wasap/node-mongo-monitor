var _ = require('underscore');
var ObjectId = require('mongoose').Types.ObjectId;

var GoArray = function(A, KeepSpaces, ToObjectId, optErrorCallback) {
    if (_.isArray(A) && !ToObjectId) return A;
    var Error;
    if (_.isString(A) && A.indexOf(',') > -1) {
        if (!KeepSpaces) A = A.split(' ').join('');
        if (!ToObjectId) return A.split(',');
        A = A.split(',');
    }
    if (ToObjectId == true) {
        var Return = _.compact(_.map(A, function(a,i){
            var b;
            if (!a) { Error = true; if (optErrorCallback) optErrorCallback(400,{ErrorType:'InvalidQueryParameter', Details:'Cannot create ObjectId from null', Data:a}); return null; }
            try { b = new ObjectId(a); } catch(E){ Error = true; if (optErrorCallback) optErrorCallback(400,{ErrorType:'InvalidQueryParameter', Details:E, Data:a}); }
            return b;
        }));
        return Error && optErrorCallback ? false : Return;
    }
    if (ToObjectId == 'StringId') {
        var Return;
        try {
            Return = _.map(A, function(a){ return _.isObject(a) && a._id ? a._id.toString ? a._id.toString() : a._id : _.isObject(a) && a.Id ? a.Id : a.toString ? a.toString() : a; });
        } catch(E) {
            Error = true;
            if (optErrorCallback) optErrorCallback(400,{ErrorType:'InvalidQueryParameter', Details:E});
        }
        return Error && optErrorCallback ? false : Return;
    }
    if (A) return [A];
    return [];
}
/**
 * A "forEach" utility function to handle performing asynchronous calls on a list. Waits till all list items are "done" before calling a Callback function
 * @param {Array.<*>} List The array to perform the forEach on
 * @param {function} Iterator What function to run for each list item. The function is passed 3 arguments:
 *
 *  - {*} Item The current item in the list to perform the function on
 *  - {number} Index The current index of that item in the list
 *  - {function} Next The function to call when the item's logic is finished and the forEach loop is ready to step or check whether the loop is done. This function can be called with no arguments or with the Index
 *
 * @param {function} Callback What function to call when all the list items are complete
 * @param {object=} optContext What to call the Iterator and Callback functions in
 * @param {boolean=} optAsync If present and true, the loop initiates all Iterator functions asynchronously. Otherwise, each Iterator happens when the previous Iterator has called the Next function.
 * @param {(boolean|number|object)=} optPeriodicPause Use this argument to set periodic setTimeouts to prevent filling up the CPU load for long running iterations. If true, sets a timeout to occur every 100 iterations, waiting 100ms. If a number, the number of iterations to pause at.
 * @param {number} optPeriodicPause.PauseAt The number of iterations to run a setTimeout at
 * @param {number} optPeriodicPause.Wait The number of milliseconds to run the setTimeout for
 */
var each = function(List, Iterator, Callback, optContext, optAsync, optPeriodicPause) {
    var Check = [], Index = 0, DoneCount = 0, PauseAt = optPeriodicPause, Wait = 100;
    if (optPeriodicPause && _.isObject(optPeriodicPause)) { PauseAt = optPeriodicPause.PauseAt; Wait = optPeriodicPause.Wait || 100}
    if (PauseAt) PauseAt = _.isNaN(parseInt(PauseAt)) ? 100 : parseInt(PauseAt);
    var Context = optContext || this;
    if (!List || !List.length) { if (Callback) Callback.call(Context); return null; }
    var CheckDone = function(Index) {
        if (Index != null) {
            Check[Index] = true;
        } else {
            for (var i=0; i<Check.length; i++) {
                if (Check[i] == false) { Check[i] = true; break; }
            }
        }
        if (Check.join('|').indexOf('false') == -1 || (!optAsync && Index >= List.length)) {
            if (Callback) Callback.call(Context);
        } else if (!optAsync) {
            Index++;
            DoneCount++;
            if (!PauseAt || DoneCount % PauseAt != 0) return Iterator.call(Context,List[Index],Index,CheckDone);
            setTimeout(function(){ Iterator.call(Context,List[Index],Index,CheckDone); },Wait);
        }
    }
    for (var i=0; i<List.length; i++){
        Check.push(false);
    }
    if (optAsync) {
        var I =0;
        var NextAsync = function(){
            if (I < List.length) {
                Iterator.call(Context,List[I],I,CheckDone);
                I++;
                if (I < List.length) setTimeout(function(){NextAsync();},0);
            }
        }
        NextAsync();
        /*for (var i=0; i<List.length; i++){
            Iterator.call(Context,List[i],i,CheckDone);
        }*/
    } else {
        Iterator.call(Context,List[Index],Index,CheckDone);
    }
}

/**
 * This prototype is meant to be used in place of any for/next or do/while loop to prevent resource-hogging and endless looping
 * @param {string|array|object} Condition Either a string which is a condition to be evaled (such what would be used in a do/while loop) or a list (object keys become the list if an object is used) that will be iterated through. If an array or object is passed, two local variables, Key and Value are generated per iteration, where Key is either the field name or array index, and value is the corresponding value for the field/index.
 * @param {string|function} Logic Either a string to be evaled or a function to call per iteration. If a function, it is called in the context of the looper prototype, and is passed the Value and Key as arguments
 * @param {function} Callback The function to call when the loop completes or errors out. The function is passed 3 arguments: Error (if an error occurred), Value and Key.
 * @constructor
 */
var Looper = function(Condition, Logic, Callback, Data) {
    if (!Callback) return console.error('Callback required');
    if (!Condition || !Logic) return Callback('Condition and Logic required');
    this.Id = new Date().getTime();
    this.MaxIterations = 10000;
    this.Enabled = true;
    this.Quit = false;
    this.Condition = Condition;
    this.Keys = _.isObject(Condition) && !_.isArray(Condition) ? _.keys(Condition) : null;
    this.Logic = Logic;
    this.Iteration = 0;
    this.Data = Data;
    this.Loop = function() {
        var ConditionMet = false, Key, Value;

        if (_.isFunction(this.Condition)) {
            try {
                ConditionMet = this.Condition.call(this);
            } catch (Error) {
                return Callback(Error);
            }
        } else if (_.isString(this.Condition)) {
            try {
                ConditionMet = eval(this.Condition);
            } catch (Error) {
                return Callback(Error);
            }
        } else if (_.isArray(this.Condition)){
            if (this.Iteration < this.Condition.length) {
                ConditionMet = true;
                Key = this.Iteration;
                Value = this.Condition[Key];
            }
        } else if (_.isObject(this.Condition) && this.Keys) {
            if (this.Iteration < this.Keys.length) {
                ConditionMet = true;
                Key = this.Keys[this.Iteration];
                Value = this.Condition[Key];
            }
        } else {
            return Callback('Invalid conditions');
        }

        if (this.Quit) return Callback(null, Value, Key);

        this.Iteration++;
        if (ConditionMet && this.Enabled && this.Iteration < this.MaxIterations) {
            try {
                if (_.isFunction(this.Logic)) {
                    this.Logic.call(this,Value,Key);
                } else {
                    eval(this.Logic);
                }

            } catch (Error) {
                return Callback(Error);
            }
            if (this.Quit) return Callback(null, Value, Key);
            setTimeout(this.Loop.bind(this),0);
        } else if (!this.Enabled || this.Iteration >= this.MaxIterations) {
            Callback('Loop ran too long');
        } else {
            Callback(null, Value, Key, this.Data);
        }
    };
    this.Stop = function(Quit) { if (Quit) return this.Quit = true; this.Enabled = false; };
    setTimeout(this.Loop.bind(this),0);
    setTimeout(this.Stop.bind(this),3000);
}
/*var Looper = function(Condition, Logic, Callback) {
    if (!Callback) return console.error('Callback required');
    if (!Condition || !Logic) return Callback('Condition and Logic required');
    var MaxIterations = 10000;
    var Enabled = true;
    var Quit = false;
    var Keys = _.isObject(Condition) && !_.isArray(Condition) ? _.keys(Condition) : null;
    var Iteration = 0;

    var Stop = function(Quitting) { if (Quitting) return Quit = true; Enabled = false; };
    var Loop = function() {
        var ConditionMet = false, Key, Value;

        if (_.isFunction(Condition)) {
            try {
                ConditionMet = Condition();
            } catch (Error) {
                return Callback(Error);
            }
        } else if (_.isString(Condition)) {
            try {
                ConditionMet = eval(Condition);
            } catch (Error) {
                return Callback(Error);
            }
        } else if (_.isArray(Condition)){
            if (Iteration < Condition.length) {
                ConditionMet = true;
                Key = Iteration;
                Value = Condition[Key];
            }
        } else if (_.isObject(Condition) && Keys) {
            if (Iteration < Keys.length) {
                ConditionMet = true;
                Key = Keys[Iteration];
                Value = Condition[Key];
            }
        } else {
            return Callback('Invalid conditions');
        }

        if (Quit) return Callback(null, Value, Key);

        Iteration++;
        if (ConditionMet && Enabled && Iteration < MaxIterations) {
            try {
                if (_.isFunction(Logic)) {
                    Logic(Value,Key);
                } else {
                    eval(Logic);
                }

            } catch (Error) {
                return Callback(Error);
            }
            if (Quit) return Callback(null, Value, Key);
            setTimeout(Loop,0);
        } else if (!Enabled || Iteration >= MaxIterations) {
            Callback('Loop ran too long');
        } else {
            Callback(null, Value, Key);
        }
    };

    setTimeout(Loop,0);
    setTimeout(Stop,3000);
}*/


/**
 * Object cloning method for deep cloning
 * @param {object} Object The object to be clones
 * @param {boolean=} opt_IncludeFunctions If present and true, clones functions
 * @param {number=} opt_Limit If present, how many levels deep of the hierarchy to clone
 * @param {boolean=} opt_IncludeComponents If present and true, clones Gir.Ui.Components
 * @return {object}
 */
var Clone = function(Object, opt_IncludeFunctions, opt_Limit){
    if (!_.clone) {
        console.error('Underscore is not present.');
        return null;
    }

    if (Object.toObject) return GLOBAL._ToObject(Object);
    if (Object.nsps || Object.nsp) { return '[Socket]' }
    /// console.log('Gir.Clone:',Object);
    var RemoveOverLimit = false;
    var Limit = opt_Limit || 10; // Sets the limit of how far we will clone
    if (Limit < 0) { // Negative limits cause children past the limit to be removed
        Limit = Math.abs(Limit);
        RemoveOverLimit = true;
    }

    // Function to determine if an object contains nested objects as children
    var IsNested = function(ThisObject) {
        if (!_.isFunction(ThisObject) && !_.isObject(ThisObject) && !_.isArray(ThisObject)) return false;
        return true;
        for (var Key in ThisObject){
            //console.log('    > IsNested %o? F = %o, O = %o, A = %o',Key,_.isFunction(ThisObject[Key]), _.isObject(ThisObject[Key]), _.isArray(ThisObject[Key]));_.isFunction(ThisObject[Key]) ||
            if (_.isObject(ThisObject[Key]) || _.isArray(ThisObject[Key])) return true;
        }
        return false;
    }

    var CloneNestedObjects = function(ThisObject, Level){
        Level = Level || 0;
        if (Level > Limit) return RemoveOverLimit ? null : ThisObject;
        if (ThisObject.toObject) return GLOBAL._ToObject(ThisObject);
        var ThisClone;
        if (!_.isFunction(ThisObject)) {
            //ThisClone = _.clone(ThisObject);
            if (ThisObject.nsps || ThisObject.nsp) { return '[Socket]' }
            try { ThisClone = _.clone(ThisObject); } catch(Error) { console.error('CloneNestedObjects Error',Error,_.isObject(ThisObject), typeof ThisObject); console.log(ThisObject); return '[InvalidObject]'; } // Use Underscore to do the basic cloning.
        } else if (_.isFunction(ThisObject)) {
            ThisClone = ThisObject;
        }

        var HasNested = false;
        for (var Key in ThisObject){
            // At this point I am simply deleting functions and components that are not included
            if (Key == '_id' && ThisObject[Key] && ThisObject[Key].toString) { /*console.log('......... cloning _id',ThisObject[Key].toString(),ThisObject[Key].generationTime); */ ThisClone[Key] = ThisObject[Key].toString() }
            if (_.isFunction(ThisObject[Key]) && !opt_IncludeFunctions) delete ThisClone[Key];
            if (IsNested(ThisObject[Key])) HasNested = true;
        }
        //console.log('  > Has Nested = %o',HasNested);

        if (HasNested){
            for (var Key in ThisClone){
                if (IsNested(ThisClone[Key])) {
                    ThisClone[Key] = CloneNestedObjects(ThisClone[Key],Level + 1);
                }
            }
        }

        return ThisClone;
    }
    var C = CloneNestedObjects(Object,0);
    //console.log(' = Gir.Clone:',Object,C);
    return C;
}

/**
 * Gets the value of a field by drilling down an object based on a period-deliminated string
 * @param {object} Root The root object to begin drilling through
 * @param {string} String The period-deliminated string that specifies the chain of fields to follow to find the value
 * @returns {*}
 */
var GetValueFromObjectString = function(Root,String,ErrorCheck){
    if (String.indexOf('.')==-1) {
        if (ErrorCheck) {
            var Error = true;
            for (var Key in Root) {
                if (Key == String) Error = false;
            }
            if (Error) return 'ERROR';
        }
        return Root[String];
    }
    var Fields = String.split('.');
    var Obj = Root;
    _.each(Fields,function(Field,i){
        if (ErrorCheck && _.indexOf(_.keys(Obj),Field) == -1) {
            Obj = 'ERROR'
            return null;
        }
        if (Obj && Obj[Field] != null) {
            Obj = Obj[Field];
        } else {
            if (ErrorCheck && i < Fields.length-1) {
                Obj = 'ERROR'
                return null;
            } else {
                Obj = null;
                return null;
            }
        }
    },this);
    return Obj;
}

/**
 * Sets the value of a field by drilling down an object based on a period-deliminated string
 * @param {object} Root The root object to begin drilling through
 * @param {string} String The period-deliminated string that specifies the chain of fields to follow to find the value. The last field in the chain is the one whose value will be set
 * @param {*} Value The value to set the field to
 * @returns {*}
 */
var SetValueToObjectString = function(Root,String,Value,ErrorCheck){
    if (String.indexOf('.')==-1) {
        if (ErrorCheck) {
            var Error = true;
            for (var Key in Root) {
                if (Key == String) Error = false;
            }
            if (Error) return 'ERROR';
        }
        Root[String] = Value;
        return Root;
    }

    var Fields = String.split('.');
    var Obj = Root;
    _.each(Fields,function(Field, i){
        if (i == Fields.length-1) {
            if (_.isArray(Obj) && Number(Field) == -1) {
                Obj.push(Value);
                return Value;
            }
            Obj[Field] = Value;
            return Value;
        } else if (Obj[Field]){
            Obj = Obj[Field];
        } else {
            if (ErrorCheck) {
                Obj = 'ERROR'
                return null;
            } else {
                if (_.isArray(Obj) && !_.isNaN(Number(Field))) {
                    if (Number(Field) == -1) { Obj.push({}); Obj = Obj[Obj.length-1] } else { Obj[Number(Field)] = {}; Obj = Obj[Number(Field)]}
                } else if (_.isObject(Obj)) {
                    Obj[Field] = {};
                    Obj = Obj[Field];
                } else {
                    Obj = null;
                    return null;
                }
            }
        }
    },this);
    return Obj;
}

var Formatters = {
    PhoneNumber: function(Number, optForUi){
        if (!Number) return optForUi ? '' : null;
        Number = Number + '';
        if (!optForUi) return parseInt(Number.split('-').join('').split('(').join('').split(')').join('').split(' ').join(''));
        if (Number.indexOf('-') != -1) return Number;
        var L = Number.length;
        var N = Number.substr(L-10,3) + '-' + Number.substr(L-7,3) + '-' + Number.substr(L-4,4);
        return L > 10 ? Number.substr(0,1) + '-' + N : N;
    },
    ParseThousands: function(Number, optForUi) {
        Number = Number + '';
        if (!optForUi) return parseInt(Number.split(',').join('').split('.').join('').split(' ').join(''));
        if (Number.length <= 3) return Number;
        if (Number.length > 3) Number = Number.substr(0, Number.length-3) + ',' + Number.substr(Number.length-3,3);
        return Number;
    },
    CreditCard: function(Number, optForUi) {
        Number = Number + '';
        if (!optForUi) return parseInt(Number.split('-').join('').split('.').join('').split(' ').join(''));
        Number = Number.substr(0, 4) + '-' + Number.substr(4,4) + '-' + Number.substr(8,4) + '-' + Number.substr(12,4);
        return Number;
    },
    ParseCents: function(Number) {
        return Number*100;
    },
    TitleCase: function(Name){
        if (Name == null) return '';
        Name = Name.substr(0,1).toUpperCase() + Name.substr(1);
        Name = Name.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        return Name;
    },
    PersonName: function(Name, optLastNameFirst){
        if (Name == null) return '';
        //TODO Provision for putting last name first
        var i = Name.indexOf(',');
        var s = Name.indexOf(' ');
        if (i == -1 && !optLastNameFirst) return Name;
        if (s > -1 && i > s && !optLastNameFirst) return Name;
        var A = Name.substring(0,i);
        var B = Name.substr(i+1);
        if (B.indexOf(' ') == 0) B = B.substr(1);
        if (!optLastNameFirst) return B + ' ' + A;
    },
    DateTime: function(DateTime, Format, opt_ConvertToUtc) {
        if (!_.isObject(DateTime) || !DateTime.getTime) return null;

        var AmPm = false;
        var ShortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var Months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        var ShortDaysOfTheWeek = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var Days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        var DaySuffixes = ['','st','nd','rd','th','th','th','th','th','th','th','th','th','th','th','th','th','th','th','th','th','st','nd','rd','th','th','th','th','th','th','th','st','nd','rd','th','th','th','th','th','th','th'];

        var Search = [
            {String: '{AM}', Replace: function(){AmPm = true; var H = DateTime.getHours(); return H >= 12 ? 'PM' : 'AM'}},
            {String: '{Am}', Replace: function(){AmPm = true; var H = DateTime.getHours(); return H >= 12 ? 'Pm' : 'Am'}},
            {String: '{am}', Replace: function(){AmPm = true; var H = DateTime.getHours(); return H >= 12 ? 'pm' : 'am'}},
            {String: '{YYYY}', Replace: function(){return DateTime.getFullYear() + ''}},
            {String: '{YY}', Replace: function(){var Y = DateTime.getFullYear() + ''; Y = Y.substr(2,4); return Y;}},
            {String: '{MM}', Replace: function(){var M = DateTime.getMonth()+1 + ''; if (M.length == 1) M =  '0'+M; return M}},
            {String: '{M}', Replace: function(){return DateTime.getMonth()+1 + ''}},
            {String: '{Mon}', Replace: function(){var M = DateTime.getMonth(); return ShortMonths[M]}},
            {String: '{Month}', Replace: function(){var M = DateTime.getMonth(); return Months[M]}},
            {String: '{D}', Replace: function(){return DateTime.getDate() + ''}},
            {String: '{DD}', Replace: function(){var M = DateTime.getDate() + '';var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM; }},
            {String: '{Day}', Replace: function(){var D = DateTime.getDay(); return ShortDaysOfTheWeek[D]}},
            {String: '{FullDay}', Replace: function(){var D = DateTime.getDay(); return Days[D]}},
            {String: '{Dth}', Replace: function(){var D = DateTime.getDate(); return D + DaySuffixes[D]}},
            {String: '{hh}', Replace: function(){var H = DateTime.getHours(); H = AmPm && H >= 12 ? H-12 : H; H = AmPm && H == 0 ? 12 : H; var HH = H + ''; if (HH.length ==1) HH = '0'+HH; return HH}},
            {String: '{h}', Replace: function(){var H = DateTime.getHours(); H = AmPm && H >= 12 ? H-12 : H; H = AmPm && H == 0 ? 12 : H; var HH = H + ''; return HH}},
            {String: '{mm}', Replace: function(){var M = DateTime.getMinutes(); var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM}},
            {String: '{m}', Replace: function(){return DateTime.getMinutes() + '';}},
            {String: '{ss}', Replace: function(){var M = DateTime.getSeconds(); var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM}},
            {String: '{s}', Replace: function(){return DateTime.getSeconds() + '';}},
            {String: '{ms}', Replace: function(){var M = DateTime.getMilliseconds(); var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM}}
            /*{String: '{REL}', Replace: function(){var M = This.GetRelativeTime(); return M}},
             {String: '{RELATIVE}', Replace: function(){var M = This.GetRelativeTime(null,null,-1); return M}}*/
        ];

        if (opt_ConvertToUtc) {
            Search = [
                {String: '{AM}', Replace: function(){AmPm = true; var H = DateTime.getUTCHours; return H >= 12 ? 'PM' : 'AM'}},
                {String: '{Am}', Replace: function(){AmPm = true; var H = DateTime.getUTCHours; return H >= 12 ? 'Pm' : 'Am'}},
                {String: '{am}', Replace: function(){AmPm = true; var H = DateTime.getUTCHours; return H >= 12 ? 'pm' : 'am'}},
                {String: '{YYYY}', Replace: function(){return DateTime.getUTCFullYear() + ''}},
                {String: '{YY}', Replace: function(){var Y = DateTime.getUTCFullYear() + ''; Y = Y.substr(2,4); return Y;}},
                {String: '{MM}', Replace: function(){var M = DateTime.getUTCMonth()+1 + ''; if (M.length == 1) M =  '0'+M; return M}},
                {String: '{M}', Replace: function(){return DateTime.getUTCMonth()+1 + ''}},
                {String: '{Mon}', Replace: function(){var M = DateTime.getUTCMonth(); return ShortMonths[M]}},
                {String: '{Month}', Replace: function(){var M = DateTime.getUTCMonth(); return Months[M]}},
                {String: '{D}', Replace: function(){return DateTime.getUTCDate() + ''}},
                {String: '{DD}', Replace: function(){var M = DateTime.getUTCDate() + ''; var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM; }},
                {String: '{Day}', Replace: function(){var D = DateTime.getUTCDay(); return ShortDaysOfTheWeek[D]}},
                {String: '{FullDay}', Replace: function(){var D = DateTime.getUTCDay(); return Days[D]}},
                {String: '{Dth}', Replace: function(){var D = DateTime.getUTCDate(); return D + DaySuffixes[D]}},
                {String: '{hh}', Replace: function(){var H = DateTime.getUTCHours(); H = AmPm && H >= 12 ? H-12 : H; H = AmPm && H == 0 ? 12 : H; var HH = H + ''; if (HH.length ==1) HH = '0'+HH; return HH}},
                {String: '{h}', Replace: function(){var H = DateTime.getUTCHours(); H = AmPm && H >= 12 ? H-12 : H; H = AmPm && H == 0 ? 12 : H; var HH = H + ''; return HH}},
                {String: '{mm}', Replace: function(){var M = DateTime.getUTCMinutes(); var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM}},
                {String: '{m}', Replace: function(){return DateTime.getUTCMinutes() + '';}},
                {String: '{ss}', Replace: function(){var M = DateTime.getUTCSeconds(); var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM}},
                {String: '{s}', Replace: function(){return DateTime.getUTCSeconds() + '';}},
                {String: '{ms}', Replace: function(){var M = DateTime.getUTCMilliseconds(); var MM = M + ''; if (MM.length ==1) MM = '0'+MM; return MM}}
                /*{String: '{REL}', Replace: function(){var M = This.GetRelativeTime(null,null,null,true); return M}},
                 {String: '{RELATIVE}', Replace: function(){var M = This.GetRelativeTime(null,null,-1,true); return M}}*/
            ];
        }

        if (!Format) Format = '{Mon} {Dth}, {YYYY}, {h}:{mm} {AM}';
        _.each(Search,function(S){
            //console.log('GetFormattedString', S.String, S.Replace(),Formatted.indexOf(S.String));
            if (Format.indexOf(S.String) > -1) { Format = Format.split(S.String).join(S.Replace()); }
        },this);
        return Format;
    },
    Slugify: function(String, optUnSlug){
        var Keys = [
            {n:'.',s:'_DOT_'},
            {n:'@',s:'_AT_'},
            {n:',',s:'_C_'},
            {n:' ',s:'_'}
        ];
        _.each(Keys,function(k){
            if (optUnSlug) {
                String = String.split(k.s).join(k.n);
            } else {
                String = String.split(k.n).join(k.s);
            }
        },this);
        return String;
    }
}

var Validators = {
    /**
     * Enumerations for validation error types
     * @enum {string}
     */
    ErrorTypes: {
        REQUIRED: 'This field is required',
        INVALID_PHONE: 'Invalid phone number',
        INVALID_EMAIL: 'Invalid email address',
        INVALID_WEBSITE: 'Invalid url',
        INVALID_PASSWORD: 'Invalid password',
        INVALID_CREDIT_CARD: 'Invalid credit card'
    },

    /**
     * Validates that the value is a 10-11 digit phone number
     * @param {string|number} Value
     * @return {object} An object containing a boolean Valid field as to whether the value is valid or not. The object may also contain an Error field, specifying what type of error was thrown if invalid.
     */
    PhoneNumber: function(Value, optCallback, optContext){
        Value += '';
        var Val = Value.split('-').join('').split('(').join('').split(')').join('').split('.').join('').split(' ').join('');
        var Match = Val.match(/[0-9]+/);
        ///console.log('..... ValidatePhone (%s): Match = ',Value,Match);
        if (!Match || !Match.length || (Match[0] && (Match[0].length < 10 || Match[0].length > 11))) {
            var V = {Valid:false, Errors: Validators.ErrorTypes.INVALID_PHONE};
            if (optCallback) optCallback.call(optContext || this, V);
            return V;
        }
        if (optCallback) optCallback.call(optContext || this, true);
        return true;
    },

    /**
     * Validates that the value is an email address. Currently only checks for something@something.abc
     * @param {string} Value
     * @return {object} An object containing a boolean Valid field as to whether the value is valid or not. The object may also contain an Error field, specifying what type of error was thrown if invalid.
     */
    Email: function(Value, optCallback, optContext){
        var V = {Valid:false, Errors: Validators.ErrorTypes.INVALID_EMAIL};
        var At = Value.indexOf('@');
        if (At < 0) { if (optCallback) optCallback.call(optContext || this, V); return V; }
        var Dot = Value.indexOf('.',At);
        if (Dot < 0) { if (optCallback) optCallback.call(optContext || this, V); return V; }
        if (optCallback) optCallback.call(optContext || this, true);
        return true;
    },

    /**
     * Validates that the value is a website. Does not check for http:// - but checks for a minimum of two dots.
     * @param {string} Value
     * @return {object} An object containing a boolean Valid field as to whether the value is valid or not. The object may also contain an Error field, specifying what type of error was thrown if invalid.
     */
    Website: function(Value, optCallback, optContext){
        var V = {Valid:false, Errors: Validators.ErrorTypes.INVALID_WEBSITE};
        var Dot = Value.indexOf('.');
        if (Dot < 0) { if (optCallback) optCallback.call(optContext || this, V); return V; }
        var Dot2 = Value.indexOf('.',Dot);
        if (Dot2 < 0) { if (optCallback) optCallback.call(optContext || this, V); return V; }
        if (optCallback) optCallback.call(optContext || this, true);
        return true;
    },

    /**
     * Validates that the value is a valid password
     * @param {string} Value The password
     * @param {string} Params A string with delimeters that specify what a valid password requires, in the form of "Option=Amount|Option=Amount"
     *   Options: Capitals (Capital Letters), Symbols, Numbers
     *   Amounts: 1+ = one or more, 1- = one or less, 0 = none, 1..2 = one to two
     *   Example: "Capitals=1+|Symbols=1+|Numbers=1..2"
     * @return {object} An object containing a boolean Valid field as to whether the value is valid or not. The object may also contain an Error field, specifying what type of error was thrown if invalid, and/or a ReplaceText field which specifies how the value was not valid.
     */
    Password: function(Value, optCallback, optContext){
        var Params = Validators.PasswordRequirements || 'Length=6+';
        GLOBAL.LOG('ValidatePw',Value,Params);
        var MatchStrings = {
            Capitals: new RegExp(/[A-Z]+/g),
            Symbols: new RegExp(/\W+/g),
            Numbers: new RegExp(/[0-9]+/g)
        }
        var ErrorLabels = {
            Capitals: 'capital letters', //TODO L
            Symbols: 'symbols',
            Numbers: 'numbers'
        }
        var Return = function(Error) {
            var V = {Valid:false, Errors: Q.Validators.ErrorTypes.INVALID_PASSWORD + (Error ? ': '+Error : '')};
            if (optCallback) optCallback.call(optContext || this, V);
            return V;
        }
        Params = Params.split('|');
        for (var i=0; i< Params.length; i++) {
            var P = Params[i].split('=');
            var Type = P[0];
            var Amount = P[1];
            if (MatchStrings[Type]) {
                var Match = Value.match(MatchStrings[Type]);
            } else {
                if (Type == 'Length') {
                    var Min = 0;
                    var Max = 20;
                    if (Amount.indexOf('+')>-1) Min = parseInt(Amount.split('+')[0]);
                    if (Amount.indexOf('-')>-1) Max = parseInt(Amount.split('-')[0]);
                    if (Amount.indexOf('..')>-1) { Min = parseInt(Amount.split('..')[0]); Max = parseInt(Amount.split('..')[1]); }
                    GLOBAL.LOG('Pw length: %o < %o > %o',Min,Value.length,Max);
                    if (Value.length < Min) return Return('must be ' + Min + ' or more characters in length'); //TODO L
                    if (Value.length > Max) return Return('must be ' + Max + ' or less characters in length'); //TODO L
                    break;
                }
            }
            GLOBAL.LOG('PW Match',Match);
            if (Match && Amount == '0') return Return('Cannot contain '+ErrorLabels[Type]); //TODO L
            if (!Match && Amount != '0') return Return('Must contain '+ErrorLabels[Type]); //TODO L
            if (Match && Amount != '0') {
                var Total = 0;
                _.each(Match,function(M){
                    Total += M.length;
                },this);
                var Min = 0;
                var Max = 10000000;
                if (Amount.indexOf('+')>-1) Min = parseInt(Amount.split('+')[0]);
                if (Amount.indexOf('-')>-1) Max = parseInt(Amount.split('-')[0]);
                if (Amount.indexOf('..')>-1) { Min = parseInt(Amount.split('..')[0]); Max = parseInt(Amount.split('..')[1]); }
                if (Total < Min) return Return('Not enough '+ErrorLabels[Type]); //TODO L
                if (Total > Max) return Return('Too many '+ErrorLabels[Type]); //TODO L
            }
        }

        if (optCallback) optCallback.call(optContext || this, true);
        return true;
    },

    PasswordRequirements: 'Length=6+',

    /**
     * Validates that the value is a 16 digit credit card number
     * @param {string|number} Value
     * @return {object} An object containing a boolean Valid field as to whether the value is valid or not. The object may also contain an Error field, specifying what type of error was thrown if invalid.
     */
    CreditCardNumber: function(Value, optCallback, optContext){
        var V = {Valid:false, Errors: Q.Validators.ErrorTypes.INVALID_CREDIT_CARD};
        var Val = Value.split('-').join('').split(' ').join('');
        var Bad = Val.match(/[a-zA-Z]/);
        if (Bad && Bad.length) return {Valid:false, Error:'Please enter a valid credit card number'};
        var Match = Val.match(/[0-9]+/);
        GLOBAL.LOG('..... Validate CC (%o): Match = ',Value,Match);
        if (!Match || !Match.length) { if (optCallback) optCallback.call(optContext || this, V); return V; }
        if (Match[0] && (Match[0].length != 16)) { if (optCallback) optCallback.call(optContext || this, V); return V; }
        if (optCallback) optCallback.call(optContext || this, true);
        return true;
    }
}

exports.each = each;
exports.Looper = Looper;
exports.Formatters = Formatters;
exports.Validators = Validators;
exports.Clone = Clone;
exports.GetValueFromObjectString = GetValueFromObjectString;
exports.SetValueToObjectString = SetValueToObjectString;
exports.GoArray = GoArray;
