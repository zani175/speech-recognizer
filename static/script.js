let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let werChart = null;  // Global variable to store the chart instance
const startButton = document.getElementById('startRecord');
const stopButton = document.getElementById('stopRecord');
const uploadButton = document.getElementById('uploadFile');
const calculateButton = document.getElementById('calculateWER');
const downloadButton = document.getElementById('downloadReport');
const audioFileInput = document.getElementById('audioFile');
const recognizedText = document.getElementById('recognizedText');
const referenceText = document.getElementById('referenceText');
const resultSection = document.getElementById('resultSection');
const werValue = document.getElementById('werValue');
const totalWords = document.getElementById('totalWords');
const correctWords = document.getElementById('correctWords');
const chartImage = document.getElementById('chartImage');
const wordDifferencesList = document.getElementById('wordDifferencesList');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mode selection
    initializeModeSelection();
    
    // Initialize text comparison section
    initializeTextComparison();
    
    // Initialize audio recording section
    initializeAudioRecording();
    
    // Initialize file upload section
    initializeFileUpload();
});

// Mode Selection
function initializeModeSelection() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    const sections = document.querySelectorAll('.section');
    
    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and sections
            modeButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding section
            const mode = button.dataset.mode;
            document.getElementById(`${mode}ToTextSection`).classList.add('active');
        });
    });
}

// Text Comparison Section
function initializeTextComparison() {
    const calculateBtn = document.getElementById('calculateTextWER');
    calculateBtn.addEventListener('click', async () => {
        const referenceText = document.getElementById('referenceText').value;
        const hypothesisText = document.getElementById('hypothesisText').value;
        
        if (!referenceText || !hypothesisText) {
            alert('Please enter both reference and hypothesis text');
            return;
        }
        
        try {
            const response = await fetch('/calculate_wer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reference: referenceText,
                    hypothesis: hypothesisText
                })
            });
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            updateResults(data);
        } catch (error) {
            console.error('Error calculating WER:', error);
            alert('Error calculating WER: ' + error.message);
        }
    });
}

// Audio Recording Section
function initializeAudioRecording() {
    const startBtn = document.getElementById('startRecording');
    const stopBtn = document.getElementById('stopRecording');
    const calculateBtn = document.getElementById('calculateSpeechWER');
    
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    
    calculateBtn.addEventListener('click', async () => {
        const referenceText = document.getElementById('speechReferenceText').value;
        const recognizedText = document.getElementById('speechRecognizedText').value;
        
        if (!referenceText || !recognizedText) {
            alert('Please enter reference text and record some audio');
            return;
        }
        
        try {
            const response = await fetch('/calculate_wer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reference: referenceText,
                    hypothesis: recognizedText
                })
            });
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            updateResults(data);
        } catch (error) {
            console.error('Error calculating WER:', error);
            alert('Error calculating WER: ' + error.message);
        }
    });
    
    // Request microphone access
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                sendAudioForTranscription(audioBlob, 'speechRecognizedText');
            };
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please ensure you have granted microphone permissions.');
        });
}

function startRecording() {
    audioChunks = [];
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('startRecording').disabled = true;
    document.getElementById('stopRecording').disabled = false;
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
    document.getElementById('startRecording').disabled = false;
    document.getElementById('stopRecording').disabled = true;
}

// File Upload Section
function initializeFileUpload() {
    const fileInput = document.getElementById('audioFile');
    const calculateBtn = document.getElementById('calculateFileWER');
    
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            sendAudioForTranscription(file, 'fileRecognizedText');
        }
    });
    
    calculateBtn.addEventListener('click', async () => {
        const referenceText = document.getElementById('fileReferenceText').value;
        const recognizedText = document.getElementById('fileRecognizedText').value;
        
        if (!referenceText || !recognizedText) {
            alert('Please enter reference text and upload an audio file');
            return;
        }
        
        try {
            const response = await fetch('/calculate_wer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reference: referenceText,
                    hypothesis: recognizedText
                })
            });
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            updateResults(data);
        } catch (error) {
            console.error('Error calculating WER:', error);
            alert('Error calculating WER: ' + error.message);
        }
    });
}

// Common Functions
function sendAudioForTranscription(audioData, targetTextareaId) {
    const formData = new FormData();
    formData.append('audio', audioData);
    
    fetch('/transcribe', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        document.getElementById(targetTextareaId).value = data.text;
    })
    .catch(error => {
        console.error('Error transcribing audio:', error);
        alert('Error transcribing audio. Please try again.');
    });
}

