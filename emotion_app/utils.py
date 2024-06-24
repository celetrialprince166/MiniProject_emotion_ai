import librosa
import numpy as np
import joblib
from django.conf import settings
import os




# Path to the saved model
MODEL_PATH = os.path.join(settings.MEDIA_ROOT, 'models', 'mlp_scaled_model.joblib')

# Audio augmentation functions
def pitch(data, sampling_rate, pitch_factor=0.7):
    return librosa.effects.pitch_shift(y=data, sr=sampling_rate, n_steps=pitch_factor)

def shift(data):
    shift_range = int(np.random.uniform(low=-5, high=5) * 1000)
    return np.roll(data, shift_range)

def stretch(data, rate=0.8):
    return librosa.effects.time_stretch(y=data, rate=rate)

def noise(data):
    noise_amp = 0.035 * np.random.uniform() * np.amax(data)
    data = data + noise_amp * np.random.normal(size=data.shape[0])
    return data

# Feature extraction function
def extract_features(data, sample_rate):
    # ZCR
    result = np.array([])
    zcr = np.mean(librosa.feature.zero_crossing_rate(y=data).T, axis=0)
    result = np.hstack((result, zcr))

    # Chroma_stft
    stft = np.abs(librosa.stft(data))
    chroma_stft = np.mean(librosa.feature.chroma_stft(S=stft, sr=sample_rate).T, axis=0)
    result = np.hstack((result, chroma_stft))

    # MFCC
    mfcc = np.mean(librosa.feature.mfcc(y=data, sr=sample_rate).T, axis=0)
    result = np.hstack((result, mfcc))

    # Root Mean Square Value
    rms = np.mean(librosa.feature.rms(y=data).T, axis=0)
    result = np.hstack((result, rms))

    # MelSpectogram
    mel = np.mean(librosa.feature.melspectrogram(y=data, sr=sample_rate).T, axis=0)
    result = np.hstack((result, mel))

    return result

# Function to extract features from an audio file with augmentation
def get_features(path):
    # Load audio file
    data, sample_rate = librosa.load(path, duration=2.5, offset=0.6)

    # Extract features without augmentation
    res1 = extract_features(data, sample_rate)
    result = np.array(res1)

    # Augment with noise
    noise_data = noise(data)
    res2 = extract_features(noise_data, sample_rate)
    result = np.vstack((result, res2))

    # Augment with stretching and pitching
    new_data = stretch(data)
    data_stretch_pitch = pitch(new_data, sample_rate)
    res3 = extract_features(data_stretch_pitch, sample_rate)
    result = np.vstack((result, res3))

    return result

# Function to make predictions
def make_prediction(path):
    # Load the model
    model = joblib.load(MODEL_PATH)

    # Extract features from the audio file
    features = get_features(path)

    # Reshape features to match the input shape of the model if necessary
    # features = features.reshape(features.shape[0], -1)

    # Make prediction
    prediction = model.predict(features)

    # Assuming the model outputs probabilities for each emotion class
    predicted_emotion = np.argmax(prediction, axis=1)

    # Map the predicted index to the corresponding emotion
    emotion_map = {
    0: 'Angry',
    1: 'Disgust',
    2: 'Fear',
    3: 'Happy',
    4: 'Neutral',
    5: 'Sad',
    6: 'Surprise'
}  # Example mapping
    predicted_emotion_label = emotion_map[predicted_emotion[0]]
    print(prediction)
    print(predicted_emotion)
    return predicted_emotion_label

# Example usage
# predicted_emotion = make_prediction('path_to_audio_file.wav')
# print(f'Predicted Emotion: {predicted_emotion}')
