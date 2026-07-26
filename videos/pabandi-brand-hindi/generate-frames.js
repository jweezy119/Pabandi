const fs = require('fs');
const path = require('path');

const frames = [
  {
    name: '01-hook.html',
    bg: 'blue',
    fg: '../../public/merchant.png',
    text1: 'Still using SWIFT?'
  },
  {
    name: '02-waiting.html',
    bg: 'blue',
    fg: '../../public/merchant.png',
    text1: 'Wow...',
    text2: 'Waiting 5 Days for your own money'
  },
  {
    name: '03-banker.html',
    bg: 'blue',
    fg: '../../public/banker.png',
    text1: 'While they count your cash...'
  },
  {
    name: '04-solution.html',
    bg: 'blue',
    text1: 'Enter',
    text2: 'Pabandi Liquidity Protocol',
    hero: true
  },
  {
    name: '05-instant.html',
    bg: 'blue',
    text1: 'Instant P2P.',
    text2: 'Zero Crypto Headaches.'
  },
  {
    name: '06-chill.html',
    bg: 'blue',
    fg: '../../public/lp.png',
    text1: 'Everyone stays chill.'
  },
  {
    name: '07-outro.html',
    bg: 'blue',
    text1: 'Pabandi.',
    text2: 'Start today.',
    hero: true
  }
];

const template = (f, id) => `
<div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
  <template>
    <style>
      #root {
        width: 1920px; height: 1080px; position: relative; overflow: hidden;
        background-color: var(--hf-canvas); color: var(--hf-ink);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', sans-serif;
      }
      .content {
        text-align: center;
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 40px;
      }
      .text-large {
        font-size: ${f.hero ? '120px' : '90px'};
        font-weight: 800;
        letter-spacing: -2px;
      }
      .text-medium {
        font-size: 70px;
        font-weight: 500;
        opacity: 0.8;
      }
      .image-container {
        width: 600px;
        height: 600px;
        margin-bottom: 40px;
        transform: scale(0);
      }
      .image-container img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    </style>
    <div class="content">
      ${f.fg ? \`<div class="image-container" data-hf-id="image"><img src="\${f.fg}" /></div>\` : ''}
      ${f.text1 ? \`<div class="text-large" data-hf-id="text1">\${f.text1}</div>\` : ''}
      ${f.text2 ? \`<div class="text-medium" data-hf-id="text2">\${f.text2}</div>\` : ''}
    </div>
    <script>
      const tl = gsap.timeline();
      ${f.fg ? \`tl.to('[data-hf-id="image"]', { scale: 1, duration: 1, ease: 'power3.out' }, 0);\` : ''}
      ${f.text1 ? \`tl.from('[data-hf-id="text1"]', { y: 100, opacity: 0, duration: 1, ease: 'power3.out' }, ${f.fg ? '1' : '0'});\` : ''}
      ${f.text2 ? \`tl.from('[data-hf-id="text2"]', { y: 50, opacity: 0, duration: 1, ease: 'power3.out' }, ${f.fg ? '1.5' : '0.5'});\` : ''}
    </script>
  </template>
</div>
`;

frames.forEach((f, i) => {
  const num = String(i + 1).padStart(2, '0');
  const id = \`frame-\${num}\`;
  fs.writeFileSync(path.join(__dirname, 'compositions', 'frames', f.name), template(f, id));
});
console.log('Frames generated.');
