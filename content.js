let config = {};

// Helper: Sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: Super Clean Text
const superClean = (str) => {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : "";
};

// ---------------------------------------------------------
// STEP 1: Find Train & Exact Class
// ---------------------------------------------------------
async function selectTrainAndClass() {
    console.log(`%c 🏁 STARTING BOT...`, 'background: #000; color: #fff;');

    const cleanInputTrain = superClean(config.trainName);
    const cleanInputClass = superClean(config.className);

    const allHeaders = Array.from(document.querySelectorAll('h2'));
    let trainHeader = allHeaders.find(h => superClean(h.innerText).includes(cleanInputTrain));

    if (!trainHeader) {
        alert(`Train "${config.trainName}" not found on this page!`);
        return;
    }
    console.log("✅ Train Found:", trainHeader.innerText);

    let trainWrapper = null;
    let currentEl = trainHeader;
    for (let i = 0; i < 15; i++) {
        if (!currentEl.parentElement) break;
        currentEl = currentEl.parentElement;
        if (currentEl.querySelector('.single-seat-class')) {
            trainWrapper = currentEl;
            break;
        }
    }

    if (!trainWrapper) {
        console.log("❌ Seat container not found.");
        return;
    }

    const seatCards = Array.from(trainWrapper.querySelectorAll('.single-seat-class'));
    let targetButton = null;
    let classMatched = false;

    for (let card of seatCards) {
        const nameEl = card.querySelector('.seat-class-name');
        if (nameEl) {
            const rawText = nameEl.innerText;
            if (superClean(rawText) === cleanInputClass) {
                console.log(`✅ Class Match: "${rawText}"`);
                classMatched = true;
                const btn = card.querySelector('button');
                if (btn && !btn.disabled && btn.innerText.toUpperCase().includes('BOOK NOW')) {
                    targetButton = btn;
                    break;
                }
            }
        }
    }

    if (targetButton) {
        targetButton.click();
        await waitForSeatPage();
    } else {
        if (classMatched) alert(`Class "${config.className}" found but 0 TICKETS AVAILABLE!`);
        else alert(`Class "${config.className}" not found!`);
    }
}

// ---------------------------------------------------------
// STEP 2: Handle Coach Selection
// ---------------------------------------------------------
async function waitForSeatPage() {
    console.log("Waiting for seat selector...");
    let retries = 0;
    while (retries < 60) {
        const coachSelect = document.getElementById("select-bogie");
        if (coachSelect && coachSelect.options.length > 0) {
            await sleep(config.delay);
            await selectBestCoach(coachSelect);
            return;
        }
        await sleep(500);
        retries++;
    }
    console.log("Timeout waiting for seat selector.");
}

async function selectBestCoach(selectElement) {
    console.log("🔍 Analyzing coaches...");
    let maxSeats = -1;
    let bestIndex = -1;
    let bestCoachText = "";

    for (let i = 0; i < selectElement.options.length; i++) {
        const text = selectElement.options[i].text;
        const match = text.match(/-\s*(\d+)\s*Seat/i);
        if (match) {
            const seats = parseInt(match[1]);
            if (seats > maxSeats) {
                maxSeats = seats;
                bestIndex = i;
                bestCoachText = text;
            }
        }
    }

    if (bestIndex > -1 && maxSeats > 0) {
        console.log(`%c 🏆 Best Coach: ${bestCoachText} (${maxSeats} seats)`, "color: blue; font-weight: bold;");
        selectElement.selectedIndex = bestIndex;
        selectElement.value = selectElement.options[bestIndex].value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        selectElement.dispatchEvent(new Event('input', { bubbles: true }));

        console.log("⏳ Waiting for new seat map...");
        await sleep(1500);
        await selectSeats();
    } else {
        alert("All coaches have 0 seats!");
    }
}

// ---------------------------------------------------------
// STEP 3: INFINITE LOOP SEAT SELECTION
// ---------------------------------------------------------

