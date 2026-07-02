const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEY_SEQUENCE = "1234567890qwertyuiopasdfghjkl".split("");
const KEY_BASE_MIDI = 36;
const KEY_BINDINGS = KEY_SEQUENCE.map((key, index) => [key, KEY_BASE_MIDI + index]);

const STYLES = [
  ["Rousseau Classic", "Âm grand piano sáng, reverb rộng, nốt rơi xanh lam.", "#41d7ff", "sine", 0.008, 1.3, 6800, 0.18],
  ["Moonlight Sonata", "Tối, mềm, ngân dài cho đoạn chậm và buồn.", "#8aa3ff", "sine", 0.02, 2.2, 3600, 0.28],
  ["Anime Ballad", "Trong trẻo, lấp lánh, hợp melody cảm xúc.", "#ff8ad8", "triangle", 0.01, 1.7, 7200, 0.22],
  ["Lo-fi Room", "Ấm, hơi mờ, attack dịu như piano trong phòng nhỏ.", "#d8b982", "triangle", 0.025, 1.1, 2600, 0.35],
  ["Concert Hall", "Rộng, vang, sáng kiểu sân khấu lớn.", "#7cffb4", "sine", 0.006, 2.5, 7600, 0.32],
  ["Chopin Nocturne", "Mềm, tròn, sustain dài cho arpeggio tay trái.", "#d6a6ff", "sine", 0.018, 2.0, 5200, 0.26],
  ["Liszt Thunder", "Mạnh, sáng, decay nhanh cho đoạn cao trào.", "#ff5c5c", "sawtooth", 0.004, 1.0, 8200, 0.12],
  ["Debussy Water", "Mơ, trong, màu xanh nước cho hợp âm mở.", "#66fff0", "triangle", 0.016, 2.4, 6200, 0.38],
  ["Baroque Clean", "Gọn, rõ từng nốt, ít reverb.", "#ffd166", "square", 0.004, 0.72, 5000, 0.08],
  ["Jazz Velvet", "Ấm, mềm, hợp voicing jazz.", "#c98a4a", "triangle", 0.02, 1.4, 3200, 0.2],
  ["Neo Soul", "Dày, trầm ấm, hợp chord màu.", "#b4ff6a", "triangle", 0.018, 1.6, 4100, 0.24],
  ["Cinematic Dark", "Tối, nặng, có độ căng cho nhạc phim.", "#6e7cff", "sine", 0.03, 2.8, 2800, 0.34],
  ["Crystal Keys", "Rất sáng, nốt cao nổi bật.", "#dfffff", "sine", 0.003, 1.6, 9000, 0.18],
  ["Dream Pop", "Mềm, delay nhẹ, hợp melody bay.", "#ff9ecf", "triangle", 0.024, 2.1, 5600, 0.36],
  ["Minimal Pulse", "Gọn, nhấn rõ, hợp ostinato.", "#ffffff", "square", 0.006, 0.58, 4600, 0.1],
  ["Epic Trailer", "Attack mạnh, màu đỏ cam, hợp nhịp lớn.", "#ff884d", "sawtooth", 0.004, 1.3, 7000, 0.2],
  ["Soft Practice", "Nhẹ tai để tập lâu.", "#b7c5d9", "sine", 0.018, 0.95, 4200, 0.16],
  ["Glass Harp", "Âm như chuông kính, decay dài.", "#b8f7ff", "sine", 0.002, 2.6, 8500, 0.3],
  ["Warm Upright", "Piano đứng ấm, ít chói.", "#e6b87a", "triangle", 0.02, 1.15, 3000, 0.18],
  ["Rainy Window", "Êm, ẩm, phù hợp ballad đêm mưa.", "#7bb7ff", "sine", 0.028, 2.3, 3400, 0.42],
  ["Pop Bright", "Sáng, rõ, dễ nổi trong bản pop.", "#64f4ff", "triangle", 0.006, 1.0, 8200, 0.14],
  ["K-drama Piano", "Ngọt, mềm, cao vừa đủ cho giai điệu tình cảm.", "#ffc1e3", "sine", 0.015, 1.85, 6000, 0.28],
  ["Game OST", "Sáng, hơi điện tử, hợp loop game.", "#8dff6a", "square", 0.005, 1.2, 6800, 0.2],
  ["Cathedral", "Vang sâu, ngân rất dài.", "#bca8ff", "sine", 0.035, 3.4, 4200, 0.48],
  ["Felt Piano", "Rất mềm, tiếng búa nỉ, ít sắc cạnh.", "#cfc1a5", "sine", 0.032, 1.8, 2400, 0.22],
  ["Electric Grand", "Có cạnh điện, hợp groove hiện đại.", "#4dffe1", "sawtooth", 0.006, 1.0, 6200, 0.16],
  ["Study Focus", "Cân bằng, không quá vang, hợp luyện bài.", "#a6d8ff", "triangle", 0.012, 1.2, 4800, 0.12],
  ["Romantic Rubato", "Nhạy, ngân dài, hợp kéo nhịp tự do.", "#ffb3c7", "sine", 0.022, 2.4, 5200, 0.3],
  ["Staccato Spark", "Ngắn, bật nhanh, hợp đoạn vui.", "#fff06a", "square", 0.002, 0.32, 7800, 0.06],
  ["Bass Heavy", "Trầm rõ, dày hơn cho tay trái.", "#67a2ff", "sawtooth", 0.012, 1.5, 2600, 0.18],
  ["Treble Shine", "Nhấn dải cao, hợp chạy nốt nhanh.", "#f7ffff", "sine", 0.004, 1.05, 10000, 0.12],
  ["Ambient Wash", "Rất bay, sustain và delay rộng.", "#9de7ff", "sine", 0.045, 3.2, 5000, 0.5],
  ["Funk Keys", "Khô, nhanh, có độ cắn.", "#a9ff4d", "square", 0.003, 0.52, 5600, 0.08],
  ["Sad Waltz", "Ấm, chậm, hợp nhịp 3/4.", "#9fa6ff", "triangle", 0.024, 2.1, 3600, 0.3],
  ["Holiday Bells", "Sáng như chuông lễ hội.", "#fff6b0", "sine", 0.002, 1.9, 9200, 0.22],
  ["Mystery Score", "Mờ, căng, hơi tối.", "#7d6bff", "triangle", 0.035, 2.8, 2200, 0.4],
  ["Latin Piano", "Rõ attack, release vừa phải cho nhịp syncopation.", "#ffcf5a", "triangle", 0.004, 0.86, 6800, 0.1],
  ["EDM Piano", "Sáng, nén cảm giác mạnh, hợp chord pop điện tử.", "#35f0ff", "sawtooth", 0.003, 0.92, 9000, 0.12],
  ["Old Tape", "Ấm, tối, hơi cổ điển.", "#d9a66a", "triangle", 0.026, 1.45, 2100, 0.26],
  ["Finale Glow", "Rộng, sáng, tạo cảm giác kết bài lớn.", "#ffffff", "sine", 0.008, 2.7, 7800, 0.36],
  ["Human Scream Lead", "Giọng người hét cao, sáng, dùng nốt đàn để đổi cao độ.", "#ff35d2", "voice-scream", 0.01, 0.8, 4800, 0.18],
  ["Human Scream Choir", "Nhiều lớp giọng hét như hợp xướng hoảng loạn.", "#fff45c", "voice-scream", 0.018, 1.25, 5200, 0.26],
  ["Monster Throat Scream", "Giọng hét trầm, khàn cổ họng, hợp nốt bass.", "#ff004c", "voice-scream", 0.02, 1.05, 2600, 0.22],
  ["Opera Panic Scream", "Hét kiểu opera cao và ngân dài.", "#ffffff", "voice-scream", 0.026, 1.65, 6200, 0.34],
  ["Robot Human Scream", "Giọng người hét bị méo điện tử, rất màu mè.", "#00f5ff", "voice-scream", 0.006, 0.74, 7000, 0.14],
  ["Crowd Horror Scream", "Đám đông hét hỗn loạn, dày và rộng.", "#d6a6ff", "voice-scream", 0.012, 1.45, 4200, 0.4]
].map(([name, description, color, wave, attack, release, cutoff, delay]) => ({
  name,
  description,
  color,
  wave,
  attack,
  release,
  cutoff,
  delay,
  instrument: wave === "voice-scream" ? "scream" : "piano"
}));

