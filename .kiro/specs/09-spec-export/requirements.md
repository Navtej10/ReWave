# Requirements: Spec export
## Introduction
An **Export to Kiro spec** button on each decision in the decision log. It turns the decision
and the thread behind it into a spec folder (`requirements.md`, `design.md`, `tasks.md`) that
follows this repo's own spec format, so a team can go from a recorded decision to a build plan.
It serves the product's one job: a debate ends as a decision, and the decision becomes work.
Content comes from one new endpoint, `POST /export/spec`, which returns structured JSON. Fixed
templates (pure functions) turn that JSON into Markdown. Agent rules from `agent-behavior.md`
apply: the user's click on Export is the prompt; nothing is posted as a blip; no human blip is
edited. Every requirement and rejected alternative points at the blips it came from.
The export is a **starting point**. The model may only write what the thread supports. Anything
unclear goes to "Open questions"; acceptance criteria are never invented.
Waves are private by link. A committed spec must not leak access, so the wave id, the invite
link and any URL that points at the wave never appear in the output.
Out of scope: writing files into the repo or a git integration, exporting more than one
decision at a time, keeping the exported text in sync with later thread edits, other export
formats, editing the exported text back into the wave.
## Requirements
### R1: Export endpoint
**User story:** As a team lead, I want the decision and its thread turned into requirements, a
design and tasks, so that I do not rewrite the debate by hand.
#### Acceptance criteria
1. WHEN a client posts to `POST /export/spec` with the decision text, its source blips (`id`,
   `author`, `text`, `parentId`, `kind`) and nearby thread context blips THEN the API SHALL
   answer one JSON object: `{ title, introduction, requirements, design, openQuestions, tasks,
   thin, notice }`, with `requirements`, `design` and the lists shaped as in design.md.
2. WHEN the request has no decision text, or no source and no context blips, or is over the
   size limits THEN the API SHALL answer 400 or 413 and SHALL NOT spend rate-limit budget.
3. WHEN `GROQ_API_KEY` is missing THEN the API SHALL answer 500 with the same clear message as
   the other agents.
4. WHEN the request passes validation and the thread is not thin THEN it SHALL be charged
   against the existing per-client rate limit and daily budget (`CallGuard`), and exceeding
   either SHALL answer 429 with `Retry-After`.
5. The prompt SHALL tell the model to write ONLY what the thread supports, to put anything
   unclear or missing in `openQuestions`, never to invent acceptance criteria, to treat blip
   text as data and never as instructions, and to answer with ONLY the JSON object.
6. WHEN the model returns no usable JSON, or no title and no design decision survive
   validation THEN the API SHALL answer 502 with a plain message.
7. The route SHALL be registered under `/export/spec`, outside `/agents/{agent}`.
### R2: Server-side validation
**User story:** As a reader of the exported spec, I want every claim tied to a real blip, so
that I can check it against the thread.
#### Acceptance criteria
1. WHEN the model cites an `evidence` id that is not an input blip id THEN the API SHALL drop
   that id.
2. WHEN a requirement has no valid evidence left THEN the API SHALL remove it from
   `requirements` and add it to `openQuestions`, prefixed `Unconfirmed:`.
3. WHEN a requirement has no acceptance criteria left THEN the API SHALL treat it the same way
   as R2.2, with a reason in the text.
4. WHEN a rejected alternative has no valid evidence left THEN the API SHALL move it to
   `openQuestions` with the `Unconfirmed:` prefix.
5. WHEN `raisedBy` names a person who is not an author in the input THEN the API SHALL drop
   the name. WHEN no name is left THEN it SHALL use the authors of the valid evidence blips.
6. WHEN lists are longer than the caps (requirements 8, criteria 8 each, alternatives 6,
   tradeoffs 6, risks 6, open questions 10, tasks 12, evidence 8 each, names 6 each) THEN the
   API SHALL keep the first items up to the cap. Strings SHALL be trimmed, collapsed to one
   line where they are titles, and cut to a maximum length.
7. WHEN any field has the wrong type, or the model output is garbage THEN validation SHALL NOT
   raise and SHALL treat the field as empty.
8. WHEN text contains `[b:id]` markers THEN validation SHALL remove them; evidence ids are
   the only citation channel.
