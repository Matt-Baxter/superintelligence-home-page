# Voice a list of sentences with Kokoro (open-weight neural TTS, Apache-2.0) through kokoro-onnx, on the CPU.
# Reads {"model", "voices", "voice", "speed", "jobs": [{"text", "file"}]} on stdin; writes one WAV per job and prints a
# JSON list of durations in seconds as the last line. Used by modules/responses/video.js; nothing leaves the machine.
import json, sys
import soundfile as sf
from kokoro_onnx import Kokoro

req = json.load(sys.stdin)
k = Kokoro(req["model"], req["voices"])
out = []
for job in req["jobs"]:
    samples, rate = k.create(job["text"], voice=req.get("voice", "af_heart"), speed=float(req.get("speed", 1.0)), lang="en-us")
    sf.write(job["file"], samples, rate)
    out.append(round(len(samples) / rate, 3))
print(json.dumps(out))