const FALL_STYLES = [
  { name: "Classic bars", mode: "bars" },
  { name: "Neon rain", mode: "rain" },
  { name: "Crystal blocks", mode: "blocks" },
  { name: "Comet trails", mode: "comets" },
  { name: "Ribbon flow", mode: "ribbons" },
  { name: "Fire sparks", mode: "sparks" },
  { name: "Matrix guide", mode: "matrix" },
  { name: "Wide concert", mode: "concert" }
];

const SONG_CATALOG = [
  ["Twinkle Twinkle Little Star", "Dân ca", "easy", "C", "#ffd166"],
  ["Happy Birthday", "Dân ca", "easy", "G", "#ff9ecf"],
  ["Amazing Grace", "Thánh ca", "easy", "D", "#7cffb4"],
  ["Auld Lang Syne", "Dân ca Scotland", "easy", "F", "#8aa3ff"],
  ["Greensleeves", "Dân ca Anh", "medium", "A", "#b4ff6a"],
  ["Scarborough Fair", "Dân ca Anh", "medium", "D", "#66fff0"],
  ["Shenandoah", "Dân ca Mỹ", "easy", "G", "#e6b87a"],
  ["Oh Susanna", "Dân ca Mỹ", "easy", "C", "#fff06a"],
  ["When the Saints Go Marching In", "Spiritual", "easy", "C", "#ff884d"],
  ["House of the Rising Sun", "Dân ca", "medium", "A", "#d6a6ff"],
  ["Danny Boy", "Dân ca Ireland", "medium", "F", "#9de7ff"],
  ["Molly Malone", "Dân ca Ireland", "easy", "G", "#a9ff4d"],
  ["Red River Valley", "Dân ca Mỹ", "easy", "D", "#ffcf5a"],
  ["Yankee Doodle", "Dân ca Mỹ", "easy", "C", "#ffffff"],
  ["Camptown Races", "Dân ca Mỹ", "easy", "G", "#ff5c5c"],
  ["Home on the Range", "Dân ca Mỹ", "easy", "F", "#cfc1a5"],
  ["My Bonnie Lies Over the Ocean", "Dân ca", "easy", "C", "#35f0ff"],
  ["Aura Lee", "Dân ca Mỹ", "easy", "G", "#ffc1e3"],
  ["The Blue Bells of Scotland", "Dân ca Scotland", "medium", "D", "#67a2ff"],
  ["Loch Lomond", "Dân ca Scotland", "medium", "F", "#bca8ff"],
  ["Ode to Joy", "Beethoven", "easy", "C", "#41d7ff"],
  ["Für Elise", "Beethoven", "medium", "A", "#ff8ad8"],
  ["Moonlight Sonata", "Beethoven", "medium", "C", "#8aa3ff"],
  ["Minuet in G", "Bach/Petzold", "easy", "G", "#ffd166"],
  ["Jesu, Joy of Man's Desiring", "Bach", "medium", "G", "#7cffb4"],
  ["Prelude in C Major", "Bach", "medium", "C", "#ffffff"],
  ["Air on the G String", "Bach", "medium", "D", "#9de7ff"],
  ["Canon in D", "Pachelbel", "medium", "D", "#66fff0"],
  ["Spring from Four Seasons", "Vivaldi", "medium", "E", "#b4ff6a"],
  ["Winter from Four Seasons", "Vivaldi", "hard", "F", "#dfffff"],
  ["Eine Kleine Nachtmusik", "Mozart", "medium", "G", "#fff6b0"],
  ["Turkish March", "Mozart", "hard", "A", "#ff884d"],
  ["Twinkle Variations", "Mozart", "medium", "C", "#ff9ecf"],
  ["Lacrimosa", "Mozart", "medium", "D", "#7d6bff"],
  ["The Blue Danube", "Strauss", "medium", "D", "#64f4ff"],
  ["Radetzky March", "Strauss", "medium", "C", "#ff5c5c"],
  ["Morning Mood", "Grieg", "easy", "E", "#b8f7ff"],
  ["In the Hall of the Mountain King", "Grieg", "medium", "A", "#6e7cff"],
  ["Swan Lake", "Tchaikovsky", "medium", "B", "#d6a6ff"],
  ["Dance of the Sugar Plum Fairy", "Tchaikovsky", "medium", "E", "#f7ffff"],
  ["1812 Overture", "Tchaikovsky", "hard", "E", "#ff884d"],
  ["Sleeping Beauty Waltz", "Tchaikovsky", "medium", "G", "#ffc1e3"],
  ["Nutcracker March", "Tchaikovsky", "medium", "G", "#fff06a"],
  ["Hungarian Dance No. 5", "Brahms", "hard", "G", "#ff5c5c"],
  ["Lullaby", "Brahms", "easy", "E", "#cfc1a5"],
  ["Wedding March", "Mendelssohn", "medium", "C", "#ffffff"],
  ["Bridal Chorus", "Wagner", "easy", "B", "#ffd166"],
  ["William Tell Overture", "Rossini", "hard", "E", "#ff884d"],
  ["Habanera", "Bizet", "medium", "D", "#ff5ca8"],
  ["Toreador Song", "Bizet", "medium", "F", "#ffcf5a"],
  ["Gymnopédie No. 1", "Satie", "easy", "D", "#9de7ff"],
  ["Gnossienne No. 1", "Satie", "medium", "F", "#bca8ff"],
  ["Clair de Lune", "Debussy", "medium", "D", "#66fff0"],
  ["Arabesque No. 1", "Debussy", "hard", "E", "#35f0ff"],
  ["The Entertainer", "Joplin", "medium", "C", "#fff06a"],
  ["Maple Leaf Rag", "Joplin", "hard", "A", "#ffcf5a"],
  ["Elite Syncopations", "Joplin", "hard", "G", "#a9ff4d"],
  ["Nocturne Op. 9 No. 2", "Chopin", "medium", "E", "#d6a6ff"],
  ["Prelude Op. 28 No. 4", "Chopin", "medium", "E", "#9fa6ff"],
  ["Raindrop Prelude", "Chopin", "medium", "D", "#7bb7ff"],
  ["Minute Waltz", "Chopin", "hard", "D", "#ff9ecf"],
  ["Revolutionary Etude", "Chopin", "hard", "C", "#ff5c5c"],
  ["Träumerei", "Schumann", "easy", "F", "#cfc1a5"],
  ["The Wild Horseman", "Schumann", "medium", "A", "#ff884d"],
  ["Liebestraum No. 3", "Liszt", "hard", "A", "#d6a6ff"],
  ["La Campanella", "Liszt", "hard", "G", "#dfffff"],
  ["Consolation No. 3", "Liszt", "medium", "D", "#8aa3ff"],
  ["Ave Maria", "Schubert", "easy", "B", "#7cffb4"],
  ["Serenade", "Schubert", "medium", "D", "#9de7ff"],
  ["The Trout", "Schubert", "medium", "D", "#66fff0"],
  ["Canon Fantasy", "Baroque", "medium", "D", "#41d7ff"],
  ["Alouette", "Dân ca Pháp", "easy", "C", "#ffd166"],
  ["Frère Jacques", "Dân ca Pháp", "easy", "C", "#7cffb4"],
  ["Sur le Pont d'Avignon", "Dân ca Pháp", "easy", "F", "#ff9ecf"],
  ["La Cucaracha", "Dân ca Mexico", "easy", "C", "#ff884d"],
  ["Cielito Lindo", "Dân ca Mexico", "medium", "G", "#ffcf5a"],
  ["Korobeiniki", "Dân ca Nga", "medium", "A", "#ff5c5c"],
  ["Kalinka", "Dân ca Nga", "medium", "G", "#a9ff4d"],
  ["Dark Eyes", "Dân ca Nga", "medium", "D", "#7d6bff"],
  ["Sakura Sakura", "Dân ca Nhật", "easy", "D", "#ffc1e3"],
  ["Arirang", "Dân ca Hàn", "easy", "G", "#b8f7ff"],
  ["Mo Li Hua", "Dân ca Trung Hoa", "easy", "C", "#fff6b0"],
  ["Waltzing Matilda", "Dân ca Úc", "easy", "G", "#d9a66a"],
  ["Baa Baa Black Sheep", "Dân ca", "easy", "C", "#ffffff"],
  ["Mary Had a Little Lamb", "Dân ca", "easy", "C", "#ffd166"],
  ["London Bridge", "Dân ca Anh", "easy", "C", "#66fff0"],
  ["Row Row Row Your Boat", "Dân ca", "easy", "C", "#7cffb4"],
  ["Pop Goes the Weasel", "Dân ca Anh", "easy", "G", "#ff5ca8"],
  ["This Old Man", "Dân ca", "easy", "C", "#a6d8ff"],
  ["For He's a Jolly Good Fellow", "Dân ca", "easy", "F", "#fff06a"],
  ["Hark! The Herald Angels Sing", "Carol", "easy", "G", "#ffd166"],
  ["Silent Night", "Carol", "easy", "G", "#b8f7ff"],
  ["Jingle Bells", "Carol", "easy", "C", "#ff5c5c"],
  ["Deck the Halls", "Carol", "medium", "F", "#7cffb4"],
  ["Joy to the World", "Carol", "easy", "D", "#fff6b0"],
  ["We Wish You a Merry Christmas", "Carol", "easy", "G", "#ffcf5a"],
  ["O Christmas Tree", "Carol", "easy", "F", "#a9ff4d"],
  ["The First Noel", "Carol", "easy", "D", "#9de7ff"],
  ["God Rest Ye Merry Gentlemen", "Carol", "medium", "E", "#7d6bff"],
  ["Carol of the Bells Pattern", "Carol", "medium", "A", "#dfffff"]
];

