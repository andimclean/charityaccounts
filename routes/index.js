
/*
 * GET home page.
 */

function index(req, res){
  res.send({"hello":"world"});
};

exports.bind = function bindRoutes(app) {
	app.get('/', index);
};

