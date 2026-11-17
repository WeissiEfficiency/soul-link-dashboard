// Einstellungen dieser Installation. Erzeugt und geändert mit: python tools/setup.py
// Die Firebase-Werte sind nicht geheim: Sie stehen bei jeder Firebase-Web-App im Browser.
// Geschützt wird die Datenbank über firestore.rules (Firebase-Konsole > Firestore > Regeln).
// Steht bei projectId "DEIN-PROJEKT", speichert die Seite nur lokal im Browser.
window.SOULLINK_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "DEIN-PROJEKT",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // Anzahl der Spieler (2 bis 6). Namen trägt man auf der Seite ein.
  playerCount: 3,
  // Firebase-Kennung (UID) des Admins: darf Backups machen und andere freischalten.
  // Muss mit der UID in firestore.rules übereinstimmen (tools/setup.py hält beide gleich).
  adminUid: "",
  // Letztes automatisches Backup (GitHub Action, tools/backup.py). Dient nur der Backup-Erinnerung.
  autoBackupUrl: ""
};
