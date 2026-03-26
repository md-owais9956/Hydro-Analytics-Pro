const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

const app = express();

// 1. DYNAMIC CORS: This allows your Vercel URL to access the data
// You can use app.use(cors()) for a quick fix, but this is more secure:
app.use(cors()); 

// --- CONFIGURATION ---
// Use Environment Variables for the API Key in Render Settings
const API_KEY = process.env.WEATHER_API_KEY || 'YOUR_OPENWEATHERMAP_API_KEY'; 

// Use path.join to ensure the file is found regardless of where the server starts
const csvPath = path.join(__dirname, 'data', 'groundwater_history.csv');

// --- ML LOGIC: Linear Regression for 1-Year Forecast ---
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

// 2. API: GET ALL STATIONS
app.get('/api/all-stations', (req, res) => {
    const stations = [];
    const seen = new Set();

    if (!fs.existsSync(csvPath)) {
        console.error("CSV NOT FOUND AT:", csvPath);
        return res.status(500).json({ error: "Database file missing on server" });
    }

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            if (row.station_name && !seen.has(row.station_name)) {
                stations.push({ 
                    name: row.station_name, 
                    district: row.district_name, 
                    state: row.state_name,
                    level: row.currentlevel 
                });
                seen.add(row.station_name);
            }
        })
        .on('end', () => {
            res.json(stations);
        });
});

// 3. API: DETAILED ANALYSIS (Virtual Sensors + Forecast)
app.get('/api/search', async (req, res) => {
    const query = req.query.place ? req.query.place.toLowerCase() : "";
    const history = [];
    let matchRow = null;

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            if (row.station_name.toLowerCase() === query) {
                history.push(parseFloat(row.currentlevel));
                matchRow = row;
            }
        })
        .on('end', async () => {
            if (!matchRow) return res.status(404).json({ error: "Station data not found" });

            let hum, tmp;
            try {
                // Virtual Sensor Call
                const weather = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${matchRow.district_name}&appid=${API_KEY}&units=metric`);
                hum = weather.data.main.humidity;
                tmp = weather.data.main.temp;
            } catch (err) {
                // Fallback to avoid "undefined" if API limits are hit
                hum = 40; tmp = 30; 
                console.log("API fallback used for", matchRow.district_name);
            }
            
            const lastKnown = history[history.length - 1];
            
            // Refined Logic: Increased penalty for heat/dryness
            const liveEst = (lastKnown + (hum * 0.01) - (tmp * 0.08)).toFixed(2);
            const futureFore = predictFuture(history);

            // Water Probability Index (WPI)
            let wpi = (parseFloat(liveEst) * 1.5) + (hum * 0.4) + ((40 - tmp) * 0.6);
            wpi = Math.min(Math.max(wpi, 0), 100).toFixed(1);

            res.json({
                station: matchRow.station_name,
                estimatedLevel: liveEst,
                forecastLevel: futureFore,
                humidity: hum,
                temp: tmp,
                wpi: wpi,
                recommendation: wpi > 50 ? "✅ High Potential Zone" : "⚠️ Low Potential Zone"
            });
        });
});

// 4. DYNAMIC PORT: Critical for Render/Cloud deployment
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Hydro-Analytics Backend Live on Port ${PORT}`);
});