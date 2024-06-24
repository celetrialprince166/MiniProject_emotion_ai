(async () => {
    let leftchannel = [];
    let rightchannel = [];
    let recorder = null;
    let recording = false;
    let recordingLength = 0;
    let volume = null;
    let audioInput = null;
    let sampleRate = null;
    let AudioContext = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let analyser = null;
    let canvas = document.querySelector("canvas");
    let canvasCtx = canvas.getContext("2d");
    let visualSelect = document.querySelector("#visSelect");
    let micSelect = document.querySelector("#micSelect");
    let stream = null;
    let tested = false;
  
    async function getStream(constraints) {
      if (!constraints) {
        constraints = { audio: true, video: false };
      }
      return await navigator.mediaDevices.getUserMedia(constraints);
    }
  
    try {
      stream = await getStream();
      console.log("Got stream");
    } catch (err) {
      alert("Issue getting mic: " + err.message);
      return;
    }
  
    const deviceInfos = await navigator.mediaDevices.enumerateDevices();
  
    var mics = [];
    for (let i = 0; i !== deviceInfos.length; ++i) {
      let deviceInfo = deviceInfos[i];
      if (deviceInfo.kind === "audioinput") {
        mics.push(deviceInfo);
        let label = deviceInfo.label || "Microphone " + mics.length;
        console.log("Mic ", label + " " + deviceInfo.deviceId);
        const option = document.createElement("option");
        option.value = deviceInfo.deviceId;
        option.text = label;
        micSelect.appendChild(option);
      }
    }
  
    function setUpRecording() {
      context = new AudioContext();
      sampleRate = context.sampleRate;
  
      volume = context.createGain();
      audioInput = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      audioInput.connect(analyser);
  
      let bufferSize = 2048;
      recorder = context.createScriptProcessor(bufferSize, 2, 2);
      analyser.connect(recorder);
      recorder.connect(context.destination);
  
      recorder.onaudioprocess = function (e) {
        if (!recording) return;
        let left = e.inputBuffer.getChannelData(0);
        let right = e.inputBuffer.getChannelData(1);
        if (!tested) {
          tested = true;
          if (!left.reduce((a, b) => a + b)) {
            alert("There seems to be an issue with your Mic");
            stop();
            stream.getTracks().forEach(function (track) {
              track.stop();
            });
            context.close();
          }
        }
        leftchannel.push(new Float32Array(left));
        rightchannel.push(new Float32Array(right));
        recordingLength += bufferSize;
      };
      visualize();
    }
  
    function mergeBuffers(channelBuffer, recordingLength) {
      let result = new Float32Array(recordingLength);
      let offset = 0;
      let lng = channelBuffer.length;
      for (let i = 0; i < lng; i++) {
        let buffer = channelBuffer[i];
        result.set(buffer, offset);
        offset += buffer.length;
      }
      return result;
    }
  
    function interleave(leftChannel, rightChannel) {
      let length = leftChannel.length + rightChannel.length;
      let result = new Float32Array(length);
      let inputIndex = 0;
      for (let index = 0; index < length; ) {
        result[index++] = leftChannel[inputIndex];
        result[index++] = rightChannel[inputIndex];
        inputIndex++;
      }
      return result;
    }
  
    function writeUTFBytes(view, offset, string) {
      let lng = string.length;
      for (let i = 0; i < lng; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  
    function start() {
      recording = true;
      document.querySelector("#msg").style.visibility = "visible";
      leftchannel.length = rightchannel.length = 0;
      recordingLength = 0;
      if (!context) setUpRecording();
    }
  
    function stop() {
      recording = false;
      document.querySelector("#msg").style.visibility = "hidden";
  
      let leftBuffer = mergeBuffers(leftchannel, recordingLength);
      let rightBuffer = mergeBuffers(rightchannel, recordingLength);
      let interleaved = interleave(leftBuffer, rightBuffer);
  
      let buffer = new ArrayBuffer(44 + interleaved.length * 2);
      let view = new DataView(buffer);
  
      writeUTFBytes(view, 0, "RIFF");
      view.setUint32(4, 44 + interleaved.length * 2, true);
      writeUTFBytes(view, 8, "WAVE");
      writeUTFBytes(view, 12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 2, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 4, true);
      view.setUint16(32, 4, true);
      view.setUint16(34, 16, true);
      writeUTFBytes(view, 36, "data");
      view.setUint32(40, interleaved.length * 2, true);
  
      let lng = interleaved.length;
      let index = 44;
      let volume = 1;
      for (let i = 0; i < lng; i++) {
        view.setInt16(index, interleaved[i] * (0x7fff * volume), true);
        index += 2;
      }
  
      const blob = new Blob([view], { type: "audio/wav" });
  
      const audioUrl = URL.createObjectURL(blob);
      document.querySelector("#audio").setAttribute("src", audioUrl);
      const link = document.querySelector("#download");
      link.setAttribute("href", audioUrl);
      link.download = "output.wav";
  
      // Call the function to upload the blob
      uploadAudio(blob);
    }
  
    async function uploadAudio(blob) {
      let formData = new FormData();
      formData.append("file", blob, "output.wav");
  
      try {
        let response = await fetch("/index", {
          method: "POST",
          body: formData,
        });
  
        if (response.ok) {
          let result = await response.json();
          console.log("Prediction result:", result);
        } else {
          console.error("Error in upload:", response.statusText);
        }
      } catch (error) {
        console.error("Error in upload:", error);
      }
    }
  
  
    function visualize() {
      let WIDTH = canvas.width;
      let HEIGHT = canvas.height;
      let CENTERX = canvas.width / 2;
      let CENTERY = canvas.height / 2;
  
      let visualSetting = visualSelect.value;
      if (!analyser) return;
  
      if (visualSetting === "sinewave") {
        analyser.fftSize = 2048;
        let bufferLength = analyser.fftSize;
        let dataArray = new Uint8Array(bufferLength);
  
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
  
        let draw = function () {
          drawVisual = requestAnimationFrame(draw);
          analyser.getByteTimeDomainData(dataArray);
  
          canvasCtx.fillStyle = "rgb(200, 200, 200)";
          canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  
          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = "rgb(0, 0, 0)";
          canvasCtx.beginPath();
  
          let sliceWidth = (WIDTH * 1.0) / bufferLength;
          let x = 0;
  
          for (let i = 0; i < bufferLength; i++) {
            let v = dataArray[i] / 128.0;
            let y = (v * HEIGHT) / 2;
  
            if (i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y);
            }
  
            x += sliceWidth;
          }
  
          canvasCtx.lineTo(canvas.width, canvas.height / 2);
          canvasCtx.stroke();
        };
  
        draw();
      } else if (visualSetting == "frequencybars") {
        analyser.fftSize = 64;
        let bufferLengthAlt = analyser.frequencyBinCount;
        let dataArrayAlt = new Uint8Array(bufferLengthAlt);
  
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
        let drawAlt = function () {
          drawVisual = requestAnimationFrame(drawAlt);
  
          analyser.getByteFrequencyData(dataArrayAlt);
  
          canvasCtx.fillStyle = "rgb(0, 0, 0)";
          canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  
          let barWidth = WIDTH / bufferLengthAlt;
          let barHeight;
          let x = 0;
  
          for (let i = 0; i < bufferLengthAlt; i++) {
            barHeight = dataArrayAlt[i];
  
            canvasCtx.fillStyle = "rgb(" + (barHeight + 100) + ",50,50)";
            canvasCtx.fillRect(
              x,
              HEIGHT - barHeight / 2,
              barWidth,
              barHeight / 2
            );
  
            x += barWidth + 1;
          }
        };
  
        drawAlt();
      } else if (visualSetting == "circle") {
        analyser.fftSize = 32;
        let bufferLength = analyser.frequencyBinCount;
        console.log(bufferLength);
        let dataArray = new Uint8Array(bufferLength);
  
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
  
        let draw = () => {
          drawVisual = requestAnimationFrame(draw);
  
          analyser.getByteFrequencyData(dataArray);
          canvasCtx.fillStyle = "rgb(0, 0, 0)";
          canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  
          let radius = dataArray[2] / 2;
          if (radius < 20) radius = 20;
          if (radius > 100) radius = 100;
          canvasCtx.beginPath();
          canvasCtx.arc(CENTERX, CENTERY, radius, 0, 2 * Math.PI, false);
          canvasCtx.lineWidth = 6;
          canvasCtx.strokeStyle = "rgb(50,50," + (radius + 100) + ")";
          canvasCtx.stroke();
        };
        draw();
      }
    }
  
    visualSelect.onchange = function () {
      window.cancelAnimationFrame(drawVisual);
      visualize();
    };
  
    micSelect.onchange = async (e) => {
      console.log("now use device ", micSelect.value);
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
      context.close();
  
      stream = await getStream({
        audio: {
          deviceId: { exact: micSelect.value },
        },
        video: false,
      });
      setUpRecording();
    };
  
    function pause() {
      recording = false;
      context.suspend();
    }
  
    function resume() {
      recording = true;
      context.resume();
    }
  
    document.querySelector("#record").onclick = (e) => {
      console.log("Start recording");
      start();
    };
  
    document.querySelector("#stop").onclick = (e) => {
      stop();
    };
  })();
  