function isSeatFree(btn) {
    const cls = (btn.className || "").toLowerCase();
    return cls.includes('seat-available') && !cls.includes('seat-booked') && !btn.disabled;
}

function isSeatSelected(btn) {
    const cls = (btn.className || "").toLowerCase();
    return cls.includes('selected') || !cls.includes('seat-available');
}

function getSeatNum(btn) {
    const txt = btn.innerText || btn.title;
    const match = txt.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// স্ক্যানিং ফাংশন যা প্রতিবার লেটেস্ট পেয়ার খুঁজে বের করবে
function findAvailablePairs() {
    const rowContainers = Array.from(document.querySelectorAll('.seat-in-row'));
    let pairs = [];

    for (let container of rowContainers) {
        const buttons = Array.from(container.querySelectorAll('button.btn-seat'));
        const available = buttons.filter(btn => isSeatFree(btn));

        if (available.length >= 2) {
            available.sort((a, b) => getSeatNum(a) - getSeatNum(b));
            for (let i = 0; i < available.length - 1; i++) {
                const s1 = available[i];
                const s2 = available[i + 1];
                if (getSeatNum(s2) === getSeatNum(s1) + 1) {
                    pairs.push([s1, s2]);
                }
            }
        }
    }

    pairs.sort((a, b) => {
        const mid = 25;
        const distA = Math.abs(getSeatNum(a[0]) - mid);
        const distB = Math.abs(getSeatNum(b[0]) - mid);
        return distA - distB;
    });

    return pairs;
}

async function selectSeats() {
    console.log("🚀 Starting Continuous Booking Loop...");

    let bookedSuccessfully = false;
    let attemptCount = 0;

    // INFINITE LOOP until success
    while (!bookedSuccessfully) {
        attemptCount++;
        console.log(`🔄 Scan Cycle: ${attemptCount}`);

        const viablePairs = findAvailablePairs();

        if (viablePairs.length === 0) {
            console.log("⚠️ No pairs found. Waiting 1 second and retrying...");
            await sleep(1000);
            continue;
        }

        for (let pair of viablePairs) {
            const seat1 = pair[0];
            const seat2 = pair[1];

            if (!isSeatFree(seat1) || !isSeatFree(seat2)) {
                console.log("   Skipping pair (occupied during scan).");
                continue;
            }

            console.log(`👉 Trying Pair: ${seat1.innerText}-${seat2.innerText}`);

            seat1.click();
            await sleep(200);
            seat2.click();
            await sleep(800);

            const s1OK = isSeatSelected(seat1);
            const s2OK = isSeatSelected(seat2);

            if (s1OK && s2OK) {
                console.log("%c ✅ SUCCESS! Pair locked.", "color: green; font-weight: bold;");
                bookedSuccessfully = true;
                break;
            }
            else {
                console.warn("❌ Failed to lock both. Resetting...");
                if (s1OK) {
                    seat1.click(); // Deselect
                    await sleep(200);
                }
                if (s2OK) {
                    seat2.click(); // Deselect
                    await sleep(200);
                }
            }
        }

        if (bookedSuccessfully) break;

        console.log("⚠️ Cycle finished without success. Retrying next cycle...");
        await sleep(500);
    }

    await clickContinue();
}

// ---------------------------------------------------------
// STEP 4: Checkout (REAL CLICK ENABLED)
// ---------------------------------------------------------
async function clickContinue() {
    await sleep(500);
    const btns = Array.from(document.querySelectorAll('button'));
    const contBtn = btns.find(b => b.innerText.toUpperCase().includes('CONTINUE PURCHASE'));

    if (contBtn) {
        console.log("🚀 Clicking Continue Purchase...");
        // REAL CLICK ENABLED:
        contBtn.click();
    } else {
        console.log("❌ Continue button not found!");
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_booking") {
        config = request.config;
        selectTrainAndClass();
    }
});