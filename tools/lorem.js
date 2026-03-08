// Lorem Ipsum Generator
// Generates randomized placeholder text in paragraph, sentence, or word mode.

import { copyText } from './utils.js';

const loremMode       = document.getElementById('loremMode');
const loremCount      = document.getElementById('loremCount');
const loremCountLabel = document.getElementById('loremCountLabel');
const loremClassic    = document.getElementById('loremClassic');
const loremHtml       = document.getElementById('loremHtml');
const loremGenerate   = document.getElementById('loremGenerate');
const loremCopy       = document.getElementById('loremCopy');
const loremOutput     = document.getElementById('loremOutput');
const loremStatus     = document.getElementById('loremStatus');

// Word pool — a broad set of Lorem Ipsum-style Latin-ish words.
const WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit',
  'sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore',
  'magna','aliqua','enim','ad','minim','veniam','quis','nostrud','exercitation',
  'ullamco','laboris','nisi','aliquip','ex','ea','commodo','consequat',
  'duis','aute','irure','in','reprehenderit','voluptate','velit','esse',
  'cillum','eu','fugiat','nulla','pariatur','excepteur','sint','occaecat',
  'cupidatat','non','proident','sunt','culpa','qui','officia','deserunt',
  'mollit','anim','id','est','laborum','at','vero','eos','accusamus',
  'iusto','odio','dignissimos','ducimus','blanditiis','praesentium','voluptatum',
  'deleniti','atque','corrupti','quos','dolores','quas','molestias','excepturi',
  'similique','culpa','blanditiis','praesentium','voluptatum','deleniti',
  'perspiciatis','unde','omnis','iste','natus','error','sit','voluptatem',
  'accusantium','doloremque','laudantium','totam','rem','aperiam','eaque',
  'ipsa','quae','ab','illo','inventore','veritatis','architecto','beatae',
  'vitae','dicta','sunt','explicabo','nemo','ipsam','voluptatem','quia',
  'voluptas','aspernatur','aut','odit','fugit','consequatur','magni',
  'dolores','eos','ratione','sequi','nesciunt','neque','porro','quisquam',
  'est','qui','dolorem','ipsum','quia','dolor','sit','amet','adipisci',
  'velit','num','quam','eius','modi','tempora','incidunt','labore','porro',
  'magnam','aliquam','quaerat','minima','nostrum','exercitationem','ullam',
  'corporis','suscipit','laboriosam','nisi','beneficium','aliquid',
  'placeat','facere','possimus','omnis','voluptas','assumenda','repellendus',
  'temporibus','autem','quibusdam','officiis','debitis','rerum','necessitatibus',
  'saepe','eveniet','ut','repudiandae','itaque','earum','hic','tenetur',
  'sapiente','delectus','reiciendis','voluptatibus','maiores','alias','consequatur',
  'aut','perferendis','doloribus','asperiores',
];

const CLASSIC_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

// Seeded shuffle to vary word order.
let seed = Date.now();
function rand(n) {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return Math.abs(seed) % n;
}

function pickWord() {
  return WORDS[rand(WORDS.length)];
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function makeSentence(wordCount) {
  const words = [];
  for (let i = 0; i < wordCount; i++) words.push(pickWord());
  return capitalize(words.join(' ')) + '.';
}

function makeParagraph(sentenceCount) {
  const sentences = [];
  for (let i = 0; i < sentenceCount; i++) {
    // Sentence length: 8–16 words
    sentences.push(makeSentence(8 + rand(9)));
  }
  return sentences.join(' ');
}

function generate() {
  seed = Date.now(); // re-seed for fresh randomness each run
  const mode    = loremMode.value;
  const count   = Math.max(1, Math.min(100, parseInt(loremCount.value, 10) || 3));
  const classic = loremClassic.checked;
  const asHtml  = loremHtml.checked;

  const paragraphs = [];

  if (mode === 'paragraphs') {
    for (let p = 0; p < count; p++) {
      // Paragraphs: 4–7 sentences each
      const text = (p === 0 && classic) ? buildClassicParagraph() : makeParagraph(4 + rand(4));
      paragraphs.push(text);
    }
  } else if (mode === 'sentences') {
    const allSentences = [];
    if (classic) allSentences.push(CLASSIC_START);
    const needed = classic ? count - 1 : count;
    for (let i = 0; i < needed; i++) allSentences.push(makeSentence(8 + rand(9)));
    // Group into ~4-sentence paragraphs for readability
    for (let i = 0; i < allSentences.length; i += 4) {
      paragraphs.push(allSentences.slice(i, i + 4).join(' '));
    }
  } else { // words
    const allWords = [];
    if (classic) {
      const classicWords = CLASSIC_START.replace(/[.,]/g, '').toLowerCase().split(' ');
      allWords.push(...classicWords.slice(0, Math.min(count, classicWords.length)));
    }
    const needed = classic ? Math.max(0, count - allWords.length) : count;
    for (let i = 0; i < needed; i++) allWords.push(pickWord());
    // Group words into a paragraph of ~10 words per line
    paragraphs.push(allWords.join(' ') + '.');
  }

  const text = asHtml
    ? paragraphs.map(p => `<p>${p}</p>`).join('\n')
    : paragraphs.join('\n\n');

  loremOutput.value = text;

  // Status: word and char count
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  loremStatus.textContent = `${wordCount} words · ${charCount} chars`;

  loremCopy.disabled = !text;
}

function buildClassicParagraph() {
  // Start with classic sentence, add more sentences to fill the paragraph.
  const extra = [];
  for (let i = 0; i < 4 + rand(3); i++) extra.push(makeSentence(8 + rand(9)));
  return CLASSIC_START + ' ' + extra.join(' ');
}

function updateCountLabel() {
  const mode = loremMode.value;
  loremCountLabel.textContent =
    mode === 'paragraphs' ? 'Paragraphs' :
    mode === 'sentences'  ? 'Sentences'  :
                            'Words';
}

loremMode.addEventListener('change', () => { updateCountLabel(); generate(); });
loremCount.addEventListener('input', generate);
loremClassic.addEventListener('change', generate);
loremHtml.addEventListener('change', generate);
loremGenerate.addEventListener('click', generate);
loremCopy.addEventListener('click', () => {
  copyText(loremOutput.value, loremCopy);
});

// Init
generate();
