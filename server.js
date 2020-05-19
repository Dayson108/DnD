/*
git add .
git commit -am "text"
git push heroku master

Remove LobbyID from PlayersInLobby upon disconnect

Remove Game from offline/online lobbies on complete/disconnect
if no DM and No Players online - terminate game
If No DM for x min - move all players offline?



DM Create placeholder

Character Join Game
DM create note
Player View note
Private Notes
Inventory
Magic
Triggerable Rests
Forum
Advanced Character Creation

Check Name constraints/character limits/etc for creating games


*/

var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var uniqid = require('uniqid');

var bcrypt = require('bcryptjs');
app.use('/', express.static(__dirname + '/'));
var mongodb = require('mongodb');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

//var ObjectId = require('mongodb').ObjectID;
var db;
var MainSocket = io.of('/DnDNotesMain');
var lobbySocket = io.of('/Lobby');

var OnlinePlayers = [];
var PlayersInLobby = [];
var DMsInLobby = [];
var ActiveGames = [];
var OfflineGames = [];

var LoggingIn = [];

//var DMCODE = "123";
//var InitList = [];
//var CharacterStats = [];
//var AddressBook = [];
//var DMsocketId;




console.log("Starting");
server.listen(process.env.PORT || 8080);
console.log("Listening");

mongodb.MongoClient.connect('mongodb://dayson108:5tarw1nd@ds311968.mlab.com:11968/heroku_lc0x9f9k', { useNewUrlParser: true }, function(err, client){
	console.log("DB connected");
	db = client.db('heroku_lc0x9f9k');
});

app.get('/', function(req, res){
	res.render(__dirname + '/views/login.ejs', {ErrorMsg: JSON.stringify("")});
});

app.get('/Lobby', function(req, res){
	res.render(__dirname + '/views/lobby.ejs');
});

app.get('/CreateNote', function(req, res){
	res.render(__dirname + '/views/CreateNote.ejs');
});

app.post('/SaveNote', function(req, res){
	var Note = {
		PublicNotes: [],
		GroupNotes: [],
		Images: [],
		Category: req.body.NewNoteCategory,
		Name: req.body.NewNoteName,
		PrivatePlayerInfo: "Private Stuff"
	}
	Note.PublicNotes.push("This is the first page of info");
	Note.GroupNotes.push("This is the group notes");
	Note.Images.push("https://github.com/Dayson108/drd/blob/master/Images/inspired.png?raw=true");
	
	var DMName;
	var GameName;
	var ActiveGamesLength = ActiveGames.length;
	var OfflineGamesLength = OfflineGames.length;
	for(var i = 0; i < ActiveGames.length; i++){
		if(ActiveGames[i].GameID == req.body.GameID){
			DMName = ActiveGames[i].DMName;
			GameName = ActiveGames[i].GameName;
			OfflineGamesLength = 0;
		}
	}
	for(var i = 0; i < OfflineGames.length; i++){
		if(OfflineGames[i].GameID == req.body.GameID){
			DMName = OfflineGames[i].DMName;
			GameName = OfflineGames[i].GameName;
		}
	}

	var collectionName = "Game_" + DMName + "_" + GameName + "_";
	db.collection(collectionName + "NOTES").insert(Note, function(err, result){
		if(err){return console.log(err)};
	});

	//res.render(__dirname + '/views/CreateNote.ejs', {Game: JSON.stringify("")});
	res.render(__dirname + '/views/TestPage.ejs');
});

app.post('/RegisterAccount', function(req, res){
	var UsernameDoesNotAlreadyExist = true;
	//var playerName = req.body.PlayerName;

	db.collection('__Accounts').find().toArray(function(err, result){
		if (err) return console.log(err);
		for(var i = 0; i < result.length; i ++){
			//Check to see if the username already exists in the database. 
			if(req.body.username == result[i].username){
				UsernameDoesNotAlreadyExist = false;
				break;
			}
		}
		if(UsernameDoesNotAlreadyExist){
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				req.body.password = hash;
				db.collection('__Accounts').insertOne(req.body, function(err, result){
					if(err){return console.log(err)};
				});	
			});
			res.render(__dirname + '/views/lobby.ejs');
		}else{
			var msg = "Account Name Already Exists.  Please login or choose a different account name";
			res.render(__dirname + '/views/index.ejs', {ErrorMsg: JSON.stringify(msg)});
		}	
	});	
});

