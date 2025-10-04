const state = {
    compositeSignals: [],
    originalData: [],
    originalIndices: [],
    outputData: [],
    outputIndices: [],
    originalChart: null,
    outputChart: null,
    convChart1: null,
    convChart2: null,
    currentSignalType: '',
    operationHistory: [],
    lastOperationKey: '',
    globalYMin: null,
    globalYMax: null,
    globalXMin: null,
    globalXMax: null,
    isDiscreteView: false,
    storedSignals: [],
    transferredData: null,
    transferredIndices: null,
    appliedOperations: [],
    tempWorkingData: null,
    tempWorkingIndices: null
};

const SIGNAL_CONFIG = {
    impulse: {
        title: 'Unit Impulse: δ[n]',
        modalType: 'basic',
        evaluate: (n, signal) => (n === 0 ? 1 : 0) * signal.amplitude
    },
    step: {
        title: 'Unit Step: u[n]',
        modalType: 'basic',
        evaluate: (n, signal) => (n >= 0 ? 1 : 0) * signal.amplitude
    },
    ramp: {
        title: 'Unit Ramp: r[n]',
        modalType: 'basic',
        evaluate: (n, signal) => (n >= 0 ? n : 0) * signal.amplitude
    },
    exp: {
        title: 'Exponential: a^n',
        modalType: 'exponential',
        evaluate: (n, signal) => Math.pow(signal.base, n) * signal.amplitude
    },
    sin: {
        title: 'Sinusoid: A·sin(ωn + φ)',
        modalType: 'sinusoid',
        evaluate: (n, signal) => signal.sinAmp * Math.sin(signal.sinFreq * n + signal.sinPhase)
    },
    cos: {
        title: 'Cosine: A·cos(ωn + φ)',
        modalType: 'sinusoid',
        evaluate: (n, signal) => signal.sinAmp * Math.cos(signal.sinFreq * n + signal.sinPhase)
    }
};

const OPERATION_CONFIG = {
    convolve: {
        apply: (indices, data, param) => {
            return { indices: [], data: [] };
        },
        description: (param) => `Applied Convolution with stored signal`,
        notation: (current, param) => `${current} * ${param}`
    },
    shift: {
        apply: (indices, data, param) => ({
            indices: indices.map(n => n + param),
            data: [...data]
        }),
        description: (param) => `Applied Time Shifting: k = ${param}`,
        notation: (current, param) => {
            if (param > 0) return current.replace(/\[n([^\]]*)\]/g, `[n-${param}$1]`).replace(/--/g, '+').replace(/\+-/g, '-');
            if (param < 0) return current.replace(/\[n([^\]]*)\]/g, `[n+${Math.abs(param)}$1]`);
            return current;
        }
    },
    scale: {
        apply: (indices, data, param) => ({
            indices: indices.map(n => n / param),
            data: [...data]
        }),
        description: (param) => `Applied Time Scaling: a = ${param}`,
        notation: (current, param) => current.replace(/\[n([^\]]*)\]/g, `[${param}n$1]`)
    },
    fold: {
        apply: (indices, data) => ({
            indices: indices.map(n => -n).reverse(),
            data: [...data].reverse()
        }),
        description: () => `Applied Time Folding: n → -n`,
        notation: (current) => current.replace(/\[n([^\]]*)\]/g, '[-n$1]').replace(/--/g, '+')
    },
    add: {
        apply: (indices, data, param) => ({
            indices: [...indices],
            data: data.map(x => x + param)
        }),
        description: (param) => `Applied Addition: + ${param}`,
        notation: (current, param) => `(${current}) + ${param}`
    },
    multiply: {
        apply: (indices, data, param) => ({
            indices: [...indices],
            data: data.map(x => x * param)
        }),
        description: (param) => `Applied Multiplication: × ${param}`,
        notation: (current, param) => `${param} × (${current})`
    },
    reverse: {
        apply: (indices, data) => ({
            indices: [...indices].reverse(),
            data: [...data].reverse()
        }),
        description: () => `Applied Reverse Sequence`,
        notation: (current) => `reverse(${current})`
    }
};

