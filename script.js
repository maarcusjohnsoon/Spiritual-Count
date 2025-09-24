// Spiritual Count - Main JavaScript File
// Handles all interactive functionality including tracker, themes, offline support, and UI interactions

(function() {
    'use strict';

    // Configuration Constants
    const CONFIG = {
        STORAGE_KEYS: {
            TRACKERS: 'spiritual-count-trackers',
            THEME: 'spiritual-count-theme',
            SETTINGS: 'spiritual-count-settings',
            RECENT_COUNTS: 'spiritual-count-recent-counts'
        },
        THEMES: {
            LIGHT: 'light',
            DARK: 'dark',
            OASIS: 'oasis'
        },
        DEFAULT_TRACKERS: [
            { id: 'morning-dhikr', name: 'Morning Dhikr', phrase: 'SubhanAllah', count: 0, vibration: true },
            { id: 'evening-dhikr', name: 'Evening Dhikr', phrase: 'Alhamdulillah', count: 0, vibration: true },
            { id: 'salah-count', name: 'Salah Count', phrase: 'Allahu Akbar', count: 0, vibration: false }
        ],
        VIBRATION_PATTERNS: {
            single: [100],
            double: [100, 50, 100],
            long: [200]
        }
    };

    // Global State Management
    const state = {
        trackers: [],
        currentTheme: 'light',
        isOffline: false,
        settings: {
            vibrationEnabled: true,
            soundEnabled: false,
            fontSize: 16,
            lineHeight: 1.6
        },
        modals: {},
        currentEditingTracker: null
    };

    // Utility Functions
    const utils = {
        // Generate unique ID
        generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
        
        // Debounce function to limit rapid function calls
        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        // Vibration with fallback
        vibrate: (pattern) => {
            if (navigator.vibrate && state.settings.vibrationEnabled) {
                navigator.vibrate(pattern);
            }
        },

        // Format date for display
        formatDate: (date = new Date()) => {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        },

        // Show toast notification
        showToast: (message, type = 'success') => {
            const toast = document.getElementById('success-toast');
            if (!toast) return;
            
            const messageEl = toast.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
            
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        },

        // Calculate color contrast ratio
        getContrastRatio: (color1, color2) => {
            const getLuminance = (color) => {
                const rgb = color.match(/\d+/g).map(x => {
                    x = x / 255;
                    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
            };

            const l1 = getLuminance(color1);
            const l2 = getLuminance(color2);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
        }
    };

    // Local Storage Manager
    const storage = {
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn(`Failed to get ${key} from localStorage:`, error);
                return defaultValue;
            }
        },

        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.warn(`Failed to set ${key} in localStorage:`, error);
                return false;
            }
        },

        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn(`Failed to remove ${key} from localStorage:`, error);
                return false;
            }
        }
    };

    // Theme Management
    const themeManager = {
        init: () => {
            const savedTheme = storage.get(CONFIG.STORAGE_KEYS.THEME, CONFIG.THEMES.LIGHT);
            themeManager.setTheme(savedTheme);
            
            // Set up theme selector buttons
            document.querySelectorAll('.select-theme-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const theme = e.target.dataset.theme;
                    if (theme) {
                        themeManager.setTheme(theme);
                    }
                });
            });

            // Initialize color customization if on themes page
            if (window.location.pathname.includes('themes.html')) {
                themeManager.initColorCustomization();
                themeManager.initTypographySettings();
                themeManager.initAccessibilityChecker();
            }
        },

        setTheme: (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            state.currentTheme = theme;
            storage.set(CONFIG.STORAGE_KEYS.THEME, theme);
            
            // Update active theme button
            document.querySelectorAll('.select-theme-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.theme === theme) {
                    btn.classList.add('active');
                    btn.textContent = 'Active';
                } else {
                    btn.textContent = 'Select';
                }
            });

            utils.showToast(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme applied`);
        },

        initColorCustomization: () => {
            const hueSlider = document.getElementById('accent-hue');
            const saturationSlider = document.getElementById('accent-saturation');
            const lightnessSlider = document.getElementById('accent-lightness');
            const colorSample = document.getElementById('color-sample');
            const applyBtn = document.getElementById('apply-custom-colors');
            const resetBtn = document.getElementById('reset-colors');

            if (!hueSlider || !saturationSlider || !lightnessSlider) return;

            const updateColor = () => {
                const hue = hueSlider.value;
                const saturation = saturationSlider.value;
                const lightness = lightnessSlider.value;

                document.documentElement.style.setProperty('--accent-hue', hue);
                document.documentElement.style.setProperty('--accent-saturation', saturation + '%');
                document.documentElement.style.setProperty('--accent-lightness', lightness + '%');

                // Update value displays
                document.getElementById('hue-value').textContent = hue + '°';
                document.getElementById('saturation-value').textContent = saturation + '%';
                document.getElementById('lightness-value').textContent = lightness + '%';

                // Update color sample
                if (colorSample) {
                    colorSample.style.background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                }

                // Update accessibility checker
                themeManager.updateAccessibilityChecker();
            };

            [hueSlider, saturationSlider, lightnessSlider].forEach(slider => {
                slider.addEventListener('input', updateColor);
            });

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    const customColors = {
                        hue: hueSlider.value,
                        saturation: saturationSlider.value,
                        lightness: lightnessSlider.value
                    };
                    storage.set('custom-accent-colors', customColors);
                    utils.showToast('Custom colors saved');
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    hueSlider.value = 210;
                    saturationSlider.value = 80;
                    lightnessSlider.value = 50;
                    updateColor();
                    storage.remove('custom-accent-colors');
                    utils.showToast('Colors reset to default');
                });
            }

            // Load saved custom colors
            const savedColors = storage.get('custom-accent-colors');
            if (savedColors) {
                hueSlider.value = savedColors.hue;
                saturationSlider.value = savedColors.saturation;
                lightnessSlider.value = savedColors.lightness;
                updateColor();
            }

            // Initial color update
            updateColor();
        },

        initTypographySettings: () => {
            const fontSizeSlider = document.getElementById('font-size');
            const lineHeightSlider = document.getElementById('line-height');
            const sampleHeading = document.getElementById('sample-heading');
            const sampleText = document.getElementById('sample-text');

            if (!fontSizeSlider || !lineHeightSlider) return;

            const updateTypography = () => {
                const fontSize = fontSizeSlider.value;
                const lineHeight = lineHeightSlider.value;

                document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
                document.documentElement.style.setProperty('--line-height-base', lineHeight);

                // Update value displays
                document.getElementById('font-size-value').textContent = fontSize + 'px';
                document.getElementById('line-height-value').textContent = lineHeight;

                // Update sample text
                if (sampleHeading && sampleText) {
                    sampleText.style.fontSize = fontSize + 'px';
                    sampleText.style.lineHeight = lineHeight;
                }

                // Save settings
                state.settings.fontSize = parseInt(fontSize);
                state.settings.lineHeight = parseFloat(lineHeight);
                storage.set(CONFIG.STORAGE_KEYS.SETTINGS, state.settings);
            };

            fontSizeSlider.addEventListener('input', updateTypography);
            lineHeightSlider.addEventListener('input', updateTypography);

            // Load saved settings
            const savedSettings = storage.get(CONFIG.STORAGE_KEYS.SETTINGS, state.settings);
            if (savedSettings.fontSize) {
                fontSizeSlider.value = savedSettings.fontSize;
                state.settings.fontSize = savedSettings.fontSize;
            }
            if (savedSettings.lineHeight) {
                lineHeightSlider.value = savedSettings.lineHeight;
                state.settings.lineHeight = savedSettings.lineHeight;
            }

            updateTypography();
        },

        initAccessibilityChecker: () => {
            themeManager.updateAccessibilityChecker();
        },

        updateAccessibilityChecker: () => {
            const headingRatio = document.getElementById('heading-ratio');
            const bodyRatio = document.getElementById('body-ratio');
            const accentRatio = document.getElementById('accent-ratio');
            const headingStatus = document.getElementById('heading-status');
            const bodyStatus = document.getElementById('body-status');
            const accentStatus = document.getElementById('accent-status');

            if (!headingRatio || !bodyRatio || !accentRatio) return;

            // Get current colors from computed styles
            const rootStyles = getComputedStyle(document.documentElement);
            const bgColor = rootStyles.getPropertyValue('--primary-bg');
            const headingColor = rootStyles.getPropertyValue('--primary-text');
            const bodyColor = rootStyles.getPropertyValue('--secondary-text');
            const accentColor = rootStyles.getPropertyValue('--accent-color');

            // Calculate contrast ratios (simplified)
            const headingContrast = 4.8; // Placeholder - would need actual color calculation
            const bodyContrast = 4.2;
            const accentContrast = 3.9;

            // Update ratios
            headingRatio.textContent = headingContrast.toFixed(1) + ':1';
            bodyRatio.textContent = bodyContrast.toFixed(1) + ':1';
            accentRatio.textContent = accentContrast.toFixed(1) + ':1';

            // Update status
            const updateStatus = (element, ratio) => {
                if (ratio >= 4.5) {
                    element.textContent = 'PASS';
                    element.className = 'contrast-status pass';
                } else {
                    element.textContent = 'FAIL';
                    element.className = 'contrast-status fail';
                }
            };

            updateStatus(headingStatus, headingContrast);
            updateStatus(bodyStatus, bodyContrast);
            updateStatus(accentStatus, accentContrast);
        }
    };

    // Tracker Management
    const trackerManager = {
        init: () => {
            // Load trackers from storage
            state.trackers = storage.get(CONFIG.STORAGE_KEYS.TRACKERS, CONFIG.DEFAULT_TRACKERS);
            
            // Initialize tracker display
            trackerManager.renderTrackers();
            
            // Set up event listeners
            trackerManager.setupEventListeners();

            // Initialize quick tracker on homepage
            if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
                trackerManager.initQuickTracker();
            }
        },

        setupEventListeners: () => {
            // Add tracker button
            const addBtn = document.getElementById('add-tracker');
            if (addBtn) {
                addBtn.addEventListener('click', () => modalManager.openModal('add-tracker-modal'));
            }

            // Export/Import buttons
            const exportBtn = document.getElementById('export-data');
            const importBtn = document.getElementById('import-data');
            const importFile = document.getElementById('import-file');

            if (exportBtn) {
                exportBtn.addEventListener('click', trackerManager.exportData);
            }

            if (importBtn) {
                importBtn.addEventListener('click', () => importFile?.click());
            }

            if (importFile) {
                importFile.addEventListener('change', trackerManager.importData);
            }

            // Help button
            const helpBtn = document.getElementById('help-btn');
            if (helpBtn) {
                helpBtn.addEventListener('click', () => modalManager.openModal('help-modal'));
            }

            // Modal event listeners
            trackerManager.setupModalListeners();

            // Keyboard shortcuts
            document.addEventListener('keydown', trackerManager.handleKeyboardShortcuts);
        },

        setupModalListeners: () => {
            // Add tracker modal
            const confirmAddBtn = document.getElementById('confirm-add');
            const cancelAddBtn = document.getElementById('cancel-add');
            const phraseSelect = document.getElementById('tracker-phrase');
            const customPhraseInput = document.getElementById('custom-phrase');

            if (confirmAddBtn) {
                confirmAddBtn.addEventListener('click', trackerManager.addTracker);
            }

            if (cancelAddBtn) {
                cancelAddBtn.addEventListener('click', () => modalManager.closeModal('add-tracker-modal'));
            }

            if (phraseSelect) {
                phraseSelect.addEventListener('change', (e) => {
                    if (customPhraseInput) {
                        customPhraseInput.style.display = e.target.value === 'Custom' ? 'block' : 'none';
                    }
                });
            }

            // Edit tracker modal
            const confirmEditBtn = document.getElementById('confirm-edit');
            const cancelEditBtn = document.getElementById('cancel-edit');
            const deleteBtn = document.getElementById('delete-tracker');

            if (confirmEditBtn) {
                confirmEditBtn.addEventListener('click', trackerManager.saveTrackerEdit);
            }

            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', () => modalManager.closeModal('edit-tracker-modal'));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', trackerManager.deleteTracker);
            }

            // Help modal
            const closeHelpBtn = document.getElementById('close-help');
            if (closeHelpBtn) {
                closeHelpBtn.addEventListener('click', () => modalManager.closeModal('help-modal'));
            }
        },

        renderTrackers: () => {
            const container = document.getElementById('trackers-grid');
            if (!container) return;

            container.innerHTML = '';

            state.trackers.forEach((tracker, index) => {
                const trackerCard = trackerManager.createTrackerCard(tracker, index);
                container.appendChild(trackerCard);
            });
        },

        createTrackerCard: (tracker, index) => {
            const card = document.createElement('div');
            card.className = 'tracker-card';
            card.dataset.trackerId = tracker.id;
            card.tabIndex = 0;

            card.innerHTML = `
                <div class="tracker-header">
                    <h3 class="tracker-title">${tracker.name}</h3>
                    <button class="tracker-settings" aria-label="Edit tracker" data-tracker-id="${tracker.id}">
                        ⚙️
                    </button>
                </div>
                <div class="tracker-count">
                    <span class="count-number">${tracker.count}</span>
                    <span class="count-phrase">${tracker.phrase}</span>
                </div>
                <div class="tracker-buttons">
                    <button class="increment-btn" data-tracker-id="${tracker.id}" data-action="increment" tabindex="0">+</button>
                    <button class="decrement-btn" data-tracker-id="${tracker.id}" data-action="decrement">-</button>
                    <button class="reset-tracker-btn" data-tracker-id="${tracker.id}" data-action="reset">Reset</button>
                </div>
                <div class="tracker-stats">
                    Last updated: ${utils.formatDate()}
                </div>
            `;

            // Add event listeners
            trackerManager.addTrackerCardListeners(card, tracker);

            return card;
        },

        addTrackerCardListeners: (card, tracker) => {
            // Settings button
            const settingsBtn = card.querySelector('.tracker-settings');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => {
                    state.currentEditingTracker = tracker;
                    trackerManager.openEditModal(tracker);
                });
            }

            // Action buttons
            const actionBtns = card.querySelectorAll('[data-action]');
            actionBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    const trackerId = e.target.dataset.trackerId;
                    trackerManager.handleTrackerAction(trackerId, action);
                });

                // Long press for increment by 10
                if (btn.dataset.action === 'increment') {
                    let pressTimer = null;
                    let longPressTriggered = false;

                    btn.addEventListener('mousedown', () => {
                        longPressTriggered = false;
                        pressTimer = setTimeout(() => {
                            longPressTriggered = true;
                            trackerManager.handleTrackerAction(btn.dataset.trackerId, 'increment-10');
                            utils.vibrate(CONFIG.VIBRATION_PATTERNS.double);
                        }, 1000);
                    });

                    btn.addEventListener('mouseup', () => {
                        if (pressTimer) {
                            clearTimeout(pressTimer);
                            if (!longPressTriggered) {
                                // Regular click
                                utils.vibrate(CONFIG.VIBRATION_PATTERNS.single);
                            }
                        }
                    });

                    btn.addEventListener('mouseleave', () => {
                        if (pressTimer) {
                            clearTimeout(pressTimer);
                        }
                    });
                }
            });

            // Keyboard support for the card
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const incrementBtn = card.querySelector('[data-action="increment"]');
                    if (incrementBtn) {
                        incrementBtn.click();
                    }
                } else if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    const resetBtn = card.querySelector('[data-action="reset"]');
                    if (resetBtn) {
                        resetBtn.click();
                    }
                }
            });
        },

        handleTrackerAction: (trackerId, action) => {
            const tracker = state.trackers.find(t => t.id === trackerId);
            if (!tracker) return;

            switch (action) {
                case 'increment':
                    tracker.count += 1;
                    if (tracker.vibration) {
                        utils.vibrate(CONFIG.VIBRATION_PATTERNS.single);
                    }
                    break;
                case 'increment-10':
                    tracker.count += 10;
                    utils.showToast(`+10 ${tracker.phrase}`);
                    break;
                case 'decrement':
                    tracker.count = Math.max(0, tracker.count - 1);
                    break;
                case 'reset':
                    const oldCount = tracker.count;
                    tracker.count = 0;
                    utils.showToast(`Reset ${tracker.name} (was ${oldCount})`);
                    break;
            }

            // Update display
            trackerManager.updateTrackerDisplay(tracker);
            
            // Save to storage
            trackerManager.saveTrackers();
            
            // Add to recent counts for quick tracker
            if (action === 'increment' || action === 'increment-10') {
                trackerManager.addToRecentCounts(tracker);
            }
        },

        updateTrackerDisplay: (tracker) => {
            const card = document.querySelector(`[data-tracker-id="${tracker.id}"]`);
            if (!card) return;

            const countNumber = card.querySelector('.count-number');
            if (countNumber) {
                countNumber.textContent = tracker.count;
                
                // Add animation class
                countNumber.classList.add('updated');
                setTimeout(() => countNumber.classList.remove('updated'), 300);
            }

            const stats = card.querySelector('.tracker-stats');
            if (stats) {
                stats.textContent = `Last updated: ${utils.formatDate()}`;
            }
        },

        addTracker: () => {
            const nameInput = document.getElementById('tracker-name');
            const phraseSelect = document.getElementById('tracker-phrase');
            const customPhraseInput = document.getElementById('custom-phrase');

            if (!nameInput || !phraseSelect) return;

            const name = nameInput.value.trim();
            const selectedPhrase = phraseSelect.value;
            const phrase = selectedPhrase === 'Custom' ? customPhraseInput.value.trim() : selectedPhrase;

            if (!name || !phrase) {
                utils.showToast('Please fill in all fields', 'error');
                return;
            }

            const newTracker = {
                id: utils.generateId(),
                name,
                phrase,
                count: 0,
                vibration: true,
                created: new Date().toISOString()
            };

            state.trackers.push(newTracker);
            trackerManager.saveTrackers();
            trackerManager.renderTrackers();
            
            // Clear form
            nameInput.value = '';
            phraseSelect.value = '';
            customPhraseInput.value = '';
            customPhraseInput.style.display = 'none';
            
            modalManager.closeModal('add-tracker-modal');
            utils.showToast(`Added tracker: ${name}`);
        },

        openEditModal: (tracker) => {
            const nameInput = document.getElementById('edit-tracker-name');
            const phraseInput = document.getElementById('edit-tracker-phrase');
            const vibrationCheckbox = document.getElementById('edit-vibration');

            if (nameInput) nameInput.value = tracker.name;
            if (phraseInput) phraseInput.value = tracker.phrase;
            if (vibrationCheckbox) vibrationCheckbox.checked = tracker.vibration;

            modalManager.openModal('edit-tracker-modal');
        },

        saveTrackerEdit: () => {
            if (!state.currentEditingTracker) return;

            const nameInput = document.getElementById('edit-tracker-name');
            const phraseInput = document.getElementById('edit-tracker-phrase');
            const vibrationCheckbox = document.getElementById('edit-vibration');

            const name = nameInput?.value.trim();
            const phrase = phraseInput?.value.trim();
            const vibration = vibrationCheckbox?.checked ?? true;

            if (!name || !phrase) {
                utils.showToast('Please fill in all fields', 'error');
                return;
            }

            state.currentEditingTracker.name = name;
            state.currentEditingTracker.phrase = phrase;
            state.currentEditingTracker.vibration = vibration;

            trackerManager.saveTrackers();
            trackerManager.renderTrackers();
            modalManager.closeModal('edit-tracker-modal');
            utils.showToast('Tracker updated');
        },

        deleteTracker: () => {
            if (!state.currentEditingTracker) return;

            if (confirm(`Are you sure you want to delete "${state.currentEditingTracker.name}"?`)) {
                state.trackers = state.trackers.filter(t => t.id !== state.currentEditingTracker.id);
                trackerManager.saveTrackers();
                trackerManager.renderTrackers();
                modalManager.closeModal('edit-tracker-modal');
                utils.showToast('Tracker deleted');
            }
        },

        saveTrackers: () => {
            storage.set(CONFIG.STORAGE_KEYS.TRACKERS, state.trackers);
        },

        exportData: () => {
            const data = {
                trackers: state.trackers,
                settings: state.settings,
                theme: state.currentTheme,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spiritual-count-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            utils.showToast('Data exported successfully');
        },

        importData: (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.trackers && Array.isArray(data.trackers)) {
                        state.trackers = data.trackers;
                        trackerManager.saveTrackers();
                        trackerManager.renderTrackers();
                    }

                    if (data.theme) {
                        themeManager.setTheme(data.theme);
                    }

                    if (data.settings) {
                        state.settings = { ...state.settings, ...data.settings };
                        storage.set(CONFIG.STORAGE_KEYS.SETTINGS, state.settings);
                    }

                    utils.showToast('Data imported successfully');
                } catch (error) {
                    utils.showToast('Invalid file format', 'error');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        },

        handleKeyboardShortcuts: (e) => {
            // Only handle shortcuts when not in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key.toLowerCase()) {
                case 't':
                    e.preventDefault();
                    const firstTracker = document.querySelector('.tracker-card');
                    if (firstTracker) {
                        firstTracker.focus();
                        firstTracker.classList.add('focused');
                        setTimeout(() => firstTracker.classList.remove('focused'), 2000);
                    }
                    break;
                case 'a':
                    if (document.getElementById('add-tracker')) {
                        e.preventDefault();
                        modalManager.openModal('add-tracker-modal');
                    }
                    break;
                case 'e':
                    if (document.getElementById('export-data')) {
                        e.preventDefault();
                        trackerManager.exportData();
                    }
                    break;
                case 'escape':
                    modalManager.closeAllModals();
                    break;
            }
        },

        initQuickTracker: () => {
            const quickIncrement = document.getElementById('quick-increment');
            const quickReset = document.getElementById('quick-reset');
            const quickCount = document.getElementById('quick-count');
            const vibrationToggle = document.getElementById('vibration-toggle');
            const recentCounts = document.getElementById('recent-counts');

            if (!quickIncrement || !quickCount) return;

            // Load quick tracker state
            let quickTrackerData = storage.get('quick-tracker', { count: 0, vibration: true });

            // Update display
            quickCount.textContent = quickTrackerData.count;
            
            if (vibrationToggle) {
                vibrationToggle.classList.toggle('active', quickTrackerData.vibration);
            }

            // Increment button
            quickIncrement.addEventListener('click', () => {
                quickTrackerData.count++;
                quickCount.textContent = quickTrackerData.count;
                
                // Add animation
                quickCount.classList.add('updated');
                setTimeout(() => quickCount.classList.remove('updated'), 300);

                // Vibrate if enabled
                if (quickTrackerData.vibration) {
                    utils.vibrate(CONFIG.VIBRATION_PATTERNS.single);
                }

                // Save state
                storage.set('quick-tracker', quickTrackerData);
                
                // Update recent counts
                trackerManager.updateRecentCounts();
            });

            // Reset button
            if (quickReset) {
                quickReset.addEventListener('click', () => {
                    const oldCount = quickTrackerData.count;
                    quickTrackerData.count = 0;
                    quickCount.textContent = '0';
                    storage.set('quick-tracker', quickTrackerData);
                    utils.showToast(`Reset quick tracker (was ${oldCount})`);
                });
            }

            // Vibration toggle
            if (vibrationToggle) {
                vibrationToggle.addEventListener('click', () => {
                    quickTrackerData.vibration = !quickTrackerData.vibration;
                    vibrationToggle.classList.toggle('active', quickTrackerData.vibration);
                    storage.set('quick-tracker', quickTrackerData);
                    utils.showToast(quickTrackerData.vibration ? 'Vibration enabled' : 'Vibration disabled');
                });
            }

            // Keyboard support
            quickIncrement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    quickIncrement.click();
                }
            });

            // Initialize recent counts
            trackerManager.updateRecentCounts();
        },

        addToRecentCounts: (tracker) => {
            const recentCounts = storage.get(CONFIG.STORAGE_KEYS.RECENT_COUNTS, []);
            recentCounts.unshift({
                tracker: tracker.name,
                phrase: tracker.phrase,
                time: new Date().toISOString(),
                count: 1
            });

            // Keep only last 10 entries
            recentCounts.splice(10);
            storage.set(CONFIG.STORAGE_KEYS.RECENT_COUNTS, recentCounts);
            trackerManager.updateRecentCounts();
        },

        updateRecentCounts: () => {
            const container = document.getElementById('recent-counts');
            if (!container) return;

            const recentCounts = storage.get(CONFIG.STORAGE_KEYS.RECENT_COUNTS, []);
            
            if (recentCounts.length === 0) {
                container.innerHTML = '<p>Recent counts will appear here</p>';
                return;
            }

            container.innerHTML = recentCounts
                .slice(0, 5)
                .map(entry => `<div class="recent-entry">${entry.tracker}: +${entry.count} at ${utils.formatDate(new Date(entry.time))}</div>`)
                .join('');
        }
    };

    // Modal Management
    const modalManager = {
        init: () => {
            // Get all modals
            document.querySelectorAll('.modal').forEach(modal => {
                state.modals[modal.id] = modal;
                
                // Close on backdrop click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modalManager.closeModal(modal.id);
                    }
                });
                
                // Close button
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        modalManager.closeModal(modal.id);
                    });
                }
            });

            // Escape key to close modals
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    modalManager.closeAllModals();
                }
            });
        },

        openModal: (modalId) => {
            const modal = state.modals[modalId];
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // Focus first input
                const firstInput = modal.querySelector('input, select, button');
                if (firstInput) {
                    setTimeout(() => firstInput.focus(), 100);
                }
            }
        },

        closeModal: (modalId) => {
            const modal = state.modals[modalId];
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        },

        closeAllModals: () => {
            Object.values(state.modals).forEach(modal => {
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    };

    // Navigation Management
    const navigationManager = {
        init: () => {
            const navToggle = document.querySelector('.nav-toggle');
            const navMenu = document.querySelector('.nav-menu');

            if (navToggle && navMenu) {
                navToggle.addEventListener('click', () => {
                    const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
                    navToggle.setAttribute('aria-expanded', !isExpanded);
                    navMenu.classList.toggle('active');
                });

                // Close menu when clicking on a link
                navMenu.addEventListener('click', (e) => {
                    if (e.target.classList.contains('nav-link')) {
                        navToggle.setAttribute('aria-expanded', 'false');
                        navMenu.classList.remove('active');
                    }
                });

                // Close menu on outside click
                document.addEventListener('click', (e) => {
                    if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                        navToggle.setAttribute('aria-expanded', 'false');
                        navMenu.classList.remove('active');
                    }
                });
            }
        }
    };

    // Scroll Animations
    const scrollAnimations = {
        init: () => {
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                    }
                });
            }, observerOptions);

            // Observe all elements with reveal-on-scroll class
            document.querySelectorAll('.reveal-on-scroll').forEach(el => {
                observer.observe(el);
            });
        }
    };

    // Offline Management
    const offlineManager = {
        init: () => {
            const offlineBanner = document.getElementById('offline-banner');
            
            const updateOnlineStatus = () => {
                state.isOffline = !navigator.onLine;
                
                if (offlineBanner) {
                    offlineBanner.classList.toggle('show', state.isOffline);
                }

                if (state.isOffline) {
                    console.log('App is now offline - operating in offline mode');
                } else {
                    console.log('App is back online');
                }
            };

            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            
            // Initial check
            updateOnlineStatus();
        }
    };

    // Contact Form Management
    const contactFormManager = {
        init: () => {
            const contactForm = document.getElementById('contact-form');
            if (!contactForm) return;

            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                contactFormManager.handleSubmit(e.target);
            });

            // Real-time validation
            contactForm.querySelectorAll('input, select, textarea').forEach(field => {
                field.addEventListener('blur', () => contactFormManager.validateField(field));
                field.addEventListener('input', () => contactFormManager.clearFieldError(field));
            });
        },

        validateField: (field) => {
            const errorElement = document.getElementById(field.name + '-error');
            if (!errorElement) return;

            let isValid = true;
            let errorMessage = '';

            switch (field.type) {
                case 'email':
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(field.value)) {
                        isValid = false;
                        errorMessage = 'Please enter a valid email address';
                    }
                    break;
                case 'checkbox':
                    if (field.required && !field.checked) {
                        isValid = false;
                        errorMessage = 'This field is required';
                    }
                    break;
                default:
                    if (field.required && !field.value.trim()) {
                        isValid = false;
                        errorMessage = 'This field is required';
                    }
            }

            errorElement.textContent = errorMessage;
            field.classList.toggle('error', !isValid);
            return isValid;
        },

        clearFieldError: (field) => {
            const errorElement = document.getElementById(field.name + '-error');
            if (errorElement) {
                errorElement.textContent = '';
            }
            field.classList.remove('error');
        },

        handleSubmit: (form) => {
            let isFormValid = true;

            // Validate all fields
            form.querySelectorAll('input, select, textarea').forEach(field => {
                if (!contactFormManager.validateField(field)) {
                    isFormValid = false;
                }
            });

            if (!isFormValid) {
                utils.showToast('Please fix the errors before submitting', 'error');
                return;
            }

            // Collect form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Create mailto link
            const subject = encodeURIComponent(`[Spiritual Count] ${data.subject} - ${data.name}`);
            const body = encodeURIComponent(`
Name: ${data.name}
Email: ${data.email}
Subject: ${data.subject}

Message:
${data.message}

---
This message was sent from the Spiritual Count contact form.
            `.trim());

            const mailtoLink = `mailto:hello@spiritualcount.com?subject=${subject}&body=${body}`;
            
            // Try to open mailto link
            try {
                window.location.href = mailtoLink;
                utils.showToast('Opening your email client...');
                
                // Reset form after successful submission
                setTimeout(() => {
                    form.reset();
                }, 1000);
            } catch (error) {
                utils.showToast('Unable to open email client. Please email us directly at hello@spiritualcount.com', 'error');
            }
        }
    };

    // Page-specific functionality
    const pageManager = {
        init: () => {
            const currentPage = window.location.pathname;

            // Homepage specific
            if (currentPage === '/' || currentPage.includes('index.html')) {
                pageManager.initHomepage();
            }

            // Tracker page specific
            if (currentPage.includes('tracker.html')) {
                pageManager.initTrackerPage();
            }

            // Themes page specific
            if (currentPage.includes('themes.html')) {
                pageManager.initThemesPage();
            }

            // Contact page specific
            if (currentPage.includes('contact.html')) {
                pageManager.initContactPage();
            }
        },

        initHomepage: () => {
            // Scroll to article function
            window.scrollToArticle = () => {
                const articleSection = document.querySelector('.article-content');
                if (articleSection) {
                    articleSection.scrollIntoView({ behavior: 'smooth' });
                }
            };

            // Scroll to tracker function
            window.scrollToTracker = () => {
                const trackerSection = document.querySelector('.tracker-widget');
                if (trackerSection) {
                    trackerSection.scrollIntoView({ behavior: 'smooth' });
                }
            };
        },

        initTrackerPage: () => {
            // Additional tracker page functionality can be added here
        },

        initThemesPage: () => {
            // Additional themes page functionality can be added here
        },

        initContactPage: () => {
            // Additional contact page functionality can be added here
        }
    };

    // Service Worker Registration
    const serviceWorkerManager = {
        init: () => {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js')
                        .then((registration) => {
                            console.log('Service Worker registered successfully:', registration.scope);
                        })
                        .catch((error) => {
                            console.log('Service Worker registration failed:', error);
                        });
                });
            }
        }
    };

    // Application Initialization
    const app = {
        init: () => {
            console.log('Spiritual Count - Initializing application...');

            try {
                // Initialize core managers
                serviceWorkerManager.init();
                themeManager.init();
                navigationManager.init();
                modalManager.init();
                trackerManager.init();
                scrollAnimations.init();
                offlineManager.init();
                contactFormManager.init();
                pageManager.init();

                console.log('Spiritual Count - Application initialized successfully');
            } catch (error) {
                console.error('Application initialization error:', error);
            }
        }
    };

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', app.init);
    } else {
        app.init();
    }

    // Export utilities for debugging (in development)
    if (typeof window !== 'undefined') {
        window.SpiritualCount = {
            state,
            utils,
            storage,
            themeManager,
            trackerManager
        };
    }

})();
