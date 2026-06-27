LIVE SYNC FIX INCLUDED

Files updated:
- index.html
- fomo-live.html

What changed:
- Game Plan now writes score/status changes to Firebase and triggers a live sync timestamp.
- Game Plan also refreshes tournament teams/matches/settings from Firebase every 5 seconds.
- Public page listens live with Firebase onSnapshot and also refreshes from Firebase every 5 seconds.
- Public page no longer uses createdAt ordering for tournamentTeams/tournamentMatches, so older match docs without createdAt still load.
- Points table now updates from Live/Completed matches and also any match with scores, not only Completed matches.

Important:
If the public page still does not load live data, paste the Firestore rules from FIREBASE_PUBLIC_READ_RULES.txt into Firebase Console > Firestore Database > Rules > Publish.
