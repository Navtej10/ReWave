// Test env shim: the default Vitest `node` environment has no `location`, but
// `buildInviteLink` (and its test) read `location.origin`. Provide a stable one.
if (typeof (globalThis as { location?: unknown }).location === "undefined") {
  (globalThis as { location?: unknown }).location = new URL("http://localhost/");
}
