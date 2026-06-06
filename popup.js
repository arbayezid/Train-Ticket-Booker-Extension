// --- CLOCK LOGIC (BST Online) ---
const timeDisplay = document.getElementById('bd-time');
let timeOffset = 0; // Difference between server time and local time

// 1. Get accurate time from WorldTimeAPI
async function syncTime() {
    try {
        const response = await fetch('https://worldtimeapi.org/api/timezone/Asia/Dhaka');
        const data = await response.json();

        // Server time in milliseconds
        const serverTime = new Date(data.datetime).getTime();
        const localTime = Date.now();

        // Calculate offset (Server - Local)
        timeOffset = serverTime - localTime;

        console.log("Time Synced. Offset:", timeOffset, "ms");
    } catch (error) {
        console.error("Time sync failed, using system time.", error);
        timeDisplay.style.color = "yellow"; // Warning color
    }
}

// 2. Update the clock every second using the offset
function updateClock() {
    // Current Estimated Server Time = Local Time + Offset
    const now = new Date(Date.now() + timeOffset);

    // Format: HH:MM:SS
    const timeString = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour12: false, // 24 Hour format (Use true for AM/PM)
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    timeDisplay.innerText = timeString;
}

// Start Sync and Interval
syncTime(); // Sync once when popup opens
setInterval(updateClock, 1000); // Update display every second


// --- BOOKING LOGIC (Previous Code) ---

document.getElementById('startBtn').addEventListener('click', () => {
    const trainName = document.getElementById('trainName').value.trim();
    const className = document.getElementById('className').value.trim();
    const delay = parseInt(document.getElementById('delay').value) || 500;

    if (!trainName || !className) {
        alert("Please enter both Train Name and Class Name.");
        return;
    }

    // Save settings
    chrome.storage.local.set({ trainName, className, delay });

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "start_booking",
                config: { trainName, className, delay }
            });
            window.close();
        } else {
            alert("Please open the Railway website first.");
        }
    });
});

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['trainName', 'className', 'delay'], (data) => {
        if (data.trainName) document.getElementById('trainName').value = data.trainName;
        if (data.className) document.getElementById('className').value = data.className;
        if (data.delay) document.getElementById('delay').value = data.delay;
    });
});