// The Apprentice's Ledger: everything the visitor has made and earned,
// kept in localStorage and never sent anywhere.

const KEY = 'altlab-ledger-v1';
const MAX_PRINTS = 36;

const blank = () => ({
  began: null,       // ISO date of first visit to the lab
  onboarded: false,  // has read the Master's welcome letter
  sound: false,
  prints: [],        // { process, ts, verdict, params, thumb }
  seals: {},         // processId -> ISO ts
  commissions: {},   // commissionId -> ISO ts
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch (e) { /* private mode or corrupt store: start fresh */ }
  return blank();
}

let state = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* full or blocked */ }
}

export const ledger = {
  get: () => state,

  // another page (the ledger, in an atelier overlay) may have written
  reload() { state = load(); },

  begin() {
    if (!state.began) { state.began = new Date().toISOString(); persist(); }
  },

  setOnboarded() { state.onboarded = true; this.begin(); persist(); },
  onboarded: () => state.onboarded,

  soundOn: () => state.sound,
  setSound(on) { state.sound = !!on; persist(); },

  savePrint(print) {
    state.prints.unshift({ ts: new Date().toISOString(), ...print });
    while (state.prints.length > MAX_PRINTS) state.prints.pop();
    this.begin();
    persist();
  },
  removePrint(ts) {
    state.prints = state.prints.filter((p) => p.ts !== ts);
    persist();
  },

  hasSeal: (id) => !!state.seals[id],
  grantSeal(id) {
    if (state.seals[id]) return false;
    state.seals[id] = new Date().toISOString();
    persist();
    return true; // newly earned
  },
  sealCount: () => Object.keys(state.seals).length,

  fulfilled: (id) => !!state.commissions[id],
  fulfil(id) {
    if (state.commissions[id]) return false;
    state.commissions[id] = new Date().toISOString();
    persist();
    return true;
  },
};
