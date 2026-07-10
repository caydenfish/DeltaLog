// Customer-facing "What's New" copy, keyed by version number (must match
// package.json's version exactly). Written for users, not developers —
// no implementation details, no mention of the tools or services behind
// the scenes. Keep entries short, benefit-focused, and skimmable.
//
// When shipping a new version: add an entry here with the same version
// number as package.json. If a version has nothing worth telling users
// about, either skip the entry (the What's New sheet just won't show
// anything special) or write a short "small fixes and polish" line.

export const CHANGELOG = {
  "1.10.4": {
    title: "Exercise history, editable setup, and quicker navigation",
    items: [
      "Exercise Library: tap any exercise to see your own weight, reps, and volume charts for it, with 7 day, 30 day, 90 day, and 1 year views.",
      "Exercise Library: edit an exercise's notes and machine setup (seat height, arm setting, etc.) right from its detail screen — no need to start a workout first.",
      "Workout menu: a menu icon in the top right now takes you straight to the main menu. Your workout keeps going in the background, so you can pick it back up with a Resume Workout button on Home.",
    ],
  },
  "1.10.3": {
    title: "Calendar fix, streamlined first-run",
    items: [
      "Days you worked out on the calendar are now all the same shade of orange, instead of varying by how much volume you logged that day.",
      "Removed the guided tutorial walkthrough. The setup wizard on first launch still walks you through units, training focus, and your other defaults.",
    ],
  },
  "1.10.1": {
    title: "A third level of muscle detail: Category, Region, Anatomy",
    items: [
      "Muscle names now have three levels: Category (Chest), Region (Upper Chest), and Anatomy (Pectoralis Major, Clavicular Head).",
      "Admin: the muscle taxonomy screen has been rebuilt as a full three-level tree, with the ability to add, rename, move, and delete at every level.",
    ],
  },
  "1.9.27": {
    title: "Taxonomy safety net",
    items: [
      "Admin: the muscle taxonomy screen now blocks accidentally creating a Detailed group that's actually a Scientific name, and flags any existing ones so they can be found and fixed.",
    ],
  },
  "1.9.26": {
    title: "Fixed the reentry freeze, exercise library, and cleaner taps",
    items: [
      "Fixed the bug causing the app to sometimes get stuck on a blank gray screen indefinitely after leaving and reentering, requiring a restart. If anything still ever hangs on load, a \"tap to reload\" option now appears after a few seconds instead of leaving you stuck.",
      "Removed the blue tap highlight/focus box that flashed on buttons before a screen change.",
      "Fixed the Exercise Library: the top level is always the general muscle groups, and the level below now correctly follows your Detailed or Scientific naming preference instead of always showing Detailed.",
      "Fixed a timing issue that could leave the muscle breakdown on Home showing the wrong naming style until something else forced it to refresh.",
      "The loading icon now has an orange wave rippling and filling inside the outline.",
    ],
  },
  "1.9.25": {
    title: "Export image fixes, calmer loading",
    items: [
      "Fixed bodyweight not showing on the Story layout of the save-as-image export, even with the toggle on.",
      "Bigger logo on the save-as-image preview.",
      "Your layout and Include selections on save-as-image are now remembered after you export, so you don't have to reset them every time.",
      "Replaced the loading animation with something calmer: the logo now just pulses quietly instead of spinning and shrinking.",
    ],
  },
  "1.9.24": {
    title: "Delete sets mid-workout, backfill bodyweight in history",
    items: [
      "You can now delete a logged set while still in the middle of a workout, not just from the workout summary.",
      "Forgot to log bodyweight? You can now add or edit it for any past workout from Edit mode in history.",
    ],
  },
  "1.9.23": {
    title: "Smoother reentry, smaller rest timer, and a few fixes",
    items: [
      "Reopening the app with a workout in progress now takes you straight back into it, with a new loading animation instead of a blank screen.",
      "You can now log 0 lb (bodyweight) sets and 0 rep (failed) sets, both live and when editing history.",
      "Added an \"Arm setting\" field to machine setup, alongside seat, bar, and cable height.",
      "The rest timer bar is smaller and the Skip button is gone.",
      "Tapping Enter after typing reps now closes the keyboard.",
      "Added an optional \"How did you hear about us?\" question to setup.",
      "New: a \"What's next\" page in Settings, next to What's new, showing what we're building.",
    ],
  },
  "1.9.22": {
    title: "Admin-editable splits",
    items: [
      "Admins can now edit which muscle groups belong to each split (Push, Pull, Legs, and more), plus add or remove splits entirely, from a new Splits screen in Admin. Changes apply immediately across the workout generator, exercise picker, and FAQ & Glossary for everyone.",
    ],
  },
  "1.9.21": {
    title: "Muscle names preference now applies everywhere",
    items: [
      "The exercise picker's muscle group filter and split shortcuts, and the Exercise Library's browse-by-muscle screen, now show the same level of detail (Generic, Detailed, or Scientific) you've chosen in Preferences, instead of only the workout generator respecting it.",
    ],
  },
  "1.9.20": {
    title: "Correct split breakdown, grouped Workouts section",
    items: [
      "The Split reference in FAQ & Glossary now lists actual primary muscles for each split (e.g. Quads, Hamstrings, Glutes, and Calves under Legs) instead of a single broad group name.",
      "Templates and Exercise Library are now grouped together under one Workouts heading in Settings.",
    ],
  },
  "1.9.19": {
    title: "Corrected split reference, tidier menu",
    items: [
      "The Push/Pull/Legs split breakdown now lists the correct muscles for each split, and lives inside FAQ & Glossary under \"Split\" instead of its own separate screen.",
      "Fixed uneven spacing in the Settings menu.",
    ],
  },
  "1.9.18": {
    title: "Fixed workout resume, and a smarter generator",
    items: [
      "Backgrounding the app mid-workout and reopening it now correctly drops you back on the exercise you were actually on, instead of the first one.",
      "The workout generator's split buttons (Push, Pull, Legs, etc.) now work correctly again.",
      "In Detailed or Scientific muscle name mode, the generator's target muscle picker now shows the full range of specific muscles instead of just the broad groups, with search to find them quickly. \"Full Body\" and \"Neck\" no longer appear as target options.",
    ],
  },
  "1.9.15": {
    title: "Tap to see the full photo, and a tidier Settings",
    items: [
      "Progress photos in workout history are now tappable, opening the full-resolution photo instead of the cropped thumbnail.",
      "Profile moved into a renamed \"Profile & Preferences\" section. Units and Training Preferences are now their own screens, just like every other settings destination, instead of expanding in place.",
    ],
  },
  "1.9.14": {
    title: "Custom exercises now live in the Exercise Library",
    items: [
      "\"My Custom Exercises\" moved into the Exercise Library, right below View All -- one place to browse everything and manage what you've added.",
    ],
  },
  "1.9.13": {
    title: "Warmups carry over, streak moves to the calendar",
    items: [
      "Last session's warmup sets now show up correctly labeled (W1, W2...) when you're logging that exercise again, instead of blending in with working sets.",
      "Sets shown around the app now separate working sets from warmups wherever the two could be confused, like the workout summary and history.",
      "Fixed the muscle breakdown showing a different set count on the row than in the drill-down sheet.",
      "The home screen's time range (7D/30D/90D/1Y) now stays put between visits instead of resetting to 30 days.",
      "Streak moved down next to the calendar.",
    ],
  },
  "1.9.12": {
    title: "Announcements get polls, and a sharper muscle breakdown",
    items: [
      "Home screen's muscle breakdown now follows your muscle name preference (Generic/Detailed/Scientific) for both primary and secondary muscles, instead of only secondary.",
      "Admins can now edit and archive announcements, and attach a poll for everyone to vote on.",
    ],
  },
  "1.9.6": {
    title: "A little more style on startup",
    items: [
      "Added a glowing perspective grid horizon beneath the bar during the startup animation, right after it extends across the screen.",
    ],
  },
  "1.9.5": {
    title: "Drill into your muscle breakdown, and a cleaner library flow",
    items: [
      "Tap any \"N sets\" count on Home to see exactly which exercises and sessions made it up, with weight and reps for every set.",
      "Exercise Library: tapping a muscle group tile no longer pops open the search keyboard. There's also a new second layer of detailed muscle tiles before you land on the exercise list.",
      "Tap any exercise to see its equipment, muscle group, and primary/secondary muscles.",
      "Fixed a muscle-name mapping gap that could show raw names like \"Adductor Longus\" instead of grouping them under Adductors/Legs.",
    ],
  },
  "1.9.4": {
    title: "Browse the exercise library by muscle group",
    items: [
      "The Exercise Library now opens to muscle group tiles instead of a flat list — tap a group to narrow the list, or View All to browse everything.",
      "Exercise rows are cleaner: just the name, no more muscle/equipment subtext or colored dots.",
    ],
  },
  "1.9.1": {
    title: "Exercise library fixes",
    items: [
      "Fixed an issue where the exercise library failed to load for some users.",
      "Simplified how exercises are categorized — muscle group and equipment now drive filtering and search everywhere pattern, mechanism, laterality, grip, and skill level used to.",
    ],
  },
  "1.9.0": {
    title: "A completely rebuilt exercise library",
    items: [
      "Every exercise's data was rebuilt from scratch — muscle tagging, equipment, movement pattern, and three new fields: laterality, grip, and skill level.",
      "New Exercise Library screen, open to everyone: search any exercise (nicknames included) and view its full detail.",
      "Muscle groupings are simpler now: Arms, Back, Chest, Core, Full Body, Legs, Neck, Shoulders.",
    ],
  },
  "1.8.0": {
    title: "Scientific muscle tagging, and cleaner promotions",
    items: [
      "Promoting a custom exercise to the shared library now fully consolidates it: any other user's duplicate copy of the same exercise gets its workout history, templates, and defaults automatically repointed to the shared version, the duplicate is removed, and its creator gets a personal notification (visible from the same bell icon as announcements).",
      "Admins tag primary and secondary muscles with the correct scientific name (e.g. Latissimus Dorsi) when reviewing, promoting, or creating a shared exercise — Detailed mode (\"Lats\") and Generic mode (\"Back\") are derived automatically from that one tag instead of being set independently.",
      "New admin Taxonomy screen to manage the full scientific-name list and which generic muscle group each one rolls up into.",
      "Admins can now create a brand-new exercise directly into the shared library, not just promote one a user already submitted.",
    ],
  },
  "1.7.1": {
    title: "Muscle data cleanup, and no more emoji",
    items: [
      "Fixed the volume-over-time chart not actually changing with the selected time range — it now buckets the same way the bodyweight chart does (daily for 7d, weekly for 30d, every other week for 90d, monthly for 1yr).",
      "Restructured exercise muscle data into three aligned tiers: a general muscle group, one or more primary muscles, and one or more secondary muscles — consistent across custom exercise creation, your custom exercise list, admin review, and the admin Exercise Library.",
      "Custom exercises created by regular users no longer auto-promote to the shared library after 3 people submit the same one — promotion is admin-only now, always.",
      "The DeltaLog logo is now always included when saving a workout summary as an image — no longer an optional toggle.",
      "Replaced every colored emoji in the app with simple line icons for a consistent look across devices.",
    ],
  },
  "1.7.0": {
    title: "Warmup sets, announcements, and sharing",
    items: [
      "Warmup sets: mark any set as a warmup by tapping its number — it labels as W1, W2, etc. and no longer counts toward volume, PRs, or the outlier check. Set a default warmup count per exercise in templates or mid-workout.",
      "Announcements: a new bell icon on Home shows updates from the DeltaLog team, with a dot when there's something new.",
      "Templates can now be exported as a short code and imported by anyone who has it, so you can share a program with a friend.",
      "Past workouts can be shared as a public link — no account needed to view it.",
      "Save any workout summary as an image, with your choice of layout and what to include.",
      "Added a \"None\" option for strength scoring, for anyone who'd rather not see a comparison at all.",
      "The outlier review card can now delete a flagged set directly, not just edit or dismiss it.",
      "Fixed progress photos, the volume chart, the bodyweight chart, and the calendar all occasionally showing the wrong day.",
      "The bodyweight chart now adjusts its granularity to the selected time range instead of showing a wall of daily dots.",
      "The exercise search bar in template building now clears after you add an exercise.",
      "Past workouts now open in view-only mode — tap Edit (top right) to correct a set or add/remove sets and exercises.",
      "Clicking a calendar day with more than one session now opens a list of that day's sessions instead of guessing which one to show.",
      "Admins get a new Exercise Library screen to fix any exercise's muscle assignment and add new muscle groups — changes apply to every user.",
      "Admins can now grant or remove admin access for other users from Settings.",
    ],
  },
  "1.6.2": {
    title: "Pick up exactly where you left off",
    items: [
      "Fixed the rest timer disappearing after leaving and reopening the app.",
      "Leaving mid-workout — any screen, any tool, the set logger, the plate calculator, the exercise picker — now restores exactly as you left it, not just which exercise you were on.",
      "Added a loading animation on open.",
      "Danger Zone (reset data, delete account) now lives one tap deeper in Settings, to cut down on accidental taps.",
      "Admin tools are now behind a single Admin entry in Settings instead of several separate buttons.",
      "Admin's custom exercise review now shows the submitter's actual name, requires a quick review of the details before an exercise can be promoted to the shared library, and can merge a near-duplicate submission into an existing library exercise instead — the submitter keeps their own copy, and future duplicates with that same name won't clutter the review queue again.",
      "Past workouts: you can now add or remove sets and exercises after the fact, and volume/totals update to match.",
      "History now shows the start time for each workout, and Preferences has a 12h/24h clock format toggle.",
      "The setup wizard now explains manual entry vs. the plate calculator, with a quick visual, instead of just naming the two options.",
      "Moved the split reference guide (Push/Pull/Legs & more) into Tutorials, Guides & Support.",
      "Fixed the Reddit community link button running wider than the screen.",
      "Preferences reorganized: Muscle Names and Default Rest Timer moved into Training Preferences; Units renamed to Weight Units and combined with Time Format under one Units section.",
      "Admin's custom exercise review can now archive a submission outright (hides it from the creator too), not just dismiss it from the queue.",
      "Fixed admin Version History text running off the screen on long entries.",
      "Hardened the mid-workout resume fix further — added more frequent, more redundant saves so which exercise and the rest timer survive closing/reopening the app.",
      "Edit Workout now lets you remove an individual logged set, not just whole exercises.",
      "Moved Profile up in Settings, between Workouts and Preferences.",
    ],
  },
  "1.6.1": {
    title: "Fewer surprises, more control",
    items: [
      "Leaving the app mid-workout — refresh, background, phone dying — now picks back up exactly where you left off: same screen, same exercise, rest timer included.",
      "Settings now has a search bar.",
      "Starting weight for the plate calculator now remembers itself per exercise, so you're not re-entering the same bar weight every session.",
      "Finishing a workout now flags any set that looks way off from your usual numbers, so you can fix a typo before it's locked in.",
      "History: tap any past set to correct it, and use the new Edit button to select and delete multiple sessions at once.",
      "Adding a progress photo now lets you choose Camera or Photo Library directly.",
      "You'll now get a quick heads-up on login when there's something new — covering everything since your last visit, not just the latest version.",
    ],
  },
  "1.6.0": {
    title: "Everything help-related, in one place",
    items: [
      "Added a Tutorials, Guides & Support section in Settings — the tutorial replay, FAQ, install guide, community link, and feedback form all now live together.",
      "You can now rerun the first-time setup wizard anytime from that same section, if you want to revisit your defaults.",
    ],
  },
  "1.5.0": {
    title: "A better first run",
    items: [
      "New users now get a quick, guided setup walking through units, training focus, and how they like to log — so DeltaLog fits how you train from the very first workout.",
    ],
  },
  "1.4.0": {
    title: "Train the way you want",
    items: [
      "Added a Training Focus setting — pick Strength, Hypertrophy, or Endurance as your default rep range, with a quick explainer for each.",
      "Cleaned up Settings — training-related options now live together under one Training Preferences section.",
    ],
  },
  "1.3.0": {
    title: "Your data, your control",
    items: [
      "Added a full Privacy Policy, viewable anytime in Settings.",
      "You can now permanently delete your account and everything tied to it, right from Settings — no waiting, no emailing support.",
      "Added a way to submit privacy questions or requests directly from the app.",
    ],
  },
  "1.2.0": {
    title: "Cleaner settings, clearer terms",
    items: [
      "Terms & Conditions are now viewable anytime from Settings.",
      "Your bodyweight chart is now always on, one less setting to manage.",
    ],
  },
  "1.1.1": {
    title: "Small fixes and polish",
    items: [
      "Smoothed out the sign-in screen on smaller phones.",
    ],
  },
  "1.1.0": {
    title: "More ways to sign in",
    items: [
      "Added email + password as an alternative to signing in with Google.",
    ],
  },
  "1.0.0": {
    title: "Welcome to DeltaLog",
    items: [
      "Reordering exercises and templates is smoother, with a clear line showing exactly where things will land.",
      "You can now swap one exercise for another in a saved template in a couple taps.",
      "Added an optional progress photo you can attach to any workout day — private to you.",
      "Added a cable height field to machine setup, alongside seat and bar height.",
      "Back buttons throughout the app now take you back one step, not all the way home.",
      "Logging a set now uses the full screen, so the plate calculator has room to breathe.",
    ],
  },
};