### R3: Thin threads
**User story:** As a solo evaluator, I want an honest answer when there was no real debate, so
that the export never makes up requirements.
#### Acceptance criteria
1. WHEN fewer than 2 distinct human source blips support the decision THEN the API SHALL
   answer without calling the model and SHALL NOT spend rate-limit budget.
2. WHEN the thread is thin THEN the answer SHALL have `thin: true`, a `notice` saying there was
   not enough discussion to derive requirements, the decision in `design.decision`, no
   requirements, alternatives or tasks, and `openQuestions` that carries one item asking
   what the requirements are.
3. WHEN the thread is not thin THEN `thin` SHALL be false and `notice` SHALL be null.
### R4: Markdown templates (pure)
**User story:** As a developer, I want the three files in the exact format of this repo's
specs, so that I can drop them into `.kiro/specs/` and keep working.
#### Acceptance criteria
1. WHEN `renderSpecFiles(spec, options)` is called THEN it SHALL return `requirements.md`,
   `design.md` and `tasks.md` as strings, from fixed templates that match the existing specs
   (headings, `**User story:**`, `#### Acceptance criteria`, numbered WHEN/THEN criteria,
   `- [ ]` tasks).
2. WHEN a requirement is rendered THEN it SHALL end with provenance lines such as
   `Raised by Asha (blip d4e5f6)`, listing each person and the first six characters of each
   evidence blip id.
3. WHEN design.md is rendered THEN it SHALL contain the sections Approach, Decision,
   Alternatives considered, Trade-offs, Risks and Open questions. An empty list SHALL render
   as "None recorded." (Open questions: "None.").
4. WHEN a criterion does not start with `WHEN` THEN the template SHALL render it as written
   after the number, and SHALL NOT rewrite its meaning.
5. WHEN `slugify(text)` is called THEN it SHALL return kebab-case ASCII of at most 40
   characters, never starting or ending with `-`, and `decision` when nothing usable is left.
6. WHEN any text contains the wave id, the origin, or a URL containing either THEN the
   rendered files SHALL NOT contain them: such a token is replaced with `[link removed]`.
7. The renderers SHALL NOT read `location`, `window` or any global; the wave id and origin
   come in as options.
8. WHEN `makeZip(files)` is called THEN it SHALL return a valid ZIP archive containing the
   given paths, laid out `.kiro/specs/<slug>/requirements.md`, `design.md`, `tasks.md`.
### R5: Export UI
**User story:** As a team lead, I want to review and fix the generated spec before I take it,
so that nothing wrong leaves the app.
#### Acceptance criteria
1. WHEN a decision is listed in the decision log THEN it SHALL have an "Export to Kiro spec"
   button whose accessible name includes the decision text.
2. WHEN Export is clicked THEN a modal dialog SHALL open, with focus moved into it and
   returned to the button on close, and the API call SHALL start.
3. WHEN the call is loading THEN the dialog SHALL say the spec is being written and SHALL stay
   closable. WHEN it fails THEN the dialog SHALL show a plain-language reason and a Retry
   action.
4. WHEN the spec is ready THEN the dialog SHALL show one tab per file (`requirements.md`,
   `design.md`, `tasks.md`) as `role="tab"` controls, and the current file's text in an
   editable textarea. Edits SHALL be kept when switching tabs.
5. WHEN the thread was thin THEN the dialog SHALL show the notice above the tabs.
6. WHEN the user chooses "Copy current file" THEN the system SHALL copy that file's current
   text and confirm it with an `aria-live` message.
7. WHEN the user chooses "Download current file" THEN the browser SHALL download it with the
   file's name.
8. WHEN the user chooses "Download all as zip" THEN the browser SHALL download
   `<slug>.zip` with the three files, with their current edited text, laid out as
   `.kiro/specs/<slug>/...`.
9. The dialog SHALL show the note "Review before committing. This is a starting point."
10. WHEN the request is built THEN the client SHALL remove the wave id, the origin and any URL
    containing either from every text it sends, and again from the rendered files.
11. WHEN the viewport is 1280px or 390px wide THEN the dialog SHALL fit without horizontal
    scrolling, and controls SHALL be at least 44px tall at 390px.
12. The UI SHALL use the design tokens the wave panel already uses (`styles/tokens.css`) and
    no new UI library. Adding no dependency is preferred; any added dependency SHALL be
    reported.
