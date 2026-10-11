import glob, os, numpy as np, soundfile as sf
from scipy import signal
from PIL import Image, ImageDraw
rows = []
for f in sorted(glob.glob("music/wav/*.wav")):
    x, sr = sf.read(f); m = x.mean(axis=1)
    fr, t, S = signal.spectrogram(m, sr, nperseg=2048, noverlap=1536)
    S = 10 * np.log10(S + 1e-12); keep = fr < 8000; S = S[keep][::-1]
    S = np.clip((S - (S.max() - 80)) / 80, 0, 1)
    im = Image.fromarray((S * 255).astype(np.uint8)).resize((1400, 220))
    ImageDraw.Draw(im).text((5, 5), os.path.basename(f), fill=255)
    rows.append(im)
c = Image.new("L", (1400, 230 * len(rows)))
for i, r in enumerate(rows): c.paste(r, (0, i * 230))
c.save("music/spectrograms.png")
