# Agent behavior (hard rules)

1. Agents (@scribe, @skeptic, @researcher) speak ONLY when a human @-mentions them. No unprompted posts. (This is the lesson from Clippy.)
2. Every claim cites its source blip as [b:<id>]. Citations that do not match a real blip id are dropped server-side.
3. Agent output is short: scribe max ~200 words, skeptic max 3 sentences.
4. Agents never edit human blips. They only add new blips as replies.
5. If the thread is empty or the API key is missing, return a clear error telling the user what to do.