function updateResults(data) {
    // Show results section
    const resultSection = document.getElementById('resultSection');
    resultSection.style.display = 'block';
    
    // Update statistics
    document.getElementById('werValue').textContent = data.wer.toFixed(2) + '%';
    document.getElementById('totalWords').textContent = data.stats.total_words;
    document.getElementById('correctWords').textContent = data.stats.correct_words;
    
    // Update chart
    updateChart(
        data.stats.correct_words,
        data.stats.substitutions,
        data.stats.insertions,
        data.stats.deletions
    );
    
    // Update word differences
    updateWordDifferences(data.word_differences);
    
    // Show success message for identical texts
    if (data.stats.correct_words === data.stats.total_words && 
        data.stats.substitutions === 0 && 
        data.stats.insertions === 0 && 
        data.stats.deletions === 0) {
        showNotification('Perfect match! The texts are identical.', 'success');
    }
}

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add styles for notification
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        box-shadow: var(--shadow-md);
        animation: slideIn 0.3s ease;
    }
    
    .notification.success {
        background-color: var(--primary-color);
    }
    
    .notification.error {
        background-color: #ef4444;
    }
    
    .notification.info {
        background-color: var(--text-light);
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

function updateChart(correct, substitutions, insertions, deletions) {
    const ctx = document.getElementById('werChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (werChart) {
        werChart.destroy();
    }
    
    werChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Correct', 'Substitutions', 'Insertions', 'Deletions'],
            datasets: [{
                label: 'Word Count',
                data: [correct, substitutions, insertions, deletions],
                backgroundColor: [
                    '#2ecc71',
                    '#f39c12',
                    '#3498db',
                    '#e74c3c'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateWordDifferences(differences) {
    const { reference, hypothesis } = differences;
    const substitutionsList = document.getElementById('substitutionsList');
    const insertionsList = document.getElementById('insertionsList');
    const deletionsList = document.getElementById('deletionsList');
    
    // Clear existing lists
    substitutionsList.innerHTML = '';
    insertionsList.innerHTML = '';
    deletionsList.innerHTML = '';
    
    // Process each aligned pair
    for (let i = 0; i < reference.length; i++) {
        const refWord = reference[i];
        const hypWord = hypothesis[i];
        
        if (refWord && hypWord) {
            if (refWord.toLowerCase() !== hypWord.toLowerCase()) {
                // Substitution
                const li = document.createElement('li');
                li.innerHTML = `<span class="ref-word">${refWord}</span> → <span class="hyp-word">${hypWord}</span>`;
                substitutionsList.appendChild(li);
            }
        } else if (refWord && !hypWord) {
            // Deletion
            const li = document.createElement('li');
            li.innerHTML = `<span class="ref-word">${refWord}</span>`;
            deletionsList.appendChild(li);
        } else if (!refWord && hypWord) {
            // Insertion
            const li = document.createElement('li');
            li.innerHTML = `<span class="hyp-word">${hypWord}</span>`;
            insertionsList.appendChild(li);
        }
    }
    
    // Add styles for word differences
    const style = document.createElement('style');
    style.textContent = `
        .word-list li {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background-color: var(--background-color);
            border-radius: 0.5rem;
            border-left: 3px solid var(--primary-color);
            transition: all 0.3s ease;
        }
        
        .word-list li:hover {
            transform: translateX(5px);
            box-shadow: var(--shadow-sm);
        }
        
        .ref-word {
            color: var(--primary-color);
            font-weight: 500;
        }
        
        .hyp-word {
            color: var(--secondary-color);
            font-weight: 500;
        }
    `;
    document.head.appendChild(style);
}

// Download report functionality
document.getElementById('downloadReport').addEventListener('click', async () => {
    try {
        // Get the current mode
        const activeMode = document.querySelector('.mode-btn.active').dataset.mode;
        
        // Get reference and hypothesis text based on the active mode
        let reference, hypothesis;
        
        switch (activeMode) {
            case 'text':
                reference = document.getElementById('referenceText').value.trim();
                hypothesis = document.getElementById('hypothesisText').value.trim();
                break;
            case 'speech':
                reference = document.getElementById('speechReferenceText').value.trim();
                hypothesis = document.getElementById('speechRecognizedText').value.trim();
                break;
            case 'file':
                reference = document.getElementById('fileReferenceText').value.trim();
                hypothesis = document.getElementById('fileRecognizedText').value.trim();
                break;
        }

        if (!reference || !hypothesis) {
            alert('Please ensure both reference and hypothesis text are available');
            return;
        }

        // Get current statistics
        const stats = {
            wer: parseFloat(document.getElementById('werValue').textContent),
            total_words: parseInt(document.getElementById('totalWords').textContent),
            correct_words: parseInt(document.getElementById('correctWords').textContent),
            substitutions: document.getElementById('substitutionsList').children.length,
            insertions: document.getElementById('insertionsList').children.length,
            deletions: document.getElementById('deletionsList').children.length
        };

        // Send request to generate report
        const response = await fetch('/download_report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reference: reference,
                hypothesis: hypothesis,
                stats: stats
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate report');
        }

        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'speech_evaluation_report.txt';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading report:', error);
        alert('Error downloading report: ' + error.message);
    }
});

document.getElementById('moreDetailsBtn').addEventListener('click', async () => {
    const mlSection = document.getElementById('mlDetailsSection');
    // Get the current mode
    const activeMode = document.querySelector('.mode-btn.active').dataset.mode;
    let reference, hypothesis;
    switch (activeMode) {
        case 'text':
            reference = document.getElementById('referenceText').value.trim();
            hypothesis = document.getElementById('hypothesisText').value.trim();
            break;
        case 'speech':
            reference = document.getElementById('speechReferenceText').value.trim();
            hypothesis = document.getElementById('speechRecognizedText').value.trim();
            break;
        case 'file':
            reference = document.getElementById('fileReferenceText').value.trim();
            hypothesis = document.getElementById('fileRecognizedText').value.trim();
            break;
    }
    if (!reference || !hypothesis) {
        alert('Please enter both reference and hypothesis text.');
        return;
    }
    // Fetch ML details
    try {
        const response = await fetch('/ml_details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, hypothesis })
        });
        const data = await response.json();
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        // Show section
        mlSection.style.display = 'block';
        // Set all ML graph images
        document.getElementById('confusionMatrixImg').src = 'data:image/png;base64,' + data.confusion_matrix_img;
        // Set TP/TN/FP/FN words
        document.getElementById('tpWords').textContent = data.tp.join(', ') || '-';
        document.getElementById('tnWords').textContent = data.tn.join(', ') || '-';
        document.getElementById('fpWords').textContent = data.fp.join(', ') || '-';
        document.getElementById('fnWords').textContent = data.fn.join(', ') || '-';
    } catch (error) {
        alert('Failed to fetch ML details: ' + error.message);
    }
}); 