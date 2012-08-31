$(function() {
    ko.dirtyFlag = function(root, isInitiallyDirty) {
        var result = function() {},
        _initialState = ko.observable(ko.toJSON(root)),
        _isInitiallyDirty = ko.observable(isInitiallyDirty);
    
        result.isDirty = ko.dependentObservable(function() {
            var initState = _initialState();
            var nowstate = ko.toJSON(root);
            var iniDirty = _isInitiallyDirty();
            if (iniDirty || initState !== nowstate) {
                var tmp1 =  initState != nowstate;
            }
            return _isInitiallyDirty() || _initialState() !== ko.toJSON(root);
        });
    
        result.setDirty = function() {
            _isInitiallyDirty(true);
        }
        result.reset = function() {
            _initialState(ko.toJSON(root));
            _isInitiallyDirty(false);
        };
    
        return result;
    };
    
    ko.observableArray['fn']['arrayFirst']= function (valueOrPredicate) {
        var underlyingArray = this();
        var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
        
        for (var i = underlyingArray.length - 1; i >= 0; i--) {
            var value = underlyingArray[i];
            if (predicate(value)){
                return value;
            }
        }
    }
});