// Standalone LLM worker. Runs in a child process via `child_process.fork()`.
//
// Why a child process? node-llama-cpp's Metal backend (b8390) has a
// reproducible null-pointer segfault in `state_seq_get_data` triggered by
// `AddonContextSequenceCheckpointInitWorker` during sequence init on Apple
// Silicon. A native segfault in the main process kills Electron entirely —
// the recording, the transcript, all unsaved state. Isolating LLM work in a
// child means a segfault here just exits this child with SIGSEGV; the parent
// catches the non-zero exit, marks the meeting status=error, and the app
// keeps running.
//
// Protocol: parent sends one `{type:"generate", payload:{...}}` message,
// worker streams `{type:"progress", stage, pct, note?, model?}` messages,
// then exactly one `{type:"result", raw}` or `{type:"error", message}` and
// exits.

const PROGRESS = (stage, pct, note, model) => {
  if (!process.send) return;
  process.send({ type: "progress", stage, pct, note, model });
};

async function handleGenerate(payload) {
  const {
    modelPath,
    prompt,
    schema,
    maxTokens,
    temperature,
    contextSize,
    badge,
  } = payload;

  PROGRESS("loading", 30, undefined, badge);
  const { getLlama, LlamaChatSession, LlamaJsonSchemaGrammar } = await import(
    "node-llama-cpp"
  );
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath });
  const ctx = await model.createContext({ contextSize });

  // checkpoints disabled — the InitWorker that crashes lives in the
  // checkpoint init path. Even if `interval: false` alone doesn't suppress
  // it, `max: 0` removes the storage entirely; together they minimize the
  // surface. Process isolation is what actually saves us if it still crashes.
  const seq = ctx.getSequence({
    checkpoints: { max: 0, interval: false },
  });
  const session = new LlamaChatSession({ contextSequence: seq });

  PROGRESS("generating", 55, undefined, badge);
  const grammar = new LlamaJsonSchemaGrammar(llama, schema);
  const startedAt = Date.now();
  const raw = await session.prompt(prompt, {
    grammar,
    maxTokens,
    temperature,
  });
  const durationMs = Date.now() - startedAt;

  PROGRESS("writing", 90, undefined, badge);

  // Best-effort token counts via the model's own tokenizer. The numbers are
  // close enough for budget reporting (the actual generation may pick
  // slightly different tokens at the margin, but the count matches what
  // the model "sees"). Wrapped in try/catch because tokenize() can throw on
  // models with non-standard tokenizers we haven't encountered yet — losing
  // the counts is preferable to losing the whole generation.
  let inputTokens;
  let outputTokens;
  try {
    inputTokens = model.tokenize(prompt).length;
    outputTokens = model.tokenize(raw).length;
  } catch {
    /* leave undefined */
  }

  // Send result BEFORE dispose. If dispose triggers the segfault, the parent
  // has already received the data and can persist it.
  if (process.send) {
    process.send({
      type: "result",
      raw,
      inputTokens,
      outputTokens,
      durationMs,
    });
  }

  try {
    await ctx.dispose();
  } catch {
    /* ignore */
  }
  try {
    await model.dispose();
  } catch {
    /* ignore */
  }
}

process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type !== "generate") return;
  handleGenerate(msg.payload).then(
    () => process.exit(0),
    (err) => {
      if (process.send) {
        process.send({
          type: "error",
          message: err && err.message ? err.message : String(err),
          stack: err && err.stack,
        });
      }
      process.exit(1);
    },
  );
});

// If the parent dies without telling us, exit too — no point lingering.
process.on("disconnect", () => process.exit(0));
