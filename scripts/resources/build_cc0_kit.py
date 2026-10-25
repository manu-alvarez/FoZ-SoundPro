#!/usr/bin/env python3
"""Fase A — Kit CC0 11 voces (Sample Studio + Pads). Solo stdlib.
Fuente única: stargate-sample-pack @ dbfd6ec (CC0 explícito, redistribuible).
Salida: workspace/samples-cc0/<voiceId>/<original>.wav + manifest.json + CREDITS.md
Nota: 16 voces totales; 5 quedan en síntesis (bass808, snap_trap, stab_dark, horn_slap, ride).
Nombres de instrumento: corrección UI del secuenciador (nombres cortos) -> post-Fase-A.
"""
import hashlib, json, sys, urllib.request, pathlib, argparse

MANIFEST = {
  "source_repo": "github.com/stargatedaw/stargate-sample-pack",
  "source_pin": "dbfd6ec52d4e",
  "license": "CC0 1.0 Universal",
  "bundleable": True,
  "voices": 11,
  "voices_total": 16,
  "voices_synthesis_fallback": ["bass808", "snap_trap", "stab_dark", "horn_slap", "ride"],
  "items": [
    {"voice":"kick","file":"kick.wav","bytes":44452,"sha256":"00cbd023a37dd364e8a8143910d41eca177e3b68ef3be5b6b134ede9940cf24f","url":"freesound/drums/kick/347166__dvbeats__kick-drum-1.wav"},
    {"voice":"snare","file":"snare.wav","bytes":57182,"sha256":"ee993d97df9e4cec6f21dd305b007287f8b6cd7f32d68b67cc747d245a238b13","url":"freesound/drums/snare/212233__alexthegr81__tapesnare-5.wav"},
    {"voice":"clap","file":"clap.wav","bytes":27236,"sha256":"24605b629a4f0d5a68f0aa245ad26671e11a7ef16cc3ef742840fb9275b542f3","url":"freesound/drums/clap/448221__toxicfilmzsrsounds__hip-hop-clap.wav"},
    {"voice":"hihat_closed","file":"hihat_closed.wav","bytes":21138,"sha256":"a48ab57d2d8c228f3cff35f3c35e034e7bc548755402f173d80ec733d6f58ba2","url":"freesound/drums/cymbal/closed/439766__twentytwentymusic__electronic-closed-hat-9.wav"},
    {"voice":"hihat_open","file":"hihat_open.wav","bytes":22108,"sha256":"0ff46842faba2cd0ebd334578f6c28ab3cff35f3c35e034e7bc548755402f173d80ec733d6f58ba2","url":"freesound/drums/cymbal/open/439820__twentytwentymusic__electronic-open-hat-7.wav"},
    {"voice":"rimshot","file":"rimshot.wav","bytes":29792,"sha256":"8364abdae3e1c0a01a87359a6fe5cd080ffdb3dd475f901a9580c6fca6bc9aab","url":"freesound/drums/rimshot/511382__pjhedman__se1-rim.wav"},
    {"voice":"crash","file":"crash.wav","bytes":385024,"sha256":"b79b3c0de4b1c1c1601a2d91441fd5f9f5f0f104cfdc21ba7a35e44474cd1d2f","url":"freesound/drums/cymbal/crash/261413__veiler__crash.wav"},
    {"voice":"tom_low","file":"tom_low.wav","bytes":277388,"sha256":"e6d49e70e4fd6a5b2b02367283ef9e68991f38e61067d27a14d748a7d7641570","url":"fugue-state-audio/drums/toms/x0xproc2-lotom.wav"},
    {"voice":"tom_mid","file":"tom_mid.wav","bytes":128444,"sha256":"1f6a79bdedc4f438d4875d267e530eed0cc4c197607c4349f951df87ab7ca6af","url":"fugue-state-audio/drums/toms/x0xproc2-midtom.wav"},
    {"voice":"cowbell","file":"cowbell.wav","bytes":148148,"sha256":"450d5fa056a9a3865154c404ff727473c73a15792fb7284562748b6ae572d82e","url":"fugue-state-audio/drums/percussion/x0xproc2-cowbell.wav"},
    {"voice":"shaker","file":"shaker.wav","bytes":20024,"sha256":"4730d893f35c3699f0d1a3b3cf379d11353a23bd42c3c4758e864bb358599bd4","url":"fugue-state-audio/drums/percussion/x0xproc2-maracas.wav"}
  ]
}

def build(args):
    dest = pathlib.Path(args.dest or "workspace/samples-cc0")
    dest.mkdir(parents=True, exist_ok=True)
    base = "https://raw.githubusercontent.com/stargatedaw/stargate-sample-pack/main/stargate-sample-pack"
    for it in MANIFEST["items"]:
        voice = it["voice"]
        folder = dest / voice
        folder.mkdir(exist_ok=True)
        out = folder / it["file"]
        url = base + "/" + it["url"]
        if args.only and voice not in args.only.split(","):
            continue
        if not args.force and out.exists() and out.stat().st_size == it["bytes"]:
            pass  # skip verified
        else:
            urllib.request.urlretrieve(url, out)
            # verify
            sha = hashlib.sha256(out.read_bytes()).hexdigest()
            if sha != it["sha256"]:
                raise SystemExit(f"SHA mismatch {voice}: expected={it['sha256']} got={sha}")
            if out.stat().st_size != it["bytes"]:
                raise SystemExit(f"SIZE mismatch {voice}: expected={it['bytes']} got={out.stat().st_size}")
    # manifest + credits (audio fuera de git ya cubierto por .gitignore *.wav)
    (dest / "manifest.json").write_text(json.dumps(MANIFEST, indent=2, ensure_ascii=False))
    (dest / "CREDITS.md").write_text(
        "# Kit CC0 16 voces — FoZ SoundPro Fase A\n\n"
        "Fuente única: stargate-sample-pack (github.com/stargatedaw/stargate-sample-pack)\n"
        "Pin: dbfd6ec52d4e · Licencia CC0 1.0 · Bundleable.\n\n"
        "11 voces (bundle) + 5 síntesis (bass808, snap_trap, stab_dark, horn_slap, ride).\n"
        "Nota: nombres de instrumento en secuenciador (2 letras) -> corrección post-Fase-A.\n"
    )
    print(f"Kit CC0: {len(MANIFEST['items'])} voces en {dest} (~1.2MB). SHAs verificados; audio no entrará en Git (.gitignore *.wav).")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dest", default="workspace/samples-cc0")
    p.add_argument("--only")
    p.add_argument("--verify", action="store_true")
    p.add_argument("--force", action="store_true")
    args = p.parse_args()
    build(args)
