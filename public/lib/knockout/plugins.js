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
    ko.bindingHandlers.dateString = {
		update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
            var value = valueAccessor();
            var valueUnwrapped = ko.utils.unwrapObservable(value);
            if(valueUnwrapped) {
                $(element).text(moment(valueUnwrapped).format('YYYY-MM-DD'));
            }
        }
    }
    
    ko.moneyObservable =(function ($) {
    
        var currency = null;
	    var cleanInput = function (value) {
	        if (value == '') { return value;}
	        return parseFloat(value.replace(/[^0-9.-]/g, ''));
	    };
	
	    var format = function (value) {
	        if (value == null) { return '';}
	        if (value === 0) { return currency() + '0.00';}
	        if (value == '') {return '';}
            var toks = value.toFixed(2).replace('-', '').split('.');
	        var display = $.map(toks[0].split('').reverse(), function (elm, i) {
	            return [(i % 3 == 0 && i > 0 ? ',' : ''), elm];
	        }).reverse().join('');
	
            return currency() + [display ,  toks[1]].join('.')
	    };
	    
	    return function(initialValue , curr){
	        var raw = typeof initialValue == "function"? 
	            ko.dependentObservable(initialValue) : ko.observable(initialValue);
	        currency = typeof curr == 'function'?
	            ko.dependentObservable(curr) : ko.observable(curr);
	        var public=ko.dependentObservable({
	            read:function(){return format(raw())},
	            write:function(value){raw(cleanInput(value))}            
	        });
	        
	        public.formatted=ko.dependentObservable({
	            read:function(){return format( raw())},
	            write:function(value){raw(cleanInput(value))} 
	        });
	        return public;
	    };
	})(jQuery);
	
	//jqAuto -- main binding (should contain additional options to pass to autocomplete)
	//jqAutoSource -- the array to populate with choices (needs to be an observableArray)
	//jqAutoQuery -- function to return choices
	//jqAutoValue -- where to write the selected value
	//jqAutoSourceLabel -- the property that should be displayed in the possible choices
	//jqAutoSourceInputValue -- the property that should be displayed in the input box
	//jqAutoSourceValue -- the property to use for the value
	ko.bindingHandlers.jqAuto = {
	    init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
	        var options = valueAccessor() || {},
	            allBindings = allBindingsAccessor(),
	            unwrap = ko.utils.unwrapObservable,
	            modelValue = allBindings.jqAutoValue,
	            source = allBindings.jqAutoSource,
	            query = allBindings.jqAutoQuery,
	            valueProp = allBindings.jqAutoSourceValue,
	            inputValueProp = allBindings.jqAutoSourceInputValue || valueProp,
	            labelProp = allBindings.jqAutoSourceLabel || inputValueProp;
	
	        //function that is shared by both select and change event handlers
	        function writeValueToModel(valueToWrite) {
	            if (ko.isWriteableObservable(modelValue)) {
	               modelValue(valueToWrite );  
	            } else {  //write to non-observable
	               if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers']['jqAutoValue'])
	                        allBindings['_ko_property_writers']['jqAutoValue'](valueToWrite );    
	            }
	        }
	        
	        //on a selection write the proper value to the model
	        options.select = function(event, ui) {
	            writeValueToModel(ui.item ? ui.item.actualValue : null);
	        };
	            
	        //on a change, make sure that it is a valid value or clear out the model value
	        options.change = function(event, ui) {
	            var currentValue = $(element).val();
	            var matchingItem =  ko.utils.arrayFirst(unwrap(source), function(item) {
	               return unwrap(inputValueProp ? item[inputValueProp] : item) === currentValue;   
	            });
	            
	            if (!matchingItem) {
	               writeValueToModel(null);
	            }    
	        }
	        
	        //hold the autocomplete current response
	        var currentResponse = null;
	            
	        //handle the choices being updated in a DO, to decouple value updates from source (options) updates
	        var mappedSource = ko.dependentObservable({
	            read: function() {
	                    mapped = ko.utils.arrayMap(unwrap(source), function(item) {
	                        var result = {};
	                        result.label = labelProp ? unwrap(item[labelProp]) : unwrap(item).toString();  //show in pop-up choices
	                        result.value = inputValueProp ? unwrap(item[inputValueProp]) : unwrap(item).toString();  //show in input box
	                        result.actualValue = valueProp ? unwrap(item[valueProp]) : item;  //store in model
	                        return result;
	                });
	                return mapped;                
	            },
	            write: function(newValue) {
	                source(newValue);  //update the source observableArray, so our mapped value (above) is correct
	                if (currentResponse) {
	                    currentResponse(mappedSource());
	                }
	            },
	            disposeWhenNodeIsRemoved: element
	        });
	        
	        if (query) {
	            options.source = function(request, response) {  
	                currentResponse = response;
	                query.call(this, request.term, mappedSource);
	            }
	        } else {
	            //whenever the items that make up the source are updated, make sure that autocomplete knows it
	            mappedSource.subscribe(function(newValue) {
	               $(element).autocomplete("option", "source", newValue); 
	            });
	            
	            options.source = mappedSource();
	        }
	        
	        
	        //initialize autocomplete
	        $(element).autocomplete(options);
	    },
	    update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
	       //update value based on a model change
	       var allBindings = allBindingsAccessor(),
	           unwrap = ko.utils.unwrapObservable,
	           modelValue = unwrap(allBindings.jqAutoValue) || '', 
	           valueProp = allBindings.jqAutoSourceValue,
	           inputValueProp = allBindings.jqAutoSourceInputValue || valueProp;
	        
	       //if we are writing a different property to the input than we are writing to the model, then locate the object
	       if (valueProp && inputValueProp !== valueProp) {
	           var source = unwrap(allBindings.jqAutoSource) || [];
	           var modelValue = ko.utils.arrayFirst(source, function(item) {
	                 return unwrap(item[valueProp]) === modelValue;
	           }) || {};             
	       } 
	
	       //update the element with the value that should be shown in the input
	       $(element).val(modelValue && inputValueProp !== valueProp ? unwrap(modelValue[inputValueProp]) : modelValue.toString());    
	    }
	};
	
});