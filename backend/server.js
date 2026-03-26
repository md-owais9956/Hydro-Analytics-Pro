const express = require('express');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');

const app = express();
app.use(cors());

// --- CONFIGURATION ---
// In a real live app, you'd set this in your host's "Environment Variables" 
const API_KEY = process.env.WEATHER_API_KEY || '3e7fbc6dfb2ca39a0810c52489ae96f2'; 
const csvPath = './data/groundwater_history.csv';

// Linear Regression for 1-Year Forecast
function predictFuture(data) {
    if (data.length < 2) return "Stable";
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach((val, i) => {
        sumX += i; sumY += val;
        sumXY += i * val; sumXX += i * i;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const nextVal = (sumY / n) + slope * (n - (sumX / n));
    return nextVal.toFixed(2);
}

app.get('/api/all-stations', (req, res) => {
    const stations = [];
    const seen = new Set();
    if (!fs.existsSync(csvPath)) return res.status(500).json({ error: "Data source missing" });

    fs.createReadStream(csvPath).pipe(csv()).on('data', (row) => {
        if (row.station_name && !seen.has(row.station_name)) {
            stations.push({ name: row.station_name, district: row.district_name, state: row.state_name });
            seen.add(row.station_name);
        }
    }).on('end', () => res.json(stations));
});

app.get('/api/search', async (req, res) => {
    const query = req.query.place.toLowerCase();
    const history = [];
    let matchRow = null;

    fs.createReadStream(csvPath).pipe(csv()).on('data', (row) => {
        if (row.station_name.toLowerCase() === query) {
            history.push(parseFloat(row.currentlevel));
            matchRow = row;
        }
    }).on('end', async () => {
        if (!matchRow) return res.status(404).json({ error: "No data" });

        let hum, tmp;
        try {
            const weather = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${matchRow.district_name}&appid=${API_KEY}&units=metric`);
            hum = weather.data.main.humidity;
            tmp = weather.data.main.temp;
        } catch (err) {
            hum = 45; tmp = 28; // Fail-safe defaults
        }
            
        const lastKnown = history[history.length - 1];
        // Bio-inspired adjustment logic (Penalty for high heat)
        const liveEst = (lastKnown + (hum * 0.01) - (tmp * 0.08)).toFixed(2);
        const futureFore = predictFuture(history);

        let wpi = (parseFloat(liveEst) * 1.5) + (hum * 0.4) + ((40 - tmp) * 0.6);
        wpi = Math.min(Math.max(wpi, 0), 100).toFixed(1);

        res.json({
            station: query.toUpperCase(),
            estimatedLevel: liveEst,
            forecastLevel: futureFore,
            humidity: hum,
            temp: tmp,
            wpi: wpi
            
        });
    });
});

// CRITICAL FOR DEPLOYMENT: Use the port provided by the host
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Live Server active on port ${PORT}`));