const piano = document.querySelector("#piano");
const keyMap = document.querySelector("#keyMap");
const styleSelect = document.querySelector("#styleSelect");
const songSelect = document.querySelector("#songSelect");
const startGuideButton = document.querySelector("#startGuideButton");
const stopGuideButton = document.querySelector("#stopGuideButton");
const currentSongName = document.querySelector("#currentSongName");
const guideStatus = document.querySelector("#guideStatus");
const currentStyleName = document.querySelector("#currentStyleName");
const currentStyleDesc = document.querySelector("#currentStyleDesc");
const volumeControl = document.querySelector("#volumeControl");
const octaveControl = document.querySelector("#octaveControl");
const octaveValue = document.querySelector("#octaveValue");
const tempoControl = document.querySelector("#tempoControl");
const tempoValue = document.querySelector("#tempoValue");
const fallStyleSelect = document.querySelector("#fallStyleSelect");
const sustainToggle = document.querySelector("#sustainToggle");
const visualToggle = document.querySelector("#visualToggle");
const recordButton = document.querySelector("#recordButton");
const playButton = document.querySelector("#playButton");
const clearButton = document.querySelector("#clearButton");
const recordStatus = document.querySelector("#recordStatus");
const audioStatus = document.querySelector("#audioStatus");
const canvas = document.querySelector("#noteCanvas");
const ctx = canvas.getContext("2d");
const visualizer = document.querySelector("#visualizer");
const fxLayer = document.createElement("div");
const cursorAura = document.createElement("div");
fxLayer.className = "fx-layer";
cursorAura.className = "cursor-aura";
document.body.append(fxLayer, cursorAura);

