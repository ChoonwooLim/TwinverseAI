// Diagnostics for development builds only. Production keeps warnings and errors, which report
// real problems (a missing file, a GPU error), and drops the informational lines.
export const devInfo = import.meta.env.DEV ? (...args) => console.info(...args) : () => {};
