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


def higgsfield_section():
    """V3 (Gate E): every Higgsfield generation, from videos/higgsfield/ledger.json (exact prompts there and in
    higgsfield/prompts_people_music_hooks.json)."""
    led = json.load(open(os.path.join(os.path.dirname(LIB), "higgsfield", "ledger.json"), encoding="utf8"))
    out = [
        "",
        "## Higgsfield generations (V3/V3.2, generated 2026-10-11 to 2026-10-12 on the owner's account; recorded before use)",
        "Narration (kind `narration`, `voice-test`): Higgsfield speech, model seed_audio, preset voice \"Holden\"",
        "(3c9d6053-6334-592c-8997-4e325286af3f), chosen by the owner; generated under the owner's per-project exception of",
        "2026-10-12 to the playbook's \"never generate voice\" rule (logged in the video-factory PROPOSED_RULE_CHANGES.md). One WAV",
        "per line in videos/narration/audio/ (text: narration/VISITOR.json, ADMIN.json); rejected takes in narration/audio/rejected/.",
        "Terms: Higgsfield Terms of Use §4.4 — Higgsfield claims no ownership of outputs and does not restrict their commercial",
        "use; outputs may not be used to train AI models (§5.1(iii), §5.2(iv)); no likeness/IP infringement (§5.1(ii)(b), §5.3).",
        "Evidence: licenses/higgsfield-terms-2026-10-11.txt. All people are original characters generated from text (no real",
        "person's photo was uploaded); all products are generic, unbranded; prompts forbid text, logos and plates.",
        "Model column: the model requested (the API reports nano_banana_pro jobs as `nano_banana_2`). Full prompts: higgsfield/ledger.json.",
        "",
        "| Generation id | Kind | Model | Date | File (local, not in git) | Product / note |",
        "|---|---|---|---|---|---|",
    ]
    for e in sorted(led, key=lambda e: (e.get("kind", ""), e.get("file", ""))):
        note = e.get("product") or e.get("status") or ""
        model = e.get("model_requested") or e.get("model")
        out.append(f"| {e['job_id']} | {e.get('kind', '')} | {model} | {e.get('date', '')} | {e.get('file', '').replace('videos/', '')} | {note} |")
    out.append("")
    out.append(f"{len(led)} Higgsfield generations recorded. Elements: olleik-demo-catalog-style 310febdd-c4a9-499d-be0b-cc30b46b9e5f, olleik-marco 2f647b1b-7746-4ecd-9510-49fb41c197e7, olleik-salma ce092dc3-a897-47f2-a82c-5e5b7f773e9a, olleik-driver 93840d9d-15f2-4d88-92b9-3e71f5a93a9d.")
    return out


def main():
    idx = json.load(open(os.path.join(LIB, "raw", "mixkit-index.json")))
    lic = os.path.join(LIB, "licenses")
    os.makedirs(lic, exist_ok=True)
    for pack in KENNEY_PAGES:
        src = os.path.join(LIB, "_src", pack, "License.txt")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(lic, f"{pack}-License.txt"))
    rows_k, rows_m, rows_o = [], [], []
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
            elif src == "oga":
                rows_o.append(f"| {name}.mp3 | {role} | OpenGameArt “Various Paper Sound Effects” | https://opengameart.org/content/various-paper-sound-effects (file: https://opengameart.org/sites/default/files/{name}.mp3) | CC0 1.0 | licenses/opengameart-various-paper-sound-effects-CC0.txt |")
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
        "## Sound effects: OpenGameArt (CC0)",
        "",
        "| File | Role | Item | Source | Licence | Evidence |",
        "|---|---|---|---|---|---|",
        *sorted(rows_o),
        "",
        "## V2 sounds (sourced 2026-10-09 for the story film, all with licences recorded above before use)",
        "",
        "- Door bell: Mixkit #2864 “Doorbell tone”, #333 “Doorbell single press” (also the end-card bell, pitched down).",
        "- Stapler: Mixkit #2995 “Stapling paper” (the paper-snap layer of the rubber stamp).",
        "- Tape: Mixkit #3102 “Duct tape bandage”.",
        "- Paper tear: OpenGameArt “Various Paper Sound Effects”, paper_ripped_-_1.mp3 (CC0).",
        "- Thermal printer: Mixkit #2383 “Paper scroll in an office” (real paper feed, looped over the print time) plus a faint",
        "  synthesised stepper-motor chirp (−32 dB). No real thermal-printer recording with a clear licence was found on Mixkit,",
        "  Kenney or OpenGameArt.",
        "- Phone buzz: a synthesised 165 Hz vibration-motor hum (on/off pattern of a phone) layered with REAL rattles of a hard",
        "  object on a counter (Kenney Impact Sounds, CC0). No phone-vibration recording with a clear licence was found.",
        "- Knife on a board: Mixkit #2152 “Quick knife slice cutting” refused the download (HTTP 403); replaced by a real light",
        "  wood impact (Kenney impactWood_light, CC0). Not used: Mixkit #2152.",
        "- Box thuds, stamp body and punch, footsteps, mug: Kenney Impact Sounds (CC0), listed above.",
        "- Room tone: synthesised (very low brown noise, low-passed), about 34 dB under the effects.",
        "- Problem-card pluck and the episodes' two-note “coming up” sting: rendered by the music engine (FluidSynth + GeneralUser GS).",
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
    L += higgsfield_section()
    open(os.path.join(LIB, "LICENSES.md"), "w", encoding="utf8").write("\n".join(L) + "\n")
    print(os.path.join(LIB, "LICENSES.md"), len(rows_k), "Kenney,", len(rows_m), "Mixkit,", len(rows_o), "OpenGameArt rows")


if __name__ == "__main__":
    main()