let audioContext;
let masterGain;
let delayNode;
let delayGain;
let activeStyle = STYLES[0];
let activeFallStyle = FALL_STYLES[0];
let activeKeys = new Map();
let fallingNotes = [];
let guideNotes = [];
let guideScore = { hit: 0, total: 0 };
let guidePlaying = false;
let guideStart = 0;
let activeSong = null;
let sustain = true;
let visualsEnabled = true;
let isRecording = false;
let recordStart = 0;
let recorded = [];
let lastSparkleAt = 0;

function midiToNote(midi) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function randomNeonColor() {
  const colors = ["#ff35d2", "#ff008c", "#00f5ff", "#fff45c", "#7cffb4", "#d6a6ff", "#ffffff"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function removeAfter(element, ms) {
  window.setTimeout(() => element.remove(), ms);
}

function spawnSparkle(x, y, amount = 1) {
  for (let i = 0; i < amount; i += 1) {
    const sparkle = document.createElement("span");
    const distance = 24 + Math.random() * 80;
    const angle = Math.random() * Math.PI * 2;
    sparkle.className = "sparkle";
    sparkle.style.left = `${x + (Math.random() - 0.5) * 18}px`;
    sparkle.style.top = `${y + (Math.random() - 0.5) * 18}px`;
    sparkle.style.setProperty("--spark-color", randomNeonColor());
    sparkle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    sparkle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    fxLayer.appendChild(sparkle);
    removeAfter(sparkle, 820);
  }
}

function spawnBurst(x, y, label = "") {
  const ring = document.createElement("span");
  ring.className = "burst-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.setProperty("--spark-color", randomNeonColor());
  fxLayer.appendChild(ring);
  removeAfter(ring, 680);
  spawnSparkle(x, y, 14);

  if (label) {
    const pop = document.createElement("span");
    pop.className = "note-pop";
    pop.textContent = label;
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    fxLayer.appendChild(pop);
    removeAfter(pop, 900);
  }
}

function keyCenter(bindingKey) {
  const el = piano.querySelector(`[data-key="${bindingKey}"]`);
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 };
}

function getStyledMidi(midi) {
  return midi + Number(octaveControl.value) * 12;
}

function isBlack(midi) {
  return NOTE_NAMES[midi % 12].includes("#");
}

function keyForMidi(midi) {
  const normalized = ((midi - KEY_BASE_MIDI) % KEY_BINDINGS.length) + KEY_BASE_MIDI;
  const binding = KEY_BINDINGS.find(([, note]) => note === normalized);
  return binding ? binding[0] : null;
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashSong(song) {
  return song.join("").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function rootMidi(root) {
  const index = NOTE_NAMES.indexOf(root);
  return 60 + Math.max(index, 0);
}

function generateGuideSong(song) {
  const [title, genre, difficulty, root, color] = song;
  const random = seededRandom(hashSong(song));
  const scale = difficulty === "hard" ? [0, 2, 3, 5, 7, 8, 10, 12] : [0, 2, 4, 5, 7, 9, 11, 12];
  const phraseLength = difficulty === "hard" ? 48 : difficulty === "medium" ? 40 : 32;
  const beat = difficulty === "hard" ? 420 : difficulty === "medium" ? 520 : 620;
  const base = rootMidi(root);
  const notes = [];
  let degree = Math.floor(random() * 4);

  for (let i = 0; i < phraseLength; i += 1) {
    const leap = random() > 0.78 ? (random() > 0.5 ? 2 : -2) : (random() > 0.5 ? 1 : -1);
    degree = Math.max(0, Math.min(scale.length - 1, degree + leap));
    const octaveLift = i % 16 > 10 && random() > 0.35 ? 12 : 0;
    const midi = base + scale[degree] + octaveLift - (base > 67 ? 12 : 0);
    const duration = beat * (random() > 0.82 ? 1.45 : random() > 0.22 ? 1 : 0.65);
    const wait = beat * (random() > 0.72 ? 1.25 : 1);
    const key = keyForMidi(midi);
    if (key) {
      notes.push({ key, midi, at: Math.round(i * wait), duration: Math.round(duration) });
    }
  }

  return { title, genre, difficulty, root, color, beat, notes };
}

function clearTargets() {
  document.querySelectorAll(".key.target").forEach((key) => key.classList.remove("target"));
}

function updateGuideTargets() {
  clearTargets();
  if (!guidePlaying) return;
  const now = performance.now() - guideStart;
  const upcoming = guideNotes.filter((note) => !note.hit && note.hitAt - now > -250 && note.hitAt - now < 900).slice(0, 4);
  for (const note of upcoming) {
    const key = piano.querySelector(`[data-key="${note.key}"]`);
    if (key) key.classList.add("target");
  }
}

function checkGuideHit(bindingKey) {
  if (!guidePlaying) return;
  const now = performance.now() - guideStart;
  const target = guideNotes.find((note) => !note.hit && note.key === bindingKey && Math.abs(note.hitAt - now) < 520);
  if (!target) return;
  target.hit = true;
  target.color = "#7cffb4";
  guideScore.hit += 1;
  guideStatus.textContent = `Đúng ${guideScore.hit}/${guideScore.total} nốt - tiếp tục bấm theo phím sáng.`;
}

function startGuide() {
  const song = generateGuideSong(SONG_CATALOG[Number(songSelect.value) || 0]);
  const tempo = Number(tempoControl.value);
  const lead = 2800;
  activeSong = song;
  guidePlaying = true;
  guideStart = performance.now();
  guideScore = { hit: 0, total: song.notes.length };
  guideNotes = song.notes.map((note, index) => {
    const hitAt = note.at / tempo + lead;
    return {
      ...note,
      hitAt,
      spawnAt: hitAt - lead,
      id: `${song.title}-${index}`,
      color: song.color,
      guide: true
    };
  });
  fallingNotes = fallingNotes.filter((note) => !note.guide);
  currentSongName.textContent = `${song.title} - ${song.genre}`;
  guideStatus.textContent = `Bài ${song.difficulty}, ${song.notes.length} nốt. Bấm khi nốt chạm vạch sáng.`;
  audioStatus.textContent = "Bài hướng dẫn đang chạy";
}

function stopGuide() {
  guidePlaying = false;
  guideNotes = [];
  clearTargets();
  guideStatus.textContent = "Đã dừng bài hướng dẫn.";
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    delayNode = audioContext.createDelay(1.2);
    delayGain = audioContext.createGain();
    delayNode.delayTime.value = activeStyle.delay;
    delayGain.gain.value = 0.18;
    masterGain.gain.value = Number(volumeControl.value);
    delayNode.connect(delayGain);
    delayGain.connect(masterGain);
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") audioContext.resume();
  audioStatus.textContent = "Âm thanh đã bật";
}

function createNoiseBuffer() {
  const length = Math.floor(audioContext.sampleRate * 0.22);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  return buffer;
}

function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function connectFormant(source, destination, frequency, q, amount = 1) {
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  gain.gain.value = amount;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
}

function playHumanScreamNote(midi, frequency) {
  const now = audioContext.currentTime;
  const output = audioContext.createGain();
  const vowelBus = audioContext.createGain();
  const throat = audioContext.createOscillator();
  const bright = audioContext.createOscillator();
  const rasp = audioContext.createOscillator();
  const vibrato = audioContext.createOscillator();
  const vibratoGain = audioContext.createGain();
  const noise = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const drive = audioContext.createWaveShaper();
  const base = Math.max(92, Math.min(frequency * 0.92, 880));
  const duration = Math.max(0.35, activeStyle.release + 0.22);
  const isLow = activeStyle.name.includes("Monster");
  const isChoir = activeStyle.name.includes("Choir") || activeStyle.name.includes("Crowd");
  const isRobot = activeStyle.name.includes("Robot");

  drive.curve = makeDistortionCurve(isRobot ? 520 : 240);
  drive.oversample = "4x";
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(isLow ? 0.9 : 0.72, now + activeStyle.attack + 0.025);
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  vibrato.type = isRobot ? "square" : "sine";
  vibrato.frequency.value = isRobot ? 22 : 6.5 + Math.random() * 3.5;
  vibratoGain.gain.value = isLow ? 18 : 32 + Math.random() * 24;
  vibrato.connect(vibratoGain);

  noise.buffer = createNoiseBuffer();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = isLow ? 450 : 1050;

  for (const osc of [throat, bright, rasp]) {
    osc.type = osc === bright ? "sawtooth" : "square";
    vibratoGain.connect(osc.frequency);
  }

  throat.frequency.setValueAtTime(base * (isLow ? 0.48 : 1.0), now);
  throat.frequency.exponentialRampToValueAtTime(base * (isLow ? 0.36 : 0.76), now + duration * 0.52);
  bright.frequency.setValueAtTime(base * 1.98, now);
  bright.frequency.exponentialRampToValueAtTime(base * 1.42, now + duration * 0.48);
  rasp.frequency.setValueAtTime(base * (isRobot ? 3.2 : 2.7), now);

  throat.connect(drive);
  bright.connect(drive);
  rasp.connect(drive);
  noise.connect(noiseFilter);
  noiseFilter.connect(drive);
  drive.connect(vowelBus);

  const formants = isLow
    ? [[520, 6, 1.1], [980, 9, 0.78], [2350, 8, 0.5]]
    : [[780, 7, 1.0], [1260, 10, 0.86], [3100, 8, 0.58]];
  for (const [formant, q, amount] of formants) {
    connectFormant(vowelBus, output, formant + (midi % 7) * 18, q, amount);
  }

  if (isChoir) {
    for (const offset of [-0.08, 0.07, 0.14]) {
      const extra = audioContext.createOscillator();
      extra.type = "sawtooth";
      extra.frequency.setValueAtTime(base * (1 + offset), now);
      extra.frequency.exponentialRampToValueAtTime(base * (0.76 + offset), now + duration * 0.52);
      extra.connect(drive);
      extra.start(now);
      extra.stop(now + duration + 0.04);
    }
  }

  output.connect(masterGain);
  output.connect(delayNode);
  throat.start(now);
  bright.start(now);
  rasp.start(now);
  vibrato.start(now);
  noise.start(now);
  throat.stop(now + duration + 0.04);
  bright.stop(now + duration + 0.04);
  rasp.stop(now + duration + 0.04);
  vibrato.stop(now + duration + 0.04);
  noise.stop(now + Math.min(duration, 0.5));
  return { gain: output, nodes: [throat, bright, rasp, vibrato], release: duration };
}

function playNote(bindingKey, midi, source = "keyboard") {
  ensureAudio();
  const styledMidi = getStyledMidi(midi);
  const frequency = midiToFrequency(styledMidi);
  const center = keyCenter(bindingKey);

  if (activeStyle.instrument === "scream") {
    const voice = playHumanScreamNote(styledMidi, frequency);
    activeKeys.set(bindingKey, { ...voice, midi: styledMidi, voice: true, startedAt: performance.now() });
    setKeyActive(bindingKey, true);
    addFallingNote(bindingKey, styledMidi);
    checkGuideHit(bindingKey);
    spawnBurst(center.x, center.y, `AAAA ${midiToNote(styledMidi)}`);

    if (isRecording) {
      recorded.push({ type: "down", key: bindingKey, midi, time: performance.now() - recordStart });
      updateRecordStatus();
    }
    return;
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const osc = audioContext.createOscillator();
  const body = audioContext.createOscillator();
  const bodyGain = audioContext.createGain();
  const velocity = source === "pointer" ? 0.78 : 0.86;

  osc.type = activeStyle.wave;
  osc.frequency.value = frequency;
  body.type = "sine";
  body.frequency.value = frequency * 2.01;
  bodyGain.gain.value = 0.16;
  filter.type = "lowpass";
  filter.frequency.value = activeStyle.cutoff;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(velocity, now + activeStyle.attack);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.22);

  osc.connect(filter);
  body.connect(bodyGain);
  bodyGain.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  gain.connect(delayNode);
  osc.start(now);
  body.start(now);

  activeKeys.set(bindingKey, { osc, body, gain, midi: styledMidi, startedAt: performance.now() });
  setKeyActive(bindingKey, true);
  addFallingNote(bindingKey, styledMidi);
  checkGuideHit(bindingKey);
  spawnBurst(center.x, center.y, midiToNote(styledMidi));

  if (isRecording) {
    recorded.push({ type: "down", key: bindingKey, midi, time: performance.now() - recordStart });
    updateRecordStatus();
  }
}

function stopNote(bindingKey) {
  const note = activeKeys.get(bindingKey);
  if (!note || !audioContext) return;
  const now = audioContext.currentTime;
  if (note.voice) {
    note.gain.gain.cancelScheduledValues(now);
    note.gain.gain.setValueAtTime(Math.max(note.gain.gain.value, 0.0001), now);
    note.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    activeKeys.delete(bindingKey);
    setKeyActive(bindingKey, false);

    if (isRecording) {
      recorded.push({ type: "up", key: bindingKey, time: performance.now() - recordStart });
      updateRecordStatus();
    }
    return;
  }

  const release = sustain ? activeStyle.release : Math.min(activeStyle.release, 0.28);

  note.gain.gain.cancelScheduledValues(now);
  note.gain.gain.setValueAtTime(Math.max(note.gain.gain.value, 0.0001), now);
  note.gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
  note.osc.stop(now + release + 0.04);
  note.body.stop(now + release + 0.04);
  activeKeys.delete(bindingKey);
  setKeyActive(bindingKey, false);

  if (isRecording) {
    recorded.push({ type: "up", key: bindingKey, time: performance.now() - recordStart });
    updateRecordStatus();
  }
}

function setKeyActive(bindingKey, active) {
  const el = piano.querySelector(`[data-key="${bindingKey}"]`);
  if (el) el.classList.toggle("active", active);
}

function addFallingNote(bindingKey, midi) {
  if (!visualsEnabled) return;
  const index = KEY_BINDINGS.findIndex(([key]) => key === bindingKey);
  const laneWidth = visualizer.clientWidth / KEY_BINDINGS.length;
  fallingNotes.push({
    x: index * laneWidth + laneWidth * 0.12,
    y: -80,
    width: laneWidth * 0.76,
    height: 54 + Math.random() * 58,
    speed: 3.2 + Math.random() * 1.8,
    color: activeStyle.color,
    label: midiToNote(midi)
  });
}

function drawNoteShape(note) {
  const mode = note.mode || activeFallStyle.mode;
  const color = note.hit ? "#7cffb4" : note.color;
  const x = note.x;
  const y = note.y;
  const width = note.width;
  const height = note.height;

  ctx.shadowColor = color;
  ctx.shadowBlur = mode === "sparks" ? 28 : 18;
  ctx.fillStyle = color;

  if (mode === "blocks") {
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  } else if (mode === "comets") {
    const gradient = ctx.createLinearGradient(x, y - height * 1.5, x, y + height);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.7, `${color}88`);
    gradient.addColorStop(1, "#ffffff");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y - height, width, height * 2, width / 2);
    ctx.fill();
  } else if (mode === "ribbons") {
    ctx.beginPath();
    ctx.moveTo(x + width * 0.5, y);
    ctx.bezierCurveTo(x + width * 1.1, y + height * 0.2, x - width * 0.15, y + height * 0.7, x + width * 0.5, y + height);
    ctx.lineWidth = Math.max(8, width * 0.35);
    ctx.strokeStyle = color;
    ctx.stroke();
  } else if (mode === "sparks") {
    for (let i = 0; i < 6; i += 1) {
      const px = x + Math.random() * width;
      const py = y + Math.random() * height;
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mode === "matrix") {
    ctx.font = "800 13px Be Vietnam Pro, Arial";
    for (let py = y; py < y + height; py += 18) {
      ctx.fillText(note.key.toUpperCase(), x + width * 0.32, py);
    }
  } else if (mode === "concert") {
    const gradient = ctx.createRadialGradient(x + width / 2, y + height, 2, x + width / 2, y + height, height);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.24, color);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - width, y - height, width * 3, height * 2.4);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, mode === "rain" ? `${color}11` : `${color}22`);
    gradient.addColorStop(0.35, color);
    gradient.addColorStop(1, "#ffffff");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "800 11px Be Vietnam Pro, Arial";
  ctx.fillText(note.key ? note.key.toUpperCase() : note.label, x + 6, y + height - 9);
}

