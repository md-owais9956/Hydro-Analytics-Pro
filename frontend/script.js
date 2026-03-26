// 1. UPDATE THIS TO YOUR ACTUAL RENDER URL
const BASE_URL = 'https://hydro-analytics-pro.onrender.com'; 

let allStations = [];

// Initial Load (Waking up the server)
window.onload = async () => {
    const loader = document.getElementById('loader-overlay');
    loader.classList.remove('hidden');

    try {
        const res = await fetch(`${BASE_URL}/api/all-stations`);
        if (!res.ok) throw new Error("Waking up...");
        
        allStations = await res.json();
        renderGrid(allStations.slice(0, 60));
    } catch (err) {
        console.warn("Server is sleeping. Silent retry in 3 seconds...");
        setTimeout(window.onload, 3000); 
    } finally {
        // We only hide the loader if we actually have data
        if (allStations.length > 0) loader.classList.add('hidden');
    }
};

// Analysis Function (No Alert Boxes)
async function analyzeStation(name) {
    const loader = document.getElementById('loader-overlay');
    const output = document.getElementById('prediction-output');
    
    loader.classList.remove('hidden');
    if (output) output.classList.add('hidden');

    try {
        const res = await fetch(`${BASE_URL}/api/search?place=${encodeURIComponent(name.toLowerCase())}`);
        
        if (!res.ok) throw new Error("Latency");

        const data = await res.json();
        
        // Update UI
        document.getElementById('res-location').innerText = data.station;
        document.getElementById('res-level').innerHTML = `
            Live Estimate: <strong>${data.estimatedLevel}m</strong><br>
            1-Year Forecast: <strong>${data.forecastLevel}m</strong>
        `;
        document.getElementById('res-wpi').innerText = data.wpi + "%";
        document.getElementById('res-hum').innerText = data.humidity + "%";
        document.getElementById('res-temp').innerText = data.temp + "°C";
        document.getElementById('res-suggest').innerText = data.recommendation;

        output.classList.remove('hidden');
        loader.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.warn("Silent retry for:", name);
        // If it fails, we wait 2 seconds and try again without bothering the user
        setTimeout(() => analyzeStation(name), 2000);
    }
}

function renderGrid(data) {
    const list = document.getElementById('station-list');
    list.innerHTML = data.map(s => `
        <div class="station-card" onclick="analyzeStation('${s.name}')" style="cursor: pointer;">
            <h3>${s.name}</h3>
            <p>${s.district}</p>
        </div>
    `).join('');
}

document.getElementById('search-bar').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allStations.filter(s => 
        s.name.toLowerCase().includes(term) || s.district.toLowerCase().includes(term)
    );
    renderGrid(filtered.slice(0, 60));
});