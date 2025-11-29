document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('settingsForm').addEventListener('submit', saveOptions);
document.getElementById('language').addEventListener('change', updateLanguage);

// Default settings
const defaultSettings = {
    salaryType: 'yearly',
    salaryAmount: 60000,
    currency: 'USD',
    workStart: '09:00',
    workEnd: '18:00',
    language: 'en',
    workDays: ['1', '2', '3', '4', '5'] // Mon-Fri default
};

function restoreOptions() {
    chrome.storage.sync.get(defaultSettings, (items) => {
        document.getElementById('salaryType').value = items.salaryType;
        document.getElementById('salaryAmount').value = items.salaryAmount;
        document.getElementById('currency').value = items.currency;
        document.getElementById('workStart').value = items.workStart;
        document.getElementById('workEnd').value = items.workEnd;
        document.getElementById('language').value = items.language;

        // Restore checkboxes
        const days = items.workDays || [];
        document.querySelectorAll('input[name="workDay"]').forEach(cb => {
            cb.checked = days.includes(cb.value);
        });

        updateUIText(items.language);
    });
}

function saveOptions(e) {
    e.preventDefault();

    // Get selected days
    const selectedDays = Array.from(document.querySelectorAll('input[name="workDay"]:checked'))
        .map(cb => cb.value);

    const settings = {
        salaryType: document.getElementById('salaryType').value,
        salaryAmount: Number(document.getElementById('salaryAmount').value),
        currency: document.getElementById('currency').value,
        workStart: document.getElementById('workStart').value,
        workEnd: document.getElementById('workEnd').value,
        language: document.getElementById('language').value,
        workDays: selectedDays
    };

    chrome.storage.sync.set(settings, () => {
        const status = document.getElementById('statusMessage');
        status.textContent = getMessage('settingsSaved', settings.language);
        status.style.color = 'var(--success-color)';
        setTimeout(() => {
            status.textContent = '';
        }, 2000);

        // Update UI text immediately if language changed
        updateUIText(settings.language);
    });
}

function updateLanguage() {
    // Just update the UI text preview, don't save yet
    const lang = document.getElementById('language').value;
    updateUIText(lang);
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
        })
        .catch(err => console.error('Failed to load locale:', err));
}

function getMessage(key, lang) {
    const messages = {
        'ko': '설정이 저장되었습니다!',
        'en': 'Settings saved!',
        'ja': '設定が保存されました！'
    };
    return messages[lang] || messages['en'];
}
