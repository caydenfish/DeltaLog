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
  "1.12.21": {
    title: "Save as Image is now full resolution, and the photo-background flicker is gone for good",
    items: [
      "Fixed: saved images (all layouts, all formats) were noticeably softer than they should be, both the photo and the text/logo on top of it. Exports are now rendered at full 1080px-wide resolution instead of a low-res copy that got stretched afterward.",
      "Fixed: a photo background could still flicker repeatedly while sitting on the Save as Image screen, not just once. Root cause was outside this screen: the progress photo comes from a short-lived signed link that gets silently refreshed with a new link for the exact same photo, and this screen was treating each refresh as a brand new photo to reload. It now recognizes those refreshes as the same photo and leaves the image alone.",
    ],
  },
  "1.12.20": {
    title: "New Position option for Card/Detailed: Centered or Corner",
    items: [
      "Save as Image's Card and Detailed layouts now have a Position option: Centered (the original layout) or Corner, a smaller version of the same info tucked into the bottom-left instead of taking over the whole card.",
    ],
  },
  "1.12.19": {
    title: "Fixed Story export not matching the preview, and photo-background flicker",
    items: [
      "Fixed: a photo background on a Story/Post/Square export could look stretched or squished compared to the preview. The photo is now cropped to the exact export shape before it's captured, so what you see is what gets saved.",
      "Fixed: a visible flicker when a photo background loads on the Save as Image screen.",
    ],
  },
  "1.12.18": {
    title: "New Format picker for Story exports: Story, Post, or Square",
    items: [
      "The Story layout now has a Format picker: Story (9:16), Post (4:5), or Square (1:1) — Instagram's own standard sizes, so your export always matches exactly what Instagram expects for that surface, regardless of which format you're posting to. Replaces the previous approach of matching your phone's screen shape, which wasn't consistent across devices.",
    ],
  },
  "1.12.17": {
    title: "Story image export now matches your phone's actual screen shape",
    items: [
      "Fixed: the Story-layout image export was built for an older, shorter phone screen shape. On today's taller phones, that mismatch made Instagram shrink the whole image down to fit instead of filling the Story edge to edge. The export now automatically matches your device's actual screen shape.",
    ],
  },
  "1.12.16": {
    title: "Fixed Story image export coming out cropped wrong for Instagram",
    items: [
      "Fixed: saving a workout summary as a Story-layout image and posting it to an Instagram Story could come out cropped or distorted instead of filling the frame cleanly. The image export now always matches exactly what's shown in the preview.",
    ],
  },
  "1.12.15": {
    title: "Fixed kg weights showing extra decimals, warmup sets now scale their own weight, new Warmup Set Weights setting",
    items: [
      "Fixed: logging weight in kg could show long, unrealistic decimal numbers (e.g. 61.68539...) instead of a clean one-decimal value almost everywhere a weight was displayed or pre-filled — history, targets, program-generated weights, and more. All kg weights are now rounded to one decimal place throughout the app.",
      "Fixed: opening a warmup set used to pre-fill it with the same weight as your top (working) set, instead of a lighter warmup weight. Warmup sets now default to a percentage of your top set, scaled to how many warmup sets you've planned for that exercise.",
      "The Target display now recognizes when your next set is a warmup: it turns yellow, relabels itself \"Warmup 1 of 3\" (etc.), and shows the scaled warmup weight instead of your working weight, so it's always clear at a glance which kind of set is coming up next.",
      "New: Warmup Set Weights, under Settings > Training Preferences. Set what percentage of your top set each warmup set should load, with recommended percentages already filled in based on standard progressive-warmup ramps used in strength coaching. Percentages ramp up automatically depending on how many warmup sets you use for an exercise (e.g. 3 warmup sets default to 40%/60%/80%), and every value is fully adjustable to fit how you like to warm up.",
    ],
  },
  "1.12.14": {
    title: "Fixed a gray-screen loading bug, sign-in fix, and preferences now backed up",
    items: [
      "Fixed: after a run of quick updates, the app could get stuck showing the logo and then a blank gray screen instead of finishing loading, requiring you to manually clear site data to fix it. The app now catches this automatically and recovers on its own with a single reload — no more manual fix needed.",
      "Fixed: the \"Continue with Google\" button on the sign-in screen could be completely unreachable on some phones — a layout issue meant it could end up scrolled out of reach with no way to get to it. It's now always reachable.",
      "Your preferences (units, muscle names display, rest timer settings, Home dashboard layout, and everything else in Preferences) are now backed up to your account, not just kept on this device. If you ever have to clear your browser's cache or site data — including as a fix for the gray-screen issue above — your preferences will be restored automatically the next time you sign in, instead of resetting to defaults.",
    ],
  },
  "1.12.12": {
    title: "Weekly Set Goals consolidated, Anatomy mode fixed",
    items: [
      "Fixed: switching Muscle Names to Anatomy was tracking Weekly Set Goals at the full scientific-name level instead of the same Region-level muscles (Lats, Traps, Quads, etc.) Region mode already uses — both now track identically at that level, so you don't need the exact anatomical name just to set a goal.",
      "Weekly Set Goals now lives in one place: the Home dashboard's Weekly Set Goals card. It now includes a Goals breakdown you can expand to see every muscle's exact current/target numbers (same style as Muscle breakdown's Coverage breakdown), plus the Edit Goals button — the separate bars widget and the standalone Settings entry are gone, folded into this one card.",
      "Muscle Taxonomy management moved from Exercise Library into the Admin menu.",
    ],
  },
  "1.12.11": {
    title: "Independent per-muscle weekly goals, clearer heatmap breakdowns",
    items: [
      "Weekly Set Goals now tracks at whichever tier your Muscle Names setting uses. On Category (the default), Lats and Traps still share one \"Back\" goal like before. Switch Muscle Names to Region or Anatomy in Preferences and every muscle — Lats, Traps, Upper Back, Quads, etc. — gets its own independent weekly target and its own independent color on the Body Map, so hitting one doesn't make others look done too.",
      "Heads up: switching to Region/Anatomy tracking starts everyone at the default 10 sets/week per muscle, separate from whatever you'd set at the Category tier. Open Edit Goals and use \"One for all\" to quickly reapply your usual number across every muscle at once.",
      "Muscle breakdown map and the Weekly Set Goals body map: tapping or hovering a region now shows exactly which muscles are contributing to that number when more than one shares the same spot on the silhouette, instead of just an unexplained total.",
      "Cleaned up the Sets/Muscles filter buttons on Muscle breakdown — now a single clean full-width control per row instead of the cramped side-by-side buttons.",
    ],
  },
  "1.12.10": {
    title: "Muscle breakdown rework, plus a Home ordering fix",
    items: [
      "Fixed: the mid-workout muscle heatmap (and the template builder's Coverage panel) could show the wrong muscle for an exercise, depending on how recently you'd opened the app.",
      "The Muscle breakdown map now lets you choose exactly what counts: Working sets, Warm-up sets, or Both, and Primary muscles, Secondary muscles, or Both — pick any combination and the map recolors to match.",
      "The map's legend now shows the actual set-count ranges for each shading level instead of the words None/Low/Moderate/High.",
      "Removed the Radar view from Muscle breakdown.",
      "Weekly Set Goals now has its own body-map view as a separate Home card (only appears once you've actually saved a weekly goal), split out from the main Muscle breakdown map.",
      "Fixed: the Last workout card on Home ignored your Customize Home ordering and always showed up first, no matter where you'd dragged it.",
    ],
  },
  "1.12.8": {
    title: "Set list no longer scrolls unless it needs to",
    items: [
      "Last Session and Today no longer reserve empty scrollable space for 4 sets when you've only got 1 or 2 — the tiles now size to fit exactly however many sets there are, and only start scrolling once you've actually got more than 4.",
    ],
  },
  "1.12.7": {
    title: "Faster update notifications",
    items: [
      "The \"new version ready\" banner now shows up much sooner if you keep the app open a long time or just background it instead of closing it, rather than only being checked when you fully quit and reopen.",
    ],
  },
  "1.12.6": {
    title: "Fixed mid-workout scrolling",
    items: [
      "Fixed: scrolling mid-workout could drag the whole screen along with it, hiding the exercise strip at the top or the Log next set button at the bottom depending on scroll position. Only the Last Session/Today area scrolls now; everything above and below it stays put.",
    ],
  },
  "1.12.5": {
    title: "Persistent-workout bug actually fixed, and set-list polish",
    items: [
      "Fixed for real this time: a canceled workout could still keep pulling you back into it on every app open, even after canceling repeatedly. Canceling now clears out any old abandoned workouts on your account, not just the current one.",
      "The Last Session / Today tiles now stretch to fill the full space down to the Log next set button, with Volume and e1RM anchored at the very bottom of each tile.",
      "If you log more sets today than you did last session, Last Session now keeps scrolling in step with Today instead of running out early — the extra spots just show blank since there's nothing to compare them to.",
    ],
  },
  "1.12.4": {
    title: "Set logging refined, and exercise progress shown as a fill instead of a fraction",
    items: [
      "Last Session and Today now list sets in the exact same format, side by side, each showing weight x reps, RIR, and e1RM per set — plus a Volume and best e1RM summary at the bottom of each tile, with Today's showing how it compares to last time (green for up, red for down).",
      "Both lists show up to 4 sets before scrolling; scroll either side and the other follows, so set numbers always stay lined up.",
      "In the workout exercise strip up top, an in-progress exercise's pill now fills with green proportionally to sets completed, instead of showing a \"2/4\" style count.",
    ],
  },
  "1.12.3": {
    title: "Set logging redesigned, home header fixed, and a persistent-workout bug fixed",
    items: [
      "Set logging redesigned: Last Session and Today are now two separate tiles side by side instead of one combined row per set. Last Session shows your total volume, best e1RM, and every set's reps/RIR at a glance; Today is where you actually log and review sets, sized about 60% shorter per row than before.",
      "Tap any logged set to edit it directly — no separate Edit button needed anymore.",
      "Deleting sets: tap \"Delete sets,\" check off however many you want to remove, then confirm — instead of a delete button on every single row.",
      "Fixed: a canceled workout could keep pulling you back into it every time you fully closed and reopened the app, even after canceling it multiple times.",
      "Home screen header (logo, edit, announcements, menu) now actually stays pinned in place while the rest of the page scrolls beneath it, and its spacing is now even from top to bottom.",
    ],
  },
  "1.12.1": {
    title: "Pause workouts, smarter targets, and a big round of fixes",
    items: [
      "New: pause a workout mid-session (freezes the workout and rest timers) and Save for later. Next time you start a workout, you can pick up right where you left off instead of losing it.",
      "Target weight/reps now adapts to what you've actually logged today, not just last session — and you can choose how it's calculated in Preferences (or during setup): Double Progression, % of e1RM, or RIR Autoregulation.",
      "Program generator now orders each day's exercises with compound lifts first and adds warmup sets to the lead lift automatically. A 6-day Push/Pull/Legs week also gets real variety on repeat days instead of an identical clone — e.g. a quad/glute-focused Leg day and a separate hamstring-focused one.",
      "Custom machine setup redesigned: proper text entry instead of a browser popup, previously-used machine names suggested automatically, and a new Settings > Machine Names screen to rename or delete a machine everywhere it's used at once.",
      "Completed exercises now highlight green in the workout strip instead of showing a checkmark.",
      "Exercise names now link directly to a \"how to\" search, in both a workout and a Program day.",
      "Mid-workout replace-exercise flow redesigned as a full screen with a proper header and footer.",
      "Last session vs. Today set comparison redesigned into one compact combined list instead of two separate stacked lists.",
      "Target weight/reps is now more prominent and easier to spot at a glance.",
      "Post-workout summary screen: only the \"Workout Complete\" header stays pinned while you scroll; everything else (stats, PRs, exercise breakdown) scrolls normally.",
      "Setup wizard trimmed: removed the Default Set Entry, Big Plates, and Default Rest Timer steps (still adjustable anytime in Preferences) and added a new Target Calculation Method step.",
      "Announcements: added a \"Dismiss all\" option when you have more than one.",
      "A half-typed weight/reps entry is no longer lost if you back out of logging a set without saving it.",
      "Note delete button moved inside the note editor.",
      "Fixed: replacing an exercise mid-workout could leave the old one behind instead of properly swapping it out.",
      "Fixed: an exercise removed mid-workout with no sets logged could still show up afterward in history as \"No sets logged.\"",
      "Fixed: Push/Pull/Legs split wasn't including ab/core exercises on any day.",
      "Fixed: opening Program right after finishing today's session showed tomorrow's workout instead of confirming today's was done.",
      "Fixed: mid-workout muscle heatmap/radar could show the wrong muscles under Detailed or Scientific muscle-name display mode.",
      "Fixed: Instagram Story image export was coming out too tall and looking compressed once added to a real Story.",
      "Disabled the pull-down-to-refresh gesture on Android so it can't be triggered by accident mid-workout.",
    ],
  },
  "1.11.7": {
    title: "Smarter Program exercise picks, cleaner Exercise Library browsing",
    items: [
      "Program generator no longer double-books the same exercise on both Push and Pull day (or similar overlaps) — shoulder and arm exercises are now correctly sorted to the day they actually belong to.",
      "Browsing the Exercise Library by muscle group no longer shows unrelated muscles mixed in — e.g. Chest no longer surfaces Triceps, Shoulders no longer surfaces Calves. Full-body compound lifts still show up under every muscle group they train, they just won't drag their other muscles along as false options.",
      "Program setup's \"Your exercises\" step redesigned to match the Template builder: each day is its own section with drag-to-reorder, Replace, Remove, and a sets stepper per exercise, plus the same full exercise picker (search, Filters, Favorites/Previously performed/Unperformed) used everywhere else in the app for adding more.",
      "New: Training Focus, Split, Experience level, and Progression model in the Program setup wizard now each have a short plain-language explanation right under the picker.",
      "Home's Last Workout card now folds in your active program: what's next up in the rotation, plus an Open Program shortcut, right alongside the usual days-since-last-session recovery note.",
      "Fixed prescribed weights showing as \"0lb x 10\" for exercises you haven't logged before. First-time exercises now start from an estimate based on your own recent training on similar exercises (or a light bodyweight-based guess if you're brand new to that muscle group entirely), instead of the exercise library's unset default.",
      "You can now search the web for how to perform an exercise directly from a Program day, same as the Exercise Library already offered.",
      "Abandoning a program now asks you to confirm first, and the button itself is far less prominent — no more accidentally ending a program with a stray tap.",
    ],
  },
  "1.11.6": {
    title: "A more organized Settings menu",
    items: [
      "Preferences is now its own screen (tap Preferences under Profile & Preferences), instead of the full list of fields sitting inline in the middle of Settings — it's now a clean tap-through like everything else. Searching Settings still surfaces the exact matching field right there without navigating anywhere, same as before.",
      "Settings reorganized into clearer groups: Training Plan (Program, Weekly Set Goals) and Workout Library (Templates, Exercise Library) instead of one mixed \"Workouts\" section.",
    ],
  },
  "1.11.5": {
    title: "Weekly Set Goals (formerly My Plan), and a cleaner Radar scale",
    items: [
      "My Plan is now Weekly Set Goals, and it has one home: a new Weekly Set Goals entry in Settings opens the exact same editor as the Home card's Edit Goals button, so it's always reachable even if you've removed the Home widget via Customize Home.",
      "Editing is no longer sliders on Home — targets now live behind a dedicated Edit Goals screen with a +/- stepper and typeable number for each muscle group, so nothing gets bumped by accident while scrolling.",
      "New: One for all mode. Set a single weekly set number and apply it to every muscle group at once, instead of adjusting each one individually — switch back to Individual anytime, your last-used mode is remembered.",
      "The Radar view (Muscle breakdown) now uses clean, consistent scale intervals (5/10/15... or a larger clean step for higher volume) instead of whatever fractional split the previous max happened to produce.",
    ],
  },
  "1.11.4": {
    title: "Program: a science-backed multi-week training program generator",
    items: [
      "New: Program. Build a multi-week training program from Home's menu — pick a Training Focus, days per week, and let it suggest your experience level from your logging history (or set it yourself). Quick Start defaults everything sensibly; Custom lets you set program length, split, and which progression style to use.",
      "Every session in a program shows a prescribed weight and reps for each exercise, computed from your own training history — no more guessing what to load. A short line under each target explains why it's what it is (hit the top of your rep range, easing back in after time off, holding steady through a plateau, etc.), so the number never just quietly changes on you.",
      "Three progression styles under the hood, matched to your Training Focus by default: Double Progression (Hypertrophy/Endurance), % of e1RM (Strength), and RIR Autoregulation as an optional pick in Custom setup. See the new Program Generator section in FAQ for what each one actually does.",
      "Every program has a built-in deload week at the end of the block, and progress is tracked by sessions completed rather than the calendar — missing a week just waits for you instead of throwing off the plan.",
      "My Plan can now suggest weekly set targets straight from your active program — one tap to apply them, and every slider stays fully editable afterward.",
      "Exercises for a program are auto-picked per muscle group (favoring compound movements and exercises you've already done), with a search box under each day to swap in whatever you'd rather do instead.",
    ],
  },
  "1.11.3": {
    title: "A customizable Home, and a clearer muscle breakdown",
    items: [
      "Home now has a pencil icon (top left) that opens a Customize Home screen — turn any dashboard section on or off, and drag to reorder them to match how you actually use the app.",
      "Added a Workout Time chart alongside Volume and Bodyweight, showing how long your sessions have been running over time.",
      "Tapping a point on the Volume, Bodyweight, or Workout Time charts now pulls up a Selected Day card showing all three values for that date together — scroll or tap elsewhere to return to the normal view.",
      "The Training range switcher (7 Days/30 Days/90 Days/1 Year) now stays pinned near the top while you scroll through the chart section, instead of only being reachable by scrolling back to the very top of Home.",
      "The muscle breakdown body map is now purely visual, with four clearly distinct color tiers (None/Low/Moderate/High) and a legend, instead of a tap-to-select outline. A new \"Coverage breakdown\" list underneath shows every muscle group's exact set count, including ones you haven't trained yet, so it's obvious what's been missed — tap any trained muscle to see both its primary and secondary sets broken out together.",
      "The Radar view is decluttered — capped to your top 8 trained muscles, with a subtle scale of numbers running up the middle instead of a label stamped at every point.",
      "The exercise detail sheet in Exercise Library now has a back button pinned to the top, and the Google search link is now a clearly-labeled \"Search\" button instead of a small icon.",
      "Share buttons (templates, workout history) now use a proper share icon instead of a plain arrow character.",
      "New: My Plan. Set a weekly set target per muscle group (slider, right on Home) and track this rolling week against it — gray until you've started, orange while under target, green once you've hit it. The Body map now has a matching \"My Plan\" view that colors the whole silhouette the same way, so you can see at a glance which muscles still need work this week.",
      "Each chart on Home (Volume, Bodyweight, Workout Time, Muscle breakdown) now keeps its own independent time range instead of one range controlling all of them — pin Bodyweight to 90 Days while keeping Volume at 30 Days, for example. The range switcher now lives right on each chart's own header.",
      "Training Preferences is now split into two collapsed groups (Training Focus & Logging, Rest Timer) instead of every field showing at once — tap into whichever one you need.",
      "General icon polish throughout the app — drag handles and expand/collapse arrows now use real icons instead of text characters, and the icon buttons at the top of Home (customize, announcements, settings) are bigger, better centered, and no longer sit inside a filled circle.",
    ],
  },
  "1.11.1": {
    title: "Body map, exercise lookup, and a few polish fixes",
    items: [
      "Exercise names in the Exercise Library now link out to a Google search for that exact exercise, in case you want a form video or more detail.",
      "The button in the mid-workout menu that takes you home is now a house icon instead of a second menu icon, so it's not confused with the button that opens the workout menu.",
      "The Resume Workout button now shows a live-ticking elapsed time, so it's obvious a workout has been sitting paused instead of just sitting there quietly.",
      "Reworked the \"Since last workout\" card on Home to match the app's newer look — a status-colored icon, cleaner layout, and last session's muscles as tags instead of a plain sentence.",
    ],
  },
  "1.10.10": {
    title: "Behind-the-scenes security hardening",
    items: [
      "Tightened data access rules across the backend as part of a routine security review — no visible changes, just extra protection around how your data is stored and accessed.",
    ],
  },
  "1.10.9": {
    title: "Pinned headers, and a real fix for image flicker",
    items: [
      "Every screen's header now stays pinned in place while you scroll the content beneath it — Templates, Settings, Exercise Library, Workout History, and everywhere else.",
      "The template builder's Save Template button is now pinned at the bottom of the screen, always reachable without scrolling.",
      "\"Full Body\" removed from Exercise Library's browse-by-muscle-group tiles — those exercises now show up under their real muscle groups instead (or via View All / search).",
      "Rest Timer settings moved into Training Preferences instead of being their own separate section.",
      "Fixed a remaining cause of image flicker when saving a workout image with a photo background: the photo is now resized before use instead of processed at full camera resolution.",
    ],
  },
  "1.10.8": {
    title: "Template builder, matched to the workout logger",
    items: [
      "Muscle breakdown (on Home, in a workout, and in the template builder's Coverage panel) is now a bar chart by default, showing Primary vs Secondary sets per muscle at a glance. The old plain-language list is still there — tap \"Full breakdown\" to expand it.",
      "Exercises that train more than one muscle group (like an incline press hitting Chest, Shoulders, and Triceps) now show up when browsing or filtering by any of those muscle groups — not just whichever one the exercise happened to be filed under.",
      "Building a template now uses the same exercise picker as adding exercises to a workout — search, muscle group/equipment filters, split quick-picks, favorites, and \"Previously performed\", all in one panel.",
      "You can create a custom exercise right from the template builder, no need to back out to a workout first.",
      "\"My Custom Exercises\" now has a \"Create a template from these exercises\" option — select a few and jump straight into building a template with them already added.",
      "The template builder's Coverage heatmap now respects your Muscle Names setting (Generic/Detailed/Scientific) instead of always showing generic buckets.",
      "\"Import template\" is now a small icon button next to \"+ New Template\" instead of its own full-width button.",
      "Replaced the superset icon with a clearer paired-exercises icon.",
      "Exercise thumbnails without a photo now show a plain image placeholder instead of a barbell icon.",
    ],
  },
  "1.10.7": {
    title: "Better custom exercise picker, promoted exercises",
    items: [
      "Choosing a muscle group or equipment when creating a custom exercise now opens a searchable in-app picker instead of the clunky native menu.",
      "When a custom exercise you submitted gets added to the shared library, or combined with an existing one, it now shows up in a new \"Promoted Exercises\" section in My Custom Exercises, and you'll get a notification either way.",
      "Volume and Bodyweight charts on Home now space points by actual time elapsed — a 4-day gap between workouts looks like a gap, not the same spacing as two back-to-back days.",
      "Updating your weight from a past workout in Workout History now updates your profile's current weight too, matching whichever entry is most recent.",
      "Announcements and notifications can now be dismissed individually from the Announcements panel.",
      "Added \"Split scheduling\" to What's Next: setting your split's order and seeing it forecasted on your calendar.",
      "Fixed: primary/secondary muscles on an exercise's detail screen now match your Training Preferences muscle-name setting instead of always showing Detailed names, and no longer repeat the same muscle multiple times.",
      "Fixed: searching for a merge target in admin's Custom Exercises now also matches an exercise's alternate names (aliases), not just its current name — a promoted exercise whose original submitted name only survives as an alias was previously unfindable there.",
      "Fixed a rare bug where tapping \"Add\" on the exercise picker more than once in quick succession (most likely to happen right as the app loses or regains focus) could add the same exercise two or three times.",
      "Fixed: the keyboard didn't always pop up right away when adding a new set — it should now show up reliably every time.",
      "Fixed a crash on the workout screen: \"muscleNameMode is not defined.\"",
      "Fixed the \"Add exercises\" screen (manual add) only using about half the available height, with the create-custom-exercise button floating in an inconsistent spot — the exercise list now fills the screen and that button sits pinned just above \"Add exercises.\"",
      "Rest timer settings moved to their own \"Rest Timer\" screen in Settings, and you can now choose a sound and/or vibration for when a rest timer ends — 4 options each, and each can be turned off independently.",
      "All Submissions (admin) now flags anything marked reviewed/dismissed that was never actually added to the shared library, with a one-tap fix — catches cases like accidentally dismissing instead of promoting.",
      "Fixed: the \"Muscle group\" options when creating a custom exercise were pulling from a stale, separately-maintained list instead of what's actually used across real exercises. Muscle group is now also auto-derived from your primary muscle picks instead of being a separate choice, so it can't drift out of sync with them.",
      "Fixed: Primary/Secondary muscle options when creating a custom exercise now match your Training Preferences muscle-name setting (Category/Region/Anatomy) — previously they stayed at Category precision no matter what that setting was.",
      "Fixed the rest timer bar briefly disappearing and reappearing right as it hit 0:00 — it now stays put and counts through smoothly.",
      "Added a \"Rest Timer Complete\" notification option (Settings > Rest Timer), alongside sound and vibration, for when the app's in the background.",
      "Renamed the rest bar's \"Rest timer over\" label to \"Rest timer complete\" for consistency with the new notification.",
    ],
  },
  "1.10.5": {
    title: "Warmup rest timer, easier navigation back",
    items: [
      "New \"Rest Timers\" section under Training Preferences: a toggle to turn on a separate warmup rest timer, with its own default duration alongside your regular working-set default. Turn it off and there's just one rest timer for every set, like before.",
      "Set a different rest timer for warmup sets than your working sets, per exercise, right from the Edit Workout screen. Only shows up for exercises where you've planned warmup sets, and only when the new Rest Timers toggle is on. Carries over workout to workout, same as your regular per-exercise rest times.",
      "Adding exercises: creating a custom exercise while building your workout no longer loses the other exercises you'd already picked — it now takes you back to that same screen with your picks intact.",
      "Added a back button to the Edit Workout screen and the setup wizard when it's replayed from Help & Support.",
      "Fixed: backing out of \"Add exercises manually\" on a brand-new workout no longer drops you into the workout screen as if you'd started it. It now asks if you want to discard the exercises you'd added and takes you back to Home.",
    ],
  },
  "1.10.4": {
    title: "Exercise history, editable setup, and quicker navigation",
    items: [
      "Exercise Library: tap any exercise to see your own weight, reps, and volume charts for it, with 7 day, 30 day, 90 day, and 1 year views.",
      "Exercise Library: edit an exercise's notes and machine setup (seat height, arm setting, etc.) right from its detail screen — no need to start a workout first.",
      "Workout menu: a menu icon in the top right now takes you straight to the main menu. Your workout keeps going in the background, so you can pick it back up with a Resume Workout button on Home.",
      "Fixed the Save as image screen flickering and glitching while it generates.",
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
