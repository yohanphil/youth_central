FOMO 2.0 score/points live sync fix

Files included:
- index.html = Game Plan / admin control page
- fomo-live.html = public live page
- assets/ = existing required public assets

What changed:
- Scores now save to Firebase using both scoreA/scoreB and teamAScore/teamBScore fields.
- Points table reads both score field formats, so older/newer match records still calculate correctly.
- Score/status/court/time edits auto-save when changed.
- Game Plan refreshes tournament collections every 5 seconds.
- Public page refreshes tournament collections every 5 seconds.
- Firestore snapshot listeners now also trigger tournament rendering immediately.

Important:
- After uploading to GitHub, do a hard refresh on both pages: Ctrl + Shift + R.
- If public page still does not update, check Firestore Rules for public read access on tournamentTeams, tournamentMatches, and tournamentSettings.
