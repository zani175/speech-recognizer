from flask import Flask, render_template, request, jsonify, send_file
import speech_recognition as sr
import matplotlib.pyplot as plt
import numpy as np
import os
import io
import base64
from werkzeug.utils import secure_filename
from jiwer import wer, process_words
import matplotlib
import wave
import seaborn as sns
from sklearn.metrics import confusion_matrix
import sklearn.metrics as skm
matplotlib.use('Agg')  # Use Agg backend for non-interactive plotting

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def calculate_wer(reference, hypothesis):
    """Calculate Word Error Rate (WER) between reference and hypothesis text."""
    if not reference or not hypothesis:
        return 0.0
    
    # If texts are identical, return 0% WER
    if reference.strip() == hypothesis.strip():
        return 0.0
    
    # Calculate WER using jiwer
    return wer(reference, hypothesis) * 100  # Convert to percentage

def get_word_statistics(reference, hypothesis):
    """Calculate word-level statistics between reference and hypothesis text."""
    if not reference or not hypothesis:
        return {
            'total_words': 0,
            'correct_words': 0,
            'substitutions': 0,
            'insertions': 0,
            'deletions': 0
        }
    
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    
    # If texts are identical
    if reference.strip() == hypothesis.strip():
        return {
            'total_words': len(ref_words),
            'correct_words': len(ref_words),
            'substitutions': 0,
            'insertions': 0,
            'deletions': 0
        }
    
    # Initialize counters
    total_words = len(ref_words)
    correct = 0
    substitutions = 0
    insertions = 0
    deletions = 0
    
    # Create a matrix for dynamic programming
    matrix = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]
    
    # Initialize first row and column
    for i in range(len(ref_words) + 1):
        matrix[i][0] = i
    for j in range(len(hyp_words) + 1):
        matrix[0][j] = j
    
    # Fill the matrix
    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i-1].lower() == hyp_words[j-1].lower():
                matrix[i][j] = matrix[i-1][j-1]
                correct += 1
            else:
                matrix[i][j] = min(
                    matrix[i-1][j-1] + 1,  # substitution
                    matrix[i-1][j] + 1,    # deletion
                    matrix[i][j-1] + 1     # insertion
                )
    
    # Backtrack to find actual operations
    i, j = len(ref_words), len(hyp_words)
    while i > 0 or j > 0:
        if i > 0 and j > 0 and ref_words[i-1].lower() == hyp_words[j-1].lower():
            i -= 1
            j -= 1
        else:
            if i > 0 and j > 0 and matrix[i][j] == matrix[i-1][j-1] + 1:
                substitutions += 1
                i -= 1
                j -= 1
            elif i > 0 and matrix[i][j] == matrix[i-1][j] + 1:
                deletions += 1
                i -= 1
            else:
                insertions += 1
                j -= 1
    
    return {
        'total_words': total_words,
        'correct_words': correct,
        'substitutions': substitutions,
        'insertions': insertions,
        'deletions': deletions
    }

