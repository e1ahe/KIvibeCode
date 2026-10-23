# GirlMath 🐷✨

> *It's not spending if you earned it.*

GirlMath is a cute little web app for anyone who loves shopping a bit too much. Instead of feeling guilty about buying something, you **earn it first**: make a piggy bank for the thing you want, add small everyday to-dos (tidy your room, work out, pack lunch…) and every time you finish one, gold coins drop into the jar. When the jar is full, you smash it and treat yourself — guilt-free. That's just math. 💅

Works on both phone and computer.

## Features

- **Multiple piggy banks** – one jar per thing you're saving for, each with its own name, icon and coin goal that you choose yourself.
- **To-dos per jar** – every jar has its own to-do list. You decide how many coins each to-do is worth. To-dos can be one-time or repeat every day.
- **Gold coins** – tapping a finished to-do sends a coin flying into the jar, which fills up as you go. Tap again to undo.
- **Smash the jar** – when the goal is reached, smash the jar for confetti and a celebration. It's saved in *Treats you earned*.
- **Quick ideas** – suggested to-dos to get started fast.

Coins are just points, not real money. All data is stored locally in your browser (no account, no server, no personal data).

## Run it locally

It's plain HTML, CSS and JavaScript, so there's nothing to install. Start any static server in the project folder, for example:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Files

- `index.html` – page structure
- `style.css` – the cute pink look, mobile-first
- `app.js` – jars, to-dos, coins, animations and saving to `localStorage`

## Built with AI

This app was built with vibe coding using Claude Code: the idea was described in natural language, then the AI helped plan the features, write the code and test it in a browser on both phone and desktop sizes.
