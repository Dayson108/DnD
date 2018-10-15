var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);


console.log("thing");
app.use('/', express.static(__dirname + '/'));
app.set('view engine', 'ejs');
console.log("Starting");
server.listen(process.env.PORT || 8080);
console.log("Listening");


app.get('/', function(req, res){
	res.render(__dirname + '/views/TestPage.ejs');
});
