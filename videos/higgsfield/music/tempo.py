"""Tempo estimate (onset-envelope autocorrelation) + loudness of each music source. usage: python music/tempo.py"""
import glob, numpy as np, soundfile as sf
from scipy import signal
for f in sorted(glob.glob("music/wav/*.wav")):
    x, sr = sf.read(f); m = x.mean(axis=1)
    hop = 512; S = np.abs(signal.stft(m, sr, nperseg=2048, noverlap=2048 - hop)[2])
    flux = np.maximum(0, np.diff(np.log1p(S), axis=1)).sum(axis=0); flux -= flux.mean()
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    fps = sr / hop; lags = np.arange(len(ac)) / fps
    bpm = 60 / lags[1:]; ok = (bpm > 70) & (bpm < 160)
    best = np.argsort(ac[1:][ok])[::-1][:3]
    cands = [round(float(bpm[ok][i]), 1) for i in best]
    rms = 20 * np.log10(np.sqrt((m ** 2).mean()) + 1e-9)
    print(f, f"{len(m)/sr:.1f}s", "bpm~", cands, f"rms {rms:.1f} dBFS")