const MODAL_TEMPLATES = {
    basic: () => `
        <div class="input-group">
            <label>Operation Type:</label>
            <select id="modalOperation">
                <option value="+">+ Add</option>
                <option value="-">- Subtract</option>
                <option value="*">× Modulate</option>
            </select>
        </div>
        <div class="input-group">
            <label>Time Shift (k):</label>
            <input type="number" id="modalShift" value="0" placeholder="e.g., -2 for [n+2], 3 for [n-3]">
            <small style="color: #6c757d;">Positive shifts right, negative shifts left</small>
        </div>
        <div class="input-group">
            <label>Amplitude Multiplier:</label>
            <input type="number" id="modalAmplitude" value="1" step="0.1" placeholder="e.g., 2 for 2×signal">
        </div>
    `,
    exponential: () => `
        <div class="input-group">
            <label>Operation Type:</label>
            <select id="modalOperation">
                <option value="+">+ Add</option>
                <option value="-">- Subtract</option>
                <option value="*">× Modulate</option>
            </select>
        </div>
        <div class="input-group">
            <label>Base (a):</label>
            <input type="number" id="modalExpBase" value="0.8" step="0.1" placeholder="e.g., 0.8, 0.5">
        </div>
        <div class="input-group">
            <label>Time Shift (k):</label>
            <input type="number" id="modalShift" value="0" placeholder="e.g., -2 for [n+2]">
        </div>
        <div class="input-group">
            <label>Amplitude Multiplier:</label>
            <input type="number" id="modalAmplitude" value="1" step="0.1">
        </div>
    `,
    sinusoid: () => `
        <div class="input-group">
            <label>Operation Type:</label>
            <select id="modalOperation">
                <option value="+">+ Add</option>
                <option value="-">- Subtract</option>
                <option value="*">× Modulate</option>
            </select>
        </div>
        <div class="param-grid">
            <div class="input-group">
                <label>Amplitude (A):</label>
                <input type="number" id="modalSinAmp" value="1" step="0.1">
            </div>
            <div class="input-group">
                <label>Frequency (ω):</label>
                <input type="number" id="modalSinFreq" value="0.5" step="0.1">
            </div>
        </div>
        <div class="input-group">
            <label>Phase (φ in radians):</label>
            <input type="number" id="modalSinPhase" value="0" step="0.1">
        </div>
        <div class="input-group">
            <label>Time Shift (k):</label>
            <input type="number" id="modalShift" value="0">
        </div>
    `
};

function getElement(id) {
    return document.getElementById(id);
}

function getValue(id, defaultValue = 0, parser = parseFloat) {
    const el = getElement(id);
    return el ? parser(el.value) || defaultValue : defaultValue;
}

function updateGlobalBounds(data, indices) {
    state.globalYMin = Math.min(...data);
    state.globalYMax = Math.max(...data);
    state.globalXMin = Math.min(...indices);
    state.globalXMax = Math.max(...indices);
}

function buildNotation(signals) {
    if (signals.length === 0) return '';
    if (signals.length === 1) return signals[0].notation;
    
    let result = '';
    let accumulatedAdditive = [];
    
    for (let i = 0; i < signals.length; i++) {
        const signal = signals[i];
        
        if (signal.operation === '*') {
            if (accumulatedAdditive.length > 0) {
                const additiveStr = accumulatedAdditive.map((s, idx) => {
                    if (idx === 0) return s.notation;
                    return s.operation === '+' ? ` + ${s.notation}` : ` - ${s.notation}`;
                }).join('');
                
                result += (result ? ' × ' : '') + `(${additiveStr})`;
                accumulatedAdditive = [];
            } else if (result) {
                result = `(${result})`;
            }
            
            result += ` × ${signal.notation}`;
        } else {
            accumulatedAdditive.push(signal);
        }
    }
    
    if (accumulatedAdditive.length > 0) {
        const additiveStr = accumulatedAdditive.map((s, idx) => {
            if (idx === 0 && !result) return s.notation;
            return s.operation === '+' ? ` + ${s.notation}` : ` - ${s.notation}`;
        }).join('');
        
        if (result) {
            result += ` × (${additiveStr})`;
        } else {
            result = additiveStr;
        }
    }
    
    return result;
}

function toggleView() {
    const viewToggle = getElement('viewToggle');
    if (!viewToggle) return;
    
    state.isDiscreteView = viewToggle.checked;
    
    const leftLabel = document.querySelector('.slider-label.left');
    const rightLabel = document.querySelector('.slider-label.right');
    
    if (leftLabel && rightLabel) {
        leftLabel.classList.toggle('active', !state.isDiscreteView);
        rightLabel.classList.toggle('active', state.isDiscreteView);
    }
    
    if (state.originalChart && state.originalData.length > 0) {
        updateChartStyle(state.originalChart, 'original');
    }
    
    if (state.outputChart && state.outputData.length > 0) {
        updateChartStyle(state.outputChart, 'output');
    }
}

