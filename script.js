let compositeSignals = [];
let originalData = [];
let originalIndices = [];
let outputData = [];
let outputIndices = [];
let originalChart = null;
let outputChart = null;
let currentSignalType = '';

function openModal(signalType) {
    currentSignalType = signalType;
    const modal = document.getElementById('signalModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    let title = '';
    let bodyHTML = '';
    
    switch(signalType) {
        case 'impulse':
            title = 'Unit Impulse: δ[n]';
            bodyHTML = generateBasicModalBody();
            break;
        case 'step':
            title = 'Unit Step: u[n]';
            bodyHTML = generateBasicModalBody();
            break;
        case 'ramp':
            title = 'Unit Ramp: r[n]';
            bodyHTML = generateBasicModalBody();
            break;
        case 'exp':
            title = 'Exponential: a^n';
            bodyHTML = generateExpModalBody();
            break;
        case 'sin':
            title = 'Sinusoid: A·sin(ωn + φ)';
            bodyHTML = generateSinusoidModalBody();
            break;
        case 'cos':
            title = 'Cosine: A·cos(ωn + φ)';
            bodyHTML = generateSinusoidModalBody();
            break;
    }
    
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modal.classList.add('show');
}

function generateBasicModalBody() {
    return `
        <div class="input-group">
            <label>Operation (Add/Subtract):</label>
            <select id="modalOperation">
                <option value="+">+ Add</option>
                <option value="-">- Subtract</option>
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
    `;
}

function generateExpModalBody() {
    return `
        <div class="input-group">
            <label>Operation (Add/Subtract):</label>
            <select id="modalOperation">
                <option value="+">+ Add</option>
                <option value="-">- Subtract</option>
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
    `;
}

function generateSinusoidModalBody() {
    return `
        <div class="input-group">
            <label>Operation (Add/Subtract):</label>
            <select id="modalOperation">
                <option value="+">+ Add</option>
                <option value="-">- Subtract</option>
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
    `;
}

function closeModal() {
    document.getElementById('signalModal').classList.remove('show');
}

function addToFunction() {
    const operation = document.getElementById('modalOperation').value;
    const shift = parseInt(document.getElementById('modalShift').value) || 0;
    const amplitude = parseFloat(document.getElementById('modalAmplitude')?.value) || 1;
    
    let signalObj = {
        type: currentSignalType,
        operation: operation,
        shift: shift,
        amplitude: amplitude
    };
    
    let notation = '';
    const shiftStr = shift === 0 ? 'n' : shift > 0 ? `n-${shift}` : `n+${Math.abs(shift)}`;
    const ampStr = amplitude === 1 ? '' : `${amplitude}×`;
    
    switch(currentSignalType) {
        case 'impulse':
            notation = `${ampStr}δ[${shiftStr}]`;
            break;
        case 'step':
            notation = `${ampStr}u[${shiftStr}]`;
            break;
        case 'ramp':
            notation = `${ampStr}r[${shiftStr}]`;
            break;
        case 'exp':
            const base = parseFloat(document.getElementById('modalExpBase').value) || 0.8;
            signalObj.base = base;
            notation = `${ampStr}(${base})^${shiftStr}`;
            break;
        case 'sin':
        case 'cos':
            const amp = parseFloat(document.getElementById('modalSinAmp').value) || 1;
            const freq = parseFloat(document.getElementById('modalSinFreq').value) || 0.5;
            const phase = parseFloat(document.getElementById('modalSinPhase').value) || 0;
            signalObj.sinAmp = amp;
            signalObj.sinFreq = freq;
            signalObj.sinPhase = phase;
            const funcName = currentSignalType === 'sin' ? 'sin' : 'cos';
            const phaseStr = phase === 0 ? '' : phase > 0 ? `+${phase}` : `${phase}`;
            notation = `${amp}×${funcName}(${freq}×${shiftStr}${phaseStr})`;
            break;
    }
    
    signalObj.notation = notation;
    compositeSignals.push(signalObj);
    updateCompositeDisplay();
    closeModal();
}

function updateCompositeDisplay() {
    const display = document.getElementById('compositeFunction');
    if (compositeSignals.length === 0) {
        display.textContent = 'No signals added yet';
        return;
    }
    
    let text = '';
    compositeSignals.forEach((signal, index) => {
        if (index === 0) {
            text += signal.notation;
        } else {
            text += ` ${signal.operation} ${signal.notation}`;
        }
    });
    
    display.textContent = text;
}

function clearComposite() {
    compositeSignals = [];
    updateCompositeDisplay();
}

function evaluateSignal(n, signal) {
    const adjustedN = n - signal.shift;
    let value = 0;
    
    switch(signal.type) {
        case 'impulse':
            value = adjustedN === 0 ? 1 : 0;
            break;
        case 'step':
            value = adjustedN >= 0 ? 1 : 0;
            break;
        case 'ramp':
            value = adjustedN >= 0 ? adjustedN : 0;
            break;
        case 'exp':
            value = Math.pow(signal.base, adjustedN);
            break;
        case 'sin':
            value = signal.sinAmp * Math.sin(signal.sinFreq * adjustedN + signal.sinPhase);
            break;
        case 'cos':
            value = signal.sinAmp * Math.cos(signal.sinFreq * adjustedN + signal.sinPhase);
            break;
    }
    
    return value * signal.amplitude;
}

function plotComposite() {
    if (compositeSignals.length === 0) {
        alert('Please add at least one signal to the function!');
        return;
    }
    
    const start = parseInt(document.getElementById('globalRangeStart').value);
    const end = parseInt(document.getElementById('globalRangeEnd').value);
    
    if (isNaN(start) || isNaN(end) || start >= end) {
        alert('Invalid range!');
        return;
    }
    
    originalIndices = [];
    originalData = [];
    
    for (let n = start; n <= end; n++) {
        originalIndices.push(n);
        let sum = 0;
        
        compositeSignals.forEach(signal => {
            const value = evaluateSignal(n, signal);
            if (signal.operation === '-') {
                sum -= value;
            } else {
                sum += value;
            }
        });
        
        originalData.push(sum);
    }
    
    createChart('originalChart', originalIndices, originalData, 'Original Signal: x[n]', 'original');
}

function applyOperation() {
    if (originalData.length === 0) {
        alert('Please plot the original signal first!');
        return;
    }

    const opType = document.getElementById('operationType').value;
    const param = parseFloat(document.getElementById('paramValue').value) || 0;

    outputData = [];
    outputIndices = [];

    switch(opType) {
        case 'shift':
            outputIndices = originalIndices.map(n => n + param);
            outputData = [...originalData];
            break;
        case 'scale':
            if (param === 0) {
                alert('Scale factor cannot be 0!');
                return;
            }
            outputIndices = originalIndices.map(n => n / param);
            outputData = [...originalData];
            break;
        case 'fold':
            outputIndices = originalIndices.map(n => -n).reverse();
            outputData = [...originalData].reverse();
            break;
        case 'add':
            outputIndices = [...originalIndices];
            outputData = originalData.map(x => x + param);
            break;
        case 'multiply':
            outputIndices = [...originalIndices];
            outputData = originalData.map(x => x * param);
            break;
        case 'reverse':
            outputIndices = [...originalIndices].reverse();
            outputData = [...originalData].reverse();
            break;
    }

    createChart('outputChart', outputIndices, outputData, 'Output Signal: y[n]', 'output');
}

function transferOutputToOriginal() {
    if (outputData.length === 0) {
        alert('Please apply an operation first to generate output signal!');
        return;
    }
    
    originalData = [...outputData];
    originalIndices = [...outputIndices];
    
    createChart('originalChart', originalIndices, originalData, 'Original Signal: x[n]', 'original');
    
    alert('Output signal transferred to Original signal!');
}

function createChart(canvasId, indices, data, title, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if ((type === 'original' && originalChart) || (type === 'output' && outputChart)) {
        if (type === 'original') {
            originalChart.destroy();
        } else {
            outputChart.destroy();
        }
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: indices,
            datasets: [{
                label: title,
                data: data,
                borderColor: type === 'original' ? '#667eea' : '#f093fb',
                backgroundColor: type === 'original' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(240, 147, 251, 0.1)',
                borderWidth: 2,
                pointRadius: 5,
                pointBackgroundColor: type === 'original' ? '#667eea' : '#f093fb',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'n (sample index)',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Amplitude',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                }
            }
        }
    });

    if (type === 'original') {
        originalChart = chart;
    } else {
        outputChart = chart;
    }
}