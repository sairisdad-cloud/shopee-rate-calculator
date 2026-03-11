document.addEventListener('DOMContentLoaded', () => {
    // === Constants & Elements ===
    const API_URL = 'https://open.er-api.com/v6/latest/JPY';
    const CACHE_KEY = 'shopee_rate_cache';
    const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
    
    // Target Currencies for Shopee
    // 🇸🇬 SGD, 🇹🇭 THB, 🇵🇭 PHP, 🇲🇾 MYR, 🇻🇳 VND, 🇹🇼 TWD
    const TARGET_CURRENCIES = ['SGD', 'THB', 'PHP', 'MYR', 'VND', 'TWD'];
    let rates = {}; // JPY to TARGET rates (e.g., 1 JPY = 0.0089 SGD)

    // Shopee Fees (Commission + Transaction)
    const shopeeFees = {
        SGD: { commission: 0.11, transaction: 0.02 }, // 13%
        THB: { commission: 0.0321, transaction: 0.0321 }, // 6.42%
        PHP: { commission: 0.0336, transaction: 0.3224 }, // 35.6%
        MYR: { commission: 0.11, transaction: 0.035 }, // 14.5%
        VND: { commission: 0.033, transaction: 0.05 }, // 8.3%
        TWD: { commission: 0.05, transaction: 0.02 } // 7%
    };

    // DOM Elements
    const elements = {
        loading: document.getElementById('loading-overlay'),
        errorMsg: document.getElementById('error-message'),
        updateTime: document.getElementById('update-time'),
        refreshBtn: document.getElementById('refresh-btn'),
        
        // Base Cost Inputs
        costInputs: document.querySelectorAll('.base-cost-input'),
        totalBaseCostDisplay: document.getElementById('total-base-cost-display'),
        costHeader: document.getElementById('toggle-costs-btn'),
        costGrid: document.getElementById('cost-inputs-grid'),
        costToggleIcon: document.getElementById('cost-toggle-icon'),
        
        marginGrid: document.getElementById('margin-grid'),
        rateTableBody: document.getElementById('rate-table-body'),
        // Country margin grids
        countryMargins: {
            SGD: document.getElementById('margin-sgd'),
            THB: document.getElementById('margin-thb'),
            PHP: document.getElementById('margin-php'),
            MYR: document.getElementById('margin-myr'),
            VND: document.getElementById('margin-vnd'),
            TWD: document.getElementById('margin-twd')
        },
        // Results for JPY -> Local
        results: {
            SGD: document.getElementById('res-sgd'),
            THB: document.getElementById('res-thb'),
            PHP: document.getElementById('res-php'),
            MYR: document.getElementById('res-myr'),
            VND: document.getElementById('res-vnd'),
            TWD: document.getElementById('res-twd')
        },
        // Inputs for Local -> JPY
        localInputs: document.querySelectorAll('.local-curr-input'),
        // Conversions for Local -> JPY
        conversions: {
            SGD: document.getElementById('conv-sgd'),
            THB: document.getElementById('conv-thb'),
            PHP: document.getElementById('conv-php'),
            MYR: document.getElementById('conv-myr'),
            VND: document.getElementById('conv-vnd'),
            TWD: document.getElementById('conv-twd')
        }
    };

    const currencyInfo = {
        SGD: { name: 'シンガポール', flag: '🇸🇬', decimals: 2 },
        THB: { name: 'タイ', flag: '🇹🇭', decimals: 2 },
        PHP: { name: 'フィリピン', flag: '🇵🇭', decimals: 2 },
        MYR: { name: 'マレーシア', flag: '🇲🇾', decimals: 2 },
        VND: { name: 'ベトナム', flag: '🇻🇳', decimals: 0 },
        TWD: { name: '台湾', flag: '🇹🇼', decimals: 2 }
    };

    // === Initialization ===
    init();

    function init() {
        setupEventListeners();
        loadRates();
    }

    function setupEventListeners() {
        elements.refreshBtn.addEventListener('click', () => fetchRatesFromAPI(true));
        
        // Base cost input events
        elements.costInputs.forEach(input => {
            input.addEventListener('input', calculateTotalBaseCost);
        });

        // Toggle costs accordion
        elements.costHeader.addEventListener('click', () => {
            const isExpanded = elements.costHeader.getAttribute('aria-expanded') === 'true';
            elements.costHeader.setAttribute('aria-expanded', !isExpanded);
            
            if (isExpanded) {
                elements.costGrid.style.display = 'none';
                elements.costToggleIcon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            } else {
                elements.costGrid.style.display = 'grid'; // reset to default grid
                elements.costToggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-up');
            }
        });

        // Local input events
        elements.localInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const currency = e.target.dataset.currency;
                const value = e.target.value;
                calculateLocalToJpy(currency, value);
            });
        });
    }

    // === Data Fetching ===
    async function loadRates() {
        showLoading(true);
        hideError();

        let cachedData = null;
        try {
            cachedData = localStorage.getItem(CACHE_KEY);
        } catch (e) {
            console.warn("localStorage access denied", e);
        }

        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                const now = new Date().getTime();
                
                if (now - parsed.timestamp < CACHE_DURATION) {
                    processRateData(parsed.data, parsed.timestamp);
                    showLoading(false);
                    return;
                }
            } catch (e) {
                console.error("Cache parsing error", e);
            }
        }

        // Fetch fresh if no cache or expired
        await fetchRatesFromAPI();
    }

    async function fetchRatesFromAPI(force = false) {
        if (force) {
            showLoading(true);
            hideError();
            // Optional: spin animation class add
            elements.refreshBtn.classList.add('fa-spin');
        }

        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            
            if (data.result === 'success') {
                const timestamp = new Date().getTime();
                
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        timestamp: timestamp,
                        data: data
                    }));
                } catch (e) {
                    console.warn("Could not save to localStorage", e);
                }
                
                processRateData(data, timestamp);
            } else {
                throw new Error('API returned unsuccessful result');
            }
        } catch (error) {
            console.error('Failed to fetch rates:', error);
            showError(error.message);
        } finally {
            showLoading(false);
            if (force) {
                elements.refreshBtn.classList.remove('fa-spin');
            }
        }
    }

    function processRateData(data, timestamp) {
        // Extract required rates
        TARGET_CURRENCIES.forEach(curr => {
            if (data.rates[curr]) {
                rates[curr] = data.rates[curr];
            }
        });

        // Update UI
        updateTimeDisplay(timestamp);
        renderRateTable();
        
        // Recalculate if there are existing inputs
        calculateTotalBaseCost();
        elements.localInputs.forEach(input => {
            if (input.value) {
                calculateLocalToJpy(input.dataset.currency, input.value);
            }
        });
    }

    // === Calculations ===
    function calculateTotalBaseCost() {
        let total = 0;
        elements.costInputs.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) {
                total += val;
            }
        });
        
        elements.totalBaseCostDisplay.textContent = `¥${formatNumber(total, 0)}`;
        calculateJpyToLocal(total);
    }

    function calculateJpyToLocal(jpyValue) {
        const jpy = parseFloat(jpyValue);
        
        if (isNaN(jpy) || jpy <= 0) {
            TARGET_CURRENCIES.forEach(curr => {
                elements.results[curr].textContent = currencyInfo[curr].decimals === 0 ? '0' : '0.00';
                elements.countryMargins[curr].innerHTML = '';
            });
            elements.marginGrid.innerHTML = '<div class="margin-placeholder">金額を入力すると計算されます</div>';
            return;
        }

        // --- Calculate Target Currencies and their Margins ---
        TARGET_CURRENCIES.forEach(curr => {
            const rate = rates[curr];
            const fee = shopeeFees[curr];
            const totalFeeDec = fee.commission + fee.transaction;

            if (rate) {
                // Base Result with NO Margin (just fees considered for "0% margin" selling price)
                // If they want 0% margin, Price = Cost / (1 - TotalFee)
                const baseJpyPrice = jpy / (1 - totalFeeDec);
                const baseLocalPrice = baseJpyPrice * rate;
                elements.results[curr].textContent = formatNumber(baseLocalPrice, currencyInfo[curr].decimals);

                let countryMarginHtml = '';
                for (let pct = 10; pct <= 80; pct += 10) {
                    const marginDec = pct / 100;
                    
                    if (totalFeeDec >= 1) {
                        // Technically impossible if platform takes 100% or more fee
                        countryMarginHtml += `
                            <div class="country-margin-item error" title="手数料(${Math.round(totalFeeDec*1000)/10}%)が100%以上の為計算不可">
                                <span>${pct}%</span>
                                <span class="margin-val tooltip-target" style="color: #ef4444; font-size: 0.85rem;">計算不可</span>
                            </div>
                        `;
                    } else {
                        // Formula:
                        // Cost = jpy
                        // Profit = Cost * Margin (e.g. 1000 * 10% = 100)
                        // Fee = Selling Price * FeePercentage
                        // Selling Price = Cost + Profit + Fee -> S = (Cost * (1 + Margin)) / (1 - FeePercentage)
                        const targetJpyPrice = (jpy * (1 + marginDec)) / (1 - totalFeeDec);
                        const localTargetPrice = targetJpyPrice * rate;
                        
                        const profitAmt = jpy * marginDec;
                        const feeAmt = targetJpyPrice * totalFeeDec;
                        
                        const jpyTooltip = `日本円: ¥${formatNumber(targetJpyPrice, 0)} (原価¥${formatNumber(jpy,0)} + 利益¥${formatNumber(profitAmt, 0)} + 手数料¥${formatNumber(feeAmt, 0)})`;
                        countryMarginHtml += `
                            <div class="country-margin-item" title="${jpyTooltip}">
                                <span>${pct}%</span>
                                <span class="margin-val tooltip-target">${formatNumber(localTargetPrice, currencyInfo[curr].decimals)}</span>
                            </div>
                        `;
                    }
                }
                elements.countryMargins[curr].innerHTML = countryMarginHtml;
            }
        });

        // --- Calculate Profit Margins for JPY (10% to 80%) ---
        // Formula without specific country fees
        let marginHtml = '';
        for (let pct = 10; pct <= 80; pct += 10) {
            const marginDec = pct / 100;
            const targetPrice = jpy * (1 + marginDec);
            marginHtml += `
                <div class="margin-item">
                    <span class="margin-pct">利益 ${pct}%</span>
                    <span class="margin-val">¥${formatNumber(targetPrice, 0)}</span>
                </div>
            `;
        }
        elements.marginGrid.innerHTML = marginHtml;
    }

    function calculateLocalToJpy(currency, localValue) {
        const local = parseFloat(localValue);
        const targetElement = elements.conversions[currency];
        
        if (isNaN(local) || local < 0) {
            targetElement.textContent = '0';
            return;
        }

        const rate = rates[currency];
        const fee = shopeeFees[currency];
        
        if (rate && fee) {
            const totalFeeDec = fee.commission + fee.transaction;
            
            // JPY Equivalent = (Local Price * (1 - TotalFee)) / Rate
            // Calculates how much JPY you are LEFT WITH after Shopee takes their cut.
            const jpyResult = (local * (1 - totalFeeDec)) / rate;
            targetElement.textContent = formatNumber(jpyResult, 0);
        }
    }

    // === UI Updates ===
    function renderRateTable() {
        elements.rateTableBody.innerHTML = '';
        
        TARGET_CURRENCIES.forEach(curr => {
            const rate = rates[curr];
            if (rate) {
                const info = currencyInfo[curr];
                
                // 1. JPY to Local (1 JPY = X Local)
                const trJpy = document.createElement('tr');
                trJpy.className = 'rate-row-jpy';
                trJpy.innerHTML = `
                    <td rowspan="2" class="country-cell">${info.flag} ${info.name}</td>
                    <td>1 JPY</td>
                    <td><b>${curr}</b></td>
                    <td class="text-right">${rate.toFixed(4)}</td>
                `;
                elements.rateTableBody.appendChild(trJpy);
                
                // 2. Local to JPY (1 Local = X JPY)
                // Reverse rate (1 / rate)
                const reverseRate = 1 / rate;
                const trLocal = document.createElement('tr');
                trLocal.className = 'rate-row-local';
                trLocal.innerHTML = `
                    <td>1 ${curr}</td>
                    <td><b>JPY</b></td>
                    <td class="text-right">${reverseRate.toFixed(2)}</td>
                `;
                elements.rateTableBody.appendChild(trLocal);
            }
        });
    }

    function updateTimeDisplay(timestamp) {
        const date = new Date(timestamp);
        const options = { 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        };
        elements.updateTime.innerHTML = `<i class="fa-solid fa-clock"></i> 最終更新: ${date.toLocaleString('ja-JP', options)}`;
    }

    function showLoading(show) {
        if (show) {
            elements.loading.classList.remove('hidden');
        } else {
            elements.loading.classList.add('hidden');
        }
    }

    function showError(msg = '') {
        elements.errorMsg.classList.remove('hidden');
        if (msg) {
            const span = elements.errorMsg.querySelector('span');
            if (span) {
                span.textContent = `レート情報の取得に失敗しました。時間をおいて再試行してください。(${msg})`;
            }
        }
    }

    function hideError() {
        elements.errorMsg.classList.add('hidden');
    }

    // Formatting utility
    function formatNumber(num, decimals) {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
});
