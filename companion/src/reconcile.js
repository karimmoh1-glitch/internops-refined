// The state-machine decision for OFF_WORK / WORK_MODE reconciliation,
// pulled out as a pure function so it's testable without an Electron
// runtime. Given what the server says is true (an active session exists
// or not) and what the local tracker currently believes, decide the one
// action that brings them back in sync — this is the boundary that
// prevents both "server ended it, client kept sampling" and "server has
// an active session, client's tracker died/restarted and isn't sampling."
function reconcileTrackingState(serverHasActiveSession, locallyTracking) {
  if (serverHasActiveSession && !locallyTracking) return "start";
  if (!serverHasActiveSession && locallyTracking) return "stop";
  return "none";
}

module.exports = { reconcileTrackingState };