function updateChartStyle(chart, type) {
    const dataPoints = chart.data.datasets[0].data;
    const color = type === 'original' ? '#667eea' : '#f093fb';
    const bgColor = type === 'original' ? 'rgba(102, 126, 234, 0.7)' : 'rgba(240, 147, 251, 0.7)';
    const fillColor = type === 'original' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(240, 147, 251, 0.1)';
    
    chart.data.datasets = state.isDiscreteView ? [
        {
            type: 'bar',
            data: dataPoints,
            backgroundColor: bgColor,
            borderWidth: 0,
            barPercentage: 0.05,
            categoryPercentage: 1,
            order: 2
        },
        {
            type: 'scatter',
            data: dataPoints,
            pointRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            order: 1
        }
    ] : [
        {
            type: 'line',
            data: dataPoints,
            showLine: true,
            borderColor: color,
            backgroundColor: fillColor,
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0
        }
    ];
    
    chart.update();
}

function openModal(signalType) {
    state.currentSignalType = signalType;
    const config = SIGNAL_CONFIG[signalType];
    if (!config) return;
    
    const modal = getElement('signalModal');
    const modalTitle = getElement('modalTitle');
    const modalBody = getElement('modalBody');
    
    modalTitle.textContent = config.title;
    modalBody.innerHTML = MODAL_TEMPLATES[config.modalType]();
    modal.classList.add('show');
}

function closeModal() {
    getElement('signalModal').classList.remove('show');
}

function createSignalNotation(signal, shift, amplitude) {
    const shiftStr = shift === 0 ? 'n' : shift > 0 ? `n-${shift}` : `n+${Math.abs(shift)}`;
    const ampStr = amplitude === 1 ? '' : `${amplitude}×`;
    
    switch(signal.type) {
        case 'impulse': return `${ampStr}δ[${shiftStr}]`;
        case 'step': return `${ampStr}u[${shiftStr}]`;
        case 'ramp': return `${ampStr}r[${shiftStr}]`;
        case 'exp': return `${ampStr}(${signal.base})^${shiftStr}`;
        case 'sin':
        case 'cos':
            const funcName = signal.type;
            const phaseStr = signal.sinPhase === 0 ? '' : signal.sinPhase > 0 ? `+${signal.sinPhase}` : `${signal.sinPhase}`;
            return `${signal.sinAmp}×${funcName}(${signal.sinFreq}×${shiftStr}${phaseStr})`;
        default: return '';
    }
}

function addToFunction() {
    const operationSelect = getElement('modalOperation');
    if (!operationSelect) {
        closeModal();
        return;
    }
    
    const operation = operationSelect.options[operationSelect.selectedIndex].value;
    const shift = getValue('modalShift', 0, parseInt);
    const amplitude = getValue('modalAmplitude', 1);
    
    let signalObj = {
        type: state.currentSignalType,
        operation: String(operation),
        shift: shift,
        amplitude: amplitude
    };
    
    if (state.currentSignalType === 'exp') {
        signalObj.base = getValue('modalExpBase', 0.8);
    } else if (state.currentSignalType === 'sin' || state.currentSignalType === 'cos') {
        signalObj.sinAmp = getValue('modalSinAmp', 1);
        signalObj.sinFreq = getValue('modalSinFreq', 0.5);
        signalObj.sinPhase = getValue('modalSinPhase', 0);
    }
    
    signalObj.notation = createSignalNotation(signalObj, shift, amplitude);
    
    state.compositeSignals.push(JSON.parse(JSON.stringify(signalObj)));
    updateCompositeDisplay();
    closeModal();
}

function updateCompositeDisplay() {
    const display = getElement('compositeFunction');
    display.textContent = state.compositeSignals.length === 0 ? 
        'No signals added yet' : buildNotation(state.compositeSignals);
}

function updateHistoryDisplay() {
    const displays = document.querySelectorAll('.history-display');
    
    displays.forEach(display => {
        display.innerHTML = '';
        
        if (state.operationHistory.length === 0) {
            display.innerHTML = '<div class="history-empty">No operations applied yet</div>';
            return;
        }
        
        state.operationHistory.forEach((entry, index) => {
            const historyBlock = document.createElement('div');
            historyBlock.className = 'history-block';
            historyBlock.innerHTML = `
                <div class="step-label">Step ${index + 1}:</div>
                <div class="signal-text">${entry.signal}</div>
                <div class="operation-text">${entry.operation}</div>
            `;
            display.appendChild(historyBlock);
        });
    });
}

function updateStorageDisplay() {
    const display = getElement('storageDisplay');
    display.innerHTML = '';
    
    if (state.storedSignals.length === 0) {
        display.innerHTML = '<div class="storage-empty">No signals stored</div>';
        return;
    }
    
    state.storedSignals.forEach((stored, index) => {
        const storageItem = document.createElement('div');
        storageItem.className = 'storage-item';
        storageItem.onclick = () => openRetrieveModal(index);
        storageItem.innerHTML = `
            <div class="storage-item-label">Stored Signal ${index + 1}:</div>
            <div class="storage-item-notation">${stored.notation}</div>
        `;
        display.appendChild(storageItem);
    });
}

