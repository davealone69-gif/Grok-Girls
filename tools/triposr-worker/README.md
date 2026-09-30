# Grok-Girls TripoSR worker

This is the no-PC fallback 3D worker for the existing Android Hunyuan3DLocal bridge.
It exposes /health and /generate on 127.0.0.1:8081 and uses the official TripoSR repository as the generation engine.

TripoSR is MIT licensed. Its official README documents Python >= 3.8 and says the default GPU inference configuration uses about 6 GB VRAM. This worker forces CPU mode for the phone, so it is intentionally slow and memory/thermal intensive.

## Termux setup

Install the official TripoSR repository at ~/TripoSR and keep Grok-Girls at ~/Grok-Girls.

Start:

    bash ~/Grok-Girls/tools/triposr-worker/start-triposr.sh

Check:

    curl http://127.0.0.1:8081/health

The first generation may download the TripoSR model from Hugging Face if it is not already cached.

Only one 3D generation job is accepted at a time. The worker refuses jobs when available RAM plus swap is below the configured threshold.

Do not run Ollama, stable-diffusion.cpp and TripoSR generation simultaneously on this phone.

The Android client does not need to know that the worker is TripoSR. A later Hunyuan3D worker can implement the same /health and /generate contract.
