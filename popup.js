let settings = {};
let timerInterval;

document.addEventListener('DOMContentLoaded', () => {
    initialize();
    document.getElementById('openOptions').addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // Manual Toggle Listener
    const toggle = document.getElementById('manualToggle');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            chrome.storage.local.set({ manualMode: e.target.checked }, () => {
                updateCounter(); // Immediate update
            });
        });
    }
});

function initialize() {
    // Load settings and manual mode state
    chrome.storage.sync.get({
        salaryType: 'yearly',
        salaryAmount: 60000,
        currency: 'USD',
        workStart: '09:00',
        workEnd: '18:00',
        language: 'en',
        workDays: ['1', '2', '3', '4', '5']
    }, (items) => {
        settings = items;

        chrome.storage.local.get({ manualMode: false }, (local) => {
            const toggle = document.getElementById('manualToggle');
            if (toggle) toggle.checked = local.manualMode;
            updateUIText(settings.language);
            startCounter();
        });
    });
}

function startCounter() {
    if (timerInterval) clearInterval(timerInterval);
    updateCounter(); // Initial call
    timerInterval = setInterval(updateCounter, 100); // Update every 100ms for smoothness
}

function updateCounter() {
    // Guard against settings not being loaded yet
    if (!settings || !settings.workStart) return;

    const now = new Date();
    const currentDay = now.getDay(); // 0-6

    // Time calculations
    const currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    const [startHour, startMinute] = settings.workStart.split(':').map(Number);
    const [endHour, endMinute] = settings.workEnd.split(':').map(Number);

    const startTime = startHour * 3600 + startMinute * 60;
    const endTime = endHour * 3600 + endMinute * 60;

    // Determine if working
    const toggle = document.getElementById('manualToggle');
    const manualMode = toggle ? toggle.checked : false;
    let isWorking = false;

    if (manualMode) {
        isWorking = true;
    } else {
        // Check Day
        // settings.workDays is array of strings '1', '2' etc.
        const workDays = settings.workDays.map(Number);

        if (workDays.includes(currentDay)) {
            // Check Time
            if (endTime > startTime) {
                // Normal day shift (e.g. 09:00 - 18:00)
                if (currentTime >= startTime && currentTime < endTime) {
                    isWorking = true;
                }
            } else {
                // Overnight shift (e.g. 22:00 - 06:00)
                // Working if: (Time >= 22:00) OR (Time < 06:00)
                if (currentTime >= startTime || currentTime < endTime) {
                    isWorking = true;
                }
            }
        }
    }

    // Status Badge
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        const statusText = statusBadge.querySelector('span');

        if (isWorking) {
            statusBadge.classList.remove('inactive');
            if (statusText) statusText.setAttribute('data-i18n', 'statusActive');
            statusBadge.style.color = ''; // Reset inline style if any
        } else {
            statusBadge.classList.add('inactive');
            if (statusText) statusText.setAttribute('data-i18n', 'statusInactive');
        }
        if (statusText) updateElementText(statusText, settings.language);
    }

    // Calculate Money
    let dailyWorkSeconds = 0;
    if (endTime > startTime) {
        dailyWorkSeconds = endTime - startTime;
    } else {
        dailyWorkSeconds = (24 * 3600 - startTime) + endTime;
    }

    if (dailyWorkSeconds <= 0) dailyWorkSeconds = 8 * 3600;

    const daysPerWeek = (settings.workDays && settings.workDays.length) || 5;
    const workDaysPerYear = daysPerWeek * 52;
    const workDaysPerMonth = (daysPerWeek * 52) / 12;

    let salaryPerSecond = 0;
    if (settings.salaryType === 'yearly') {
        salaryPerSecond = settings.salaryAmount / (workDaysPerYear * dailyWorkSeconds);
    } else {
        salaryPerSecond = settings.salaryAmount / (workDaysPerMonth * dailyWorkSeconds);
    }

    let earnedToday = 0;

    if (manualMode) {
        let secondsSinceStart = currentTime - startTime;
        if (secondsSinceStart < 0) secondsSinceStart += 24 * 3600;
        earnedToday = secondsSinceStart * salaryPerSecond;

    } else if (isWorking) {
        // Normal schedule working
        let secondsSinceStart = currentTime - startTime;
        if (secondsSinceStart < 0) secondsSinceStart += 24 * 3600;
        earnedToday = secondsSinceStart * salaryPerSecond;
    } else {
        // Not working
        if (settings.workDays && settings.workDays.map(Number).includes(currentDay)) {
            if (endTime > startTime && currentTime > endTime) {
                earnedToday = dailyWorkSeconds * salaryPerSecond;
            }
            else if (endTime < startTime && currentTime > endTime && currentTime < startTime) {
                earnedToday = dailyWorkSeconds * salaryPerSecond;
            }
        }
    }

    // Display
    const currencySymbol = getCurrencySymbol(settings.currency);
    const symbolEl = document.getElementById('currencySymbol');
    if (symbolEl) symbolEl.textContent = currencySymbol;

    const displayDecimals = 1; // Fixed to 1 decimal place as requested
    const counterEl = document.getElementById('moneyCounter');
    if (counterEl) counterEl.textContent = earnedToday.toFixed(displayDecimals);
}

function getCurrencySymbol(currency) {
    const symbols = {
        'KRW': '₩',
        'USD': '$',
        'EUR': '€',
        'JPY': '¥',
        'CNY': '¥'
    };
    return symbols[currency] || currency;
}

function updateUIText(lang) {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    fetch(url)
        .then(response => response.json())
        .then(messages => {
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (messages[key]) {
                    element.textContent = messages[key].message;
                }
            });

            document.querySelectorAll('[data-i18n-title]').forEach(element => {
                const key = element.getAttribute('data-i18n-title');
                if (messages[key]) {
                    element.title = messages[key].message;
                }
            });
        })
        .catch(err => console.error('Failed to load locale:', err));
}

function updateElementText(element, lang) {
    const key = element.getAttribute('data-i18n');
    if (!key) return;

    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    fetch(url)
        .then(res => res.json())
        .then(messages => {
            if (messages[key]) {
                element.textContent = messages[key].message;
            }
        })
        .catch(err => console.error('Failed to update element text:', err));
}