function storeCurrentSignal() {
    if (state.compositeSignals.length === 0) {
        alert('Please add at least one signal to store!');
        return;
    }
    
    state.storedSignals.push({
        signals: JSON.parse(JSON.stringify(state.compositeSignals)),
        notation: buildNotation(state.compositeSignals)
    });
    
    updateStorageDisplay();
}

function openRetrieveModal(index) {
    const stored = state.storedSignals[index];
    const modal = getElement('signalModal');
    const modalTitle = getElement('modalTitle');
    const modalBody = getElement('modalBody');
    
    modalTitle.textContent = 'Retrieve Stored Signal';
    modalBody.innerHTML = `
        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007bff;">
            <div style="font-size: 11px; font-weight: 700; color: #007bff; text-transform: uppercase; margin-bottom: 8px;">
                Signal to Retrieve:
            </div>
            <div style="font-size: 14px; font-weight: 600; color: #495057; font-family: 'Courier New', monospace;">
                ${stored.notation}
            </div>
        </div>
        <div class="input-group">
            <label>Retrieval Mode:</label>
            <select id="retrievalMode">
                <option value="add">+ Add to Current</option>
                <option value="subtract">- Subtract from Current</option>
                <option value="modulate">× Modulate with Current</option>
                <option value="exact">= Replace Current</option>
            </select>
        </div>
    `;
    
    const oldAddFunction = window.addToFunction;
    window.addToFunction = () => {
        const mode = getValue('retrievalMode', 'add', (v) => v);
        
        if (mode === 'exact') {
            state.compositeSignals = JSON.parse(JSON.stringify(stored.signals));
        } else {
            const operation = mode === 'add' ? '+' : mode === 'subtract' ? '-' : '*';
            stored.signals.forEach(signal => {
                const signalCopy = JSON.parse(JSON.stringify(signal));
                signalCopy.operation = operation;
                state.compositeSignals.push(signalCopy);
            });
        }
        
        updateCompositeDisplay();
        closeModal();
        window.addToFunction = oldAddFunction;
    };
    
    modal.classList.add('show');
}

function clearStoredSignals() {
    if (state.storedSignals.length === 0) {
        alert('No stored signals to clear!');
        return;
    }
    
    if (confirm('Are you sure you want to clear all stored signals?')) {
        state.storedSignals = [];
        updateStorageDisplay();
    }
}

function clearComposite() {
    state.compositeSignals = [];
    updateCompositeDisplay();
}

function clearHistory() {
    state.operationHistory = [];
    state.lastOperationKey = '';
    updateHistoryDisplay();
}

function evaluateSignal(n, signal) {
    const adjustedN = n - signal.shift;
    const config = SIGNAL_CONFIG[signal.type];
    return config ? config.evaluate(adjustedN, signal) : 0;
}

function plotComposite() {
    const start = getValue('globalRangeStart', -10, parseInt);
    const end = getValue('globalRangeEnd', 10, parseInt);
    
    if (isNaN(start) || isNaN(end) || start >= end) {
        alert('Invalid range!');
        return;
    }
    
    const opType = getElement('operationType');
    if (opType && opType.value === 'convolve') {
        opType.value = 'shift';
        updateConvolutionUI();
    }
    
    state.appliedOperations = [];
    state.tempWorkingData = null;
    state.tempWorkingIndices = null;
    
    state.originalIndices = [];
    state.originalData = [];
    
    for (let n = start; n <= end; n++) {
        state.originalIndices.push(n);
        let result = 0;
        
        if (state.transferredData !== null) {
            const transferredIndex = state.transferredIndices.indexOf(n);
            if (transferredIndex !== -1) {
                result = state.transferredData[transferredIndex];
            }
        }
        
        let modulationProduct = 1;
        let hasModulation = false;
        
        state.compositeSignals.forEach(signal => {
            if (signal.isTransferred) return;
            
            const value = evaluateSignal(n, signal);
            
            if (signal.operation === '*') {
                hasModulation = true;
                modulationProduct *= value;
            } else if (signal.operation === '-') {
                result -= value;
            } else {
                result += value;
            }
        });
        
        if (hasModulation) result *= modulationProduct;
        
        state.originalData.push(result);
    }
    
    updateGlobalBounds(state.originalData, state.originalIndices);
    
    const currentSignalNotation = buildNotation(state.compositeSignals);
    
    state.operationHistory.push({
        signal: currentSignalNotation,
        operation: 'Plotted Original Signal'
    });
    state.lastOperationKey = `plot|${currentSignalNotation}`;
    updateHistoryDisplay();
    
    createChart('originalChart', state.originalIndices, state.originalData, 'Original Signal: x[n]', 'original', state.globalXMin, state.globalXMax);
}

