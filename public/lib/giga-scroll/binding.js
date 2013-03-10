(function() {

  ko.bindingHandlers.gigaScroll = {
    init: function(element, valueAccessor, allBindingsAccessor) {
      var viewModel = valueAccessor();

      var itemTemplate = element.innerHTML;

      var templateEngine = createNativeStringTemplateEngine();

      templateEngine.addTemplate('gigaScroll', "\
        <div id=\"gigaViewport\">\
          <div id=\"gigaRiver\" data-bind=\"style: { height: gigaDivHeight() + 'px' }\">\
            <div class=\"gigaRaft\" data-bind=\"style: { paddingTop: offsetTop() + 'px' }\">\
              <ul data-bind=\"foreach: visibleItems\">\
                "+itemTemplate+"\
              </ul>\
            </div>\
          </div>\
        </div>");

      ko.renderTemplate("gigaScroll", viewModel, { templateEngine: templateEngine }, element, "replaceNode" );

      var viewPort = document.getElementById('gigaViewport');
      viewPort.style.width = "100%";
      viewPort.style.height = "100%";
      viewPort.style.overflowY = "scroll";

      viewModel.viewport = viewPort;
      var measureViewPort = function() {
        viewModel.setViewPortHeight(viewPort.offsetHeight);
      }
      setTimeout(measureViewPort,100);
      window.addEventListener('resize', measureViewPort);

      viewPort.addEventListener('scroll', function (e) {
        viewModel.setScrollPosition(viewPort.scrollTop);
      });

      var ul = viewPort.getElementsByTagName('UL')[0];

      ul.style.margin = 0;
      ul.style.padding = 0;
      ul.style.border = 0;

      var onListItemInserted = function(e) {
        if(e.target.nodeName !== "LI") {
          return;
        }
        if (e.target.offsetHeight) {
	        viewModel.setElementHeight(e.target.offsetHeight);
	        ul.removeEventListener("DOMNodeInserted", onListItemInserted, false);
	    }
      }
      ul.addEventListener("DOMNodeInserted", onListItemInserted, false);

      viewModel.setElementHeight(20);

    }
  };
})();