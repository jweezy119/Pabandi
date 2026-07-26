const fs = require('fs');
let sb = fs.readFileSync('STORYBOARD.md', 'utf8');

sb = sb.replace('## Frame 1 — The Hook\n\n- scene:', '## Frame 1 — The Hook\n\n- src: compositions/frames/01-hook.html\n- scene:');
sb = sb.replace('## Frame 2 — The Onramp\n\n- scene:', '## Frame 2 — The Onramp\n\n- src: compositions/frames/02-onramp.html\n- scene:');
sb = sb.replace('## Frame 3 — FX Router & Escrow\n\n- scene:', '## Frame 3 — FX Router & Escrow\n\n- src: compositions/frames/03-fx-router.html\n- scene:');
sb = sb.replace('## Frame 4 — The Yield\n\n- scene:', '## Frame 4 — The Yield\n\n- src: compositions/frames/04-yield.html\n- scene:');
sb = sb.replace('## Frame 5 — The Offramp\n\n- scene:', '## Frame 5 — The Offramp\n\n- src: compositions/frames/05-offramp.html\n- scene:');
sb = sb.replace('## Frame 6 — The Settlement\n\n- scene:', '## Frame 6 — The Settlement\n\n- src: compositions/frames/06-settlement.html\n- scene:');
sb = sb.replace('## Frame 7 — Outro\n\n- scene:', '## Frame 7 — Outro\n\n- src: compositions/frames/07-outro.html\n- scene:');

fs.writeFileSync('STORYBOARD.md', sb);