function applyOperation() {
    if (state.originalData.length === 0) {
        alert('Please plot the original signal first!');
        return;
    }

    const opType = getValue('operationType', 'shift', (v) => v);
    
    if (opType === 'convolve') {
        applyConvolution();
        return;
    }
    
    const param = getValue('paramValue', 0);
    
    const operation = OPERATION_CONFIG[opType];
    if (!operation) return;
    
    if (opType === 'scale' && param === 0) {
        alert('Scale factor cannot be 0!');
        return;
    }

    const sourceData = state.tempWorkingData || state.originalData;
    const sourceIndices = state.tempWorkingIndices || state.originalIndices;

    const result = operation.apply(sourceIndices, sourceData, param);
    state.outputData = result.data;
    state.outputIndices = result.indices;
    
    state.tempWorkingData = [...result.data];
    state.tempWorkingIndices = [...result.indices];
    
    const currentSignalNotation = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'Unknown signal'}]);
    
    let stackedNotation = currentSignalNotation;
    state.appliedOperations.forEach(op => {
        stackedNotation = op.notation(stackedNotation, op.param);
    });
    const newNotation = operation.notation(stackedNotation, param);
    const operationDesc = operation.description(param);
    
    state.appliedOperations.push({
        type: opType,
        param: param,
        notation: operation.notation,
        description: operationDesc
    });
    
    const allData = [...state.originalData, ...state.outputData];
    const allIndices = [...state.originalIndices, ...state.outputIndices];
    
    updateGlobalBounds(allData, allIndices);
    
    state.operationHistory.push({
        signal: newNotation,
        operation: operationDesc
    });
    updateHistoryDisplay();

    createChart('originalChart', state.originalIndices, state.originalData, 'Original Signal: x[n]', 'original', state.globalXMin, state.globalXMax);
    createChart('outputChart', state.outputIndices, state.outputData, 'Output Signal: y[n]', 'output', state.globalXMin, state.globalXMax);
}

function updateChartLayout(isConvolution) {
    const chartWrappers = document.querySelectorAll('.chart-wrapper');
    if (chartWrappers.length === 0) return;
    
    const originalChartWrapper = chartWrappers[0];
    const originalChartContainer = originalChartWrapper.querySelector('.chart-container');
    const originalChartTitle = originalChartWrapper.querySelector('.chart-title');
    
    if (!originalChartContainer || !originalChartTitle) return;
    
    if (state.originalChart) {
        state.originalChart.destroy();
        state.originalChart = null;
    }
    
    if (state.convChart1) {
        state.convChart1.destroy();
        state.convChart1 = null;
    }
    
    if (state.convChart2) {
        state.convChart2.destroy();
        state.convChart2 = null;
    }
    
    if (isConvolution) {
        originalChartWrapper.classList.add('convolution-mode');
        originalChartContainer.innerHTML = `
            <div class="conv-grid">
                <div class="conv-chart-item">
                    <div class="conv-chart-label">Signal 1: x[n]</div>
                    <canvas id="convChart1"></canvas>
                </div>
                <div class="conv-chart-item">
                    <div class="conv-chart-label">Signal 2: h[n]</div>
                    <canvas id="convChart2"></canvas>
                </div>
            </div>
        `;
        originalChartTitle.textContent = 'Input Signals';
    } else {
        originalChartWrapper.classList.remove('convolution-mode');
        originalChartContainer.innerHTML = '<canvas id="originalChart"></canvas>';
        originalChartTitle.textContent = 'Original Signal: x[n]';
        
        if (state.originalData.length > 0) {
            setTimeout(() => {
                createChart('originalChart', state.originalIndices, state.originalData, 'Original Signal: x[n]', 'original', state.globalXMin, state.globalXMax);
            }, 0);
        }
    }
}
function updateConvolutionOptions() {
    const signal1Select = getElement('convSignal1');
    const signal2Select = getElement('convSignal2');
    
    if (!signal1Select || !signal2Select) return;
    
    signal1Select.innerHTML = '';
    signal2Select.innerHTML = '';
    
    if (state.originalData.length > 0) {
        const currentNotation = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'Current signal'}]);
        const option1 = document.createElement('option');
        option1.value = 'current';
        option1.textContent = `Current: ${currentNotation}`;
        const option2 = document.createElement('option');
        option2.value = 'current';
        option2.textContent = `Current: ${currentNotation}`;
        signal1Select.appendChild(option1);
        signal2Select.appendChild(option2);
    }
    
    if (state.storedSignals.length === 0 && state.originalData.length === 0) {
        const emptyOption1 = document.createElement('option');
        emptyOption1.textContent = 'No signals available';
        emptyOption1.disabled = true;
        const emptyOption2 = document.createElement('option');
        emptyOption2.textContent = 'No signals available';
        emptyOption2.disabled = true;
        signal1Select.appendChild(emptyOption1);
        signal2Select.appendChild(emptyOption2);
    }
    
    state.storedSignals.forEach((stored, index) => {
        const option1 = document.createElement('option');
        option1.value = index;
        option1.textContent = `Stored ${index + 1}: ${stored.notation}`;
        const option2 = document.createElement('option');
        option2.value = index;
        option2.textContent = `Stored ${index + 1}: ${stored.notation}`;
        signal1Select.appendChild(option1);
        signal2Select.appendChild(option2);
    });
}