app.post('/Login', function(req, res){
	console.log("/Login Called");
	var playerNotFound = true;
	db.collection('__Accounts').find().toArray(function(err, result){
		if (err) return console.log(err);
		for(var i = 0; i < result.length; i ++){
			if(req.body.username == result[i].username && bcrypt.compareSync(req.body.password, result[i].password)){
				console.log("player logged in");
				var info = {
					mainSocketID: uniqid(),
					playerName: result[i].PlayerName,
					username: req.body.username,
				};
				res.render(__dirname + '/views/DnDTool.ejs', {AccountInfo: JSON.stringify(info)});
				playerNotFound = false;
				break;	
			}
		}
		if(playerNotFound){
			var msg = "Invalid Account Name or Password";
			res.render(__dirname + '/views/index.ejs', {ErrorMsg: JSON.stringify(msg)});
		}
	});
});
 
/*
app.post('/CreateCharacter', function(req, res){
	//console.log("/CreateCharacter Called");
	res.render(__dirname + '/views/CreateCharacter.ejs', {iPlayerName: JSON.stringify(req.body.PlayerName), iUserName: JSON.stringify(req.body.UserName)});
});
*/

app.post('/DnD_Notes', function(req, res){
	//console.log("/DnD_Notes Called");
	res.render(__dirname + '/views/DnD_Notes.ejs');	
});

app.post('/DMCreateGame', function(req, res){
	var query = { username: req.body.CreateGameDMName };
	var submit = true;
	var newvalues;	
	db.collection("__Accounts").findOne(query, function(err, result) {
		if (err) throw err;
		if(!("GameIDs" in result)){
			/*
				Check to see if the variable "GameIDs" exists in the account
				If it doesn't, then this is the first created game
				Create an arry of Games, push this game into it
			*/
			var Games = [ req.body.GameName ];
			newvalues = { $set: {GameIDs: Games} };
		}
		
		else{
			/*
				This will run if the user has created previous games.
				Take the existing game list array, add the current game
			*/
			for(var i = 0; i < result.GameIDs.length; i++){
				//if(Game.GameName == result.GameIDs[i].GameName){
				if(req.body.GameName == result.GameIDs[i]){
					//If the newly created game has the same name as an
					//existing name.  Reject the save
					console.log("Game Name Already Exists")
					submit = false;
					lobbySocket.emit("GameCreateErrorMsg", "Game Name Already Taken");
					break;
				}
			}	
			if(submit){
				var Games = result.GameIDs;
				Games.push(req.body.GameName);
				newvalues = { $set: {GameIDs: Games} };	
			}				
		}
	
		if(submit){
			db.collection("__Accounts").updateOne(query, newvalues, function(err, res) {
				if (err) throw err;
				
				/*
				db.collection("__Accounts").findOne(query, function(err, result) {
					if (err) throw err;
					console.log(result.GameIDs);
					lobbySocket.emit('DMRcvGames', result.GameIDs);
				});
				*/
			});
			
			var GameInfo = {
				GameName: req.body.GameName,
				DMName: req.body.CreateGameDMName
			}
			var collectionName = "Game_" + GameInfo.DMName + "_" + GameInfo.GameName;
			db.collection(collectionName).insert(GameInfo, function(err, result){
				if(err){return console.log(err)};
			});
		}
	});
	///res.render(__dirname + '/views/DM_Lobby.ejs');
});

