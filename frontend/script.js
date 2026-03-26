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
    
    // 1. Show loader and hide old results immediately
    loader.classList.remove('hidden');
    if (output) output.classList.add('hidden');

    try {
        // 2. Attempt to fetch data
        const res = await fetch(`${BASE_URL}/api/search?place=${encodeURIComponent(name.toLowerCase())}`);
        
        // 3. If the server is slow/waking up, throw an error to trigger the 'catch' block
        if (!res.ok) throw new Error("Server warming up...");

        const data = await res.json();
        
        // 4. Populate the UI with the received data
        document.getElementById('res-location').innerText = data.station;
        document.getElementById('res-level').innerHTML = `
            Live Estimate: <strong>${data.estimatedLevel}m</strong><br>
            1-Year Forecast: <strong>${data.forecastLevel}m</strong>
        `;
        document.getElementById('res-wpi').innerText = data.wpi + "%";
        document.getElementById('res-hum').innerText = data.humidity + "%";
        document.getElementById('res-temp').innerText = data.temp + "°C";
        document.getElementById('res-suggest').innerText = data.recommendation;

        // 5. Success! Hide loader and show results
        loader.classList.add('hidden');
        output.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.warn("Retrying analysis silently...");
        // 6. NO ALERT BOX: Just wait 1.5 seconds and try again automatically
        setTimeout(() => {
            analyzeStation(name);
        }, 1500);
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