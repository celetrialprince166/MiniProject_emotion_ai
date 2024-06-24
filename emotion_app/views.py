# views.py
import os
from django.shortcuts import render, HttpResponse
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .utils import make_prediction
import librosa
import numpy as np

def test_view(request):
    return HttpResponse("<h1> This is a test page</h1>")

@csrf_exempt
def index(request):
    if request.method == 'POST':
        audio_file = request.FILES.get('file')
        if audio_file:
            audio_path = os.path.join(settings.MEDIA_ROOT, 'audio', audio_file.name)
            with open(audio_path, 'wb+') as destination:
                for chunk in audio_file.chunks():
                    destination.write(chunk)
            
            prediction= make_prediction(path=audio_path)
            
            # Here you would process the file and make predictions
            prediction_result = {
                'emotion': 'happy'  # Replace with actual prediction result
            }
            return JsonResponse(prediction_result)

    return render(request, 'index.html')
