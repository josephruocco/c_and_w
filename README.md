# Chabad & Weave

A dependency-free, pixel-art browser arcade prototype about an interrupted Brooklyn jog. Fictional neighborhood satire; unaffiliated with Chabad. The underground route is game fantasy, not a factual account.

## Play

Run `python3 -m http.server 5173` here and open http://localhost:5173. You can also open `index.html` directly. No build step. The game fills the available window with its original aspect ratio preserved. No remote fonts or assets; gameplay works offline.

- Left/right or A/D: turn around and run left or right. You keep running in your selected direction; distance counts travel in either direction.
- Space, up, or W: jump from the ground or a cloud; hold to jump again on landing; Space also starts/restarts/resumes.
- Press Jump again in midair for a double-jump barrel roll. One air boost per landing; works in the park, clouds, tunnels, and RV arena. Holding Jump still automatically jumps on landing and does not spend the midair flip.
- Down or S: enter a nearby hatch while on the ground.
- P or Escape: pause. Switching away pauses automatically.
- Touch controls are provided on touch devices.
- A collision stops the run and costs one focus point. Click **Respectfully decline** to continue; keyboard shortcuts cannot dismiss the conversation. The third conversation ends the run after declining.
- Avoid conversations to preserve three focus points. Every three bagels restores one point.
- Cloud layouts vary each run, with different widths, spacing, and heights. Some clouds drift sideways or bob vertically, carrying the runner and any characters standing on them. First clouds and refuge clouds remain stationary.
- Cloud staircases climb from the park into outer space. Falling returns you to the park without fall damage. Space outreach characters require the same click-to-decline interaction.
- The fictional Pearly Gates cloud grants 12 seconds of immunity, once per rest stop per run. A halo and countdown show when it is active. This is fantasy scenery, not a statement about religious beliefs.
- Tunnels return to the park automatically, or use an exit hatch.
- Best distance is saved on this browser when storage is available. Sound is opt-in.

## Levels and pace

Four 250-meter levels lead to the finale: Warm-up, Picking Up Pace, Full Stride, and Final Stretch. Speed rises smoothly from 225 to 330 pixels per second over the 1,000-meter run. Each new level restores one focus point, up to three. A progress bar shows the distance to the next level or boss; reversing direction still counts toward progress.

## Final boss

At 1,000 meters, the run moves to the MOSHIAH RV arena. Focus resets to three for the fight. Dodge five charges to win; the RV chooses a random side for each charge, with no warning arrow or horn. Consecutive charges can come from the same side. It speeds up after each successful dodge. A collision costs one focus point and that pass does not count. Arrows move within the arena and Space jumps over the roof. There are no conversation popups during the boss. Pause works normally, and losing lets you retry the boss directly. Use **Practice Boss** on the title screen to try it immediately.

## Files

`index.html` is the page shell; `style.css` handles layout; `game.js` contains the canvas art and game logic; `boss.js` handles the RV finale. All art is original code-drawn pixel art. No external images, engine, or package installation required.
