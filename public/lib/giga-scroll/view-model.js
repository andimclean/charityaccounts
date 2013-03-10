function GigaScrollViewModel(opts) {

  var self = this;
  
  // Shorthand to create a computed property with deferred evaluation.
  function DC(fn) { 
    return ko.computed({ read: fn, deferEvaluation: true , owner: self}) 
  }


  self.visibleItems = DC(function() {
    var i, loadStartIndex, loadLength, oneViewPortAboveIndex, visibles;

    if (_visibleStartIndex() === null || _fitsInViewPort === null) {
      return [];
    }

    oneViewPortAboveIndex = _visibleStartIndex() - _fitsInViewPort();
    loadStartIndex = Math.max(oneViewPortAboveIndex, 0);
    loadLength = _fitsInViewPort() * 3;

    _loadIfMissing(loadStartIndex, loadLength);
    
    var ivp = _fitsInViewPort() || 0;
    visibles = [];
    var cache = _itemCache();
    for (i = 0; i < ivp; i++) {
      var tmp = cache[_visibleStartIndex() + i];
      if (tmp) {
        visibles[i] = tmp;
        visibles[i].cacheIndex = _visibleStartIndex() + i;
      } else {
        return visibles;
      }
    }
    return visibles;
  });

  self.offsetTop = DC(function() {
    return _visibleStartIndex() * _elementHeight();
  });

  self.gigaDivHeight = DC(function() {
    return _numberOfServerItems() * _elementHeight();
  });

  self.setViewPortHeight = function(height)  {
    _viewPortHeight(height);
  }
  self.setElementHeight = function(height)  {
    _elementHeight(height);
  }
  self.setScrollPosition = function(y) {
    _scrollPosition(y);
  }

  self.clearCache = function() {
    _itemCache([]);
    _numberOfServerItems(null)
    if (viewport) self.setViewPortHeight(viewport.offsetHeight);
  }
  
  var _visibleStartIndex = DC(function() {
    if (_scrollPosition() === null || _elementHeight() === null) {
      return null;
    }
    var lastIndex = _numberOfServerItems();
    var lastStartIndex = Math.max(0,lastIndex - _fitsInViewPort());
    var indexAtScrollPosition = Math.floor(_scrollPosition() / _elementHeight());
    return Math.min(lastStartIndex, indexAtScrollPosition);
  });

  var _fitsInViewPort = DC(function() {
    if (_viewPortHeight() === null || _elementHeight() === null) {
      return null;
    }
    var vph = _viewPortHeight();
    var eh = _elementHeight();
    var val = Math.ceil(vph / eh);
    return val;
  });

  var _getItemsMissingHandle = null;

  var _loadIfMissing = function(startIndex, length) {

    while(_itemCache()[startIndex]) {
      startIndex++;
      length--;
    }
    while(_itemCache()[startIndex+length-1]) {
      length--;
      if (length < 1) return;
    }

    var maxLength = _numberOfServerItems();
    if (maxLength != null) {
	    if (startIndex > maxLength) {
	        return;
	    }
	    if (startIndex + length > maxLength ) {
	        length = maxLength - startIndex;
	    }
	    if (length <= 0 ) {
	        return;
	    }
	}
    clearTimeout(_getItemsMissingHandle);
    _getItemsMissingHandle = setTimeout(function (){
      opts.load(startIndex, length, function(items, numberOfServerItems) {
        _numberOfServerItems(numberOfServerItems);
        for(var i = 0; i < length; i++) {
          _itemCache()[startIndex + i] = items[i];
        }
        _itemCache.valueHasMutated();
      });
    }, 100);

  };

  var _itemCache = ko.observableArray();
  var _numberOfServerItems = ko.observable(null);
  var _viewPortHeight = ko.observable(null);
  var _elementHeight = ko.observable(null);
  var _scrollPosition = ko.observable(0);
  var viewport = null;
}