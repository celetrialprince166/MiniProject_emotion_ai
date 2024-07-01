# views.py
import os
from django.shortcuts import render, HttpResponse
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .utils import make_prediction
import librosa
import numpy as np

def home_View(request):
    return render(request,"home.html")



@csrf_exempt
def index(request):
    prediction_value=None
    
    if request.method == 'POST':
        audio_file = request.FILES.get('file')
        if audio_file:
            audio_path = os.path.join(settings.MEDIA_ROOT, 'audio', audio_file.name)
            with open(audio_path, 'wb+') as destination:
                for chunk in audio_file.chunks():
                    destination.write(chunk)
            
            prediction_value= make_prediction(path=audio_path)
            
            # Here you would process the file and make predictions
            prediction_result = {
                'emotion': prediction_value  # Replace with actual prediction result
            }
            return JsonResponse(prediction_result)
    context={
        "prediction":prediction_value
    }
    return render(request, 'index.html',context)
