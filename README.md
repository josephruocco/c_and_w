# Chabad & Weave

A dependency-free, pixel-art browser arcade prototype about an interrupted Brooklyn jog. Fictional neighborhood satire; unaffiliated with Chabad. The underground route is game fantasy, not a factual account.

## Play

Run `python3 -m http.server 5173` here and open http://localhost:5173. You can also open `index.html` directly. No build step. Fonts use Google Fonts with system fallbacks; gameplay works offline.

- Left/right or A/D: adjust position while the route scrolls automatically.
- Space, up, or W: jump; Space also starts/restarts/resumes.
- Down or S: enter a nearby hatch while on the ground.
- P or Escape: pause. Switching away pauses automatically.
- Touch controls are provided on smaller screens.
- Avoid conversations to preserve three focus points. Every three bagels restores one point.
- Tunnels return to the park automatically, or use an exit hatch.
- Best distance is saved on this browser when storage is available. Sound is opt-in.

## Files

`index.html` is the page shell; `style.css` handles layout; `game.js` contains the canvas art and game logic. All art is original code-drawn pixel art. No external images, engine, or package installation required.