app.post('/DM_Game', function(req, res){

	var GameInfo = {
		GameName: req.body.GameName,
		DMName: req.body.DMName,
		GameID: uniqid()
	}

	ActiveGames.push(GameInfo);
		
	for(var i = 0; i < PlayersInLobby.length; i++){
		console.log("updating Lobby :" + i);
		/*
		for(var d = 0; d < ActiveGames.length; d++){
			var temp = "Game_" + ActiveGames[d].DMName;
			//This is where to Get the Character Lists from the database
		}			
		*/
		console.log("Updating Lobbies for: " + PlayersInLobby[i]);
		lobbySocket.to(PlayersInLobby[i]).emit("LobbyUpdate", ActiveGames);
	}
	console.log("Game " + req.body.Game + " started by: " + req.body.DMName);
	console.log("ID: " + GameInfo.GameID);
	
	res.render(__dirname + '/views/DM_Game.ejs', {GameID: JSON.stringify(GameInfo.GameID)});
});

app.post('/SaveCharacter', function(req, res){
	//console.log("Creating Character for playerName " + req.body.PlayerName);
	//console.log("Creating Character for username " + req.body.username);
		
	for(var i = 0; i < OnlinePlayers.length; i++){
			if(OnlinePlayers[i].playerRID == req.body.PlayerRID){
				if(OnlinePlayers[i].playerName == req.body.PlayerName && OnlinePlayers[i].accountName == req.body.username){
					var CollectionName = "_Account_" + req.body.username + "_Characters";

					db.collection(CollectionName).insertOne(req.body, function(err, result){
						if(err){return console.log(err)};
						db.collection(CollectionName).find().toArray(function(err, result2){
							if (err) return console.log(err);
							res.render(__dirname + '/views/lobby.ejs');
						});	
					});
				}
			}
	}
	
	res.render(__dirname + '/views/Error.ejs', {ErrorMsg: JSON.stringify("")});
	
});


/* Edit Character
app.post('/EditCharacter', function(req, res){
	collectionName = req.body.username + "_Characters";
	
	db.collection(collectionName).update({_id: ObjectId(req.body.charID)}, 
	{$set: {
		CharacterName: req.body.CharacterName, 
		Level: req.body.Level,
		Race: req.body.Race,
		Class: req.body.Class,
		AC: req.body.AC,
		MaxHP: req.body.MaxHP,
		STR: req.body.STR,
		DEX: req.body.DEX,
		CON: req.body.CON,
		INT: req.body.INT,
		WIS: req.body.WIS,
		CHA: req.body.CHA,
		AcrobaticsProf: req.body.AcrobaticsProf,
		InsightProf: req.body.InsightProf,
		PerformanceProf: req.body.PerformanceProf,
		AnimalHandlingProf: req.body.AnimalHandlingProf,
		IntimidationProf: req.body.IntimidationProf,
		PersuasionProf: req.body.PersuasionProf,
		ArcanaProf: req.body.ArcanaProf,
		InvestigationProf: req.body.InvestigationProf,
		ReligionProf: req.body.ReligionProf,
		AthleticsProf: req.body.AthleticsProf,
		MedicineProf: req.body.MedicineProf,
		SleightOfHandProf: req.body.SleightOfHandProf,
		DeceptionProf: req.body.DeceptionProf,
		NatureProf: req.body.NatureProf,
		StealthProf: req.body.StealthProf,
		HistoryProf: req.body.HistoryProf,
		PerceptionProf: req.body.PerceptionProf,
		SurvivalProf: req.body.SurvivalProf,
		STRProf: req.body.STRProf,
		DEXProf: req.body.DEXProf,
		CONProf: req.body.CONProf,
		INTProf: req.body.INTProf,
		WISProf: req.body.WISProf,
		CHAProf: req.body.CHAProf,
		ProfBonus: req.body.ProfBonus
		}});

	db.collection(collectionName).find().toArray(function(err, result){
		if (err) return console.log(err);
		res.render(__dirname + '/Views/CharScreen', {Characters: JSON.stringify(result), iPlayerName: JSON.stringify(playerName)});
	});	
});

app.post('/DnDTool', function(req, res){
	res.render(__dirname + '/Views/DnDTool.ejs', {Msg: JSON.stringify("")});
});

app.get('/Spellbook', function(req, res){
	res.render(__dirname + '/Views/Spellbook.ejs', {ErrorMsg: JSON.stringify("")});
});


*/

