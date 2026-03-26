const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

const app = express();

// --- CRITICAL CORS CONFIG ---
app.use(cors()); 
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// --- CONFIGURATION ---
const API_KEY = process.env.weather_api_key || 'YOUR_OPENWEATHERMAP_API_KEY'; 
const csvPath = path.join(__dirname, 'data', 'groundwater_history.csv');

// ML Logic: Linear Regression for 1-Year Forecast
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

// Routes
app.get('/api/all-stations', (req, res) => {
    const stations = [];
    const seen = new Set();
    if (!fs.existsSync(csvPath)) return res.status(500).json({ error: "CSV source missing" });

    fs.createReadStream(csvPath).pipe(csv()).on('data', (row) => {
        if (row.station_name && !seen.has(row.station_name)) {
            stations.push({ name: row.station_name, district: row.district_name, state: row.state_name });
            seen.add(row.station_name);
        }
    }).on('end', () => res.json(stations));
});

app.get('/api/search', async (req, res) => {
    const query = req.query.place ? req.query.place.toLowerCase() : "";
    const history = [];
    let matchRow = null;

    fs.createReadStream(csvPath).pipe(csv()).on('data', (row) => {
        if (row.station_name.toLowerCase() === query) {
            history.push(parseFloat(row.currentlevel));
            matchRow = row;
        }
    }).on('end', async () => {
        if (!matchRow) return res.status(404).json({ error: "Station not found" });

        let hum = 42, tmp = 29; 
        try {
            const weather = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${matchRow.district_name}&appid=${API_KEY}&units=metric`);
            hum = weather.data.main.humidity;
            tmp = weather.data.main.temp;
        } catch (err) { console.log("Virtual Sensor Fallback triggered."); }
            
        const lastKnown = history[history.length - 1];
        // Bio-inspired adjustment logic (Conservative Penalty for heat/dryness)
        const liveEst = (lastKnown + (hum * 0.01) - (tmp * 0.08)).toFixed(2);
        const futureFore = predictFuture(history);

        let wpi = (parseFloat(liveEst) * 1.5) + (hum * 0.4) + ((40 - tmp) * 0.6);
        wpi = Math.min(Math.max(wpi, 0), 100).toFixed(1);

        res.json({
            station: matchRow.station_name.toUpperCase(),
            estimatedLevel: liveEst,
            forecastLevel: futureFore,
            humidity: hum,
            temp: tmp,
            wpi: wpi,
            recommendation: wpi > 50 ? "✅ High Potential Zone" : "⚠️ Low Potential Zone"
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hydro-Analytics Backend Live on Port ${PORT}`));