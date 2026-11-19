// The web config is public by design; Firestore rules are what protect the data.
export const firebaseConfig = {
  apiKey: 'AIzaSyAWqYqYB3vwf6iyVgUy1Uus55DSxuFabFc',
  authDomain: 'darood-e-pak-b94f4.firebaseapp.com',
  projectId: 'darood-e-pak-b94f4',
  storageBucket: 'darood-e-pak-b94f4.firebasestorage.app',
  messagingSenderId: '891018198775',
  appId: '1:891018198775:web:85b6019341727a05b49df2',
};
export const ADMIN_UID = 'AIKhgA4DhzMgksgpM7zNBwvf9Sj1';

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
