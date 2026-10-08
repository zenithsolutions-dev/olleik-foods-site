"""Writes videos/audio-library/LICENSES.md: every audio file the promo can use, with source URL, licence and the
evidence file. No file enters a cut without an entry here (bank.py only references files listed by this script).

  python audio/licenses.py
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bank  # noqa: E402

LIB = os.path.join(os.path.dirname(__file__), "..", "audio-library")
KENNEY_PAGES = {
    "kenney_ui-audio": ("UI Audio", "https://kenney.nl/assets/ui-audio", "https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip"),
    "kenney_interface-sounds": ("Interface Sounds", "https://kenney.nl/assets/interface-sounds", "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip"),
    "kenney_impact-sounds": ("Impact Sounds", "https://kenney.nl/assets/impact-sounds", "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip"),
    "kenney_digital-audio": ("Digital Audio", "https://kenney.nl/assets/digital-audio", "https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney_digital-audio.zip"),
}


def main():
    idx = json.load(open(os.path.join(LIB, "raw", "mixkit-index.json")))
    lic = os.path.join(LIB, "licenses")
    os.makedirs(lic, exist_ok=True)
    for pack in KENNEY_PAGES:
        src = os.path.join(LIB, "_src", pack, "License.txt")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(lic, f"{pack}-License.txt"))
    rows_k, rows_m = [], []
    seen = set()
    for role, items in bank.BANK.items():
        for src, name in items:
            if (src, name) in seen:
                continue
            seen.add((src, name))
            if src == "kenney":
                pack, base = name.split("/")
                title, page, z = KENNEY_PAGES[pack]
                rows_k.append(f"| {base}.ogg | {role} | Kenney · {title} | {page} (zip: {z}) | CC0 1.0 | licenses/{pack}-License.txt |")
            else:
                it = idx.get(name, {})
                rows_m.append(f"| mixkit-{name}.wav | {role} | Mixkit #{name} “{it.get('title', '')}” | {it.get('page', 'https://mixkit.co/free-sound-effects/')} (file: {it.get('wav', f'https://assets.mixkit.co/active_storage/sfx/{name}/{name}.wav')}) | Mixkit Sound Effects Free License | licenses/mixkit-sfx-free-license-2026-10-05.txt / .jpg |")
    L = [
        "# Audio Licences (Olleik Foods videos)",
        "",
        "Every audio file the promo can use is listed here with its source, its licence and the saved licence evidence. Sources were",
        "checked on 2026-10-05 when the toolkit sourced them; the same files and the saved licence evidence were copied into this project on 2026-10-08 (no new downloads). Accepted: CC0 / public domain, and licences that explicitly allow commercial video and online",
        "advertising without attribution and without a login. Rejected: CC-BY, CC-BY-SA, NC, anything unclear, and anything behind",
        "a login. Raw files are kept out of git (Mixkit forbids redistributing items on their own); they live in",
        "`videos/audio-library/raw/` and `videos/audio-library/_src/` on this machine.",
        "",
        "## Licences in short",
        "",
        "- **Kenney (CC0 1.0)**: “free to use in personal, educational and commercial projects”; crediting is optional. Licence files copied from each pack.",
        "- **Mixkit Sound Effects Free License**: commercial and non-commercial use, explicitly including *online marketing ads*,",
        "  social media, YouTube, TV and radio; no attribution; the item may not be redistributed on its own, as stock, or registered",
        "  on a rights management service. Text and screenshot saved 2026-10-05.",
        "- **GeneralUser GS 2.0.3 SoundFont** (S. Christian Collins, https://github.com/mrbumpy409/GeneralUser-GS): “You may use",
        "  GeneralUser GS without restriction for your own music creation, private or commercial.” The author notes he cannot be 100 %",
        "  sure of the origin of every sample (none from commercial packages) and has never had a complaint since 2000. Recorded as a",
        "  residual risk in the report. Licence: licenses/GeneralUser-GS-LICENSE.txt.",
        "- **FluidSynth 2.6.1** (https://github.com/FluidSynth/fluidsynth, LGPL-2.1): the synthesiser program that renders our MIDI with",
        "  the SoundFont. A tool, not audio content; its licence puts no condition on the audio it renders.",
        "- **Our own work**: every MIDI composition, arrangement, the mix and the edits (code in `videos/audio/`).",
        "",
        "## Music",
        "",
        "| Candidate | How it is made | Licence |",
        "|---|---|---|",
    ]
    import music2

    for cid, c in music2.CANDIDATES.items():
        L.append(f"| {cid} “{c['title']}” ({c['bpm']} BPM) | Original MIDI composed in code (`audio/music2.py`), rendered with FluidSynth + GeneralUser GS (GM programs: kit {c['kit']}, bass {c['bass']}, keys {c['keys']}, pad {c['pad']}, lead {c['lead']}/{c['lead2']}) | Ours + GeneralUser GS licence |")
    L += [
        "",
        "## Sound effects: Kenney (CC0)",
        "",
        "| File | Role | Pack | Source | Licence | Evidence |",
        "|---|---|---|---|---|---|",
        *sorted(rows_k),
        "",
        "## Sound effects: Mixkit",
        "",
        "| File | Role | Item | Source | Licence | Evidence |",
        "|---|---|---|---|---|---|",
        *sorted(rows_m),
        "",
        "Keystroke “clacks” are short slices (about 90 ms each) cut from Mixkit #1388 “Keyboard random typing”, #1386 “Keyboard typing”,",
        "#1387 “Fast keyboard typing”, #1390 “Hard typing” and #2538 “Hard laptop keyboard typing” (all listed above where used as",
        "sources), combined with Kenney switch recordings into blue-switch keystrokes. Permitted: the Mixkit licence allows modifying",
        "items inside a larger end product.",
        "",
        "Rejected while sourcing: Mixkit #1144 and #2354 (download refused, HTTP 403, not used); OpenGameArt “Keyboard Soundpack #1”",
        "(CC0 but a membrane keyboard, not blue-switch; not used); Pixabay (blocked, HTTP 403); Freesound (login required).",
    ]
    for extra in (1386, 1387, 1388, 1390, 2538):
        if not any(r.startswith(f"| mixkit-{extra}.wav") for r in rows_m):
            it = idx.get(str(extra), {})
            L.insert(L.index("## Sound effects: Mixkit") + 4, f"| mixkit-{extra}.wav | key_clack_src | Mixkit #{extra} “{it.get('title', '')}” | {it.get('page', '')} (file: https://assets.mixkit.co/active_storage/sfx/{extra}/{extra}.wav) | Mixkit Sound Effects Free License | licenses/mixkit-sfx-free-license-2026-10-05.txt / .jpg |")
    open(os.path.join(LIB, "LICENSES.md"), "w", encoding="utf8").write("\n".join(L) + "\n")
    print(os.path.join(LIB, "LICENSES.md"), len(rows_k), "Kenney,", len(rows_m), "Mixkit rows")


if __name__ == "__main__":
    main()