function renderPiano() {
  piano.innerHTML = "";
  keyMap.innerHTML = "";
  let whiteIndex = 0;
  const whiteCount = KEY_BINDINGS.filter(([, midi]) => !isBlack(midi)).length;
  piano.style.setProperty("--white-key-count", whiteCount);

  for (const [key, midi] of KEY_BINDINGS) {
    const black = isBlack(midi);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key${black ? " black" : ""}`;
    button.dataset.key = key;
    button.dataset.midi = String(midi);
    button.style.setProperty("--key-color", activeStyle.color);
    button.innerHTML = `<span class="key-label"><span>${key.toUpperCase()}</span><span>${midiToNote(midi)}</span></span>`;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!activeKeys.has(key)) playNote(key, midi, "pointer");
    });
    button.addEventListener("pointerup", () => stopNote(key));
    button.addEventListener("pointerleave", () => stopNote(key));

    if (black) {
      button.style.left = `calc(${whiteIndex} * var(--white-key-width) - var(--black-key-half))`;
      piano.appendChild(button);
    } else {
      button.style.gridColumn = `${whiteIndex + 1}`;
      piano.appendChild(button);
      whiteIndex += 1;
    }

    const chip = document.createElement("div");
    chip.className = "map-chip";
    chip.innerHTML = `${key.toUpperCase()}<span>${midiToNote(midi)}</span>`;
    keyMap.appendChild(chip);
  }
}

function renderStyles() {
  styleSelect.innerHTML = "";
  STYLES.forEach((style, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${style.name}`;
    styleSelect.appendChild(option);
  });
}

