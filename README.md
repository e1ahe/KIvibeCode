# GirlMath 🐷✨

> *It's not spending if you earned it.*

GirlMath is a cute little web app for anyone who loves shopping a bit too much. Instead of feeling guilty about buying something, you **earn it first**. Make a piggy bank for the thing you want and add small everyday to-dos (tidy your room, work out, pack lunch…). Every time you finish one, gold coins drop into the jar. When the jar is full, you smash it and treat yourself, guilt-free. That's just math. 💅

Works on both phone and computer.

## Features

- **Multiple piggy banks.** One jar per thing you're saving for, each with its own name, icon and coin goal that you choose yourself. Jars can be edited or deleted.
- **To-dos per jar.** Every jar has its own to-do list, and you decide how many coins each to-do is worth.
  - **One-time to-dos** get ticked off. Tap again to undo.
  - **🔁 Repeat to-dos** can be tapped again and again (e.g. "Workout"), with a counter for today and an undo button.
  - Deleting a to-do that already earned coins asks whether to take those coins back out of the jar.
- **Coins drop in one by one.** A coin flies from the to-do to the jar, then gold coins fall in and pile up, with a counter ticking up.
- **Full jar celebration.** When the goal is reached, the jar glows gold with sparkles. Extra coins spill out over the edge.
- **Tap to smash.** A full jar shows a bouncing 👆 and "Tap the jar to smash it!". Every tap cracks it a little more, and the fifth tap smashes it with a flash, flying glass, a coin explosion, confetti and an emoji rain.
- **Treats you earned.** Smashed jars are saved in a list, and you can remove items from it.
- **Sounds.** Ka-ching when coins land, clinks, cracks and a fanfare, all generated in code (no sound files). Mute button in the top left.
- **Made for phones.** Mobile-first layout, sparkly splash screen, no double-tap or pinch zoom, and an ⓘ button that explains the app in four steps.

Coins are just points, not real money.

## Where is the data saved?

Everything is saved locally in the browser (`localStorage`). There is no account, no server and no personal data. This means the data:

- stays when you close the tab or restart the device,
- is gone if you clear the browser's site data or use a private window,
- is not shared between devices, browsers or different web addresses.

## Run it locally

It's plain HTML, CSS and JavaScript, so there's nothing to install. Start any static server in the project folder, for example:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Files

- `index.html`: page structure and dialogs
- `style.css`: the cute pink look and all animations, mobile-first
- `app.js`: jars, to-dos, coins, smashing, sounds and saving to `localStorage`

## Built with AI

This app was built with vibe coding using Claude Code. I described the idea and what I wanted in natural language (in Norwegian), and the AI helped plan the features, write the code and test it in a browser at both phone and desktop sizes.

The app was improved over several rounds based on my own testing, for example:

- the jar filling with a bar → coins dropping one by one,
- "every day" to-dos that could only be done once → repeatable to-dos,
- deleting a done to-do left its coins in the jar → it now asks to take them back,
- a "Smash the jar" button → tapping the jar until it cracks and breaks,
- blocking zoom on iPhone, adding sounds, and making the coin animation smoother when the jar is nearly full.
