const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors({
    origin:"http://localhost:3000",
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

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

const PORT = 5000;
app.listen(PORT,()=>{console.log(`server running on port ${PORT}`)})