function renderSongs() {
  songSelect.innerHTML = "";
  SONG_CATALOG.forEach((song, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${song[0]} - ${song[1]}`;
    songSelect.appendChild(option);
  });
}

function renderFallStyles() {
  fallStyleSelect.innerHTML = "";
  FALL_STYLES.forEach((style, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = style.name;
    fallStyleSelect.appendChild(option);
  });
}

function applyStyle(index) {
  activeStyle = STYLES[index];
  currentStyleName.textContent = activeStyle.name;
  currentStyleDesc.textContent = activeStyle.description;
  document.documentElement.style.setProperty("--accent", activeStyle.color);
  document.querySelectorAll(".key").forEach((key) => key.style.setProperty("--key-color", activeStyle.color));
  if (delayNode) delayNode.delayTime.value = activeStyle.delay;
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  document.documentElement.style.setProperty("--lane-count", KEY_BINDINGS.length);
  canvas.width = Math.floor(visualizer.clientWidth * ratio);
  canvas.height = Math.floor(visualizer.clientHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawVisualizer() {
  ctx.clearRect(0, 0, visualizer.clientWidth, visualizer.clientHeight);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  fallingNotes = fallingNotes.filter((note) => note.y < visualizer.clientHeight + note.height);
  for (const note of fallingNotes) {
    note.y += note.speed;
    drawNoteShape({ ...note, key: note.label, mode: activeFallStyle.mode });
  }

  if (guidePlaying) {
    const now = performance.now() - guideStart;
    const laneWidth = visualizer.clientWidth / KEY_BINDINGS.length;
    for (const note of guideNotes) {
      if (note.hit || now < note.spawnAt || now > note.hitAt + 720) continue;
      const progress = (now - note.spawnAt) / (note.hitAt - note.spawnAt);
      const lane = KEY_BINDINGS.findIndex(([key]) => key === note.key);
      const height = Math.max(44, note.duration / 9);
      drawNoteShape({
        ...note,
        x: lane * laneWidth + laneWidth * 0.12,
        y: progress * (visualizer.clientHeight - 8) - height,
        width: laneWidth * 0.76,
        height,
        mode: activeFallStyle.mode
      });
    }
    updateGuideTargets();
    const done = guideNotes.length > 0 && guideNotes.every((note) => note.hit || now > note.hitAt + 900);
    if (done) {
      guidePlaying = false;
      clearTargets();
      guideStatus.textContent = `Hoàn thành: đúng ${guideScore.hit}/${guideScore.total} nốt.`;
    }
  }

  ctx.restore();
  requestAnimationFrame(drawVisualizer);
}

function toggleButton(button, value) {
  button.classList.toggle("is-on", value);
  button.textContent = value ? "Bật" : "Tắt";
  button.setAttribute("aria-pressed", String(value));
}

function updateRecordStatus() {
  recordStatus.textContent = recorded.length
    ? `Đã ghi ${Math.ceil(recorded.length / 2)} nốt/sự kiện.`
    : "Chưa ghi đoạn nào.";
}

function startRecording() {
  recorded = [];
  isRecording = true;
  recordStart = performance.now();
  recordButton.classList.add("is-recording");
  recordButton.textContent = "Dừng";
  updateRecordStatus();
}

function stopRecording() {
  isRecording = false;
  recordButton.classList.remove("is-recording");
  recordButton.textContent = "Ghi";
  updateRecordStatus();
}

function playRecording() {
  if (!recorded.length) {
    recordStatus.textContent = "Chưa có đoạn ghi để phát lại.";
    return;
  }

  const events = [...recorded];
  for (const event of events) {
    window.setTimeout(() => {
      if (event.type === "down") playNote(event.key, event.midi, "playback");
      if (event.type === "up") stopNote(event.key);
    }, event.time);
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const binding = KEY_BINDINGS.find(([bind]) => bind === key);
  if (!binding || activeKeys.has(key) || event.repeat) return;
  event.preventDefault();
  playNote(binding[0], binding[1]);
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  const binding = KEY_BINDINGS.find(([bind]) => bind === key);
  if (!binding) return;
  event.preventDefault();
  stopNote(binding[0]);
});

styleSelect.addEventListener("change", () => applyStyle(Number(styleSelect.value)));
songSelect.addEventListener("change", () => {
  const song = SONG_CATALOG[Number(songSelect.value) || 0];
  currentSongName.textContent = song[0];
  guideStatus.textContent = `${song[1]} - độ ${song[2]}. Bấm "Chạy bài" để hiện nốt rơi.`;
});
startGuideButton.addEventListener("click", startGuide);
stopGuideButton.addEventListener("click", stopGuide);
fallStyleSelect.addEventListener("change", () => {
  activeFallStyle = FALL_STYLES[Number(fallStyleSelect.value) || 0];
});
volumeControl.addEventListener("input", () => {
  if (masterGain) masterGain.gain.value = Number(volumeControl.value);
});
octaveControl.addEventListener("input", () => {
  octaveValue.textContent = octaveControl.value;
});
tempoControl.addEventListener("input", () => {
  tempoValue.textContent = `${Number(tempoControl.value).toFixed(2)}x`;
});
sustainToggle.addEventListener("click", () => {
  sustain = !sustain;
  toggleButton(sustainToggle, sustain);
});
visualToggle.addEventListener("click", () => {
  visualsEnabled = !visualsEnabled;
  toggleButton(visualToggle, visualsEnabled);
});
recordButton.addEventListener("click", () => (isRecording ? stopRecording() : startRecording()));
playButton.addEventListener("click", playRecording);
clearButton.addEventListener("click", () => {
  recorded = [];
  updateRecordStatus();
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointerdown", ensureAudio, { once: true });
window.addEventListener("pointermove", (event) => {
  document.body.style.setProperty("--mouse-x", `${event.clientX}px`);
  document.body.style.setProperty("--mouse-y", `${event.clientY}px`);
  cursorAura.style.left = `${event.clientX}px`;
  cursorAura.style.top = `${event.clientY}px`;
  const now = performance.now();
  if (now - lastSparkleAt > 34) {
    spawnSparkle(event.clientX, event.clientY, 2);
    lastSparkleAt = now;
  }
}, { passive: true });
window.addEventListener("pointerdown", (event) => {
  spawnBurst(event.clientX, event.clientY);
});

renderStyles();
renderSongs();
renderFallStyles();
renderPiano();
applyStyle(0);
resizeCanvas();
drawVisualizer();