function updateConvolutionUI() {
    const opType = getElement('operationType');
    if (!opType) return;
    
    const selectedOp = opType.value;
    const paramInput = getElement('paramValue');
    const convolutionContainer = getElement('convolutionContainer');
    
    if (selectedOp === 'convolve') {
        if (paramInput && paramInput.parentElement) {
            paramInput.parentElement.style.display = 'none';
        }
        if (convolutionContainer) {
            convolutionContainer.style.display = 'block';
            updateConvolutionOptions();
        }
        updateChartLayout(true);
    } else {
        if (paramInput && paramInput.parentElement) {
            paramInput.parentElement.style.display = 'block';
        }
        if (convolutionContainer) {
            convolutionContainer.style.display = 'none';
        }
        updateChartLayout(false);
        if (state.originalData.length > 0) {
            createChart('originalChart', state.originalIndices, state.originalData, 'Original Signal: x[n]', 'original', state.globalXMin, state.globalXMax);
        }
    }
}

function applyConvolution() {
    const signal1Value = getValue('convSignal1', 'current', (v) => v);
    const signal2Value = getValue('convSignal2', 'current', (v) => v);
    
    let data1, indices1, notation1;
    let data2, indices2, notation2;

    if (!signal1Value || !signal2Value) {
        alert('Please select both signals for convolution!');
        return;
    }
    
    if (signal1Value === 'current') {
        data1 = [...state.originalData];
        indices1 = [...state.originalIndices];
        notation1 = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'x[n]'}]);
    } else {
        const stored = state.storedSignals[parseInt(signal1Value)];
        const tempIndices = [];
        const tempData = [];
        const start = getValue('globalRangeStart', -10, parseInt);
        const end = getValue('globalRangeEnd', 10, parseInt);
        
        for (let n = start; n <= end; n++) {
            tempIndices.push(n);
            let result = 0;
            let modulationProduct = 1;
            let hasModulation = false;
            
            stored.signals.forEach(signal => {
                const value = evaluateSignal(n, signal);
                if (signal.operation === '*') {
                    hasModulation = true;
                    modulationProduct *= value;
                } else if (signal.operation === '-') {
                    result -= value;
                } else {
                    result += value;
                }
            });
            
            if (hasModulation) result *= modulationProduct;
            tempData.push(result);
        }
        
        data1 = tempData;
        indices1 = tempIndices;
        notation1 = stored.notation;
    }
    
    if (signal2Value === 'current') {
        data2 = [...state.originalData];
        indices2 = [...state.originalIndices];
        notation2 = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'h[n]'}]);
    } else {
        const stored = state.storedSignals[parseInt(signal2Value)];
        const tempIndices = [];
        const tempData = [];
        const start = getValue('globalRangeStart', -10, parseInt);
        const end = getValue('globalRangeEnd', 10, parseInt);
        
        for (let n = start; n <= end; n++) {
            tempIndices.push(n);
            let result = 0;
            let modulationProduct = 1;
            let hasModulation = false;
            
            stored.signals.forEach(signal => {
                const value = evaluateSignal(n, signal);
                if (signal.operation === '*') {
                    hasModulation = true;
                    modulationProduct *= value;
                } else if (signal.operation === '-') {
                    result -= value;
                } else {
                    result += value;
                }
            });
            
            if (hasModulation) result *= modulationProduct;
            tempData.push(result);
        }
        
        data2 = tempData;
        indices2 = tempIndices;
        notation2 = stored.notation;
    }
    
    const minIndex = Math.min(...indices1) + Math.min(...indices2);
    const maxIndex = Math.max(...indices1) + Math.max(...indices2);
    
    state.outputIndices = [];
    state.outputData = [];
    
    for (let n = minIndex; n <= maxIndex; n++) {
        state.outputIndices.push(n);
        let sum = 0;
        
        for (let k = 0; k < data1.length; k++) {
            const n1 = indices1[k];
            const targetN = n - n1;
            const idx2 = indices2.indexOf(targetN);
            
            if (idx2 !== -1) {
                sum += data1[k] * data2[idx2];
            }
        }
        
        state.outputData.push(sum);
    }
    
    state.appliedOperations = [];
    state.tempWorkingData = null;
    state.tempWorkingIndices = null;
    
    const allData = [...data1, ...data2, ...state.outputData];
    const allIndices = [...indices1, ...indices2, ...state.outputIndices];
    updateGlobalBounds(allData, allIndices);
    
    const convNotation = `(${notation1}) * (${notation2})`;
    state.operationHistory.push({
        signal: convNotation,
        operation: 'Applied Convolution'
    });
    updateHistoryDisplay();
    
    createChart('convChart1', indices1, data1, 'Signal 1: x[n]', 'original', state.globalXMin, state.globalXMax);
    createChart('convChart2', indices2, data2, 'Signal 2: h[n]', 'original', state.globalXMin, state.globalXMax);
    createChart('outputChart', state.outputIndices, state.outputData, 'Output Signal: y[n] = Convolution', 'output', state.globalXMin, state.globalXMax);
}