def get_word_differences(reference, hypothesis):
    """Get detailed word-level differences between reference and hypothesis text."""
    if not reference or not hypothesis:
        return {
            'reference': [],
            'hypothesis': []
        }
    
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    
    # If texts are identical
    if reference.strip() == hypothesis.strip():
        return {
            'reference': ref_words,
            'hypothesis': hyp_words
        }
    
    # Levenshtein matrix
    m, n = len(ref_words), len(hyp_words)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if ref_words[i-1].lower() == hyp_words[j-1].lower():
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1])
    # Backtrack
    aligned_ref = []
    aligned_hyp = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and ref_words[i-1].lower() == hyp_words[j-1].lower():
            aligned_ref.insert(0, ref_words[i-1])
            aligned_hyp.insert(0, hyp_words[j-1])
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i-1][j-1] + 1:
            # Substitution
            aligned_ref.insert(0, ref_words[i-1])
            aligned_hyp.insert(0, hyp_words[j-1])
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i-1][j] + 1:
            # Deletion
            aligned_ref.insert(0, ref_words[i-1])
            aligned_hyp.insert(0, '')
            i -= 1
        else:
            # Insertion
            aligned_ref.insert(0, '')
            aligned_hyp.insert(0, hyp_words[j-1])
            j -= 1
    return {
        'reference': aligned_ref,
        'hypothesis': aligned_hyp
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'})
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No selected file'})
        
        # Save the audio file temporarily
        filename = secure_filename(audio_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        audio_file.save(filepath)
        
        recognizer = sr.Recognizer()
        transcript = []
        
        # Use wave to get duration
        with wave.open(filepath, 'rb') as wf:
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            duration = nframes / float(framerate)
        
        # Chunk size in seconds (e.g., 60s)
        chunk_size = 60
        with sr.AudioFile(filepath) as source:
            for i in range(0, int(duration), chunk_size):
                source_offset = i
                source_duration = min(chunk_size, duration - i)
                audio = recognizer.record(source, offset=source_offset, duration=source_duration)
                try:
                    text = recognizer.recognize_google(audio)
                except Exception as e:
                    text = ''
                transcript.append(text)
        
        # Clean up
        os.remove(filepath)
        
        return jsonify({'text': ' '.join(transcript)})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/calculate_wer', methods=['POST'])
def calculate_wer_endpoint():
    try:
        data = request.json
        reference = data.get('reference', '')
        hypothesis = data.get('hypothesis', '')
        
        if not reference or not hypothesis:
            return jsonify({
                'error': 'Both reference and hypothesis text are required',
                'wer': 0.0,
                'stats': {
                    'total_words': 0,
                    'correct_words': 0,
                    'substitutions': 0,
                    'insertions': 0,
                    'deletions': 0
                },
                'word_differences': {
                    'reference': [],
                    'hypothesis': []
                }
            })
        
        # Calculate WER and get statistics
        wer_score = calculate_wer(reference, hypothesis)
        stats = get_word_statistics(reference, hypothesis)
        differences = get_word_differences(reference, hypothesis)
        
        return jsonify({
            'wer': wer_score,
            'stats': stats,
            'word_differences': differences
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'wer': 0.0,
            'stats': {
                'total_words': 0,
                'correct_words': 0,
                'substitutions': 0,
                'insertions': 0,
                'deletions': 0
            },
            'word_differences': {
                'reference': [],
                'hypothesis': []
            }
        })

@app.route('/download_report', methods=['POST'])
def download_report():
    try:
        data = request.json
        reference = data.get('reference', '')
        hypothesis = data.get('hypothesis', '')
        stats = data.get('stats', {})
        
        # Create a text report
        report = f"""Speech Recognition Evaluation Report
=======================

Reference Text:
{reference}

Recognized Text:
{hypothesis}

Word Error Rate: {stats.get('wer', 0):.2f}%

Statistics:
- Total Words: {stats.get('total_words', 0)}
- Correct Words: {stats.get('correct_words', 0)}
- Substitutions: {stats.get('substitutions', 0)}
- Insertions: {stats.get('insertions', 0)}
- Deletions: {stats.get('deletions', 0)}
"""
        
        # Create a temporary file
        temp_file = io.BytesIO()
        temp_file.write(report.encode('utf-8'))
        temp_file.seek(0)
        
        return send_file(
            temp_file,
            mimetype='text/plain',
            as_attachment=True,
            download_name='speech_evaluation_report.txt'
        )
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/ml_details', methods=['POST'])
def ml_details():
    try:
        data = request.json
        reference = data.get('reference', '')
        hypothesis = data.get('hypothesis', '')
        if not reference or not hypothesis:
            return jsonify({'error': 'Both reference and hypothesis text are required'})
        ref_words = set(reference.lower().split())
        hyp_words = set(hypothesis.lower().split())
        all_words = sorted(list(ref_words | hyp_words))
        # Confusion matrix (word presence/absence)
        y_true = [1 if w in ref_words else 0 for w in all_words]
        y_pred = [1 if w in hyp_words else 0 for w in all_words]
        cm = skm.confusion_matrix(y_true, y_pred, labels=[1,0])
        # TP, TN, FP, FN words
        TP = [w for w in all_words if w in ref_words and w in hyp_words]
        TN = [w for w in all_words if w not in ref_words and w not in hyp_words]
        FP = [w for w in all_words if w not in ref_words and w in hyp_words]
        FN = [w for w in all_words if w in ref_words and w not in hyp_words]
        # 1. Confusion Matrix Plot
        fig1, ax1 = plt.subplots(figsize=(4,4))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['Present','Absent'], yticklabels=['Present','Absent'], ax=ax1)
        ax1.set_xlabel('Predicted')
        ax1.set_ylabel('Actual')
        ax1.set_title('Word Presence Confusion Matrix')
        buf1 = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf1, format='png')
        plt.close(fig1)
        buf1.seek(0)
        img_cm = base64.b64encode(buf1.read()).decode('utf-8')
        # Only keep confusion matrix code
        return jsonify({
            'confusion_matrix_img': img_cm,
            'tp': TP,
            'tn': TN,
            'fp': FP,
            'fn': FN
        })
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)