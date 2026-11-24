# Next steps

This folder is one export. It holds four files:

1. `Life-Archive.md` — the raw evidence. Do not edit it; it is the source of truth.
2. `Distillation-Brief.md` — hand the whole thing to a strong model (Claude / GPT / DeepSeek and so on) and have it work through the steps to produce `persona.md`.
3. `Coverage-Report.md` — which chapters are still thin, and what to add in the next round.
4. `Answers-Backup.json` — the raw answers; import them when you change computers or reinstall.

## Recommended workflow

1. Paste the full text of `Distillation-Brief.md` to the model, get a first version of `persona.md`, and save it under `exports/`.
2. Drop `persona.md` into the `{{PERSONA}}` slot in `twin/system_prompt.md`.
3. Run the blind test in `twin/exam.md`: have the twin answer 20 questions that never appear in the archive, and score each one yourself.
4. Write the places where it "doesn't sound like you" into `twin/calibration.md`, then have the model do one targeted revision. Do not rewrite the whole thing.
5. Repeat 3–4 until facts, tone and judgment all hold steady at 4 or above.

A digital twin is not generated in one go; it is calibrated into being.