function viewOperation() {
    if (state.originalData.length === 0) {
        alert('Please plot the original signal first!');
        return;
    }

    const opType = getValue('operationType', 'shift', (v) => v);
    const param = getValue('paramValue', 0);
    
    const operation = OPERATION_CONFIG[opType];
    if (!operation) return;
    
    if (opType === 'scale' && param === 0) {
        alert('Scale factor cannot be 0!');
        return;
    }

    const result = operation.apply(state.originalIndices, state.originalData, param);
    state.outputData = result.data;
    state.outputIndices = result.indices;
    
    const allData = [...state.originalData, ...state.outputData];
    const allIndices = [...state.originalIndices, ...state.outputIndices];
    
    updateGlobalBounds(allData, allIndices);

    createChart('originalChart', state.originalIndices, state.originalData, 'Original Signal: x[n]', 'original', state.globalXMin, state.globalXMax);
    createChart('outputChart', state.outputIndices, state.outputData, 'Output Signal: y[n]', 'output', state.globalXMin, state.globalXMax);
}

function transferOutputToOriginal() {
    if (state.outputData.length === 0) {
        alert('Please apply an operation first to generate output signal!');
        return;
    }
    
    const opType = getElement('operationType');
    const isConvolution = opType && opType.value === 'convolve';
    
    if (!isConvolution && state.appliedOperations.length === 0) {
        alert('No stacked operations to transfer! Use "Apply Operation" to stack operations before transferring.');
        return;
    }
    
    let finalNotation;
    
    if (isConvolution) {
        const signal1Value = getValue('convSignal1', 'current', (v) => v);
        const signal2Value = getValue('convSignal2', 'current', (v) => v);
        
        let notation1, notation2;
        
        if (signal1Value === 'current') {
            notation1 = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'x[n]'}]);
        } else {
            notation1 = state.storedSignals[parseInt(signal1Value)].notation;
        }
        
        if (signal2Value === 'current') {
            notation2 = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'h[n]'}]);
        } else {
            notation2 = state.storedSignals[parseInt(signal2Value)].notation;
        }
        
        finalNotation = `(${notation1}) * (${notation2})`;
        
        opType.value = 'shift';
        updateConvolutionUI();
    } else {
        const currentSignalNotation = buildNotation(state.compositeSignals.length > 0 ? state.compositeSignals : [{notation: 'Unknown signal'}]);
        finalNotation = currentSignalNotation;
        state.appliedOperations.forEach(op => {
            finalNotation = op.notation(finalNotation, op.param);
        });
    }
    
    state.transferredData = [...state.outputData];
    state.transferredIndices = [...state.outputIndices];
    state.originalData = [...state.outputData];
    state.originalIndices = [...state.outputIndices];
    
    state.compositeSignals = [{
        type: 'transferred',
        operation: '+',
        notation: finalNotation,
        isTransferred: true
    }];
    
    state.appliedOperations = [];
    state.tempWorkingData = null;
    state.tempWorkingIndices = null;
    
    updateCompositeDisplay();
    updateGlobalBounds(state.originalData, state.originalIndices);
    
    state.outputData = [];
    state.outputIndices = [];
    
    if (state.outputChart) {
        state.outputChart.destroy();
        state.outputChart = null;
    }
    
    createChart('originalChart', state.originalIndices, state.originalData, 'Original Signal: x[n]', 'original', state.globalXMin, state.globalXMax);
}
function createChart(canvasId, indices, data, title, type, forceXMin = null, forceXMax = null) {
    const canvas = getElement(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (canvasId === 'convChart1' && state.convChart1) {
        state.convChart1.destroy();
    } else if (canvasId === 'convChart2' && state.convChart2) {
        state.convChart2.destroy();
    } else if (canvasId === 'originalChart' && state.originalChart) {
        state.originalChart.destroy();
    } else if (canvasId === 'outputChart' && state.outputChart) {
        state.outputChart.destroy();
    }

    const minIndex = forceXMin !== null ? forceXMin : Math.min(...indices);
    const maxIndex = forceXMax !== null ? forceXMax : Math.max(...indices);
    const xRange = maxIndex - minIndex;
    const xPadding = xRange * 0.05 || 1;
    
    const yMin = state.globalYMin !== null ? state.globalYMin : Math.min(...data);
    const yMax = state.globalYMax !== null ? state.globalYMax : Math.max(...data);
    const yRange = yMax - yMin;
    const yPadding = yRange * 0.15 || 1;
    
    const actualXMin = minIndex - xPadding;
    const actualXMax = maxIndex + xPadding;

    const chartData = indices.map((n, i) => ({ x: n, y: data[i] }));
    const color = type === 'original' ? '#667eea' : '#f093fb';
    const bgColor = type === 'original' ? 'rgba(102, 126, 234, 0.7)' : 'rgba(240, 147, 251, 0.7)';
    const fillColor = type === 'original' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(240, 147, 251, 0.1)';

    const datasets = state.isDiscreteView ? [
        {
            type: 'bar',
            data: chartData,
            backgroundColor: bgColor,
            borderWidth: 0,
            barPercentage: 0.05,
            categoryPercentage: 1,
            order: 2
        },
        {
            type: 'scatter',
            data: chartData,
            pointRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            order: 1
        }
    ] : [
        {
            type: 'line',
            data: chartData,
            showLine: true,
            borderColor: color,
            backgroundColor: fillColor,
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0
        }
    ];

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: indices,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: actualXMin,
                    max: actualXMax,
                    title: {
                        display: true,
                        text: 'n (sample index)',
                        font: { weight: 'bold', size: 14 }
                    },
                    grid: {
                        color: (ctx) => Math.abs(ctx.tick?.value || 1) < 0.001 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0,0,0,0.08)',
                        lineWidth: (ctx) => Math.abs(ctx.tick?.value || 1) < 0.001 ? 3 : 1,
                        drawBorder: true
                    },
                    ticks: {
                        font: { size: 15, weight: '600' }
                    }
                },
                y: {
                    min: yMin - yPadding,
                    max: yMax + yPadding,
                    title: {
                        display: true,
                        text: 'Amplitude',
                        font: { weight: 'bold', size: 14 }
                    },
                    grid: {
                        color: (ctx) => Math.abs(ctx.tick?.value || 1) < 0.001 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0,0,0,0.08)',
                        lineWidth: (ctx) => Math.abs(ctx.tick?.value || 1) < 0.001 ? 3 : 1,
                        drawBorder: true
                    },
                    ticks: {
                        font: { size: 15, weight: '600' }
                    }
                }
            }
        }
    });

    if (canvasId === 'convChart1') {
        state.convChart1 = chart;
    } else if (canvasId === 'convChart2') {
        state.convChart2 = chart;
    } else if (canvasId === 'originalChart') {
        state.originalChart = chart;
    } else if (canvasId === 'outputChart') {
        state.outputChart = chart;
    }
}

function toggleSidebar() {
    const sidebar = getElement('sidebarPanel');
    const toggleButton = document.querySelector('.sidebar-toggle');
    
    sidebar.classList.toggle('show');
    
    if (toggleButton) {
        toggleButton.style.opacity = sidebar.classList.contains('show') ? '1' : '0.3';
    }
}

function toggleHistoryDrawer() {
    const drawer = document.getElementById('historyDrawer');
    if (drawer) {
        drawer.classList.toggle('expanded');
    }
}

document.addEventListener('click', function(event) {
    const drawer = document.getElementById('historyDrawer');
    if (drawer && drawer.classList.contains('expanded')) {
        if (!drawer.contains(event.target)) {
            drawer.classList.remove('expanded');
        }
    }
});