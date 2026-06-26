Youth Central FOMO Update - Final Rework

Files included:
- index.html: updated Youth Central admin site with reworked dashboard, game plan UI, cleaner fixtures, cleaner teams, and team edit popup.
- fomo-live.html: updated public read-only FOMO live page.
- assets/: images, pastor images, youth images, and FOMO logo.

Main changes:
- Public page tabs: Live Game, Teams, Be Part of Youth, Contact.
- Public page no longer shows technical Firebase fallback wording.
- Public page uses the actual FOMO logo and animated frisbee background.
- Public page youth gallery thumbnail strip removed.
- Be Part of Youth area now has Contact on WhatsApp, Follow on Instagram, and Raffles Hall Location.
- Pastor Dale & Michelle wording updated to Associate Pastors of the branch.
- Public page event detection improved so it can pick the correct FOMO tournament data from Firebase when no event id is in the URL.
- Internal Game Plan UI softened to be easier on the eyes.
- Fixtures Add Game form is hidden by default and opens only from + Add Game.
- Teams page now shows saved team cards and editing happens inside a popup.
- Final team names updated.
- Home page now uses dashboard analytics/charts and quick action cards instead of irrelevant lists.

GitHub Pages public link:
https://YOUR-USERNAME.github.io/YOUR-REPO/fomo-live.html

If live Firebase data still does not show publicly, update Firestore rules using FIREBASE_PUBLIC_READ_RULES.txt.
