# Speech-to-Text Evaluation App

A full-stack application for evaluating speech recognition accuracy using Word Error Rate (WER) calculations and visualizations.

## Features

- Record audio using microphone
- Upload audio files (.wav or .mp3)
- Convert speech to text using Google's Speech Recognition API
- Calculate Word Error Rate (WER)
- Visualize results with Matplotlib charts
- Clean and intuitive user interface

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)
- Web browser with JavaScript enabled
- Microphone (for recording)

## Installation

1. Clone this repository or download the files
2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to `http://localhost:5000`
3. Use the application:
   - Record audio using the microphone
   - Upload an audio file
   - Enter the reference text
   - Click "Calculate WER" to see results

## How it Works

1. **Audio Input**:
   - Record audio using your microphone
   - Upload audio files in .wav or .mp3 format

2. **Speech Recognition**:
   - The app uses Google's Speech Recognition API to convert audio to text
   - Results are displayed in the "Recognized Text" field

3. **WER Calculation**:
   - Enter the reference (actual) text
   - The app calculates Word Error Rate (WER)
   - Results are displayed as a percentage
   - A bar chart shows the breakdown of words (total, correct, errors)

## Notes

- The app requires an internet connection for speech recognition
- Audio files are temporarily stored in the `uploads` directory and automatically deleted after processing
- For best results, use clear audio recordings with minimal background noise

## License

This project is open source and available under the MIT License.