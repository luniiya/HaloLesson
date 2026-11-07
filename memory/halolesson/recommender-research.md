---
name: recommender-research
description: 2026-11-07 first research pass for the question recommender - FSRS, Duolingo HLR, Elo, misconception diagnosis, and a sandbox idea for generators
type: reference
---

*(as of 2026-11-07)* First pass, from web search summaries only. I haven't read the full papers or the code yet.

- **FSRS** (Jarrett Ye, 2022; optional in Anki since 23.10). Each card has a memory state: difficulty, stability (days until recall drops to 90%) and retrievability (the current chance of recall). The FSRS-5 forgetting curve is R = (1 + 19/81 · t/S)^-0.5. Code is at github.com/open-spaced-repetition; ts-fsrs is the TypeScript version.
- **Duolingo HLR** (Settles & Meeder, ACL 2016). Half-life regression predicts how long a word stays remembered from its practice history. It cut prediction error by 45%+ against baselines and raised daily engagement by 12%. Code: github.com/duolingo/halflife-regression. The model's weights also show which concepts are hard for learners.
- **Elo for learning** (Pelánek, Computers & Education 2016; UMUAI 2017). Each answer is treated as a match between the learner and the item, which gives a running estimate of the learner's skill and of each item's difficulty. It is simple and robust. Its weakness is that plain Elo handles learning over time badly (arXiv 1910.12581 proposes M-Elo).
- **Diagnosing the struggle**: a Q-matrix tags which concepts each item needs. Wrong options can be tagged with the misconception they reveal (MC-DINA/DINO models, Behaviormetrika 2020).
- **Idea for generators**: run agent-written JS inside QuickJS-in-WASM on the server, with no filesystem or network access, CPU and memory limits, and a seeded RNG.

Related: [[skill-levels-vision]]
