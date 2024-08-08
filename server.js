const express = require("express");
const axios = require("axios");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server=http.createServer(app);

const io = new Server(server,{
    cors:{
        origin:"http://localhost:3000",
        methods:["GET","POST"]
    }
})
app.use(cors({
    origin:"http://localhost:3000",
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));
app.get('/', (req, res) => {
    res.send('<h1>Socket.IO Server is Running</h1>');
});
app.get('/search/artist',async(req,res) =>{
    try{
        const { artist } = req.query;
        const response = await axios.get(`https://api.deezer.com/search/artist?q=${artist}`);
        res.json(response.data)
    } catch (error){
        res.status(500).json({error:error.message});
    }
})

app.get('/artist/:id/random',async(req,res)=>{
    try {
        const { id } = req.params;

        let tracks = [];
        let page = 0;
        let limit = 50; // Number of songs per page
        let totalSongsFetched = 0;
        let totalSongs = limit * 2; // Fetch two pages as an example

        // Fetch multiple pages of songs
        while (totalSongsFetched < totalSongs) {
            const response = await axios.get(`https://api.deezer.com/artist/${id}/top`, {
            params: { limit, index: page * limit }
            });
            tracks = tracks.concat(response.data.data);
            totalSongsFetched += response.data.data.length;
            page += 1;

            // Stop if there are no more songs to fetch
            if (response.data.data.length < limit) break;
        }

        // Shuffle and pick 10 random songs
        tracks = tracks.sort(() => 0.5 - Math.random()).slice(0, 30);

        res.json(tracks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})
const rooms = {};
const initializeRoom = (roomId)=>{
    rooms[roomId]={
        questions:[],
        remainingSong:[],
        songIndex:0,
        players:[],
        playerAnswers:{},
        gameStarted:false,
        gameSetUpComplete: false
    }
}

const ShuffleSongChoices = (quizSong,choiceOne,choiceTwo)=>{
    let array = [quizSong,choiceOne,choiceTwo];
    return array.sort(() => Math.random() - 0.5);
}

io.on('connection',(socket)=>{
    console.log("a user connected");
    socket.on('disconnect',()=>{
        console.log("user disconnected");
        for (const roomId of Object.keys(rooms)) {
            if (rooms[roomId]["players"].includes(socket.id)) {
                rooms[roomId]["players"] = rooms[roomId]["players"].filter(id => id !== socket.id);
                io.in(roomId).emit('roomPopulation', rooms[roomId]["players"].length);
                if (rooms[roomId]["players"].length === 0) {
                    delete rooms[roomId];
                }
            }
        }
    })
    socket.on("joinRoom",(data)=>{
        if(rooms[data]){
            if(rooms[data]["gameStarted"]){
                socket.emit("joinStatus",false);
                return;
            }
            rooms[data]["players"].push(socket.id);
            rooms[data]["playerAnswers"][socket.id]=[];
            socket.join(data);
            // socket.in(data).emit("roomPopulation",rooms[data].length);
            io.in(data).emit("roomPopulation", rooms[data]["players"].length);
            socket.emit("joinStatus",true);
            console.log("joined");
        }
        else{
            console.log("room not exist")
            socket.emit("joinStatus",false);
        }
    })
    socket.on("hostRoom",(data)=>{
        console.log("hosted room",data);
        if(rooms[data]){
            socket.emit("hostStatus",false);
            console.log("host occupied");
            return;
        }
        if(!rooms[data]){
            initializeRoom(data);
        }
        rooms[data]["players"].push(socket.id);
        rooms[data]["playerAnswers"][socket.id]=[];
        socket.join(data);
        socket.emit("hostStatus",true);
        socket.in(data).emit("roomPopulation",rooms[data]["players"].length);
        console.log("host success");
    });
    socket.on("gameStart",(data)=>{
        rooms[data].gameStarted=true;
        io.in(data).emit("startGame",rooms[data].gameStarted);
        // console.log("backendsend of gameStart",data);
    });
    socket.on("gameSetUp",(data)=>{
        // console.log(data.quizSongs,data.remainingSongs,data.room);
        rooms[data.room]["questions"]=data.quizSongs;
        rooms[data.room]["remainingSong"]=data.remainingSongs;
        rooms[data.room].gameSetUpComplete = true;
        // console.log(ShuffleSongChoices(rooms[data.room]["questions"][index], rooms[data.room]["remainingSong"][index], rooms[data.room]["remainingSong"][index+1]));
        socket.in(data.room).emit("gameSetUpStatus",true);
        // console.log("backend of gamesetup");
    });
    socket.on("readyMultiplayerClient",(data)=>{
        console.log("ready multi");
        if(!rooms[data.room]){
            return;
        }
        if (!rooms[data.room].gameSetUpComplete) {
            console.log("Game setup not complete for room", data.room);
            return;
        }
        let index= rooms[data.room]["songIndex"];
        let songChoices=ShuffleSongChoices(rooms[data.room]["questions"][index], rooms[data.room]["remainingSong"][index], rooms[data.room]["remainingSong"][index+1]);
        let correctSong=rooms[data.room]["questions"][index];
        io.in(data.room).emit("multiplayerGameBoard",{songChoices,correctSong,index});
    })

    socket.on("recordMultiplayerChoice",(data)=>{
        console.log("record multi",data.user,rooms[data.room]["players"]);
        rooms[data.room]["playerAnswers"][data.user].push(data.correct);
        console.log("record multi",rooms[data.room]["playerAnswers"]);

        const allPlayers = rooms[data.room]["players"];
        let songIndex= rooms[data.room]["songIndex"];
        const playerAnswers = rooms[data.room]["playerAnswers"];
        console.log("song index",songIndex)
        if(rooms[data.room]["playerAnswers"][data.user].length==10){
            io.in(data.room).emit("multiplayerEndScreen",{playerAnswers});
            return;
        }
        for(const [key,value] of Object.entries(playerAnswers)){
      
            arrayLength=value.length;
            if(arrayLength!=(songIndex+1)){
                return;
            }
        }
        setTimeout(()=>{
            rooms[data.room]["songIndex"]++;
            let index= rooms[data.room]["songIndex"];
            let songChoices=ShuffleSongChoices(rooms[data.room]["questions"][index], rooms[data.room]["remainingSong"][index], rooms[data.room]["remainingSong"][index+1]);
            let correctSong=rooms[data.room]["questions"][index];
            io.in(data.room).emit("multiplayerGameBoard",{songChoices,correctSong,index});
        },1000);
       
        // if (Object.keys(playerAnswers).length === (songIndex+1)) {
        //     // All players have answered
        //     rooms[data.room]["songIndex"]++;
        //     let index= rooms[data.room]["songIndex"];
        //     let songChoices=ShuffleSongChoices(rooms[data.room]["questions"][index], rooms[data.room]["remainingSong"][index], rooms[data.room]["remainingSong"][index+1]);
        //     let correctSong=rooms[data.room]["questions"][index];
        //     io.in(data.room).emit("multiplayerGameBoard",{songChoices,correctSong,index});
        // }
    })
})

const PORT = 5000;
server.listen(PORT,()=>{console.log(`server running on port ${PORT}`)})