/*
var lobbySocket = io.of('/Lobby');
lobbySocket.on('connection', function(socket){
	console.log('someone connected to lobby');
	socket.on('disconnect', function(){ 
		console.log('someone disconnected from lobby');
	});
});
*/

/*
All but sender
lobbySocket.broadcast.emit('', msg);

All
lobbySocket.emit('', msg);

Whisper
lobbySocket.to(socketID).emit('', msg);
*/


/*
var testCount = 0;
function testRace(){
	console.log("timestamp: " + getCurrentTime());
	if (testCount < 12){
		testCount += 1
		setTimeout(function(){ 
			testRace();
		}, timeoutTime("sec",5));
	}
}
*/

//var lobbySocket = io.of('/Lobby');
lobbySocket.on('connection', function(socket){
	//console.log('someone connected to Socket');
	console.log("Someone Connected to Lobby Socket");

	socket.on('disconnect', function(){ 
		
		for(var i = 0; i < OnlinePlayers.length; i++){
			if(OnlinePlayers[i].MainSocket.match(socket.id)){
				OnlinePlayers.splice(i, 1);
				console.log(socket.id + " has logged out");
			}
		}
		for(var i = 0; i < PlayersInLobby.length; i++){
			if(PlayersInLobby[i].match(socket.id)){
				PlayersInLobby.splice(i, 1);
				console.log(socket.id + " has left the lobby");
			}
		}
		/*
		for(var i = 0; i < OnlineDMs.length; i++){
			if(OnlineDMs[i].MainSocket.match(socket.id)){
				OnlineDMs.splice(i, 1);
				console.log(socket.id + " - DM has logged out");
			}
		}
		for(var i = 0; i < DMsInLobby.length; i++){
			if(DMsInLobby[i].match(socket.id)){
				DMsInLobby.splice(i, 1);
				console.log(socket.id + "-DM has left the lobby");
			}
		}
	*/		
		
	});
	

	
	socket.on('Test', function(msg){
		/*
		console.log("Test Start: " + getCurrentTime());
		//setTimeout(function(){ console.log("Timeout Occured at: " + getCurrentTime()}, timeoutTime("sec",5)));
		setTimeout(function(){ 
			console.log("Timeout at: " + getCurrentTime());
		}, timeoutTime("min",1));
		console.log("test race 1");
		testRace();
		*/
		
	});		
	
	socket.on('DMCreateGame', function(Game){
		var query = { username: Game.DMName };
		var submit = true;
		var newvalues;
	
		db.collection("__Accounts").findOne(query, function(err, result) {
			if (err) throw err;
			if(!("GameIDs" in result)){
				/*
					Check to see if the variable "GameIDs" exists in the account
					If it doesn't, then this is the first created game
					Create an arry of Games, push this game into it
				*/
				var Games = [ Game.GameName ];
				newvalues = { $set: {GameIDs: Games} };
			}else{
				/*
					This will run if the user has created previous games.
					Take the existing game list array, add the current game
				*/
				for(var i = 0; i < result.GameIDs.length; i++){
					//if(Game.GameName == result.GameIDs[i].GameName){
					if(Game.GameName == result.GameIDs[i]){
						//If the newly created game has the same name as an
						//existing name.  Reject the save
						console.log("Game Name Already Exists")
						submit = false;
						//lobbySocket.emit("GameCreateErrorMsg", "Game Name Already Taken");
						lobbySocket.to(socket.id).emit("GameCreateErrorMsg");
						break;
					}
				}	
				if(submit){
					var Games = result.GameIDs;
					Games.push(Game.GameName);
					newvalues = { $set: {GameIDs: Games} };	
				}				
			}
		
			if(submit){
				db.collection("__Accounts").updateOne(query, newvalues, function(err, res) {
					if (err) throw err;
				});
				var GameInfo = {
					GameName: Game.GameName,
					DMName: Game.DMName
				}
				var collectionName = "Game_" + GameInfo.DMName + "_" + GameInfo.GameName;
				db.collection(collectionName).insertOne(GameInfo, function(err, result){
					if(err){return console.log(err)};
					console.log("Game Woof");
					console.log(result);
					console.log("Game Meow");
				});
				
				
				lobbySocket.to(socket.id).emit("GameCreateConfirm");
			}
		});	
		
		
		
		
		
	});	
	/*
	socket.on('JoinLobby', function(AccountInfo){
	
		var PlayerRID = AccountInfo.playerRID;
		for(var i = 0; i < OnlinePlayers.length; i++){
			if(OnlinePlayers[i].playerRID == PlayerRID){
				PlayersInLobby.push(socket.id);
				var collectionName = "_Account_" + OnlinePlayers[i].username + "_Characters";		
				db.collection(collectionName).find().toArray(function(err, Characters){
					if (err) return console.log(err);
					lobbySocket.to(socket.id).emit("getCharacters", Characters)
				});	
			}
		}
	});	
	*/
	/*
	socket.on('RegisterMainSocket', function(AccountInfo){
		var error = true;
		for(var i = 0; i < OnlinePlayers.length; i++){
			if(OnlinePlayers[i].playerRID == AccountInfo.playerRID){
				if(OnlinePlayers[i].playerName == AccountInfo.playerName && OnlinePlayers[i].username == AccountInfo.username){
					OnlinePlayers[i].MainSocket = socket.id;
					error=false;
					break;
				}
			}
		}
		if(error){
			for(var i = 0; i < OnlineDMs.length; i++){
				if(OnlineDMs[i].playerRID == AccountInfo.playerRID){
					if(OnlineDMs[i].playerName == AccountInfo.playerName && OnlineDMs[i].username == AccountInfo.username){
						OnlineDMs[i].MainSocket = socket.id;
						error=false;
						break;
					}
				}
			}
		}
		if(error){
			lobbySocket.to(socket.id).emit("SocketError");
		}
	});
	*/
	socket.on('GetGamesList', function(AccountInfo){
		for(var i = 0; i < OnlineDMs.length; i++){
			if(OnlineDMs[i].playerRID == AccountInfo.playerRID){
				var query = { username:OnlineDMs[i].username};		
				db.collection("__Accounts").findOne(query, function(err, result) {
					if (err) throw err;
					lobbySocket.to(socket.id).emit("RecieveGamesList", JSON.stringify(result.GameIDs), JSON.stringify(ActiveGames));
					//if(!("GameIDs" in result))
					//{	
					//	res.render(__dirname + '/Views/DM_Lobby.ejs', {DMUsername: JSON.stringify(req.body.username), GamesList: ""});
					//}else{
					//	res.render(__dirname + '/Views/DM_Lobby.ejs', {DMUsername: JSON.stringify(req.body.username), GamesList: JSON.stringify(result.GameIDs)});
					//}
					
				
				});
			
			}
		}
	});	
	
	
});



//var MainSocket = io.of('/DnDNotesMain');
MainSocket.on('connection', function(socket){
	console.log('Someone Has Connected to Main Socket: ' + socket.id);
	
	socket.on('disconnect', function(){ 
		
	});

	socket.on('GetMainSessionID', function(){ 
		MainSocket.to(socket.id).emit("RcvMainSessionID", socket.id)
	});	
	
});








function getCurrentTime(){
		var date = new Date();
		var AmPm = "am";
		var hour = date.getHours(); 
		if(hour > 13) {
			hour -= 12
			AmPm = "pm";
		};
		var min = date.getMinutes();
		if(min < 10){min = "0" + min};
		var sec = date.getSeconds();
		if(sec < 10){sec = "0" + sec};
		return(hour + ":" + min +  ":" + sec + " " + AmPm); 	
}
function timeoutTime(unit, amount){
	if(unit == "sec"){
		return (amount * 1000);
	}
	if(unit == "min"){
		return (amount * 1000 * 60);
	}
	if(unit == "hour"){
		return (amount * 1000 * 60 * 60);
	}
}










