// SETUP (see SETUP.md): paste the Firebase web config and Ahmed's admin uid here.
// The web config is public by design; Firestore rules are what protect the data.
export const firebaseConfig = null;
export const ADMIN_UID = 'ADMIN_UID';

// Local testing against the Firebase emulator: http://localhost:8795/?emu
export const EMU = {
  config: { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-darood', appId: 'demo' },
  adminUid: 'admin-uid',
};

// The Darood texts people can pick from (Q93). PLACEHOLDER until Ahmed sends the exact wording:
// no religious text is typed from memory. Each: { name, ar, en, ur }.
export const DAROODS = [
  { name: 'Darood 1 (placeholder)', ar: '', en: '', ur: '' },
  { name: 'Darood 2 (placeholder)', ar: '', en: '', ur: '' },
];

export const FIRST_YEAR = 2026; // the app's history starts here
