// Main Application Logic for Nihongo Path

// Ensure formatFurigana is defined (it is defined in database.js, which loads first)
window.formatFurigana = window.formatFurigana || ((text) => text);

// Global Zoom System Modal
window.showZoomModal = (htmlContent, translationText = "") => {
  let modal = document.getElementById("global-zoom-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "global-zoom-modal";
    modal.className = "modal-backdrop";
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 99999;
      justify-content: center;
      align-items: center;
      transition: all 0.3s ease;
    `;
    modal.innerHTML = `
      <div class="zoom-modal-card" style="
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 40px;
        max-width: 90%;
        width: 650px;
        text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        position: relative;
        backdrop-filter: blur(20px);
      ">
        <button class="modal-close" style="
          position: absolute;
          top: 15px; right: 20px;
          background: none; border: none;
          color: rgba(255, 255, 255, 0.8); font-size: 32px;
          cursor: pointer; opacity: 0.7;
          transition: all 0.2s;
        " onmouseover="this.style.opacity=1; this.style.color='#ef4444';" onmouseout="this.style.opacity=0.7; this.style.color='rgba(255, 255, 255, 0.8)';"
        onclick="document.getElementById('global-zoom-modal').style.display='none'">&times;</button>
        
        <h3 style="margin-top: 0; color: #3b82f6; font-size: 1.25rem; margin-bottom: 22px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
          🔍 Kanji Magnifier
        </h3>
        
        <div class="zoom-content-box" style="
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 35px 24px;
          margin-bottom: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow-x: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 180px;
        ">
          <p id="zoom-text-container" class="jp font-japanese" style="
            margin: 0;
            font-size: 3.5rem;
            line-height: 2.2;
            word-break: keep-all;
            color: #ffffff;
            transition: font-size 0.2s ease;
            text-align: center;
          "></p>
        </div>

        <div class="zoom-controls" style="
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          margin-bottom: 24px;
        ">
          <button class="btn btn-secondary btn-sm" id="zoom-out-btn" style="padding: 6px 16px; font-weight: 600; border-radius: 6px;">A- Smaller</button>
          <button class="btn btn-secondary btn-sm" id="zoom-reset-btn" style="padding: 6px 16px; font-weight: 600; border-radius: 6px;">Reset</button>
          <button class="btn btn-secondary btn-sm" id="zoom-in-btn" style="padding: 6px 16px; font-weight: 600; border-radius: 6px;">A+ Larger</button>
        </div>

        <p id="zoom-translation-container" style="
          margin: 0;
          font-size: 1.15rem;
          color: #94a3b8;
          font-style: italic;
          line-height: 1.6;
        "></p>
      </div>
    `;
    document.body.appendChild(modal);

    // Zoom level controls
    let currentZoomSize = 3.5; // rem
    const textContainer = document.getElementById("zoom-text-container");
    
    document.getElementById("zoom-in-btn").onclick = () => {
      if (currentZoomSize < 7.0) {
        currentZoomSize += 0.5;
        textContainer.style.fontSize = `${currentZoomSize}rem`;
      }
    };
    document.getElementById("zoom-out-btn").onclick = () => {
      if (currentZoomSize > 1.5) {
        currentZoomSize -= 0.5;
        textContainer.style.fontSize = `${currentZoomSize}rem`;
      }
    };
    document.getElementById("zoom-reset-btn").onclick = () => {
      currentZoomSize = 3.5;
      textContainer.style.fontSize = `${currentZoomSize}rem`;
    };

    // Close on click outside card
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    };
  }

  // Populate content
  document.getElementById("zoom-text-container").innerHTML = htmlContent;
  document.getElementById("zoom-translation-container").textContent = translationText;
  document.getElementById("zoom-text-container").style.fontSize = "3.5rem"; // Reset size back to 3.5rem on open
  modal.style.display = "flex";
};

document.addEventListener("DOMContentLoaded", () => {
  const app = new NihongoApp();
  app.init();
});

class NihongoApp {
  constructor() {
    this.state = this.loadState();
    this.kakashi = new KakashiAssistant();
    this.activePage = "home";
    this.furiganaVisible = true;
    
    // Kanji Drawing State
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.drawCoords = [];
    this.activeKanji = null;
  }

  init() {
    this.setupRouter();
    this.setupGlobalEvents();
    this.updateDashboardStats();
  }

  generateFurigana(word, kana) {
    if (!/[々\u4e00-\u9fff]/.test(word)) {
      return word;
    }
    let start = 0;
    let endWord = word.length;
    let endKana = kana.length;
    while (start < endWord && start < endKana && word[start] === kana[start] && !/[々\u4e00-\u9fff]/.test(word[start])) {
      start++;
    }
    while (endWord > start && endKana > start && word[endWord - 1] === kana[endKana - 1] && !/[々\u4e00-\u9fff]/.test(word[endWord - 1])) {
      endWord--;
      endKana--;
    }
    const prefix = word.substring(0, start);
    const suffix = word.substring(endWord);
    const baseWord = word.substring(start, endWord);
    const baseKana = kana.substring(start, endKana);
    if (baseWord && baseKana) {
      return `${prefix}${baseWord}<rt>${baseKana}</rt>${suffix}`;
    }
    return word;
  }

  getStrippedRoot(word, kana) {
    if (!/[々\u4e00-\u9fff]/.test(word)) {
      return null;
    }
    let start = 0;
    let endWord = word.length;
    let endKana = kana.length;
    while (start < endWord && start < endKana && word[start] === kana[start] && !/[々\u4e00-\u9fff]/.test(word[start])) {
      start++;
    }
    while (endWord > start && endKana > start && word[endWord - 1] === kana[endKana - 1] && !/[々\u4e00-\u9fff]/.test(word[endWord - 1])) {
      endWord--;
      endKana--;
    }
    return {
      baseWord: word.substring(start, endWord),
      baseKana: kana.substring(start, endKana)
    };
  }

  initVocabFuriganaMap() {
    if (this.vocabFuriganaMap) return;
    this.vocabFuriganaMap = {};
    if (window.vocabDatabase) {
      window.vocabDatabase.forEach(v => {
        if (v.word && v.kana && v.word !== v.kana) {
          const furigana = this.generateFurigana(v.word, v.kana);
          if (furigana !== v.word) {
            this.vocabFuriganaMap[v.word] = furigana;
          }
          const rootInfo = this.getStrippedRoot(v.word, v.kana);
          if (rootInfo && rootInfo.baseWord && rootInfo.baseKana && rootInfo.baseWord !== rootInfo.baseKana) {
            this.vocabFuriganaMap[rootInfo.baseWord] = `${rootInfo.baseWord}<rt>${rootInfo.baseKana}</rt>`;
          }
        }
      });
    }
    this.sortedVocabWords = Object.keys(this.vocabFuriganaMap).sort((a, b) => b.length - a.length);
  }

  annotateSentence(sentence) {
    if (!sentence) return '';
    this.initVocabFuriganaMap();
    const parts = sentence.split(/(<\/?[^>]+>)/g);
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        let text = parts[i];
        const replacements = [];
        for (const word of this.sortedVocabWords) {
          if (text.includes(word)) {
            let index = text.indexOf(word);
            while (index !== -1) {
              const placeholder = `___TOKEN_${replacements.length}___`;
              replacements.push({
                placeholder: placeholder,
                html: this.vocabFuriganaMap[word]
              });
              text = text.substring(0, index) + placeholder + text.substring(index + word.length);
              index = text.indexOf(word);
            }
          }
        }
        for (const rep of replacements) {
          text = text.replace(rep.placeholder, rep.html);
        }
        parts[i] = text;
      }
    }
    return parts.join('');
  }

  rubyExample(text) {
    if (!text) return '';
    let annotated = text;
    if (!text.includes('<rt>')) {
      annotated = this.annotateSentence(text);
    }
    return annotated.replace(/([\u4e00-\u9fff\u3005\u3007]+)(<rt>[^<]*<\/rt>)/g, '<ruby>$1$2</ruby>');
  }

  conjugateSentenceToPast(sentence, translation) {
    if (!sentence) return null;
    
    let pastJp = sentence;
    let pastEn = translation || '';
    
    const rules = [
      { from: 'たいです。', to: 'たかったです。' },
      { from: 'たい。', to: 'たかった。' },
      { from: 'たいです', to: 'たかったです' },
      { from: 'たい', to: 'たかった' },
      { from: 'ます。', to: 'ました。' },
      { from: 'ます', to: 'ました' },
      { from: 'いいです。', to: 'よかったです。' },
      { from: 'いいです', to: 'よかったです' },
      { from: 'ないです。', to: 'なかったです。' },
      { from: 'ないです', to: 'なかったです' },
      { from: 'いい。', to: 'よかった。' },
      { from: 'いい', to: 'よかった' },
      { from: 'ある。', to: 'あった。' },
      { from: 'ある', to: 'あった' },
      { from: 'する。', to: 'した。' },
      { from: 'する', to: 'した' },
      { from: 'いる。', to: 'いた。' },
      { from: 'いる', to: 'いた' },
      { from: 'だ。', to: 'だった。' },
      { from: 'だ', to: 'だった' },
      { from: 'ない。', to: 'なかった。' },
      { from: 'ない', to: 'なかった' }
    ];
    
    let matched = false;
    for (const rule of rules) {
      if (pastJp.endsWith(rule.from)) {
        pastJp = pastJp.substring(0, pastJp.length - rule.from.length) + rule.to;
        matched = true;
        break;
      }
    }
    
    if (!matched) return null;
    
    const enRules = [
      { from: /\bwant to\b/g, to: 'wanted to' },
      { from: /\bwants to\b/g, to: 'wanted to' },
      { from: /\bcan\b/g, to: 'could' },
      { from: /\bis\b/g, to: 'was' },
      { from: /\bare\b/g, to: 'were' },
      { from: /\bam\b/g, to: 'was' },
      { from: /\bwill go\b/g, to: 'went' },
      { from: /\bgo\b/g, to: 'went' },
      { from: /\bgoes\b/g, to: 'went' },
      { from: /\bhad better\b/g, to: 'had better have' },
      { from: /\bit is better\b/g, to: 'it would have been better' },
      { from: /\bdecides to\b/g, to: 'decided to' },
      { from: /\bdecide to\b/g, to: 'decided to' },
      { from: /\bshould\b/g, to: 'should have' }
    ];
    
    for (const rule of enRules) {
      pastEn = pastEn.replace(rule.from, rule.to);
    }
    
    return {
      japanese: pastJp,
      translation: pastEn
    };
  }

  getTenseTable(pattern) {
    const clean = pattern.replace(/[～~]/g, '').trim();
    if (clean.endsWith('たい')) {
      const stem = clean.slice(0, -2);
      return {
        title: "たい-form (Desire) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Want to)", plain: `${stem}たい`, polite: `${stem}たいです` },
          { tense: "Present Negative (Don't want to)", plain: `${stem}たくない`, polite: `${stem}たくないです` },
          { tense: "Past Affirmative (Wanted to)", plain: `${stem}たかった`, polite: `${stem}たかったです` },
          { tense: "Past Negative (Didn't want to)", plain: `${stem}たくなかった`, polite: `${stem}たくなかったです` }
        ]
      };
    }
    if (clean.endsWith('ことができる') || clean.endsWith('ことができるです')) {
      const stem = clean.slice(0, -6);
      return {
        title: "ことができる (Ability) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Can)", plain: `${stem}ことができる`, polite: `${stem}ことができます` },
          { tense: "Present Negative (Cannot)", plain: `${stem}ことはできない / ことができない`, polite: `${stem}ことができません` },
          { tense: "Past Affirmative (Could)", plain: `${stem}ことができた`, polite: `${stem}ことができました` },
          { tense: "Past Negative (Could not)", plain: `${stem}ことができなかった`, polite: `${stem}ことができませんでした` }
        ]
      };
    }
    if (clean.endsWith('つもりだ') || clean.endsWith('つもり')) {
      const stem = clean.replace('だ', '');
      return {
        title: "つもり (Intention) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Intend to)", plain: `${stem}つもりだ`, polite: `${stem}つもりです` },
          { tense: "Present Negative (Do not intend to)", plain: `${stem}つもりはない`, polite: `${stem}つもりはありません` },
          { tense: "Past Affirmative (Intended to)", plain: `${stem}つもりだった`, polite: `${stem}つもりでした` },
          { tense: "Past Negative (Did not intend to)", plain: `${stem}つもりはなかった`, polite: `${stem}つもりはありませんでした` }
        ]
      };
    }
    if (clean.endsWith('ほうがいい')) {
      return {
        title: "ほうがいい (Recommendation) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Should)", plain: `～ほうがいい`, polite: `～ほうがいいです` },
          { tense: "Present Negative (Should not)", plain: `～ないほうがいい`, polite: `～ないほうがいいです` },
          { tense: "Past Affirmative (Should have)", plain: `～ほうがよかった`, polite: `～ほうがよかったです` },
          { tense: "Past Negative (Should not have)", plain: `～ないほうがよかった`, polite: `～ないほうがよかったです` }
        ]
      };
    }
    if (clean.endsWith('ことになる') || clean.endsWith('なる')) {
      const stem = clean.endsWith('ことになる') ? '～こと' : '～';
      return {
        title: "なる (Arrangement/Become) Conjugation Table",
        rows: [
          { tense: "Present Affirmative", plain: `${stem}になる`, polite: `${stem}になります` },
          { tense: "Present Negative", plain: `${stem}にならない`, polite: `${stem}になりません` },
          { tense: "Past Affirmative", plain: `${stem}になった`, polite: `${stem}になりました` },
          { tense: "Past Negative", plain: `${stem}にならなかった`, polite: `${stem}になりませんでした` }
        ]
      };
    }
    if (clean.endsWith('ことにする') || clean.endsWith('する')) {
      const stem = clean.endsWith('ことにする') ? '～こと' : '～';
      return {
        title: "する (Decision/Do) Conjugation Table",
        rows: [
          { tense: "Present Affirmative", plain: `${stem}にする`, polite: `${stem}にします` },
          { tense: "Present Negative", plain: `${stem}にしない`, polite: `${stem}にしません` },
          { tense: "Past Affirmative", plain: `${stem}にした`, polite: `${stem}にしました` },
          { tense: "Past Negative", plain: `${stem}にしなかった`, polite: `${stem}にしませんでした` }
        ]
      };
    }
    if (clean.endsWith('はずだ') || clean.endsWith('はず')) {
      const stem = clean.replace('だ', '');
      return {
        title: "はず (Expectation) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Expected to)", plain: `${stem}はずだ`, polite: `${stem}はずです` },
          { tense: "Present Negative (Not expected to)", plain: `${stem}はずがない`, polite: `${stem}はずがありません` },
          { tense: "Past Affirmative (Was expected to)", plain: `${stem}はずだった`, polite: `${stem}はずでした` },
          { tense: "Past Negative (Was not expected to)", plain: `${stem}はずではなかった`, polite: `${stem}はずではありませんでした` }
        ]
      };
    }
    if (clean.endsWith('ている') || clean.endsWith('ているです')) {
      const stem = clean.slice(0, -3);
      return {
        title: "ている (Continuous / State) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Is doing)", plain: `${stem}ている`, polite: `${stem}ています` },
          { tense: "Present Negative (Is not doing)", plain: `${stem}ていない`, polite: `${stem}ていません` },
          { tense: "Past Affirmative (Was doing)", plain: `${stem}ていた`, polite: `${stem}ていました` },
          { tense: "Past Negative (Was not doing)", plain: `${stem}ていなかった`, polite: `${stem}ていませんでした` }
        ]
      };
    }
    if (clean.endsWith('てみる')) {
      const stem = clean.slice(0, -3);
      return {
        title: "てみる (Try doing) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Try doing)", plain: `${stem}てみる`, polite: `${stem}てみます` },
          { tense: "Present Negative (Don't try doing)", plain: `${stem}てみない`, polite: `${stem}てみません` },
          { tense: "Past Affirmative (Tried doing)", plain: `${stem}てみた`, polite: `${stem}てみました` },
          { tense: "Past Negative (Didn't try doing)", plain: `${stem}てみなかった`, polite: `${stem}てみませんでした` }
        ]
      };
    }
    if (clean.endsWith('なければならない') || clean.endsWith('ねばならない')) {
      return {
        title: "なければならない (Necessity) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Must do)", plain: `～なければならない`, polite: `～なければれません` },
          { tense: "Present Negative (Do not have to do)", plain: `～なくてもいい`, polite: `～なくてもいいです` },
          { tense: "Past Affirmative (Had to do)", plain: `～なければならなかった`, polite: `～なければなりませんでした` },
          { tense: "Past Negative (Did not have to do)", plain: `～なくてもよかった`, polite: `～なくてもよかったです` }
        ]
      };
    }
    if (clean.endsWith('てはいけない') || clean.endsWith('てはならない')) {
      return {
        title: "てはいけない (Prohibition) Conjugation Table",
        rows: [
          { tense: "Present Affirmative (Must not do)", plain: `～てはいけない`, polite: `～てはいけません` },
          { tense: "Present Negative (Do not have to avoid)", plain: `～てはいけないことはない`, polite: `～てはいけないことはないです` },
          { tense: "Past Affirmative (Was not allowed to)", plain: `～てはいけなかった`, polite: `～てはいけませんでした` },
          { tense: "Past Negative (Was allowed to / did not have to)", plain: `～てはいけなくなかった`, polite: `～てはいけなくなかったです` }
        ]
      };
    }
    if (clean.endsWith('やすい') || clean.endsWith('にくい') || clean.endsWith('いい') || clean.endsWith('ほしい')) {
      const stem = clean.slice(0, -1);
      return {
        title: "い-Adjective Ending Conjugation Table",
        rows: [
          { tense: "Present Affirmative", plain: `${clean}`, polite: `${clean}です` },
          { tense: "Present Negative", plain: `${stem}くない`, polite: `${stem}くないです` },
          { tense: "Past Affirmative", plain: `${stem}かった`, polite: `${stem}かったです` },
          { tense: "Past Negative", plain: `${stem}くなかった`, polite: `${stem}くなかったです` }
        ]
      };
    }
    return null;
  }

  loadState() {
    const saved = localStorage.getItem("nihongo_app_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure bookmarks structure is fully initialized for backward compatibility
      if (parsed.user) {
        if (!parsed.user.bookmarks) {
          parsed.user.bookmarks = { vocab: [], kanji: [], grammar: [] };
        } else {
          if (!parsed.user.bookmarks.vocab) parsed.user.bookmarks.vocab = [];
          if (!parsed.user.bookmarks.kanji) parsed.user.bookmarks.kanji = [];
          if (!parsed.user.bookmarks.grammar) parsed.user.bookmarks.grammar = [];
        }
      }
      // Verify streak
      this.checkStreak(parsed);
      return parsed;
    }
    return this.getInitialState();
  }

  getInitialState() {
    return {
      user: {
        username: "Guest Shinobi",
        level: 1,
        xp: 35,
        xpToNextLevel: 100,
        streak: 5,
        lastActiveDate: new Date().toDateString(),
        bookmarks: {
          vocab: [],
          kanji: [],
          grammar: []
        },
        badges: [
          { id: "b1", title: "First Steps", description: "Created an account", icon: "🌱", unlocked: true },
          { id: "b2", title: "Kanji Artist", description: "Practice drawing Kanji on the canvas", icon: "🎨", unlocked: false },
          { id: "b3", title: "Streak Starter", description: "Maintain a 5-day study streak", icon: "🔥", unlocked: true },
          { id: "b4", title: "Sensei's Favorite", description: "Complete a chat quiz with Kakashi", icon: "🥷", unlocked: false },
          { id: "b5", title: "Exam Ace", description: "Pass any JLPT mock test", icon: "🏆", unlocked: false }
        ],
        recentLessons: [
          { type: "vocab", name: "Vocabulary Lists (N5-N2)", date: "Today" },
          { type: "grammar", name: "Grammar Rules Library", date: "Yesterday" }
        ],
        completedTests: [],
        masteredKanji: ["k_n5_1", "k_n5_2", "k_n5_3"],
        chapters: {
          1: true,
          2: true,
          3: false,
          4: false,
          5: false,
          6: false,
          7: false,
          8: false
        },
        xpFromQuizzes: 45,
        xpFromStrokes: 20
      }
    };
  }

  saveState() {
    localStorage.setItem("nihongo_app_state", JSON.stringify(this.state));
  }

  checkStreak(state) {
    const today = new Date().toDateString();
    const lastActive = state.user.lastActiveDate;

    if (lastActive === today) {
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastActive === yesterday.toDateString()) {
      // Streak maintained
      state.user.streak += 1;
      state.user.lastActiveDate = today;
    } else {
      // Streak broken (more than 1 day missed)
      // If lastActive was a few days ago, reset. Otherwise do not reset if it was today.
      state.user.streak = 1;
      state.user.lastActiveDate = today;
    }
  }

  addXP(amount, source = null, silent = false) {
    if (amount <= 0) return;
    this.state.user.xp += amount;
    if (source === "quiz") {
      this.state.user.xpFromQuizzes = (this.state.user.xpFromQuizzes || 0) + amount;
    } else if (source === "stroke") {
      this.state.user.xpFromStrokes = (this.state.user.xpFromStrokes || 0) + amount;
    }
    
    // Level up check
    let leveledUp = false;
    while (this.state.user.xp >= this.state.user.xpToNextLevel) {
      this.state.user.xp -= this.state.user.xpToNextLevel;
      this.state.user.level += 1;
      this.state.user.xpToNextLevel = Math.round(this.state.user.xpToNextLevel * 1.5);
      leveledUp = true;
    }

    this.saveState();
    this.updateDashboardStats();

    if (leveledUp) {
      this.showNotification("🎉 LEVEL UP!", `You have reached Level ${this.state.user.level}! Keep going!`, "success");
    } else if (!silent) {
      this.showNotification("✨ XP Gained", `+${amount} XP Added to your progress`, "info");
    }
  }

  unlockBadge(badgeId) {
    const badge = this.state.user.badges.find(b => b.id === badgeId);
    if (badge && !badge.unlocked) {
      badge.unlocked = true;
      this.saveState();
      this.showNotification("🏆 Achievement Unlocked!", `${badge.icon} ${badge.title} - ${badge.description}`, "success");
    }
  }

  showNotification(title, message, type = "info") {
    const container = document.getElementById("notification-container");
    if (!container) return;

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-icon">${type === 'success' ? '🎉' : '✨'}</div>
      <div class="notification-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(notification);
    setTimeout(() => {
      notification.classList.add("show");
    }, 100);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 400);
    }, 4000);
  }

  async fetchStrokePaths(kanji) {
    if (kanji.strokePaths && kanji.strokePaths.length > 0) return;
    if (kanji._fetchingPaths) return;
    kanji._fetchingPaths = true;

    try {
      const codePoint = kanji.character.codePointAt(0);
      const hex = codePoint.toString(16).padStart(5, '0');
      const url = `https://cdn.jsdelivr.net/gh/kanjivg/kanjivg@master/kanji/${hex}.svg`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch SVG`);
      
      const svgText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(svgText, "image/svg+xml");
      const pathElements = xmlDoc.querySelectorAll("path");
      
      if (pathElements.length === 0) {
        throw new Error("No paths found");
      }

      const svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgContainer.style.position = "absolute";
      svgContainer.style.width = "0";
      svgContainer.style.height = "0";
      svgContainer.style.pointerEvents = "none";
      document.body.appendChild(svgContainer);

      const parsedPaths = [];
      pathElements.forEach(pathEl => {
        const d = pathEl.getAttribute("d");
        if (!d) return;

        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempPath.setAttribute("d", d);
        svgContainer.appendChild(tempPath);

        const length = tempPath.getTotalLength();
        parsedPaths.push({ d, length });
      });

      document.body.removeChild(svgContainer);
      kanji.strokePaths = parsedPaths;
    } catch (err) {
      console.error(`Error loading stroke paths for ${kanji.character}:`, err);
      kanji.strokePaths = [];
    } finally {
      kanji._fetchingPaths = false;
    }
  }

  setupRouter() {
    document.querySelectorAll("[data-page]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const page = link.getAttribute("data-page");
        window.location.hash = page;
      });
    });

    const handleRoute = () => {
      const hash = window.location.hash.substring(1) || "home";
      this.navigateTo(hash);
    };

    window.addEventListener("hashchange", handleRoute);
    handleRoute();
  }

  navigateTo(page) {
    if (window.location.hash !== `#${page}`) {
      window.location.hash = page;
      return;
    }
    this.activePage = page;
    this.renderPage(page);

    // Update active nav link
    document.querySelectorAll("[data-page]").forEach(link => {
      if (link.getAttribute("data-page") === page) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Close mobile menu drawer if it is open
    const hamburger = document.getElementById("hamburger-menu");
    const navLinks = document.querySelector(".nav-links");
    const overlay = document.getElementById("drawer-overlay");
    if (hamburger && hamburger.classList.contains("active")) {
      hamburger.classList.remove("active");
      if (navLinks) navLinks.classList.remove("open");
      if (overlay) overlay.classList.remove("open");
    }
  }

  setupGlobalEvents() {
    // Mobile Drawer events
    const hamburger = document.getElementById("hamburger-menu");
    const navLinks = document.querySelector(".nav-links");
    const overlay = document.getElementById("drawer-overlay");

    if (hamburger && navLinks) {
      hamburger.addEventListener("click", () => {
        const isOpen = navLinks.classList.contains("open");
        hamburger.classList.toggle("active", !isOpen);
        navLinks.classList.toggle("open", !isOpen);
        if (overlay) overlay.classList.toggle("open", !isOpen);
      });
    }

    if (overlay) {
      overlay.addEventListener("click", () => {
        if (hamburger) hamburger.classList.remove("active");
        if (navLinks) navLinks.classList.remove("open");
        overlay.classList.remove("open");
      });
    }

    // Theme selector (desktop and mobile)
    const themeSelector = document.getElementById("theme-selector");
    const mobileThemeSelector = document.getElementById("mobile-theme-selector");

    const applyTheme = (themeName) => {
      document.body.classList.remove("light-mode", "theme-light", "theme-sakura", "theme-stealth");
      
      if (themeName === "light") {
        document.body.classList.add("light-mode", "theme-light");
      } else if (themeName === "sakura") {
        document.body.classList.add("light-mode", "theme-sakura");
      } else if (themeName === "stealth") {
        document.body.classList.add("theme-stealth");
      }
      localStorage.setItem("nihongo-theme", themeName);
      
      // Sync values across desktop and mobile selects
      if (themeSelector) themeSelector.value = themeName;
      if (mobileThemeSelector) mobileThemeSelector.value = themeName;
    };

    const savedTheme = localStorage.getItem("nihongo-theme") || "dark";
    applyTheme(savedTheme);

    if (themeSelector) {
      themeSelector.addEventListener("change", (e) => {
        applyTheme(e.target.value);
      });
    }
    if (mobileThemeSelector) {
      mobileThemeSelector.addEventListener("change", (e) => {
        applyTheme(e.target.value);
      });
    }

    // Furigana toggle (desktop and mobile)
    const firiToggle = document.getElementById("global-furigana-toggle");
    const mobFiriToggle = document.getElementById("mobile-furigana-toggle");

    const updateFuriganaUI = () => {
      document.body.classList.toggle("hide-furigana", !this.furiganaVisible);
      
      if (firiToggle) {
        firiToggle.classList.toggle("active", this.furiganaVisible);
        const toggleSpan = firiToggle.querySelector("span");
        if (toggleSpan) toggleSpan.textContent = this.furiganaVisible ? "あ ON" : "あ OFF";
      }
      if (mobFiriToggle) {
        mobFiriToggle.classList.toggle("active", this.furiganaVisible);
        const toggleSpanMob = mobFiriToggle.querySelector("span");
        if (toggleSpanMob) toggleSpanMob.textContent = this.furiganaVisible ? "あ ON" : "あ OFF";
      }
      const readingFuriganaStatus = document.getElementById("reading-furigana-status");
      if (readingFuriganaStatus) {
        readingFuriganaStatus.textContent = this.furiganaVisible ? "FURIGANA ON" : "FURIGANA OFF";
      }
    };

    // Initialize state
    updateFuriganaUI();

    if (firiToggle) {
      firiToggle.addEventListener("click", () => {
        this.furiganaVisible = !this.furiganaVisible;
        updateFuriganaUI();
      });
    }
    if (mobFiriToggle) {
      mobFiriToggle.addEventListener("click", () => {
        this.furiganaVisible = !this.furiganaVisible;
        updateFuriganaUI();
      });
    }

    // Check if user is logged in
    this.updateUserSessionUI();
  }

  updateUserSessionUI() {
    const loginNav = document.querySelector('[data-page="login"]');
    const dashboardNav = document.querySelector('[data-page="dashboard"]');
    
    if (loginNav && dashboardNav) {
      if (this.state.user.username === "Guest Shinobi") {
        loginNav.style.display = "block";
      } else {
        loginNav.style.display = "none";
      }
    }
  }

  updateDashboardStats() {
    // Update simple header state or sidebar state
    const userXPText = document.getElementById("user-xp-display");
    if (userXPText) {
      userXPText.textContent = `Lvl ${this.state.user.level} (${this.state.user.xp}/${this.state.user.xpToNextLevel} XP)`;
    }
    
    const userStreakText = document.getElementById("user-streak-display");
    if (userStreakText) {
      userStreakText.textContent = `${this.state.user.streak} Days 🔥`;
    }
  }

  renderPage(page) {
    const container = document.getElementById("app-content");
    container.innerHTML = ""; // Clear current view
    window.scrollTo(0, 0);

    // Track page views in user progress
    if (page !== "home" && page !== "login") {
      this.addToRecentLessons(page);
    }

    switch (page) {
      case "home":
        this.renderHome(container);
        break;
      case "vocab":
        this.renderVocab(container);
        break;
      case "kanji":
        this.renderKanji(container);
        break;
      case "grammar":
        this.renderGrammar(container);
        break;
      case "reading":
        this.renderReading(container);
        break;
      case "practice":
        this.renderPracticeTests(container);
        break;
      case "dashboard":
        this.renderDashboard(container);
        break;
      case "login":
        this.renderLogin(container);
        break;
      case "kakashi":
        this.renderKakashi(container);
        break;
      default:
        this.renderHome(container);
    }
  }

  addToRecentLessons(page) {
    const names = {
      vocab: "Vocabulary Lists (N5-N2)",
      kanji: "Kanji Lab & Stroke Canvas",
      grammar: "Grammar Rules Library",
      reading: "Reading Passages Practice",
      practice: "JLPT Mock Exams",
      kakashi: "Kakashi AI Chat Lesson"
    };
    
    const existsIndex = this.state.user.recentLessons.findIndex(l => l.type === page);
    if (existsIndex !== -1) {
      this.state.user.recentLessons.splice(existsIndex, 1);
    }

    this.state.user.recentLessons.unshift({
      type: page,
      name: names[page] || "Study Lesson",
      date: "Just now"
    });

    if (this.state.user.recentLessons.length > 5) {
      this.state.user.recentLessons.pop();
    }
    this.saveState();
  }

  // HOMEPAGE RENDER
  renderHome(container) {
    container.innerHTML = `
      <section class="hero-section">
        <div class="hero-bg-accent"></div>
        <div class="hero-content">
          <span class="hero-tag">✨ Your Path to Japanese Fluency</span>
          <h1>Master the JLPT <br><span class="highlight-text">N5 to N2</span> Seamlessly</h1>
          <p>Learn Kanji, Vocabulary, Grammar, and Reading through interactive flashcards, writing canvas guides, and KAKASHI, your AI Japanese Shinobi tutor.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="hero-start-btn">Start Learning Free</button>
            <button class="btn btn-secondary" id="hero-kakashi-btn">🥷 Ask Kakashi AI</button>
          </div>
        </div>
        <div class="hero-image-pane">
          <div class="floating-kanji-card">日本語</div>
          <div class="hero-card-preview">
            <div class="preview-header">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
            <div class="preview-body">
              <div class="user-greeting">こんにちは, ${this.state.user.username}!</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section level-overview">
        <div class="section-header">
          <h2>JLPT Level Coverage</h2>
          <p>Choose a level and start practicing targeted lessons built specifically for JLPT exam structures.</p>
        </div>
        <div class="level-grid">
          <div class="level-card n5" data-level="N5">
            <span class="badge">Beginner</span>
            <h3>JLPT N5</h3>
            <p>Master basic phrases, Hiragana, Katakana, ~100 Kanji, and ~800 daily vocabulary words.</p>
            <div class="level-meta">100 Kanji • 800 Vocab • 40 Grammar</div>
            <button class="btn btn-level">Study N5</button>
          </div>
          <div class="level-card n4" data-level="N4">
            <span class="badge">Upper Beginner</span>
            <h3>JLPT N4</h3>
            <p>Understand basic conversations, travel Japanese, ~300 Kanji, and ~1500 vocabulary words.</p>
            <div class="level-meta">300 Kanji • 1,500 Vocab • 80 Grammar</div>
            <button class="btn btn-level">Study N4</button>
          </div>
          <div class="level-card n3" data-level="N3">
            <span class="badge">Intermediate</span>
            <h3>JLPT N3</h3>
            <p>Bridge the gap. Read everyday essays, grasp spoken materials, and learn ~650 Kanji.</p>
            <div class="level-meta">650 Kanji • 3,700 Vocab • 110 Grammar</div>
            <button class="btn btn-level">Study N3</button>
          </div>
          <div class="level-card n2" data-level="N2">
            <span class="badge">Upper Intermediate</span>
            <h3>JLPT N2</h3>
            <p>Understand business Japanese, news articles, write essays, and master ~1000 Kanji.</p>
            <div class="level-meta">1,000 Kanji • 6,000 Vocab • 150 Grammar</div>
            <button class="btn btn-level">Study N2</button>
          </div>
        </div>
      </section>

      <section class="section kakashi-showcase">
        <div class="showcase-content">
          <h2>Meet KAKASHI: Your AI Sensei 🥷</h2>
          <p>Kakashi is a customized Japanese Language Tutor. You can ask him grammar questions, paste text for sentence breakdowns, submit sentences to get them graded, or request a quick quiz.</p>
          <ul class="kakashi-perks">
            <li>✨ <strong>Grammar breakdowns:</strong> Get instant, simple comparisons between confusing particles.</li>
            <li>📝 <strong>Writing checker:</strong> Send a Japanese sentence and get corrections with grammatical reasons.</li>
            <li>🎯 <strong>Quiz generator:</strong> Test your skills with personalized dynamic multiple-choice cards.</li>
          </ul>
          <button class="btn btn-primary" id="meet-kakashi-btn">Start Chatting with Kakashi</button>
        </div>
        <div class="showcase-media">
          <img src="assets/kakashi.png" alt="Kakashi AI Sensei Avatar" class="kakashi-avatar-img">
          <div class="kakashi-bubble">
            <p>"Let me generate a quick N5 grammar quiz for you! Type 'give me a quiz' inside our chat!"</p>
          </div>
        </div>
      </section>

      <section class="section features-highlights">
        <div class="section-header">
          <h2>Core Interactive Features</h2>
          <p>Everything you need to study Japanese, fully organized in a gamified environment.</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="icon">🎴</div>
            <h4>Interactive Cards</h4>
            <p>Study Japanese vocabulary and grammar with interactive flipping cards featuring Furigana toggle and bookmarking.</p>
          </div>
          <div class="feature-card">
            <div class="icon">✍️</div>
            <h4>Stroke Canvas Lab</h4>
            <p>Interactive canvas for drawing Kanji. Animate the stroke paths and practice writing on-screen with mouse or touch.</p>
          </div>
          <div class="feature-card">
            <div class="icon">📖</div>
            <h4>Interactive Passages</h4>
            <p>Read passages with vocabulary definitions appearing on hover. Test yourself with multiple choice comprehension checks.</p>
          </div>
          <div class="feature-card">
            <div class="icon">🏆</div>
            <h4>Gamified Dashboard</h4>
            <p>Track your XP, levels, study streaks, and unlock custom achievement badges as you progress.</p>
          </div>
        </div>
      </section>

      <section class="section testimonials">
        <div class="section-header">
          <h2>Loved by Shinobi Learners</h2>
        </div>
        <div class="testimonials-grid">
          <div class="testimonial-card">
            <p>"The Kakashi AI is incredible. I asked it to compare は vs が and it gave me a cleaner breakdown than any of my textbooks did!"</p>
            <div class="author">- Kenji S., N3 Candidate</div>
          </div>
          <div class="testimonial-card">
            <p>"The stroke order canvas is so addictive. Being able to practice drawing Kanji and seeing the guidelines is extremely helpful."</p>
            <div class="author">- Mei L., N5 Beginner</div>
          </div>
        </div>
      </section>
    `;

    // Button event listeners
    document.getElementById("hero-start-btn").addEventListener("click", () => this.navigateTo("dashboard"));
    document.getElementById("hero-kakashi-btn").addEventListener("click", () => this.navigateTo("kakashi"));
    document.getElementById("meet-kakashi-btn").addEventListener("click", () => this.navigateTo("kakashi"));

    document.querySelectorAll(".level-card, .btn-level").forEach(card => {
      card.addEventListener("click", (e) => {
        // Find closest level card
        const lvlCard = e.target.closest(".level-card");
        if (lvlCard) {
          const level = lvlCard.getAttribute("data-level");
          // Store selected level for direct filters on pages
          this.selectedLevelFilter = level;
          this.navigateTo("vocab");
        }
      });
    });
  }

  // VOCABULARY PAGE RENDER
  renderVocab(container) {
    const selectedLevel = this.selectedLevelFilter || "N5";
    this.selectedLevelFilter = null; // Clear filter after initial navigate

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Vocabulary Study</h1>
          <p>Learn vocabulary words organized by JLPT Level. Review with flashcards or test yourself.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="vocab-flashcards-mode-btn">🎴 Flashcard Slideshow</button>
          <button class="btn btn-secondary" id="vocab-quiz-mode-btn">📝 Take Vocab Quiz</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-box">
          <input type="text" id="vocab-search" placeholder="Search by English, Japanese, or Romaji...">
        </div>
        <div class="level-tabs" id="vocab-level-tabs">
          <button class="tab-btn ${selectedLevel === 'N5' ? 'active' : ''}" data-lvl="N5">N5</button>
          <button class="tab-btn ${selectedLevel === 'N4' ? 'active' : ''}" data-lvl="N4">N4</button>
          <button class="tab-btn ${selectedLevel === 'N3' ? 'active' : ''}" data-lvl="N3">N3</button>
          <button class="tab-btn ${selectedLevel === 'N2' ? 'active' : ''}" data-lvl="N2">N2</button>
        </div>
        <div class="category-tabs" id="vocab-cat-tabs">
          <button class="cat-btn active" data-cat="all">All Words</button>
          <button class="cat-btn" data-cat="nouns">Nouns</button>
          <button class="cat-btn" data-cat="verbs">Verbs</button>
          <button class="cat-btn" data-cat="adjectives">Adjectives</button>
        </div>
      </div>

      <div class="vocab-grid" id="vocab-list-container">
        <!-- Rendered Dynamically -->
      </div>

      <!-- Flashcards Slide Modal -->
      <div class="modal-backdrop" id="vocab-flashcard-modal" style="display:none;">
        <div class="modal-card flashcard-slide-card">
          <button class="modal-close" id="flashcard-modal-close">&times;</button>
          <div class="flashcard-progress">Card <span id="fc-current">1</span> of <span id="fc-total">10</span></div>
          <div class="interactive-card-inner" id="fc-interactive-area">
            <!-- Rendered Dynamically -->
          </div>
          <div class="flashcard-actions">
            <button class="btn btn-secondary" id="fc-prev-btn">⬅️ Previous</button>
            <button class="btn btn-primary" id="fc-flip-btn">🔄 Flip Card</button>
            <button class="btn btn-success" id="fc-next-btn">Next Card ➡️</button>
          </div>
        </div>
      </div>

      <!-- Vocab Quiz Modal -->
      <div class="modal-backdrop" id="vocab-quiz-modal" style="display:none;">
        <div class="modal-card quiz-card">
          <button class="modal-close" id="vocab-quiz-close">&times;</button>
          <h3>Vocabulary Quiz</h3>
          <div class="quiz-question-box">
            <div class="quiz-progress-bar"><div class="quiz-progress-fill" id="vocab-qp-fill" style="width:0%"></div></div>
            <div class="quiz-question-text" id="vocab-quiz-question">Loading question...</div>
          </div>
          <div class="quiz-options-list" id="vocab-quiz-options">
            <!-- Buttons rendered here -->
          </div>
          <div class="quiz-feedback-box" id="vocab-quiz-feedback" style="display:none;">
            <!-- Feedback explanation -->
          </div>
          <div class="quiz-actions" style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" id="vocab-quiz-next-btn" style="display:none;">Next Question</button>
          </div>
        </div>
      </div>
    `;

    // Variables for vocab logic
    let currentLvl = selectedLevel;
    let currentCat = "all";
    let searchQuery = "";
    let currentLimit = 100;

    const renderVocabList = (resetLimit = true) => {
      if (resetLimit) currentLimit = 100;
      const containerList = document.getElementById("vocab-list-container");
      containerList.innerHTML = "";

      const filtered = window.vocabDatabase.filter(item => {
        const matchesLvl = item.level === currentLvl;
        const matchesCat = currentCat === "all" || item.category === currentCat;
        const matchesSearch = searchQuery === "" || 
          item.word.includes(searchQuery) || 
          item.kana.includes(searchQuery) || 
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.romaji.toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesLvl && matchesCat && matchesSearch;
      });

      if (filtered.length === 0) {
        containerList.innerHTML = `
          <div class="empty-state">
            <p>No vocabulary words found matching the filters.</p>
          </div>
        `;
        return;
      }

      const displayed = filtered.slice(0, currentLimit);

      displayed.forEach(vocab => {
        const isBookmarked = this.state.user.bookmarks.vocab.includes(vocab.id);
        const card = document.createElement("div");
        card.className = "vocab-card";
        card.innerHTML = `
          <div class="vocab-card-header">
            <span class="vocab-badge">${vocab.category.toUpperCase()}</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="zoom-btn" title="Zoom Word" style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 2px 4px; font-size: 0.9rem; opacity: 0.7; transition: opacity 0.2s, color 0.2s;" onmouseover="this.style.opacity=1; this.style.color='var(--primary, #3b82f6)'" onmouseout="this.style.opacity=0.7; this.style.color='var(--text-muted, #94a3b8)'"
                      onclick="window.showZoomModal(this.getAttribute('data-jp'), this.getAttribute('data-en'))"
                      data-jp="${(`<ruby>${vocab.word}<rt>${vocab.kana}</rt></ruby>`).replace(/"/g, '&quot;')}"
                      data-en="${(vocab.meaning).replace(/"/g, '&quot;')}">
                🔍
              </button>
              <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${vocab.id}">
                ${isBookmarked ? '★' : '☆'}
              </button>
            </div>
          </div>
          <div class="vocab-card-body">
            <ruby class="jap-word">${vocab.word}<rt>${vocab.kana}</rt></ruby>
            <div class="romaji-text">${vocab.romaji}</div>
            <div class="meaning-text">${vocab.meaning}</div>
          </div>
          ${vocab.exampleFurigana ? `
          <div class="vocab-card-footer" style="position: relative;">
            <div class="example-box" style="padding-right: 25px;">
              <span class="lbl">Ex:</span>
              ${this.rubyExample(vocab.exampleFurigana)}
              <div class="example-translation">${vocab.exampleMeaning}</div>
            </div>
            <button class="zoom-btn" title="Zoom Example" style="position: absolute; right: 8px; top: 12px; background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 0.8rem; opacity: 0.5; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5"
                    onclick="window.showZoomModal(this.getAttribute('data-jp'), this.getAttribute('data-en'))"
                    data-jp="${this.rubyExample(vocab.exampleFurigana).replace(/"/g, '&quot;')}"
                    data-en="${(vocab.exampleMeaning).replace(/"/g, '&quot;')}">
              🔍
            </button>
          </div>` : ''}
        `;

        // Bookmark Event
        card.querySelector(".bookmark-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleBookmark("vocab", vocab.id, e.currentTarget);
        });

        containerList.appendChild(card);
      });

      if (filtered.length > currentLimit) {
        const loadMoreRow = document.createElement("div");
        loadMoreRow.style.gridColumn = "1 / -1";
        loadMoreRow.style.textAlign = "center";
        loadMoreRow.style.padding = "20px";
        loadMoreRow.innerHTML = `
          <button class="btn btn-secondary" style="width: 100%; max-width: 300px;">
            Load More (${filtered.length - currentLimit} remaining)
          </button>
        `;
        loadMoreRow.querySelector("button").onclick = () => {
          currentLimit += 100;
          renderVocabList(false);
        };
        containerList.appendChild(loadMoreRow);
      }
    };

    // Filter Change events
    const searchInput = document.getElementById("vocab-search");
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderVocabList(true);
    });

    document.querySelectorAll("#vocab-level-tabs .tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll("#vocab-level-tabs .tab-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        currentLvl = e.target.getAttribute("data-lvl");
        renderVocabList(true);
      });
    });

    document.querySelectorAll("#vocab-cat-tabs .cat-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll("#vocab-cat-tabs .cat-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        currentCat = e.target.getAttribute("data-cat");
        renderVocabList(true);
      });
    });

    // Init Render
    renderVocabList(true);

    // Flashcard slideshow logic
    const fcModal = document.getElementById("vocab-flashcard-modal");
    document.getElementById("vocab-flashcards-mode-btn").addEventListener("click", () => {
      // Collect current filtered list
      const itemsToSlide = window.vocabDatabase.filter(item => item.level === currentLvl && (currentCat === "all" || item.category === currentCat));
      if (itemsToSlide.length === 0) {
        alert("No flashcards to display in this category!");
        return;
      }

      fcModal.style.display = "flex";
      let currentIndex = 0;
      let isFlipped = false;

      const renderSlide = () => {
        const item = itemsToSlide[currentIndex];
        document.getElementById("fc-current").textContent = currentIndex + 1;
        document.getElementById("fc-total").textContent = itemsToSlide.length;

        const area = document.getElementById("fc-interactive-area");
        area.className = `interactive-card-inner ${isFlipped ? 'flipped' : ''}`;
        
        area.innerHTML = `
          <div class="card-front-face">
            <span class="level-label">${item.level} • ${item.category.toUpperCase()}</span>
            <ruby class="giant-word">${item.word}<rt>${item.kana}</rt></ruby>
            <p class="click-hint">Click to Reveal Meaning</p>
          </div>
          <div class="card-back-face">
            <span class="level-label">${item.level} • ${item.category.toUpperCase()}</span>
            <h2>${item.meaning}</h2>
            <p class="reading">Reading: <strong>${item.kana}</strong> (${item.romaji})</p>
            ${item.exampleFurigana || item.example ? `
            <div class="slide-example">
              <p class="jp-sentence">${this.rubyExample(item.exampleFurigana || item.example || '')}</p>
              <p class="en-sentence">${item.exampleMeaning}</p>
            </div>` : ''}
          </div>
        `;
      };

      renderSlide();

      // Flip click
      const area = document.getElementById("fc-interactive-area");
      area.onclick = () => {
        isFlipped = !isFlipped;
        area.classList.toggle("flipped", isFlipped);
      };
      
      document.getElementById("fc-flip-btn").onclick = () => {
        isFlipped = !isFlipped;
        area.classList.toggle("flipped", isFlipped);
      };

      document.getElementById("fc-next-btn").onclick = () => {
        if (currentIndex < itemsToSlide.length - 1) {
          currentIndex++;
          isFlipped = false;
          renderSlide();
          this.addXP(2); // XP for reading flashcards
        } else {
          this.showNotification("🎉 Review Finished!", "You have reached the end of the stack!", "success");
          fcModal.style.display = "none";
        }
      };

      document.getElementById("fc-prev-btn").onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          isFlipped = false;
          renderSlide();
        }
      };
    });

    document.getElementById("flashcard-modal-close").addEventListener("click", () => {
      fcModal.style.display = "none";
    });

    // Quiz Mode Logic
    const quizModal = document.getElementById("vocab-quiz-modal");
    document.getElementById("vocab-quiz-mode-btn").addEventListener("click", () => {
      const pool = window.vocabDatabase.filter(item => item.level === currentLvl);
      if (pool.length < 3) {
        alert("Not enough vocabulary words in this level to generate a quiz. Choose a level with more entries.");
        return;
      }

      quizModal.style.display = "flex";
      let quizQuestions = [];
      let currentQIdx = 0;
      let score = 0;

      // Generate 5 random questions
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(5, shuffled.length));

      selected.forEach((item, idx) => {
        // Collect incorrect answers from other words
        const incorrectPool = pool.filter(p => p.id !== item.id);
        const incorrectOptions = incorrectPool.sort(() => 0.5 - Math.random()).slice(0, 3).map(p => p.meaning);
        
        // Put together options
        const options = [item.meaning, ...incorrectOptions].sort(() => 0.5 - Math.random());
        const correctIndex = options.indexOf(item.meaning);

        quizQuestions.push({
          question: `What is the meaning of the word: 「${item.word}」 (${item.kana})?`,
          options: options,
          correctIndex: correctIndex,
          explanation: `「${item.word}」 (${item.kana}) means "${item.meaning}".${item.example ? ' Example: ' + item.example : ''}`
        });
      });

      const showQuizQuestion = () => {
        const q = quizQuestions[currentQIdx];
        document.getElementById("vocab-qp-fill").style.width = `${((currentQIdx) / quizQuestions.length) * 100}%`;
        document.getElementById("vocab-quiz-question").textContent = `Question ${currentQIdx + 1}: ${q.question}`;
        
        const optionsContainer = document.getElementById("vocab-quiz-options");
        optionsContainer.innerHTML = "";

        q.options.forEach((opt, index) => {
          const btn = document.createElement("button");
          btn.className = "quiz-opt-btn";
          btn.textContent = opt;
          btn.onclick = () => selectOption(index);
          optionsContainer.appendChild(btn);
        });

        document.getElementById("vocab-quiz-feedback").style.display = "none";
        document.getElementById("vocab-quiz-next-btn").style.display = "none";
      };

      const selectOption = (selectedIdx) => {
        const q = quizQuestions[currentQIdx];
        const buttons = document.querySelectorAll(".quiz-opt-btn");
        buttons.forEach((btn, index) => {
          btn.disabled = true;
          if (index === q.correctIndex) {
            btn.classList.add("correct");
          } else if (index === selectedIdx) {
            btn.classList.add("incorrect");
          }
        });

        const feedback = document.getElementById("vocab-quiz-feedback");
        feedback.style.display = "block";
        
        if (selectedIdx === q.correctIndex) {
          score++;
          feedback.innerHTML = `<span class="correct-text">🎉 Correct!</span><p>${q.explanation}</p>`;
          this.addXP(5, "quiz");
        } else {
          feedback.innerHTML = `<span class="incorrect-text">❌ Incorrect.</span><p>${q.explanation}</p>`;
        }

        document.getElementById("vocab-quiz-next-btn").style.display = "block";
      };

      document.getElementById("vocab-quiz-next-btn").onclick = () => {
        if (currentQIdx < quizQuestions.length - 1) {
          currentQIdx++;
          showQuizQuestion();
        } else {
          // Finished Quiz
          document.getElementById("vocab-qp-fill").style.width = "100%";
          document.getElementById("vocab-quiz-question").innerHTML = `Quiz Completed! <br><br>Your Score: <strong>${score} / ${quizQuestions.length}</strong>`;
          document.getElementById("vocab-quiz-options").innerHTML = `
            <div class="quiz-summary-box">
              <p>Great job practicing your vocabulary! You earned <strong>+${score * 10} XP</strong> extra bonus!</p>
              <button class="btn btn-primary" id="vocab-quiz-finish-close-btn">Done</button>
            </div>
          `;
          document.getElementById("vocab-quiz-feedback").style.display = "none";
          document.getElementById("vocab-quiz-next-btn").style.display = "none";
          
          this.addXP(score * 10, "quiz");
          this.unlockBadge("b5"); // Unlocks a badge

          document.getElementById("vocab-quiz-finish-close-btn").onclick = () => {
            quizModal.style.display = "none";
          };
        }
      };

      showQuizQuestion();
    });

    document.getElementById("vocab-quiz-close").addEventListener("click", () => {
      quizModal.style.display = "none";
    });
  }

  // KANJI PAGE RENDER
  renderKanji(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Kanji Drawing Lab</h1>
          <p>Learn Kanji strokes, meanings, readings, and practice drawing on the interactive grid.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="kanji-quiz-mode-btn">📝 Take Kanji Quiz</button>
        </div>
      </div>

      <div class="kanji-layout">
        <!-- Sidebar Selector / List -->
        <div class="kanji-sidebar">
          <div class="search-box" style="margin-bottom:15px;">
            <input type="text" id="kanji-search" placeholder="Search Kanji or reading...">
          </div>
          <div class="level-tabs" id="kanji-level-tabs" style="margin-bottom:15px; font-size:12px;">
            <button class="tab-btn active" data-lvl="N5">N5</button>
            <button class="tab-btn" data-lvl="N4">N4</button>
            <button class="tab-btn" data-lvl="N3">N3</button>
            <button class="tab-btn" data-lvl="N2">N2</button>
          </div>
          <div class="kanji-list-grid" id="kanji-list-container">
            <!-- Kanji lists render dynamically -->
          </div>
        </div>

        <!-- Kanji Canvas Area & Details -->
        <div class="kanji-workspace">
          <div class="kanji-details-card" id="kanji-details-pane">
            <div class="empty-state">
              <p>Select a Kanji character from the list on the left to start drawing and exploring details.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Kanji Quiz Modal -->
      <div class="modal-backdrop" id="kanji-quiz-modal" style="display:none;">
        <div class="modal-card quiz-card">
          <button class="modal-close" id="kanji-quiz-close">&times;</button>
          <h3>Kanji Quiz</h3>
          <div class="quiz-question-box">
            <div class="quiz-progress-bar"><div class="quiz-progress-fill" id="kanji-qp-fill" style="width:0%"></div></div>
            <div class="quiz-question-text" id="kanji-quiz-question">Loading question...</div>
          </div>
          <div class="quiz-options-list" id="kanji-quiz-options">
            <!-- Buttons rendered here -->
          </div>
          <div class="quiz-feedback-box" id="kanji-quiz-feedback" style="display:none;">
            <!-- Feedback explanation -->
          </div>
          <div class="quiz-actions" style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" id="kanji-quiz-next-btn" style="display:none;">Next Question</button>
          </div>
        </div>
      </div>
    `;

    let activeLvl = "N5";
    let searchVal = "";

    const renderKanjiList = () => {
      const grid = document.getElementById("kanji-list-container");
      grid.innerHTML = "";

      const filtered = window.kanjiDatabase.filter(k => {
        const matchesLvl = k.level === activeLvl;
        const matchesSearch = searchVal === "" || 
          k.character.includes(searchVal) || 
          k.meaning.toLowerCase().includes(searchVal.toLowerCase()) || 
          k.onyomi.toLowerCase().includes(searchVal.toLowerCase()) || 
          k.kunyomi.toLowerCase().includes(searchVal.toLowerCase());
        
        return matchesLvl && matchesSearch;
      });

      if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; padding:20px;">No Kanji found.</div>`;
        return;
      }

      filtered.forEach((kanji, idx) => {
        const item = document.createElement("div");
        item.className = "kanji-list-item";
        item.innerHTML = `
          <div class="character">${kanji.character}</div>
          <div class="meaning">${kanji.meaning}</div>
        `;
        item.onclick = () => selectKanji(kanji);
        grid.appendChild(item);

        // Auto select first kanji
        if (idx === 0) selectKanji(kanji);
      });
    };

    const selectKanji = async (kanji) => {
      this.activeKanji = kanji;
      
      // Reset any active animations
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
        this._animationFrameId = null;
      }
      if (this._animationTimeoutId) {
        clearTimeout(this._animationTimeoutId);
        this._animationTimeoutId = null;
      }

      await this.fetchStrokePaths(kanji);
      const pane = document.getElementById("kanji-details-pane");
      const isBookmarked = this.state.user.bookmarks.kanji.includes(kanji.id);
      
      pane.innerHTML = `
        <div class="kanji-display-row">
          <div class="canvas-block">
            <div class="canvas-container">
              <canvas id="kanji-canvas" width="250" height="250"></canvas>
              <div class="canvas-grid-lines">
                <div class="line horizontal"></div>
                <div class="line vertical"></div>
              </div>
            </div>
            <div class="canvas-controls">
              <button class="btn btn-secondary btn-sm" id="canvas-clear-btn">🧹 Clear</button>
              <button class="btn btn-secondary btn-sm" id="canvas-animate-btn">▶️ Stroke Order</button>
              <button class="btn btn-success btn-sm" id="canvas-verify-btn">✔️ Verify</button>
            </div>
          </div>

          <div class="kanji-info-block">
            <div class="kanji-info-header">
              <div>
                <span class="kanji-label-tag">JLPT ${kanji.level}</span>
                <h2>${kanji.character}</h2>
              </div>
              <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" id="kanji-bookmark-btn">
                ${isBookmarked ? '★' : '☆'} Bookmark
              </button>
            </div>

            <div class="readings-grid">
              <div class="reading-row">
                <span class="label">Meaning:</span>
                <span class="val accent">${kanji.meaning}</span>
              </div>
              <div class="reading-row">
                <span class="label">Onyomi:</span>
                <span class="val">${kanji.onyomi}</span>
              </div>
              <div class="reading-row">
                <span class="label">Kunyomi:</span>
                <span class="val">${kanji.kunyomi}</span>
              </div>
              <div class="reading-row">
                <span class="label">Radicals:</span>
                <span class="val">${kanji.radicals}</span>
              </div>
              <div class="reading-row">
                <span class="label">Strokes:</span>
                <span class="val">${kanji.strokes} strokes</span>
              </div>
            </div>
          </div>
        </div>

        <div class="kanji-examples-section">
          <h3>Example Vocabulary</h3>
          <div class="kanji-examples-grid">
            ${kanji.examples.map(ex => `
              <div class="kanji-ex-card">
                <div class="ex-word">${ex.word}</div>
                <div class="ex-reading">Read: ${ex.reading}</div>
                <div class="ex-meaning">${ex.meaning}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      // Event listener for Kanji bookmark
      document.getElementById("kanji-bookmark-btn").onclick = (e) => {
        this.toggleBookmark("kanji", kanji.id, e.currentTarget);
      };

      // Set up Canvas drawing
      this.initKanjiCanvas();

      // Trigger animations / clears
      document.getElementById("canvas-clear-btn").onclick = () => this.clearCanvas();
      document.getElementById("canvas-animate-btn").onclick = () => this.animateStrokeOrder();
      document.getElementById("canvas-verify-btn").onclick = () => {
        if (!this.activeKanji) return;
        
        const requiredStrokes = this.activeKanji.strokePaths;
        if (!requiredStrokes || requiredStrokes.length === 0) {
          // Fallback if no stroke guidelines exist (should be rare)
          this.addXP(10);
          this.unlockBadge("b2");
          this.showNotification("🎯 Verified!", "Strokes matching guidelines (fallback). +10 XP", "success");
          this.clearCanvas();
          return;
        }

        if (!this.userStrokes || this.userStrokes.length === 0) {
          this.showNotification("⚠️ Verification failed", "Please draw the character before verifying.", "error");
          return;
        }

        if (this.userStrokes.length < requiredStrokes.length) {
          this.showNotification("⚠️ Verification failed", `Incomplete: You drew ${this.userStrokes.length} of ${requiredStrokes.length} required strokes.`, "error");
          return;
        }

        if (this.userStrokes.length > requiredStrokes.length) {
          this.showNotification("⚠️ Verification failed", `Too many strokes: You drew ${this.userStrokes.length} strokes, but this Kanji only has ${requiredStrokes.length}.`, "error");
          return;
        }

        const getDistance = (p1, p2) => {
          return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        };

        const getStrokeStartAndEnd = (stroke) => {
          if (Array.isArray(stroke)) {
            const start = stroke[0];
            const end = stroke[stroke.length - 1];
            return {
              start: { x: start[0], y: start[1] },
              end: { x: end[0], y: end[1] }
            };
          }
          if (stroke && stroke.d) {
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tempPath.setAttribute("d", stroke.d);
            tempSvg.appendChild(tempPath);
            document.body.appendChild(tempSvg);
            const length = tempPath.getTotalLength();
            const startPt = tempPath.getPointAtLength(0);
            const endPt = tempPath.getPointAtLength(length);
            document.body.removeChild(tempSvg);
            return {
              start: { x: (startPt.x / 109) * 100, y: (startPt.y / 109) * 100 },
              end: { x: (endPt.x / 109) * 100, y: (endPt.y / 109) * 100 }
            };
          }
          return null;
        };

        const THRESHOLD = 30; // Max distance allowed (on 100x100 grid)
        for (let i = 0; i < requiredStrokes.length; i++) {
          const guide = requiredStrokes[i];
          const user = this.userStrokes[i];
          
          if (!user || user.length < 2) {
            this.showNotification("⚠️ Verification failed", `Stroke ${i + 1} is too short or invalid.`, "error");
            return;
          }

          const guidePoints = getStrokeStartAndEnd(guide);
          if (!guidePoints) continue;

          const userStart = user[0];
          const userEnd = user[user.length - 1];

          const startDiff = getDistance(userStart, guidePoints.start);
          const endDiff = getDistance(userEnd, guidePoints.end);

          if (startDiff > THRESHOLD || endDiff > THRESHOLD) {
            this.showNotification("⚠️ Verification failed", `Stroke ${i + 1} does not match the guideline. Make sure you draw in the correct direction and location.`, "error");
            return;
          }
        }

        this.addXP(10, "stroke");
        this.unlockBadge("b2"); // Kanji Artist badge
        if (!this.state.user.masteredKanji) this.state.user.masteredKanji = [];
        if (!this.state.user.masteredKanji.includes(this.activeKanji.id)) {
          this.state.user.masteredKanji.push(this.activeKanji.id);
        }
        this.saveState();
        this.showNotification("🎯 Canvas Cleared & Verified!", "Excellent practice! Your strokes matched the character guidelines! +10 XP", "success");
        this.clearCanvas();
      };
    };

    // Canvas Events
    this.initKanjiCanvas = () => {
      this.canvas = document.getElementById("kanji-canvas");
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");
      this.ctx.lineWidth = 10;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      this.userStrokes = [];
      this.currentStroke = null;

      // Draw background guidelines of Kanji character
      this.drawKanjiGuidelines();

      // Drawing Event listeners
      const startDrawing = (e) => {
        if (this._animationFrameId) {
          cancelAnimationFrame(this._animationFrameId);
          this._animationFrameId = null;
        }
        if (this._animationTimeoutId) {
          clearTimeout(this._animationTimeoutId);
          this._animationTimeoutId = null;
        }
        this.isDrawing = true;
        this.currentStroke = [];
        this.ctx.beginPath(); // Ensure drawing starts fresh and does not connect to guidelines
        this.draw(e);
      };

      const stopDrawing = () => {
        if (this.isDrawing && this.currentStroke && this.currentStroke.length > 0) {
          this.userStrokes.push(this.currentStroke);
        }
        this.currentStroke = null;
        this.isDrawing = false;
        this.ctx.beginPath();
      };

      this.canvas.addEventListener("mousedown", startDrawing);
      this.canvas.addEventListener("mousemove", (e) => {
        if (this.isDrawing) this.draw(e);
      });
      this.canvas.addEventListener("mouseup", stopDrawing);
      this.canvas.addEventListener("mouseleave", stopDrawing);

      // Touch Events for mobile support
      this.canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousedown", {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
      });

      this.canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousemove", {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
      });

      this.canvas.addEventListener("touchend", () => {
        this.canvas.dispatchEvent(new MouseEvent("mouseup", {}));
      });
    };

    this.draw = (e) => {
      if (!this.isDrawing || !this.canvas || !this.ctx) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.ctx.strokeStyle = "#ff4e50"; // Draw in coral accent color
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);

      const x_scaled = (x / this.canvas.width) * 100;
      const y_scaled = (y / this.canvas.height) * 100;
      if (this.currentStroke) {
        this.currentStroke.push({ x: x_scaled, y: y_scaled });
      }
    };

    this.clearCanvas = () => {
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
        this._animationFrameId = null;
      }
      if (this._animationTimeoutId) {
        clearTimeout(this._animationTimeoutId);
        this._animationTimeoutId = null;
      }
      if (!this.canvas || !this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawKanjiGuidelines();
      this.userStrokes = [];
      this.currentStroke = null;
    };

    this.drawKanjiGuidelines = () => {
      if (!this.canvas || !this.ctx || !this.activeKanji) return;
      
      this.ctx.save();
      
      const paths = this.activeKanji.strokePaths;
      if (paths && paths.length > 0) {
        // Draw the vector guidelines in background (faint blue/gray)
        paths.forEach(stroke => {
          this.ctx.save();
          let d = stroke.d;
          if (!d) {
            // Convert point array to SVG path
            d = "M " + stroke.map(p => `${p[0]} ${p[1]}`).join(" L ");
          }
          
          if (stroke.isDbPoints || Array.isArray(stroke)) {
            this.ctx.scale(250 / 100, 250 / 100);
            this.ctx.lineWidth = 14 * (100 / 250); // scales to ~14px on screen
          } else {
            this.ctx.scale(250 / 109, 250 / 109);
            this.ctx.lineWidth = 14 * (109 / 250); // scales to ~14px on screen
          }
          
          this.ctx.strokeStyle = "rgba(37, 99, 235, 0.12)"; // Light blue guideline
          this.ctx.lineCap = "round";
          this.ctx.lineJoin = "round";
          
          this.ctx.stroke(new Path2D(d));
          this.ctx.restore();
        });
        
        // Draw numbers directly at the start of each path (without circular dots)
        this.ctx.save();
        this.ctx.font = "bold 13px 'Outfit', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "#2563eb"; // Royal blue for number text

        paths.forEach((stroke, idx) => {
          let d = stroke.d;
          let isDb = false;
          if (!d) {
            d = "M " + stroke.map(p => `${p[0]} ${p[1]}`).join(" L ");
            isDb = true;
          } else if (stroke.isDbPoints) {
            isDb = true;
          }
          
          const match = d.match(/^[Mm]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*)/);
          if (match) {
            let startX = parseFloat(match[1]);
            let startY = parseFloat(match[2]);
            
            // Scale start coordinates to 250x250 canvas space
            if (isDb) {
              startX = startX * (250 / 100);
              startY = startY * (250 / 100);
            } else {
              startX = startX * (250 / 109);
              startY = startY * (250 / 109);
            }
            
            // Draw the number text directly offset slightly
            this.ctx.fillText(idx + 1, startX - 9, startY - 9);
          }
        });
        this.ctx.restore();
      } else {
        // Fallback to text guideline in background
        this.ctx.font = "160px 'Noto Sans JP', sans-serif";
        this.ctx.fillStyle = "rgba(100, 116, 139, 0.15)"; // Light grey guideline
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(this.activeKanji.character, this.canvas.width / 2, this.canvas.height / 2 + 10);
      }
      
      this.ctx.beginPath(); // Ensure the path starts fresh and doesn't connect to guidelines
      this.ctx.restore();
    };

    this.animateStrokeOrder = async () => {
      if (!this.canvas || !this.ctx || !this.activeKanji) return;

      let rawPaths = this.activeKanji.strokePaths;
      if (!rawPaths || rawPaths.length === 0) {
        const btn = document.getElementById("canvas-animate-btn");
        const originalText = btn ? btn.innerHTML : "▶️ Stroke Order";
        if (btn) {
          btn.innerHTML = "⏳ Loading...";
          btn.disabled = true;
        }

        await this.fetchStrokePaths(this.activeKanji);

        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
        rawPaths = this.activeKanji.strokePaths;
      }

      if (!rawPaths || rawPaths.length === 0) {
        this.showNotification("⚠️ Stroke order unavailable", "Could not load stroke order guidelines.", "error");
        return;
      }

      // Convert database coordinate points to Path2D d structure if needed
      const preparedStrokes = rawPaths.map(stroke => {
        if (stroke.d && stroke.length !== undefined) {
          return stroke;
        }
        // Convert point array to SVG path
        const d = "M " + stroke.map(p => `${p[0]} ${p[1]}`).join(" L ");
        
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempPath.setAttribute("d", d);
        tempSvg.appendChild(tempPath);
        document.body.appendChild(tempSvg);
        const length = tempPath.getTotalLength();
        document.body.removeChild(tempSvg);
        
        return { d, length, isDbPoints: true };
      });

      // Reset any running animation frames or timers
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
      }
      if (this._animationTimeoutId) {
        clearTimeout(this._animationTimeoutId);
      }

      this.clearCanvas();

      let currentStrokeIdx = 0;

      const drawStroke = (stroke, offset = 0) => {
        this.ctx.save();
        
        if (stroke.isDbPoints) {
          // Scale 100x100 database points to 250x250 canvas
          this.ctx.scale(250 / 100, 250 / 100);
          this.ctx.lineWidth = 18 * (100 / 250); // ~7.2px thickness in 100x100 grid space (scales to 18px on canvas)
        } else {
          // Scale 109x109 KanjiVG points to 250x250 canvas
          this.ctx.scale(250 / 109, 250 / 109);
          this.ctx.lineWidth = 18 * (109 / 250); // ~7.8px thickness in 109x109 grid space (scales to 18px on canvas)
        }
        
        this.ctx.strokeStyle = "#4f46e5"; // Indigo guideline trace
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        
        const path = new Path2D(stroke.d);
        if (offset > 0) {
          this.ctx.setLineDash([stroke.length, stroke.length]);
          this.ctx.lineDashOffset = offset;
        } else {
          this.ctx.setLineDash([]);
        }
        
        this.ctx.stroke(path);
        this.ctx.restore();
      };

      const animateNextStroke = () => {
        if (currentStrokeIdx >= preparedStrokes.length) return;

        const stroke = preparedStrokes[currentStrokeIdx];
        const length = stroke.length;
        let offset = length;
        const speed = length / 8; // snappier writing speed (~8 frames per stroke)

        const drawFrame = () => {
          offset -= speed;
          if (offset < 0) offset = 0;

          // Clear canvas
          this.clearCanvas();

          // Redraw all previous strokes fully
          for (let i = 0; i < currentStrokeIdx; i++) {
            drawStroke(preparedStrokes[i], 0);
          }

          // Draw current stroke partially
          drawStroke(stroke, offset);

          if (offset > 0) {
            this._animationFrameId = requestAnimationFrame(drawFrame);
          } else {
            currentStrokeIdx++;
            this._animationTimeoutId = setTimeout(animateNextStroke, 250); // Snug pause between strokes
          }
        };

        drawFrame();
      };

      animateNextStroke();
    };

    // Sidebar listeners
    const searchInput = document.getElementById("kanji-search");
    searchInput.addEventListener("input", (e) => {
      searchVal = e.target.value;
      renderKanjiList();
    });

    document.querySelectorAll("#kanji-level-tabs .tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll("#kanji-level-tabs .tab-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        activeLvl = e.target.getAttribute("data-lvl");
        renderKanjiList();
      });
    });

    // Render list
    renderKanjiList();

    // Kanji Quiz Mode
    const kQuizModal = document.getElementById("kanji-quiz-modal");
    document.getElementById("kanji-quiz-mode-btn").addEventListener("click", () => {
      const pool = window.kanjiDatabase.filter(k => k.level === activeLvl);
      if (pool.length < 2) {
        alert("Not enough kanji in this level for quiz selection.");
        return;
      }

      kQuizModal.style.display = "flex";
      let quizQuestions = [];
      let currentQIdx = 0;
      let score = 0;

      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      shuffled.forEach((k) => {
        // Option 1: Meaning quiz
        const wrongMeanings = pool.filter(p => p.id !== k.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(p => p.meaning);
        const options = [k.meaning, ...wrongMeanings].sort(() => 0.5 - Math.random());

        quizQuestions.push({
          question: `What is the meaning of the Kanji character: 「${k.character}」?`,
          options: options,
          correctIndex: options.indexOf(k.meaning),
          explanation: `The Kanji 「${k.character}」 means "${k.meaning}". Onyomi: ${k.onyomi}, Kunyomi: ${k.kunyomi}.`
        });
      });

      const showQuestion = () => {
        const q = quizQuestions[currentQIdx];
        document.getElementById("kanji-qp-fill").style.width = `${((currentQIdx) / quizQuestions.length) * 100}%`;
        document.getElementById("kanji-quiz-question").textContent = `Question ${currentQIdx + 1}: ${q.question}`;
        
        const optsContainer = document.getElementById("kanji-quiz-options");
        optsContainer.innerHTML = "";

        q.options.forEach((opt, idx) => {
          const btn = document.createElement("button");
          btn.className = "quiz-opt-btn";
          btn.textContent = opt;
          btn.onclick = () => selectOption(idx);
          optsContainer.appendChild(btn);
        });

        document.getElementById("kanji-quiz-feedback").style.display = "none";
        document.getElementById("kanji-quiz-next-btn").style.display = "none";
      };

      const selectOption = (idx) => {
        const q = quizQuestions[currentQIdx];
        const buttons = document.querySelectorAll(".quiz-opt-btn");
        buttons.forEach((btn, index) => {
          btn.disabled = true;
          if (index === q.correctIndex) btn.classList.add("correct");
          else if (index === idx) btn.classList.add("incorrect");
        });

        const feedback = document.getElementById("kanji-quiz-feedback");
        feedback.style.display = "block";

        if (idx === q.correctIndex) {
          score++;
          feedback.innerHTML = `<span class="correct-text">🎉 Correct!</span><p>${q.explanation}</p>`;
          this.addXP(6, "quiz");
        } else {
          feedback.innerHTML = `<span class="incorrect-text">❌ Incorrect.</span><p>${q.explanation}</p>`;
        }

        document.getElementById("kanji-quiz-next-btn").style.display = "block";
      };

      document.getElementById("kanji-quiz-next-btn").onclick = () => {
        if (currentQIdx < quizQuestions.length - 1) {
          currentQIdx++;
          showQuestion();
        } else {
          document.getElementById("kanji-qp-fill").style.width = "100%";
          document.getElementById("kanji-quiz-question").innerHTML = `Quiz Completed! <br><br>Score: <strong>${score} / ${quizQuestions.length}</strong>`;
          document.getElementById("kanji-quiz-options").innerHTML = `
            <div class="quiz-summary-box">
              <p>Excellent Kanji study session! You earned <strong>+${score * 10} XP</strong> bonus!</p>
              <button class="btn btn-primary" id="k-quiz-finish-close">Done</button>
            </div>
          `;
          document.getElementById("kanji-quiz-feedback").style.display = "none";
          document.getElementById("kanji-quiz-next-btn").style.display = "none";
          this.addXP(score * 10, "quiz");

          document.getElementById("k-quiz-finish-close").onclick = () => {
            kQuizModal.style.display = "none";
          };
        }
      };

      showQuestion();
    });

    document.getElementById("kanji-quiz-close").addEventListener("click", () => {
      kQuizModal.style.display = "none";
    });
  }

  renderGrammar(container) {
    const self = this;
    let activeLvl = "N5";
    let searchVal = "";

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Grammar Lessons</h1>
          <p>Study grammatical structures, sentence formations, and usage comparison cases.</p>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-box">
          <input type="text" id="grammar-search" placeholder="Search grammar rules (e.g. たい)...">
        </div>
        <div class="level-tabs" id="grammar-level-tabs">
          <button class="tab-btn active" data-lvl="N5">N5</button>
          <button class="tab-btn" data-lvl="N4">N4</button>
          <button class="tab-btn" data-lvl="N3">N3</button>
          <button class="tab-btn" data-lvl="N2">N2</button>
        </div>
        <div class="kana-tabs" id="kana-tabs">
          <button class="kana-tab-btn" data-kana="hiragana">Hiragana</button>
          <button class="kana-tab-btn" data-kana="katakana">Katakana</button>
        </div>
      </div>

      <div class="grammar-layout">
        <!-- List Panel -->
        <div class="grammar-list-panel" id="grammar-list-pane">
          <!-- Rendered dynamically -->
        </div>

        <!-- Detail View Panel -->
        <div class="grammar-detail-panel" id="grammar-detail-pane">
          <div class="empty-state">
            <p>Select a grammar pattern from the left side list to read the explanations, formations, and practice.</p>
          </div>
        </div>
      </div>

      <div class="kana-layout" id="kana-layout" style="display:none; margin-top:20px;">
        <div class="kana-list-panel" id="kana-list-pane">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;

    // --- Kana data containing Romaji mappings ---
    const hiraganaData = [
      { jp: "あ", romaji: "a" }, { jp: "い", romaji: "i" }, { jp: "う", romaji: "u" }, { jp: "え", romaji: "e" }, { jp: "お", romaji: "o" },
      { jp: "か", romaji: "ka" }, { jp: "き", romaji: "ki" }, { jp: "く", romaji: "ku" }, { jp: "け", romaji: "ke" }, { jp: "こ", romaji: "ko" },
      { jp: "さ", romaji: "sa" }, { jp: "し", romaji: "shi" }, { jp: "す", romaji: "su" }, { jp: "せ", romaji: "se" }, { jp: "そ", romaji: "so" },
      { jp: "た", romaji: "ta" }, { jp: "ち", romaji: "chi" }, { jp: "つ", romaji: "tsu" }, { jp: "て", romaji: "te" }, { jp: "と", romaji: "to" },
      { jp: "な", romaji: "na" }, { jp: "に", romaji: "ni" }, { jp: "ぬ", romaji: "nu" }, { jp: "ね", romaji: "ne" }, { jp: "の", romaji: "no" },
      { jp: "は", romaji: "ha" }, { jp: "ひ", romaji: "hi" }, { jp: "ふ", romaji: "fu" }, { jp: "へ", romaji: "he" }, { jp: "ほ", romaji: "ho" },
      { jp: "ま", romaji: "ma" }, { jp: "み", romaji: "mi" }, { jp: "む", romaji: "mu" }, { jp: "め", romaji: "me" }, { jp: "も", romaji: "mo" },
      { jp: "や", romaji: "ya" }, { jp: "ゆ", romaji: "yu" }, { jp: "よ", romaji: "yo" },
      { jp: "ら", romaji: "ra" }, { jp: "り", romaji: "ri" }, { jp: "る", romaji: "ru" }, { jp: "れ", romaji: "re" }, { jp: "ろ", romaji: "ro" },
      { jp: "わ", romaji: "wa" }, { jp: "を", romaji: "wo" }, { jp: "ん", romaji: "n" }
    ];

    const katakanaData = [
      { jp: "ア", romaji: "a" }, { jp: "イ", romaji: "i" }, { jp: "ウ", romaji: "u" }, { jp: "エ", romaji: "e" }, { jp: "オ", romaji: "o" },
      { jp: "カ", romaji: "ka" }, { jp: "キ", romaji: "ki" }, { jp: "ク", romaji: "ku" }, { jp: "ケ", romaji: "ke" }, { jp: "コ", romaji: "ko" },
      { jp: "サ", romaji: "sa" }, { jp: "シ", romaji: "shi" }, { jp: "ス", romaji: "su" }, { jp: "セ", romaji: "se" }, { jp: "ソ", romaji: "so" },
      { jp: "タ", romaji: "ta" }, { jp: "チ", romaji: "chi" }, { jp: "ツ", romaji: "tsu" }, { jp: "テ", romaji: "te" }, { jp: "ト", romaji: "to" },
      { jp: "ナ", romaji: "na" }, { jp: "ニ", romaji: "ni" }, { jp: "ヌ", romaji: "nu" }, { jp: "ネ", romaji: "ne" }, { jp: "ノ", romaji: "no" },
      { jp: "ハ", romaji: "ha" }, { jp: "ヒ", romaji: "hi" }, { jp: "フ", romaji: "fu" }, { jp: "ヘ", romaji: "he" }, { jp: "ホ", romaji: "ho" },
      { jp: "マ", romaji: "ma" }, { jp: "ミ", romaji: "mi" }, { jp: "ム", romaji: "mu" }, { jp: "メ", romaji: "me" }, { jp: "モ", romaji: "mo" },
      { jp: "ヤ", romaji: "ya" }, { jp: "ユ", romaji: "yu" }, { jp: "ヨ", romaji: "yo" },
      { jp: "ラ", romaji: "ra" }, { jp: "リ", romaji: "ri" }, { jp: "ル", romaji: "ru" }, { jp: "レ", romaji: "re" }, { jp: "ロ", romaji: "ro" },
      { jp: "ワ", romaji: "wa" }, { jp: "ヲ", romaji: "wo" }, { jp: "ン", romaji: "n" }
    ];

    // --- Rendering helpers for Kana ---
    function renderKanaList(type) {
      const pane = document.getElementById("kana-list-pane");
      pane.innerHTML = "";
      const list = type === "hiragana" ? hiraganaData : katakanaData;
      list.forEach(item => {
        const card = document.createElement("div");
        card.className = "kana-card";
        card.innerHTML = `
          <span class="kana-char">${item.jp}</span>
          <span class="kana-romaji">${item.romaji}</span>
        `;
        pane.appendChild(card);
      });
    }

    // Kana tab switching
    document.querySelectorAll("#kana-tabs .kana-tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll("#kana-tabs .kana-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll("#grammar-level-tabs .tab-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        const type = e.target.getAttribute("data-kana");
        renderKanaList(type);
        // Hide grammar list/detail when viewing kana
        document.querySelector(".grammar-layout").style.display = "none";
        document.getElementById("kana-layout").style.display = "block";
      });
    });

    // Grammar tab switching (restore view)
    document.querySelectorAll("#grammar-level-tabs .tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll("#grammar-level-tabs .tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll("#kana-tabs .kana-tab-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        activeLvl = e.target.getAttribute("data-lvl");
        renderGrammarList();
        // Show grammar layout, hide kana layout
        document.querySelector(".grammar-layout").style.display = "grid";
        document.getElementById("kana-layout").style.display = "none";
      });
    });

    // Preserve existing search functionality for grammar
    const searchInput = document.getElementById("grammar-search");
    searchInput.addEventListener("input", (e) => {
      searchVal = e.target.value;
      renderGrammarList();
    });

    // Initial render: grammar view
    document.querySelector(".grammar-layout").style.display = "grid";
    document.getElementById("kana-layout").style.display = "none";
    renderGrammarList();

    // --- Grammar rendering logic ---
    function renderGrammarList() {
      const pane = document.getElementById("grammar-list-pane");
      pane.innerHTML = "";
      const filtered = window.grammarDatabase.filter(g => {
        const lvlMatch = g.level === activeLvl;
        const searchMatch = searchVal === "" || g.pattern.toLowerCase().includes(searchVal.toLowerCase());
        return lvlMatch && searchMatch;
      });
      if (filtered.length === 0) {
        pane.innerHTML = `<div class="empty-state">No grammar rules found.</div>`;
        return;
      }
      filtered.forEach(g => {
        const item = document.createElement("div");
        item.className = "grammar-list-item";
        item.innerHTML = `
          <h4>${g.patternFurigana || g.pattern}</h4>
          <p>${g.explanation ? g.explanation.substring(0, 45) + '...' : ''}</p>
        `;
        item.onclick = () => {
          try {
            renderGrammarDetail(g);
          } catch (err) {
            console.error("Error loading grammar detail:", err);
          }
        };
        pane.appendChild(item);
      });
    }

    function getPastFormDetails(g) {
      const pattern = g.pattern;
      
      // Conjunctions / Connection words
      if (g.id.includes("_11") || g.id.includes("_12") || g.id.includes("_13") || g.id.includes("_14") || g.id.includes("_15") || g.id.includes("_16") || 
          pattern.startsWith("A。") || pattern === "しかし" || pattern === "けれども" || pattern === "それじゃ" || pattern === "それでは") {
        return {
          pastPattern: "N/A",
          formation: "This is a conjunction (connecting word) and does not conjugate.",
          explanation: "Connecting words do not have a past tense form. Instead, conjugate the verbs in the clauses before or after them.",
          example: "N/A"
        };
      }

      // ~tai
      if (pattern.endsWith("たい")) {
        return {
          pastPattern: pattern.replace("たい", "たかった"),
          formation: "Verb [Masu-Stem] + たかった (Polite: たかったです)",
          explanation: "Used to express 'wanted to do' in the past.",
          exampleJp: "日<rt>に</rt>本<rt>ほん</rt>に行<rt>い</rt>き<strong>たかった</strong>です。",
          exampleEn: "I wanted to go to Japan."
        };
      }
      
      // ~koto ga aru / ~osore ga aru / ~koto ga dekiru
      if (pattern.includes("ある") || pattern.includes("ことができる")) {
        const cleanPattern = pattern.split(" ")[0];
        return {
          pastPattern: cleanPattern.replace("ある", "あった"),
          formation: "Verb/Noun + ことがあった / 恐れがあった",
          explanation: "Used to express that something occurred or there was a risk of something occurring in the past.",
          exampleJp: "日<rt>に</rt>本<rt>ほん</rt>に行<rt>い</rt>った<strong>ことがありました</strong>。",
          exampleEn: "I have had the experience of going to Japan before."
        };
      }

      // ~koto ni naru / ~youni naru
      if (pattern.endsWith("なる")) {
        return {
          pastPattern: pattern.replace("なる", "なった"),
          formation: "Verb [Dictionary/Nai form] + ことになった (Polite: ことになりました)",
          explanation: "Used to express an external decision or eventuality that was decided in the past.",
          exampleJp: "来<rt>らい</rt>月<rt>げつ</rt>から日<rt>に</rt>本<rt>ほん</rt>で働<rt>はたら</rt>く<strong>ことになりました</strong>。",
          exampleEn: "It has been decided that I will work in Japan starting next month."
        };
      }

      // ~koto ni suru / ~youni suru
      if (pattern.endsWith("する")) {
        return {
          pastPattern: pattern.replace("する", "した"),
          formation: "Verb [Dictionary/Nai form] + ことにした (Polite: にしました)",
          explanation: "Used to express a personal decision made in the past.",
          exampleJp: "毎<rt>まい</rt>日<rt>にち</rt>運<rt>うん</rt>動<rt>どう</rt>する<strong>ことにしました</strong>。",
          exampleEn: "I decided to exercise every day."
        };
      }

      // ~hazuda / ~tsumorida
      if (pattern.endsWith("だ")) {
        return {
          pastPattern: pattern.replace("だ", "だった"),
          formation: "Verb/Adjective/Noun + はずだった / つもりだった (Polite: はずでした / つもりでした)",
          explanation: "Used to express an expectation or intention in the past that might not have happened.",
          exampleJp: "彼<rt>かれ</rt>は今<rt>きょう</rt>日忙<rt>いそが</rt>しい<strong>はずでした</strong>。",
          exampleEn: "He was supposed to be busy today."
        };
      }

      // ~hou ga ii
      if (pattern.endsWith("いい")) {
        return {
          pastPattern: pattern.replace("いい", "よかった"),
          formation: "Verb [Ta-Form] + ほうがよかった (Polite: ほうがよかったです)",
          explanation: "Used to express regret or recommendation in the past ('it would have been better to...').",
          exampleJp: "もっと勉<rt>べん</rt>強<rt>きょう</rt>した<strong>ほうがよかったです</strong>。",
          exampleEn: "It would have been better if I had studied more."
        };
      }

      // ~tsutsu aru
      if (pattern.endsWith("つつある")) {
        return {
          pastPattern: pattern.replace("つつある", "つつあった"),
          formation: "Verb [Masu-Stem] + つつあった (Polite: つつありました)",
          explanation: "Used to express a gradual change that was in progress in the past.",
          exampleJp: "日本の景気は回復し<strong>つつありました</strong>。",
          exampleEn: "Japan's economy was in the process of recovering."
        };
      }

      // ~kiru
      if (pattern.includes("切る")) {
        return {
          pastPattern: "～切った",
          formation: "Verb-stem + 切った (Polite: 切りました)",
          explanation: "Used to express that an action was completely finished in the past.",
          exampleJp: "小<rt>しょう</rt>説<rt>せつ</rt>を読<rt>よ</rt>み<strong>切りました</strong>。",
          exampleEn: "I read the novel completely."
        };
      }

      // ~tsute kudasai (requests)
      if (pattern.endsWith("てください")) {
        return {
          pastPattern: "N/A (Request Form)",
          formation: "Request forms do not have a past tense. To say someone did something for you, use <strong>～てくれました</strong>.",
          explanation: "For example, to say 'Someone read it to me' -> 読んでくれました。",
          exampleJp: "先<rt>せん</rt>生<rt>せい</rt>が本<rt>ほん</rt>を貸<rt>か</rt>し<strong>てくれました</strong>。",
          exampleEn: "The teacher kindly lent me a book."
        };
      }

      // ~kara / ~node
      if (pattern.endsWith("から") || pattern.endsWith("ので")) {
        return {
          pastPattern: "～たから / ～たので",
          formation: "Clause [Past Plain Form] + から / ので",
          explanation: "Used to express a reason/cause for an action that occurred in the past.",
          exampleJp: "雨<rt>あめ</rt>が降<rt>ふ</rt>っ<strong>たから</strong>、行<rt>い</rt>きませんでした。",
          exampleEn: "Since it rained, I did not go."
        };
      }

      // ~shidai / ~shidai de
      if (pattern.includes("次第")) {
        return {
          pastPattern: "～次第だった",
          formation: "Noun / Verb-masu + 次第だった (Polite: 次第でした)",
          explanation: "Used to express that something was dependent on or decided immediately after an event in the past.",
          exampleJp: "準<rt>じゅん</rt>備<rt>び</rt>ができ<strong>次第</strong>、出<rt>しゅっ</rt>発<rt>ぱつ</rt>しました。",
          exampleEn: "We departed as soon as preparations were complete."
        };
      }

      // ~kagiri
      if (pattern.includes("限り")) {
        return {
          pastPattern: "～限りだった",
          formation: "Verb-casual [Past/Present] + 限りだった",
          explanation: "Used to express that a condition held true in the past.",
          exampleJp: "覚<rt>おぼ</rt>えている<strong>限り</strong>では、そうでした。",
          exampleEn: "As far as I remember, it was so."
        };
      }

      // ~sai ni / ~ori ni wa / ~ue wa / ~ue ni
      if (pattern.includes("際に") || pattern.includes("折には") || pattern.includes("上は") || pattern.includes("上に") || pattern.includes("以上") || pattern.includes("末")) {
        return {
          pastPattern: "Uses past tense in the preceding clause.",
          formation: "Verb [Ta-form (Past)] + 際に / 上で / 末に / 以上",
          explanation: "These patterns themselves don't conjugate, but require a past-tense verb (Ta-form) to refer to past events.",
          exampleJp: "検<rt>けん</rt>討<rt>とう</rt>した<strong>上で</strong>、決<rt>き</rt>めました。",
          exampleEn: "I decided after considering it."
        };
      }

      // Default Fallback
      return {
        pastPattern: "～" + pattern.replace("～", "") + " (Conjugates main verb)",
        formation: "Conjugate the main verb or final copula of the sentence to its past tense (e.g. た-form / ました / でした).",
        explanation: "Many grammar particles do not change form themselves; instead, the verb that connects to them or the final verb of the sentence is conjugated to express the past tense.",
        exampleJp: "日<rt>に</rt>本<rt>ほん</rt>語<rt>ご</rt>を勉<rt>べん</rt>強<rt>きょう</rt>し<strong>ていました</strong>。",
        exampleEn: "I was studying Japanese."
      };
    }

    function renderGrammarDetail(g) {
      const pane = document.getElementById("grammar-detail-pane");
      const isBookmarked = self.state.user.bookmarks.grammar && self.state.user.bookmarks.grammar.includes(g.id);
      const pastDetails = getPastFormDetails(g);
      const firstEx = g.examples && g.examples[0] ? g.examples[0] : null;
      const presentExampleJp = firstEx ? (firstEx.furigana ? window.formatFurigana(firstEx.furigana) : firstEx.japanese) : "";
      const presentExampleEn = firstEx ? firstEx.translation : "";

      pane.innerHTML = `
        <div class="grammar-detail-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <h2>${g.patternFurigana || g.pattern}</h2>
            <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" 
                    onclick="window.showZoomModal(this.getAttribute('data-jp'), 'Base Grammar Pattern')"
                    data-jp="${(g.patternFurigana || g.pattern).replace(/"/g, '&quot;')}">
              🔍 Zoom Pattern
            </button>
          </div>
          <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" id="grammar-bookmark-btn">${isBookmarked ? '★' : '☆'}</button>
        </div>
        <div class="grammar-section-block">
          <h3>Explanation</h3>
          <p>${g.explanation || ""}</p>
        </div>
        <div class="grammar-section-block">
          <h3>Formation</h3>
          <p>${g.formation || ""}</p>
        </div>

        ${g.notes ? `
        <div class="grammar-section-block">
          <h3>Notes</h3>
          <p>${g.notes}</p>
        </div>
        ` : ""}

        ${g.commonMistakes && (g.commonMistakes.incorrect || g.commonMistakes.correct || g.commonMistakes.explanation) ? `
        <div class="grammar-section-block mistakes-block" style="border-left: 4px solid #ef4444; padding-left: 15px; background: rgba(239, 68, 68, 0.06); border-radius: 6px; padding-top: 12px; padding-bottom: 12px; margin-top: 20px;">
          <h3 style="color: #f87171; margin-top: 0; margin-bottom: 8px; font-size: 1.05rem; font-weight: 700; text-transform: uppercase;">⚠️ Common Mistakes</h3>
          ${g.commonMistakes.incorrect ? `<p style="margin: 0 0 4px 0;">❌ <strong>Incorrect:</strong> ${g.commonMistakes.incorrect}</p>` : ""}
          ${g.commonMistakes.correct ? `<p style="margin: 0 0 8px 0;">✅ <strong>Correct:</strong> ${g.commonMistakes.correct}</p>` : ""}
          ${g.commonMistakes.explanation ? `<p style="margin: 0; opacity: 0.8; font-size: 0.9rem;">${g.commonMistakes.explanation}</p>` : ""}
        </div>
        ` : ""}

        ${g.comparison && g.comparison.target ? `
        <div class="grammar-section-block comparison-block" style="border-left: 4px solid #3b82f6; padding-left: 15px; background: rgba(59, 130, 246, 0.06); border-radius: 6px; padding-top: 12px; padding-bottom: 12px; margin-top: 20px;">
          <h3 style="color: #60a5fa; margin-top: 0; margin-bottom: 8px; font-size: 1.05rem; font-weight: 700; text-transform: uppercase;">🔍 Comparison vs ${g.comparison.target}</h3>
          <p style="margin: 0; opacity: 0.95; font-size: 0.95rem;">${g.comparison.difference}</p>
        </div>
        ` : ""}

        <div class="grammar-section-block present-tense-block" style="margin-top: 20px; border-left: 4px solid #3b82f6; padding-left: 15px; background: rgba(59, 130, 246, 0.06); border-radius: 6px; padding-top: 12px; padding-bottom: 12px;">
          <h3 style="color: #60a5fa; margin-top: 0; margin-bottom: 8px; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            ☀️ Present Tense Form
          </h3>
          <p style="margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 600;">
            Present Form: <code style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.95em;">${g.patternFurigana || g.pattern}</code>
          </p>
          <p style="margin: 0 0 6px 0; font-size: 0.95rem; opacity: 0.85;">
            <strong>Formation:</strong> ${g.formation || "N/A"}
          </p>
          <p style="margin: 0 0 12px 0; font-size: 0.9rem; opacity: 0.75; line-height: 1.4;">
            ${g.explanation || ""}
          </p>
          ${presentExampleJp ? `
            <div style="background: rgba(0, 0, 0, 0.2); padding: 10px 14px; border-radius: 6px; border-left: 2px solid #3b82f6; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1; margin-right: 10px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 4px; font-weight: 700;">Present Example:</span>
                <p class="jp font-japanese" style="margin: 0 0 4px 0; font-size: 1.1rem; line-height: 1.5;">${presentExampleJp}</p>
                <p style="margin: 0; font-size: 0.88rem; opacity: 0.8; font-style: italic;">${presentExampleEn}</p>
              </div>
              <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" 
                      onclick="window.showZoomModal(this.getAttribute('data-jp'), this.getAttribute('data-en'))"
                      data-jp="${presentExampleJp.replace(/"/g, '&quot;')}"
                      data-en="${presentExampleEn.replace(/"/g, '&quot;')}">
                🔍 Zoom
              </button>
            </div>
          ` : ""}
        </div>
        
        <div class="grammar-section-block past-tense-block" style="margin-top: 20px; border-left: 4px solid #8b5cf6; padding-left: 15px; background: rgba(139, 92, 246, 0.06); border-radius: 6px; padding-top: 12px; padding-bottom: 12px;">
          <h3 style="color: #a78bfa; margin-top: 0; margin-bottom: 8px; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            ⏱️ Past Tense Form
          </h3>
          <p style="margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 600;">
            Past Form: <code style="background: rgba(139, 92, 246, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.95em;">${pastDetails.pastPattern}</code>
          </p>
          <p style="margin: 0 0 6px 0; font-size: 0.95rem; opacity: 0.85;">
            <strong>Formation:</strong> ${pastDetails.formation}
          </p>
          <p style="margin: 0 0 12px 0; font-size: 0.9rem; opacity: 0.75; line-height: 1.4;">
            ${pastDetails.explanation}
          </p>
          ${pastDetails.exampleJp ? `
            <div style="background: rgba(0, 0, 0, 0.2); padding: 10px 14px; border-radius: 6px; border-left: 2px solid #a78bfa; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1; margin-right: 10px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 4px; font-weight: 700;">Past Example:</span>
                <p class="jp font-japanese" style="margin: 0 0 4px 0; font-size: 1.1rem; line-height: 1.5;">${window.formatFurigana(pastDetails.exampleJp)}</p>
                <p style="margin: 0; font-size: 0.88rem; opacity: 0.8; font-style: italic;">${pastDetails.exampleEn}</p>
              </div>
              <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" 
                      onclick="window.showZoomModal(this.getAttribute('data-jp'), this.getAttribute('data-en'))"
                      data-jp="${window.formatFurigana(pastDetails.exampleJp).replace(/"/g, '&quot;')}"
                      data-en="${pastDetails.exampleEn.replace(/"/g, '&quot;')}">
                🔍 Zoom
              </button>
            </div>
          ` : ""}
        </div>

        <!-- Tense Table -->
        ${(() => {
          const tableData = self.getTenseTable(g.pattern);
          if (!tableData) return '';
          return `
          <div class="grammar-section-block" style="margin-top:20px;">
            <h3 style="display: flex; align-items: center; gap: 8px;">📊 Present &amp; Past Tense Formations</h3>
            <div style="overflow-x:auto; background:var(--bg-tertiary); border-radius:12px; padding:8px 12px; border:1px solid var(--border-color);">
              <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-color); color:var(--text-secondary);">
                    <th style="padding:10px;">Tense / Form</th>
                    <th style="padding:10px;">Plain Form (Casual)</th>
                    <th style="padding:10px;">Polite Form (Formal)</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableData.rows.map(row => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                      <td style="padding:10px; font-weight:600; color:var(--accent-indigo);">${row.tense}</td>
                      <td style="padding:10px; font-family:var(--font-japanese); font-size:16px;">${row.plain}</td>
                      <td style="padding:10px; font-family:var(--font-japanese); font-size:16px;">${row.polite}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          `;
        })()}

        <div class="grammar-examples" style="margin-top: 20px;">
          <h3>Examples</h3>
          ${g.examples && g.examples.length > 0 ? g.examples.map(e => {
            const jpText = e.furigana ? self.rubyExample(e.furigana) : e.japanese || "";
            const originalHTML = `
              <div class="example-item" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:12px;">
                <div style="flex:1; margin-right: 10px;">
                  <span style="font-size:10px; background:rgba(99,102,241,0.15); color:var(--accent-indigo); padding:2px 8px; border-radius:10px; font-weight:700;">Present / Affirmative Form</span>
                  <p class="jp font-japanese" style="margin-top: 6px; margin-bottom: 4px; font-size: 1.1rem; line-height: 1.6;">${jpText}</p>
                  <p class="en" style="margin: 0; opacity: 0.85;">${e.translation || ""}</p>
                  ${e.breakdown ? `<p style="font-size:12px; color:var(--accent-indigo); margin: 4px 0 0 0;">💡 ${e.breakdown}</p>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm zoom-action-btn" 
                        style="padding: 2px 6px; font-size: 0.8rem; margin-top: 5px; opacity: 0.7;" 
                        onclick="window.showZoomModal(this.getAttribute('data-jp'), this.getAttribute('data-en'))"
                        data-jp="${jpText.replace(/"/g, '&quot;')}"
                        data-en="${(e.translation || "").replace(/"/g, '&quot;')}">
                  🔍 Zoom
                </button>
              </div>
            `;
            
            const pastEx = self.conjugateSentenceToPast(e.furigana || e.japanese || '', e.translation || '');
            const pastHTML = pastEx ? `
              <div class="example-item" style="border-left: 2px dashed var(--success-color); padding-left: 12px; margin-top: 10px; margin-bottom: 20px; background: rgba(16,185,129,0.02); display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex:1; margin-right: 10px;">
                  <span style="font-size:10px; background:rgba(16,185,129,0.15); color:var(--success-color); padding:2px 8px; border-radius:10px; font-weight:700;">Past Form</span>
                  <p class="jp font-japanese" style="margin-top: 6px; margin-bottom: 4px; font-size: 1.1rem; line-height: 1.6;">${self.rubyExample(pastEx.japanese)}</p>
                  <p class="en" style="margin: 0; opacity: 0.85;">${pastEx.translation}</p>
                </div>
                <button class="btn btn-secondary btn-sm zoom-action-btn" 
                        style="padding: 2px 6px; font-size: 0.8rem; margin-top: 5px; opacity: 0.7;" 
                        onclick="window.showZoomModal(this.getAttribute('data-jp'), this.getAttribute('data-en'))"
                        data-jp="${self.rubyExample(pastEx.japanese).replace(/"/g, '&quot;')}"
                        data-en="${pastEx.translation.replace(/"/g, '&quot;')}">
                  🔍 Zoom
                </button>
              </div>
            ` : '';
            
            return originalHTML + pastHTML;
          }).join('') : '<p>No examples available.</p>'}
        </div>
      `;
      const bookmarkBtn = document.getElementById("grammar-bookmark-btn");
      if (bookmarkBtn) {
        bookmarkBtn.onclick = (e) => {
          self.toggleBookmark("grammar", g.id, e.currentTarget);
        };
      }
    }
  }

  // READING COMPREHENSION PAGE RENDER
  renderReading(container) {
    const self = this;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Dynamic Reading Practice</h1>
          <p>Generate customized Japanese reading passages matching your JLPT level and study topic instantly.</p>
        </div>
      </div>
      <div id="reading-content-pane"></div>
    `;

    /**
     * Converts bare  KANJI<rt>reading</rt>  into  <ruby>KANJI<rt>reading</rt></ruby>
     * so furigana stacks ABOVE the kanji in all browsers.
     * Single-pass: ([^\s<>]+) captures the kanji, (<rt>...) captures the reading.
     */
    const applyRubyMarkup = (html) => {
      return html.replace(/([\u4e00-\u9fff\u3005\u3007]+)(<rt>[^<]*<\/rt>)/g, '<ruby>$1$2</ruby>');
    };

    // Topic metadata for display
    const topicMeta = {
      daily:    { label: "Daily Life",          jp: "日常",       emoji: "🏡", cat: "everyday" },
      travel:   { label: "Travel & Direction",  jp: "旅行",       emoji: "✈️", cat: "everyday" },
      dining:   { label: "Food & Dining",       jp: "食事",       emoji: "🍜", cat: "everyday" },
      shopping: { label: "Shopping & Services", jp: "買い物",     emoji: "🛒", cat: "everyday" },
      hobbies:  { label: "Hobbies",             jp: "趣味",       emoji: "🎨", cat: "everyday" },
      weather:  { label: "Weather & Seasons",   jp: "天気",       emoji: "🌤️", cat: "everyday" },
      anime:    { label: "Anime & Manga",        jp: "アニメ",     emoji: "⚔️", cat: "entertainment" },
      movies:   { label: "Movies & Cinema",     jp: "映画",       emoji: "🎬", cat: "entertainment" },
      series:   { label: "TV Series & Dramas",  jp: "ドラマ",     emoji: "📺", cat: "entertainment" },
    };

    const selectPassage = (pass) => {
      const pane = document.getElementById("reading-content-pane");
      const topicKey = pass.topicKey || "daily";
      const meta = topicMeta[topicKey] || { emoji: "📖", label: topicKey, jp: "" };
      const isEntertainment = meta.cat === "entertainment";

      pane.innerHTML = `
        <div class="passage-view-container">
          <div class="passage-header-block" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
            <div>
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                <span class="kanji-label-tag">JLPT ${pass.level} Reading</span>
                ${isEntertainment ? `<span style="background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.25)); border: 1px solid rgba(139,92,246,0.4); color:#c084fc; padding:3px 12px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:0.05em;">🎌 Entertainment Culture</span>` : ""}
              </div>
              <h2 style="margin-top:0;">${meta.emoji} ${pass.title}</h2>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-secondary" id="back-to-form-btn" style="display:flex; align-items:center; gap:6px;">⚡ New Passage</button>
            </div>
          </div>

          <div class="passage-body-row">
            <!-- Passage Text Content -->
            <div class="passage-text-card">
              <div class="passage-toggle-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <small style="display:flex; align-items:center; gap:6px;">
                  <span id="reading-furigana-status" style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); border-radius:8px; padding:2px 8px; color:#60a5fa; font-weight:600; font-size:11px;">${self.furiganaVisible ? "FURIGANA ON" : "FURIGANA OFF"}</span>
                  💡 Hover underlined words for meanings!
                </small>
                <button class="control-btn" id="toggle-translation-btn" style="padding:5px 12px; font-size:12px; border-radius:12px;">📖 Show Translation</button>
              </div>

              <!-- Translation Panel (hidden by default) -->
              <div id="passage-translation-box" style="display:none; margin-bottom:20px; padding:15px; background:var(--bg-tertiary); border-radius:12px; border:1px solid var(--border-color); font-size:14px; line-height:1.6; color:var(--text-secondary);">
                <strong>English Translation:</strong>
                <p style="margin-top:5px; font-weight:500;">${pass.translation || "Translation not provided."}</p>
              </div>

              <!-- Passage Content with Furigana -->
              <div class="passage-content-box" id="reading-content-target" style="font-size:1.25rem; line-height:2.8; font-family:var(--font-japanese); padding:25px;"></div>
            </div>

            <!-- Comprehension Quiz -->
            <div class="passage-questions-pane">
              <h3>Comprehension Quiz</h3>
              <div id="reading-questions-container"></div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("back-to-form-btn").onclick = () => renderGeneratorForm();

      // Translation toggle
      const transToggle = document.getElementById("toggle-translation-btn");
      const transBox = document.getElementById("passage-translation-box");
      transToggle.onclick = () => {
        const isHidden = transBox.style.display === "none";
        transBox.style.display = isHidden ? "block" : "none";
        transToggle.textContent = isHidden ? "📖 Hide Translation" : "📖 Show Translation";
      };

      // Inject passage content with correct furigana + hint tooltips
      const bodyBox = document.getElementById("reading-content-target");
      let formattedHTML = pass.content;

      if (pass.hints) {
        // Sort keys by length descending to prevent partial replacement
        const sortedWords = Object.keys(pass.hints).sort((a, b) => b.length - a.length);
        sortedWords.forEach(word => {
          const definition = pass.hints[word];
          // Escape special regex characters for each character, allowing interspersed HTML/rt tags
          const patternParts = Array.from(word).map(char => {
            const escapedChar = char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            return escapedChar + '(?:<rt>[^<]*<\\/rt>|<\\/?[^>]+>)*';
          });
          const regex = new RegExp(`(?<![\\w<])${patternParts.join('')}(?![\\w>])`, 'g');
          
          formattedHTML = formattedHTML.replace(regex, (match) => {
            return `<span class="reading-hint-word" data-hint="${definition}">${match}</span>`;
          });
        });
      }

      formattedHTML = applyRubyMarkup(formattedHTML);
      bodyBox.innerHTML = formattedHTML;

      // Render comprehension questions
      const questionsBin = document.getElementById("reading-questions-container");
      questionsBin.innerHTML = "";

      if (pass.questions && pass.questions.length > 0) {
        pass.questions.forEach((q, qIdx) => {
          // Shuffle options for this question to randomize option placement
          const indexedOptions = q.options.map((opt, idx) => ({
            opt,
            isCorrect: idx === q.answerIndex
          }));
          
          for (let i = indexedOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = indexedOptions[i];
            indexedOptions[i] = indexedOptions[j];
            indexedOptions[j] = temp;
          }
          
          const shuffledOptions = indexedOptions.map(item => item.opt);
          const newAnswerIndex = indexedOptions.findIndex(item => item.isCorrect);

          const qBlock = document.createElement("div");
          qBlock.className = "passage-q-block";
          qBlock.innerHTML = `
            <p class="question-text"><strong>Q${qIdx + 1}:</strong> ${q.question}</p>
            <div class="options-stack">
              ${shuffledOptions.map((opt, optIdx) => `
                <button class="passage-opt-btn" data-q="${qIdx}" data-opt="${optIdx}">${opt}</button>
              `).join("")}
            </div>
            <div class="passage-q-feedback" id="q-feedback-${qIdx}" style="display:none;"></div>
          `;

          qBlock.querySelectorAll(".passage-opt-btn").forEach(btn => {
            btn.onclick = (e) => {
              const sQIdx = parseInt(e.target.getAttribute("data-q"));
              const sOptIdx = parseInt(e.target.getAttribute("data-opt"));
              qBlock.querySelectorAll(".passage-opt-btn").forEach(b => b.disabled = true);

              const feedback = document.getElementById(`q-feedback-${sQIdx}`);
              feedback.style.display = "block";

              if (sOptIdx === newAnswerIndex) {
                e.target.classList.add("correct");
                feedback.className = "passage-q-feedback success";
                feedback.innerHTML = `🎉 <strong>Correct!</strong><br>${q.explanation}`;
                self.addXP(20);
              } else {
                e.target.classList.add("incorrect");
                qBlock.querySelector(`[data-opt="${newAnswerIndex}"]`).classList.add("correct");
                feedback.className = "passage-q-feedback error";
                feedback.innerHTML = `❌ <strong>Incorrect.</strong><br>${q.explanation}`;
              }
            };
          });

          questionsBin.appendChild(qBlock);
        });
      } else {
        questionsBin.innerHTML = `<div class="empty-state">No comprehension questions for this passage.</div>`;
      }
    };

    const renderGeneratorForm = () => {
      const pane = document.getElementById("reading-content-pane");

      pane.innerHTML = `
        <div class="generator-container" style="background:var(--bg-secondary); border:1px solid var(--border-color); padding:30px; border-radius:24px;">
          <div style="margin-bottom:25px; border-bottom:1px solid var(--border-color); padding-bottom:15px;">
            <h2 style="display:flex; align-items:center; gap:10px;">✨ Dynamic Reading Generator</h2>
            <p style="color:var(--text-secondary); font-size:14px; margin-top:5px;">
              Select your JLPT level and study topic. Our engine compiles a passage with <strong>interactive furigana</strong> above every kanji, vocabulary hover hints, comprehension questions, and XP rewards.
            </p>
          </div>

          <!-- JLPT Level Selector -->
          <div class="form-group" style="margin-bottom:28px;">
            <label style="display:block; font-weight:700; font-size:14px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-secondary);">① JLPT Difficulty Level</label>
            <div id="gen-level-selector" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-secondary gen-lvl-btn active-mode-btn" data-lvl="N5" style="padding:12px 24px; flex:1; min-width:60px; font-size:1rem; font-weight:700;">N5<br><span style="font-size:10px; opacity:0.7; font-weight:400;">Beginner</span></button>
              <button class="btn btn-secondary gen-lvl-btn" data-lvl="N4" style="padding:12px 24px; flex:1; min-width:60px; font-size:1rem; font-weight:700;">N4<br><span style="font-size:10px; opacity:0.7; font-weight:400;">Elementary</span></button>
              <button class="btn btn-secondary gen-lvl-btn" data-lvl="N3" style="padding:12px 24px; flex:1; min-width:60px; font-size:1rem; font-weight:700;">N3<br><span style="font-size:10px; opacity:0.7; font-weight:400;">Intermediate</span></button>
              <button class="btn btn-secondary gen-lvl-btn" data-lvl="N2" style="padding:12px 24px; flex:1; min-width:60px; font-size:1rem; font-weight:700;">N2<br><span style="font-size:10px; opacity:0.7; font-weight:400;">Advanced</span></button>
            </div>
          </div>

          <!-- Topic Selector - Visual Cards -->
          <div class="form-group" style="margin-bottom:28px;">
            <label style="display:block; font-weight:700; font-size:14px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-secondary);">② Reading Topic</label>

            <!-- Everyday Life Category -->
            <div style="margin-bottom:16px;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-secondary); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span style="height:1px; flex:1; background:var(--border-color);"></span>
                <span>Everyday Life</span>
                <span style="height:1px; flex:1; background:var(--border-color);"></span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;" id="topic-cards-everyday">
                <button class="gen-topic-card" data-topic="daily" style="background:var(--bg-tertiary); border:2px solid var(--border-color); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">🏡</div>
                  <div>Daily Life</div>
                  <div style="font-size:11px; opacity:0.6; font-weight:400; font-family:var(--font-japanese);">日常</div>
                </button>
                <button class="gen-topic-card" data-topic="travel" style="background:var(--bg-tertiary); border:2px solid var(--border-color); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">✈️</div>
                  <div>Travel</div>
                  <div style="font-size:11px; opacity:0.6; font-weight:400; font-family:var(--font-japanese);">旅行</div>
                </button>
                <button class="gen-topic-card" data-topic="dining" style="background:var(--bg-tertiary); border:2px solid var(--border-color); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">🍜</div>
                  <div>Food & Dining</div>
                  <div style="font-size:11px; opacity:0.6; font-weight:400; font-family:var(--font-japanese);">食事</div>
                </button>
                <button class="gen-topic-card" data-topic="shopping" style="background:var(--bg-tertiary); border:2px solid var(--border-color); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">🛒</div>
                  <div>Shopping</div>
                  <div style="font-size:11px; opacity:0.6; font-weight:400; font-family:var(--font-japanese);">買い物</div>
                </button>
                <button class="gen-topic-card" data-topic="hobbies" style="background:var(--bg-tertiary); border:2px solid var(--border-color); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">🎨</div>
                  <div>Hobbies</div>
                  <div style="font-size:11px; opacity:0.6; font-weight:400; font-family:var(--font-japanese);">趣味</div>
                </button>
                <button class="gen-topic-card" data-topic="weather" style="background:var(--bg-tertiary); border:2px solid var(--border-color); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">🌤️</div>
                  <div>Weather</div>
                  <div style="font-size:11px; opacity:0.6; font-weight:400; font-family:var(--font-japanese);">天気</div>
                </button>
              </div>
            </div>

            <!-- Entertainment Category -->
            <div>
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#a78bfa; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span style="height:1px; flex:1; background:rgba(139,92,246,0.3);"></span>
                <span>🎌 Entertainment Culture — NEW!</span>
                <span style="height:1px; flex:1; background:rgba(139,92,246,0.3);"></span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;" id="topic-cards-entertainment">
                <button class="gen-topic-card" data-topic="anime" style="background:rgba(139,92,246,0.07); border:2px solid rgba(139,92,246,0.35); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">⚔️</div>
                  <div>Anime & Manga</div>
                  <div style="font-size:11px; opacity:0.7; font-weight:400; font-family:var(--font-japanese);">アニメ・漫画</div>
                </button>
                <button class="gen-topic-card" data-topic="movies" style="background:rgba(139,92,246,0.07); border:2px solid rgba(139,92,246,0.35); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">🎬</div>
                  <div>Movies & Cinema</div>
                  <div style="font-size:11px; opacity:0.7; font-weight:400; font-family:var(--font-japanese);">映画</div>
                </button>
                <button class="gen-topic-card" data-topic="series" style="background:rgba(139,92,246,0.07); border:2px solid rgba(139,92,246,0.35); border-radius:12px; padding:12px 10px; cursor:pointer; text-align:center; transition:all 0.2s; color:var(--text-primary); font-size:13px; font-weight:600;">
                  <div style="font-size:24px; margin-bottom:5px;">📺</div>
                  <div>TV Series & Dramas</div>
                  <div style="font-size:11px; opacity:0.7; font-weight:400; font-family:var(--font-japanese);">ドラマ</div>
                </button>
              </div>
            </div>
          </div>

          <!-- Furigana Info Banner -->
          <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.25); border-radius:12px; padding:12px 16px; margin-bottom:25px; display:flex; align-items:flex-start; gap:12px;">
            <span style="font-size:20px; flex-shrink:0;">振り仮名</span>
            <div>
              <div style="font-weight:700; color:#10b981; font-size:13px; margin-bottom:3px;">Furigana Enabled — Readings appear above every kanji!</div>
              <div style="font-size:12px; color:var(--text-secondary);">Example: <ruby style="font-family:var(--font-japanese); font-size:16px; line-height:2.2;">日本語<rt>にほんご</rt></ruby> • All passages include interactive furigana and vocabulary hints on hover.</div>
            </div>
          </div>

          <div style="border-top:1px solid var(--border-color); padding-top:25px; display:flex; justify-content:center;">
            <button class="btn btn-primary" id="trigger-generation-btn" style="padding:15px 50px; font-size:16px; border-radius:30px; font-weight:700; width:100%; max-width:420px; opacity:0.5; cursor:not-allowed;" disabled>
              ← Select a topic above to generate ⚡
            </button>
          </div>
        </div>
      `;

      // Level button selection
      let selectedLevel = "N5";
      let selectedTopic = null;

      document.querySelectorAll(".gen-lvl-btn").forEach(btn => {
        btn.onclick = (e) => {
          document.querySelectorAll(".gen-lvl-btn").forEach(b => b.classList.remove("active-mode-btn"));
          e.target.classList.add("active-mode-btn");
          selectedLevel = e.target.getAttribute("data-lvl");
        };
      });

      // Topic card selection logic
      const updateGenerateBtn = () => {
        const genBtn = document.getElementById("trigger-generation-btn");
        if (selectedTopic && topicMeta[selectedTopic]) {
          const meta = topicMeta[selectedTopic];
          genBtn.textContent = `Generate ${meta.emoji} ${meta.label} Passage ⚡`;
          genBtn.style.opacity = "1";
          genBtn.style.cursor = "pointer";
          genBtn.disabled = false;
        } else {
          genBtn.textContent = "← Select a topic above to generate ⚡";
          genBtn.style.opacity = "0.5";
          genBtn.style.cursor = "not-allowed";
          genBtn.disabled = true;
        }
      };

      document.querySelectorAll(".gen-topic-card").forEach(card => {
        card.onclick = (e) => {
          const clickedCard = e.currentTarget;
          const topic = clickedCard.getAttribute("data-topic");

          // Reset all cards
          document.querySelectorAll(".gen-topic-card").forEach(c => {
            c.classList.remove("topic-selected");
            const isEntCard = c.closest("#topic-cards-entertainment") !== null;
            c.style.borderColor = isEntCard ? "rgba(139,92,246,0.35)" : "var(--border-color)";
            c.style.background = isEntCard ? "rgba(139,92,246,0.07)" : "var(--bg-tertiary)";
            c.style.transform = "";
            c.style.boxShadow = "";
          });

          // Highlight selected card
          clickedCard.classList.add("topic-selected");
          const isEntCard = clickedCard.closest("#topic-cards-entertainment") !== null;
          if (isEntCard) {
            clickedCard.style.borderColor = "#a78bfa";
            clickedCard.style.background = "rgba(139,92,246,0.25)";
            clickedCard.style.boxShadow = "0 0 18px rgba(139,92,246,0.35)";
          } else {
            clickedCard.style.borderColor = "var(--primary, #3b82f6)";
            clickedCard.style.background = "rgba(59,130,246,0.15)";
            clickedCard.style.boxShadow = "0 0 18px rgba(59,130,246,0.25)";
          }
          clickedCard.style.transform = "translateY(-2px)";

          selectedTopic = topic;
          updateGenerateBtn();
        };
      });

      // Generate button click
      document.getElementById("trigger-generation-btn").onclick = async () => {
        if (!selectedTopic) return;
        const meta = topicMeta[selectedTopic] || { emoji: "📖", label: selectedTopic };

        pane.innerHTML = `
          <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:350px; text-align:center;">
            <div style="font-size:50px; margin-bottom:20px; animation: spin 1s linear infinite;">🥷</div>
            <h3>Kakashi is writing your reading passage...</h3>
            <p style="color:var(--text-secondary); margin-top:8px; font-size:14px;">Synthesizing ${meta.emoji} ${meta.label} passage for ${selectedLevel} with furigana...</p>
          </div>
        `;

        try {
          await new Promise(resolve => setTimeout(resolve, 700));
          const generated = window.JapaneseReadingGenerator.generateProceduralPassage(
            selectedLevel, selectedTopic, null, null
          );
          generated.id = "gen_" + Date.now();
          generated.level = selectedLevel;
          generated.topicKey = selectedTopic;
          generated.title = `${selectedLevel} ${meta.label} (${(topicMeta[selectedTopic] || {}).jp || ""})`;
          selectPassage(generated);
        } catch (err) {
          console.error(err);
          pane.innerHTML = `
            <div style="text-align:center; padding:40px; border:1px solid var(--border-color); border-radius:24px; background:rgba(239,68,68,0.05);">
              <span style="font-size:40px;">⚠️</span>
              <h3 style="margin-top:15px; color:var(--danger-color);">Generation Failed</h3>
              <p style="color:var(--text-secondary); margin-top:8px; font-size:14px;">An error occurred during passage synthesis.</p>
              <button class="btn btn-primary" id="retry-form-btn" style="margin-top:20px;">Back to Settings</button>
            </div>
          `;
          document.getElementById("retry-form-btn").onclick = () => renderGeneratorForm();
        }
      };
    };

    renderGeneratorForm();
  }

  // PRACTICE TEST PAGE RENDER
  renderPracticeTests(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>JLPT Practice Tests</h1>
          <p>Evaluate your skills under simulated test conditions. Select a mini mock exam to begin.</p>
        </div>
      </div>

      <div class="test-selection-panel" id="test-selector-screen">
        <div class="test-card-box">
          <h3>JLPT N5 Practice Test</h3>
          <p>4 questions covering N5 Kanji, grammar endings, particle placement, and basic vocabulary.</p>
          <div class="test-meta">⏳ Limit: 5 mins • XP Reward: +30 XP</div>
          <button class="btn btn-primary start-test-btn" data-lvl="N5">Start N5 Test</button>
        </div>
        <div class="test-card-box">
          <h3>JLPT N4 Practice Test</h3>
          <p>3 questions testing ability clauses, dictionary form adapters, and kanji combinations.</p>
          <div class="test-meta">⏳ Limit: 5 mins • XP Reward: +30 XP</div>
          <button class="btn btn-primary start-test-btn" data-lvl="N4">Start N4 Test</button>
        </div>
        <div class="test-card-box">
          <h3>JLPT N3 Practice Test</h3>
          <p>2 intermediate questions regarding external arrangements, passives, and compound readings.</p>
          <div class="test-meta">⏳ Limit: 5 mins • XP Reward: +30 XP</div>
          <button class="btn btn-primary start-test-btn" data-lvl="N3">Start N3 Test</button>
        </div>
        <div class="test-card-box">
          <h3>JLPT N2 Practice Test</h3>
          <p>2 advanced questions covering continuous progressive trends and complex character pronunciations.</p>
          <div class="test-meta">⏳ Limit: 5 mins • XP Reward: +40 XP</div>
          <button class="btn btn-primary start-test-btn" data-lvl="N2">Start N2 Test</button>
        </div>
      </div>

      <div class="test-runner-panel" id="test-runner-screen" style="display:none;">
        <div class="test-runner-header">
          <h2 id="active-test-title">JLPT N5 Test</h2>
          <div class="test-timer" id="test-countdown">05:00</div>
        </div>
        <div class="test-progress-strip">
          <div class="fill" id="test-bar-fill" style="width:0%;"></div>
        </div>

        <div class="test-q-wrapper" id="test-q-pane">
          <!-- Active Question Rendered -->
        </div>

        <div class="test-runner-footer">
          <button class="btn btn-secondary" id="test-prev-q">Previous Question</button>
          <button class="btn btn-success" id="test-next-q">Next Question</button>
        </div>
      </div>

      <div class="test-results-panel" id="test-results-screen" style="display:none;">
        <!-- Scores Rendered here -->
      </div>
    `;

    let activeLvl = "N5";
    let questions = [];
    let currentQIdx = 0;
    let answers = {}; // { qIdx: selectedOptIdx }
    let timerInterval = null;
    let secondsLeft = 300;

    const startTest = (lvl) => {
      activeLvl = lvl;
      questions = window.mockTestsDatabase[lvl];
      currentQIdx = 0;
      answers = {};
      secondsLeft = 300;

      document.getElementById("test-selector-screen").style.display = "none";
      document.getElementById("test-runner-screen").style.display = "block";
      document.getElementById("test-results-screen").style.display = "none";
      document.getElementById("active-test-title").textContent = `JLPT ${lvl} Mini Mock Exam`;

      // Start Timer
      clearInterval(timerInterval);
      updateTimerDisplay();
      timerInterval = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay();
        if (secondsLeft <= 0) {
          clearInterval(timerInterval);
          finishTest();
        }
      }, 1000);

      renderQuestion();
    };

    const updateTimerDisplay = () => {
      const minutes = Math.floor(secondsLeft / 60);
      const seconds = secondsLeft % 60;
      document.getElementById("test-countdown").textContent = 
        `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    };

    const renderQuestion = () => {
      const q = questions[currentQIdx];
      const pane = document.getElementById("test-q-pane");
      
      document.getElementById("test-bar-fill").style.width = `${((currentQIdx + 1) / questions.length) * 100}%`;
      document.getElementById("test-prev-q").disabled = currentQIdx === 0;
      document.getElementById("test-next-q").textContent = currentQIdx === questions.length - 1 ? "Finish & Submit" : "Next Question";

      pane.innerHTML = `
        <div class="exam-question-box">
          <div class="ex-q-num">Question ${currentQIdx + 1} of ${questions.length}</div>
          <div class="ex-q-text">${q.question}</div>
          <div class="ex-options-grid">
            ${q.options.map((opt, idx) => `
              <label class="ex-option-row ${answers[currentQIdx] === idx ? 'checked' : ''}">
                <input type="radio" name="exam-opt" value="${idx}" ${answers[currentQIdx] === idx ? 'checked' : ''}>
                <span class="bullet">${String.fromCharCode(65 + idx)}</span>
                <span class="text">${opt}</span>
              </label>
            `).join("")}
          </div>
        </div>
      `;

      // Radio Selection Events
      pane.querySelectorAll('input[type="radio"]').forEach(rad => {
        rad.addEventListener("change", (e) => {
          const selectedIdx = parseInt(e.target.value);
          answers[currentQIdx] = selectedIdx;
          renderQuestion(); // Re-render to update selected visuals
        });
      });
    };

    const finishTest = () => {
      clearInterval(timerInterval);
      
      let correctCount = 0;
      questions.forEach((q, idx) => {
        if (answers[idx] === q.answerIndex) {
          correctCount++;
        }
      });

      const scorePct = Math.round((correctCount / questions.length) * 100);
      const passed = scorePct >= 60;
      const xpWon = passed ? 30 : 10;

      this.addXP(xpWon, "quiz");
      if (passed) {
        this.unlockBadge("b5"); // Exam Ace badge
        this.state.user.completedTests.push(activeLvl);
        this.saveState();
      }

      document.getElementById("test-runner-screen").style.display = "none";
      const resultsPane = document.getElementById("test-results-screen");
      resultsPane.style.display = "block";

      resultsPane.innerHTML = `
        <div class="test-results-card">
          <div class="result-badge ${passed ? 'passed' : 'failed'}">${passed ? 'PASSED' : 'TRY AGAIN'}</div>
          <h2>JLPT ${activeLvl} Practice Test Report</h2>
          <div class="score-grid">
            <div class="score-circle">
              <span class="pct">${scorePct}%</span>
              <span class="fraction">${correctCount} / ${questions.length} Correct</span>
            </div>
            <div class="meta-stats">
              <p>📍 Required: <strong>60%</strong> to Pass</p>
              <p>✨ Rewards Unlocked: <strong>+${xpWon} XP</strong></p>
              <p>🥷 Kakashi says: <em>"${passed ? 'Excellent focus, shinobi! You have mastered the fundamentals of this level. Onward to your next challenge!' : 'Do not lose heart! Every mistake is a step closer to mastery. Review your incorrect answers and try again.'}"</em></p>
            </div>
          </div>

          <div class="wrong-answers-review">
            <h3>Questions Review</h3>
            ${questions.map((q, idx) => {
              const userAns = answers[idx];
              const isCorrect = userAns === q.answerIndex;
              return `
                <div class="review-item-row ${isCorrect ? 'correct' : 'incorrect'}">
                  <p class="review-q"><strong>Q${idx + 1}:</strong> ${q.question}</p>
                  <p class="answer-status">
                    Your Answer: <strong>${userAns !== undefined ? q.options[userAns] : 'Not Answered'}</strong> 
                    ${isCorrect ? '✔️' : `(Correct: <strong>${q.options[q.answerIndex]}</strong>)`}
                  </p>
                  <p class="review-explanation">💡 ${q.explanation}</p>
                </div>
              `;
            }).join("")}
          </div>

          <div style="text-align:center; margin-top:30px;">
            <button class="btn btn-primary" id="test-results-back-btn">Return to Tests</button>
          </div>
        </div>
      `;

      document.getElementById("test-results-back-btn").onclick = () => {
        document.getElementById("test-results-screen").style.display = "none";
        document.getElementById("test-selector-screen").style.display = "flex";
      };
    };

    // Runner Actions listeners
    document.getElementById("test-prev-q").onclick = () => {
      if (currentQIdx > 0) {
        currentQIdx--;
        renderQuestion();
      }
    };

    document.getElementById("test-next-q").onclick = () => {
      if (currentQIdx < questions.length - 1) {
        currentQIdx++;
        renderQuestion();
      } else {
        if (confirm("Are you sure you want to submit your answers and complete the exam?")) {
          finishTest();
        }
      }
    };

    document.querySelectorAll(".start-test-btn").forEach(btn => {
      btn.onclick = (e) => {
        const lvl = e.target.getAttribute("data-lvl");
        startTest(lvl);
      };
    });
  }

  // USER DASHBOARD PAGE RENDER
  renderDashboard(container) {
    if (!this.state.user.masteredKanji) {
      this.state.user.masteredKanji = [];
    }
    if (!this.state.user.chapters) {
      this.state.user.chapters = {};
    }

    // Generate recent activity logs HTML
    const recentActHTML = this.state.user.recentLessons.map(log => `
      <div class="activity-row-item">
        <div class="act-icon">${log.type === 'vocab' ? '🎴' : log.type === 'kanji' ? '✍️' : log.type === 'grammar' ? '📚' : '📖'}</div>
        <div class="act-info">
          <h4>${log.name}</h4>
          <span>Category: ${log.type.toUpperCase()}</span>
        </div>
        <div class="act-date">${log.date}</div>
      </div>
    `).join("");

    // Generate Badges List
    const badgesHTML = this.state.user.badges.map(b => `
      <div class="badge-item-box ${b.unlocked ? 'unlocked' : 'locked'}">
        <div class="badge-emoj">${b.unlocked ? b.icon : '🔒'}</div>
        <h4>${b.title}</h4>
        <p>${b.description}</p>
      </div>
    `).join("");

    // Calculate dynamic personalized recommendations based on level
    let recHTML = `
      <div class="rec-card" onclick="window.location.hash='#kanji'">
        <h4>✍️ Practice Kanji Drawing</h4>
        <p>Improve your memory by tracing and verifying N5 Kanji stroke orders on the canvas laboratory.</p>
      </div>
      <div class="rec-card" onclick="window.location.hash='#kakashi'">
        <h4>🥷 Chat with Kakashi AI</h4>
        <p>Ask Kakashi to test you with a quick grammar quiz, or get feedback on a sentence with "correct: [sentence]".</p>
      </div>
    `;

    // Dynamic calculations for N5 Kanji progress
    const totalN5Kanji = window.kanjiDatabase ? window.kanjiDatabase.filter(k => k.level === 'N5').length : 75;
    const masteredN5Count = window.kanjiDatabase ? this.state.user.masteredKanji.filter(id => {
      const k = window.kanjiDatabase.find(x => x.id === id);
      return k && k.level === 'N5';
    }).length : this.state.user.masteredKanji.length;
    const kanjiMasteryPercent = totalN5Kanji > 0 ? Math.round((masteredN5Count / totalN5Kanji) * 100) : 0;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 id="dashboard-welcome-heading">Welcome back, ${this.state.user.username || 'Shinobi'}!</h1>
          <p>Track your XP points, levels, continuous study streaks, and manage your profile settings.</p>
        </div>
      </div>

      <div class="dashboard-grid">
        <!-- Top Stats row -->
        <div class="dash-stat-row">
          <div class="dash-stat-card streak" onclick="window.scrollTo(0, 0)" style="cursor:pointer;" title="Click for profile settings">
            <div class="icon">🔥</div>
            <div class="stats">
              <span class="value">${this.state.user.streak} Days</span>
              <span class="label">Daily study streak! Keep the flame burning.</span>
            </div>
          </div>
          <div class="dash-stat-card level">
            <div class="icon">🥷</div>
            <div class="stats">
              <span class="value">Level ${this.state.user.level}</span>
              <span class="label">Ninja Scholar Rank</span>
            </div>
          </div>
          <div class="dash-stat-card total-xp">
            <div class="icon">✨</div>
            <div class="stats">
              <span class="value">${this.state.user.xp} / ${this.state.user.xpToNextLevel} XP</span>
              <span class="label">Progress to Level ${this.state.user.level + 1}</span>
            </div>
          </div>
        </div>

        <!-- Profile Settings Block (Dedicated user data management) -->
        <div class="dash-block profile-settings-block" style="grid-column: 1 / -1;">
          <h3>👤 Shinobi Profile Settings</h3>
          <div class="profile-settings-content" style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
            <div style="flex: 1; min-width:260px;">
              <p style="margin-bottom: 8px; font-size:14px; color:#94a3b8;">Modify your username/nickname on the platform:</p>
              <div style="display:flex; gap:10px;">
                <input type="text" id="dashboard-username-input" class="control-btn" style="flex:1; padding:10px 14px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:10px;" value="${this.state.user.username}">
                <button class="btn btn-primary btn-sm" id="dashboard-save-username-btn" style="padding:10px 20px;">Save Nickname</button>
              </div>
            </div>
            <div style="border-left:1px solid rgba(255,255,255,0.1); height:60px; display:none; min-width:1px;" class="profile-settings-divider"></div>
            <div style="min-width:200px;">
              <p style="margin-bottom:8px; font-size:14px; color:#94a3b8;">Reset all state, EXP, and chapter history:</p>
              <button class="btn btn-secondary btn-sm" id="dashboard-reset-state-btn" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444;">⚠️ Reset All Progress</button>
            </div>
          </div>
        </div>

        <!-- Left Column: XP Progress and Charts -->
        <div class="dash-left">
          <!-- Kanji Mastery progress bar card -->
          <div class="dash-block">
            <h3>✍️ Kanji Mastery (N5 Goal)</h3>
            <p style="font-size:13px; color:#94a3b8; margin-bottom:15px;">Verify characters in the Kanji Lab to master them.</p>
            <div class="kanji-mastery-status" style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:700;">
              <span>N5 Kanji Mastered</span>
              <span id="kanji-progress-pct-label" style="color:#3b82f6;">${masteredN5Count} / ${totalN5Kanji} (${kanjiMasteryPercent}%)</span>
            </div>
            <div class="progress-bar-container" style="background:rgba(255,255,255,0.08); border-radius:8px; height:12px; overflow:hidden; margin-bottom:10px;">
              <div class="progress-bar-fill" id="kanji-mastery-bar-fill" style="width:${kanjiMasteryPercent}%; height:100%; background:linear-gradient(90deg, #3b82f6, #06b6d4); transition:width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Chapter Progress Checklist (Chapters 1-8) -->
          <div class="dash-block">
            <h3>📚 Chapter Progress Checklist</h3>
            <p style="font-size:13px; color:#94a3b8; margin-bottom:15px;">Tick chapters as you complete their lessons and grammar structures.</p>
            <div class="chapter-progress-status" style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:700;">
              <span>Chapters 1-8</span>
              <span id="chapter-progress-pct-label" style="color:#10b981;">0 of 8 (0%)</span>
            </div>
            <div class="progress-bar-container" style="background:rgba(255,255,255,0.08); border-radius:8px; height:12px; overflow:hidden; margin-bottom:20px;">
              <div class="progress-bar-fill" id="chapter-progress-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #10b981, #34d399); transition:width 0.3s ease;"></div>
            </div>
            <div class="chapters-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              ${Array.from({ length: 8 }, (_, i) => {
                const chNum = i + 1;
                const isChecked = this.state.user.chapters && this.state.user.chapters[chNum];
                return `
                  <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); cursor:pointer; user-select:none; font-size:13px;">
                    <input type="checkbox" id="chapter-checkbox-${chNum}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
                    <span>Chapter ${chNum}</span>
                  </label>
                `;
              }).join("")}
            </div>
          </div>

          <div class="dash-block">
            <h3>XP Progress Ring</h3>
            <div style="display:flex; justify-content:center; align-items:center; padding:30px 0;">
              <svg width="180" height="180" viewBox="0 0 180 180" class="xp-ring-svg">
                <circle cx="90" cy="90" r="70" class="ring-bg"></circle>
                <circle cx="90" cy="90" r="70" class="ring-fill" 
                  style="stroke-dashoffset: ${440 - (440 * (this.state.user.xp / this.state.user.xpToNextLevel))};">
                </circle>
                <text x="90" y="85" class="ring-lvl">Lvl ${this.state.user.level}</text>
                <text x="90" y="110" class="ring-xp">${this.state.user.xp} / ${this.state.user.xpToNextLevel} XP</text>
              </svg>
            </div>
          </div>
        </div>

        <!-- Right Column: Recent activity and achievements -->
        <div class="dash-right">
          <!-- EXP & Study History Log (Quizzes vs Strokes breakdown) -->
          <div class="dash-block">
            <h3>📈 EXP breakdown & Study History</h3>
            <p style="font-size:13px; color:#94a3b8; margin-bottom:15px;">Earn XP by answering quizzes and tracing stroke guidelines in Kanji Lab.</p>
            <div class="exp-breakdown" style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
              <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:12px; padding:12px; text-align:center;">
                <div style="font-size:24px; font-weight:800; color:#f59e0b;" id="dashboard-xp-quizzes">${this.state.user.xpFromQuizzes || 0}</div>
                <div style="font-size:11px; color:#94a3b8; font-weight:600; margin-top:2px;">Quiz & Test XP</div>
              </div>
              <div style="background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:12px; padding:12px; text-align:center;">
                <div style="font-size:24px; font-weight:800; color:#3b82f6;" id="dashboard-xp-strokes">${this.state.user.xpFromStrokes || 0}</div>
                <div style="font-size:11px; color:#94a3b8; font-weight:600; margin-top:2px;">Kanji Stroke XP</div>
              </div>
            </div>
            <h4 style="font-size:14px; margin-bottom:10px;">Recently Studied Lessons</h4>
            <div class="activity-list">
              ${recentActHTML || '<div class="empty-state">No recent study sessions logged.</div>'}
            </div>
          </div>

          <div class="dash-block">
            <h3>Personalized Recommendations</h3>
            <div class="recs-stack">
              ${recHTML}
            </div>
          </div>
        </div>

        <!-- Badges Area bottom -->
        <div class="dash-bottom-badges dash-block" style="grid-column: 1 / -1;">
          <h3>🏆 Achievement Badges & Medals</h3>
          <p style="font-size:13px; color:#94a3b8; margin-bottom:20px;">Pass mock tests and complete tasks to unlock badges.</p>
          <div class="badges-flex">
            ${badgesHTML}
          </div>
        </div>
      </div>
    `;

    // Hook up Username Saver
    const saveNameBtn = document.getElementById("dashboard-save-username-btn");
    const nameInput = document.getElementById("dashboard-username-input");
    if (saveNameBtn && nameInput) {
      saveNameBtn.onclick = () => {
        const newName = nameInput.value.trim();
        if (newName) {
          this.state.user.username = newName;
          this.saveState();
          
          // Update the welcome message in DOM
          const welcomeHeading = document.getElementById("dashboard-welcome-heading");
          if (welcomeHeading) {
            welcomeHeading.textContent = `Welcome back, ${newName}!`;
          }
          // Update header
          this.updateUserSessionUI();
          this.showNotification("👤 Profile Updated", `Your nickname has been updated to "${newName}"!`, "success");
        }
      };
    }

    // Hook up Reset Progress Button
    const resetBtn = document.getElementById("dashboard-reset-state-btn");
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm("Are you sure you want to reset all your progress, XP, study history, chapters, and badges? This cannot be undone.")) {
          this.state = this.getInitialState();
          this.state.user.username = "Guest Shinobi"; // Fallback
          this.state.user.xp = 10;
          this.state.user.xpFromQuizzes = 0;
          this.state.user.xpFromStrokes = 0;
          this.state.user.masteredKanji = [];
          this.state.user.chapters = {
            1: false,
            2: false,
            3: false,
            4: false,
            5: false,
            6: false,
            7: false,
            8: false
          };
          this.saveState();
          this.updateUserSessionUI();
          this.renderDashboard(container); // Re-render instantly
          this.showNotification("🔄 Progress Reset", "Your Shinobi progress has been reset to level 1.", "warning");
        }
      };
    }

    // Hook up Chapter checklists checkboxes
    const updateChapterProgressUI = () => {
      let completedCount = 0;
      for (let i = 1; i <= 8; i++) {
        if (this.state.user.chapters && this.state.user.chapters[i]) {
          completedCount++;
        }
      }
      const percent = Math.round((completedCount / 8) * 100);
      const label = document.getElementById("chapter-progress-pct-label");
      const fillBar = document.getElementById("chapter-progress-bar-fill");
      if (label) {
        label.textContent = `${completedCount} of 8 (${percent}%)`;
      }
      if (fillBar) {
        fillBar.style.width = `${percent}%`;
      }
    };

    // Attach listeners & run initial progress bar render
    for (let i = 1; i <= 8; i++) {
      const chBox = document.getElementById(`chapter-checkbox-${i}`);
      if (chBox) {
        chBox.onchange = (e) => {
          this.state.user.chapters = this.state.user.chapters || {};
          this.state.user.chapters[i] = e.target.checked;
          this.saveState();
          updateChapterProgressUI();
        };
      }
    }

    // Initial render of chapter progress
    updateChapterProgressUI();
  }

  // LOGIN / SIGNUP PAGE RENDER
  renderLogin(container) {
    container.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-tabs">
            <button class="tab active" id="auth-tab-login">Login</button>
            <button class="tab" id="auth-tab-signup">Sign Up</button>
          </div>

          <!-- Login Form -->
          <form id="auth-login-form" class="auth-form">
            <h2>Welcome Back, Shinobi!</h2>
            <p>Log in to load your personalized Japanese study streak and bookmarked vocabulary.</p>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" id="login-email" placeholder="example@ninjapath.com" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="login-password" placeholder="••••••••" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Log In</button>
          </form>

          <!-- Signup Form -->
          <form id="auth-signup-form" class="auth-form" style="display:none;">
            <h2>Start Your Learning Path</h2>
            <p>Create a profile to sync statistics, bookmarks, streaks, and interact with Kakashi AI.</p>
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="signup-user" placeholder="JapLearner99" required>
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" id="signup-email" placeholder="example@ninjapath.com" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="signup-password" placeholder="Minimum 6 characters" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Create Account</button>
          </form>

          <div class="auth-footer-demo">
            <p>💡 <em>Demo Note: You can sign up with any mock credentials to instantly create a custom profile!</em></p>
          </div>
        </div>
      </div>
    `;

    const tabLogin = document.getElementById("auth-tab-login");
    const tabSignup = document.getElementById("auth-tab-signup");
    const formLogin = document.getElementById("auth-login-form");
    const formSignup = document.getElementById("auth-signup-form");

    tabLogin.onclick = () => {
      tabLogin.classList.add("active");
      tabSignup.classList.remove("active");
      formLogin.style.display = "block";
      formSignup.style.display = "none";
    };

    tabSignup.onclick = () => {
      tabSignup.classList.add("active");
      tabLogin.classList.remove("active");
      formSignup.style.display = "block";
      formLogin.style.display = "none";
    };

    // Form Submits
    formLogin.onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;

      if (email && pass) {
        this.state.user.username = email.split("@")[0]; // Simple mockup username
        this.state.user.xp = 35; // Preset values
        this.state.user.xpFromQuizzes = 45;
        this.state.user.xpFromStrokes = 20;
        this.state.user.masteredKanji = ["k_n5_1", "k_n5_2", "k_n5_3"];
        this.state.user.chapters = {
          1: true,
          2: true,
          3: false,
          4: false,
          5: false,
          6: false,
          7: false,
          8: false
        };
        this.saveState();
        this.updateUserSessionUI();
        this.updateDashboardStats();
        this.showNotification("🔑 Login Successful", `Welcome back, ${this.state.user.username}!`, "success");
        this.navigateTo("dashboard");
      }
    };

    formSignup.onsubmit = (e) => {
      e.preventDefault();
      const user = document.getElementById("signup-user").value;
      const email = document.getElementById("signup-email").value;
      const pass = document.getElementById("signup-password").value;

      if (user && email && pass) {
        // Reset/Create new profile
        this.state = this.getInitialState();
        this.state.user.username = user;
        this.state.user.xp = 10;
        this.state.user.xpFromQuizzes = 0;
        this.state.user.xpFromStrokes = 0;
        this.state.user.masteredKanji = [];
        this.state.user.chapters = {
          1: false,
          2: false,
          3: false,
          4: false,
          5: false,
          6: false,
          7: false,
          8: false
        };
        this.saveState();
        this.updateUserSessionUI();
        this.updateDashboardStats();
        this.showNotification("🌱 Registration Completed", "Your Shinobi learning path starts now! +10 XP", "success");
        this.navigateTo("dashboard");
      }
    };
  }

  // KAKASHI AI PAGE RENDER
  renderKakashi(container) {
    container.innerHTML = `
      <div class="kakashi-container">
        <!-- Sidebar Panel for Quick options -->
        <div class="kakashi-chat-sidebar">
          <div class="tutor-header">
            <img src="assets/kakashi.png" alt="Kakashi Avatar" class="tutor-img">
            <h3>Kakashi Sensei</h3>
            <span>Friendly AI Tutor</span>
          </div>

          <div class="chat-chips-area">
            <h4>Quick Prompt Chips</h4>
            <button class="chip-prompt" data-prompt="Explain particle は vs が">は vs が Difference</button>
            <button class="chip-prompt" data-prompt="Explain particle に vs で">に vs で Difference</button>
            <button class="chip-prompt" data-prompt="How do I use grammar: ～たい">Want to... (たい form)</button>
            <button class="chip-prompt" data-prompt="Give me a study plan for JLPT N5">N5 Study Plan</button>
            <button class="chip-prompt" data-prompt="Give me a quiz">📝 Generate a Quiz</button>
            <button class="chip-prompt" data-prompt="correct: 私は日本語を勉強が好きです。">🔍 Correct my writing</button>
            <button class="chip-prompt" data-prompt="breakdown: 日本に行きたいです。">🔎 Sentence Breakdown</button>
          </div>

          <button class="btn btn-secondary btn-block" id="chat-clear-history-btn" style="margin-top:20px;">🧹 Clear Chat History</button>
        </div>

        <!-- Chat logs view -->
        <div class="kakashi-chat-main">
          <div class="chat-messages-scroll" id="chat-msg-scroll-bin">
            <!-- Messages render dynamically -->
          </div>

          <div class="chat-input-bar">
            <input type="text" id="chat-user-input" placeholder="Ask Kakashi about Japanese grammar, vocabulary, writing rules...">
            <button class="btn btn-primary" id="chat-send-btn">Send</button>
          </div>
        </div>
      </div>
    `;

    const chatBin = document.getElementById("chat-msg-scroll-bin");
    const input = document.getElementById("chat-user-input");
    const sendBtn = document.getElementById("chat-send-btn");

    const renderChatLogs = () => {
      chatBin.innerHTML = "";
      this.kakashi.chatHistory.forEach((msg, idx) => {
        const item = document.createElement("div");
        item.className = `chat-bubble-row ${msg.sender === 'user' ? 'user-side' : 'bot-side'}`;

        let textHTML = msg.text
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // bold markdown
          .replace(/\*(.*?)\*/g, "<em>$1</em>") // italics markdown
          .replace(/### (.*?)\n/g, "<h3>$1</h3>") // h3 markdown
          .replace(/#### (.*?)\n/g, "<h4>$1</h4>") // h4 markdown
          .replace(/`([^`]+)`/g, "<code>$1</code>") // inline code markdown
          .replace(/\n/g, "<br>"); // newlines

        let interactiveHTML = "";
        // If the message has interactive quiz options
        if (msg.isQuiz && msg.quizOptions) {
          interactiveHTML = `
            <div class="chat-quiz-options-bin">
              ${msg.quizOptions.map((opt, optIdx) => `
                <button class="chat-quiz-btn" data-msg-idx="${idx}" data-opt-idx="${optIdx}">${opt}</button>
              `).join("")}
            </div>
          `;
        }

        item.innerHTML = `
          <img src="${msg.sender === 'user' ? 'https://api.dicebear.com/7.x/bottts/svg?seed=user' : this.kakashi.botAvatar}" class="chat-avatar">
          <div class="bubble-content-block">
            <div class="bubble-content">
              ${textHTML}
              ${interactiveHTML}
            </div>
            <span class="timestamp">${msg.timestamp}</span>
          </div>
        `;

        // Interactive quiz buttons listeners
        item.querySelectorAll(".chat-quiz-btn").forEach(btn => {
          btn.onclick = (e) => {
            const optIdx = parseInt(e.target.getAttribute("data-opt-idx"));
            
            // Lock other buttons
            e.target.closest(".chat-quiz-options-bin").querySelectorAll("button").forEach(b => b.disabled = true);
            
            // Submit to Kakashi
            const result = this.kakashi.submitQuizAnswer(optIdx);
            
            // Add bot reply to chat history
            this.kakashi.addMessage("bot", result.text);
            
            // Add rewards
            if (result.xpGained) {
              this.addXP(result.xpGained);
              this.unlockBadge("b4"); // Kakashi Friend badge
            }

            renderChatLogs();
          };
        });

        chatBin.appendChild(item);
      });
      
      const lastMsg = this.kakashi.chatHistory[this.kakashi.chatHistory.length - 1];
      const prevMsg = this.kakashi.chatHistory[this.kakashi.chatHistory.length - 2];
      if (lastMsg && lastMsg.sender === 'bot' && !lastMsg.isSystem && prevMsg && prevMsg.sender === 'user') {
        const userSideElements = chatBin.querySelectorAll(".chat-bubble-row.user-side");
        if (userSideElements.length > 0) {
          const lastUserEl = userSideElements[userSideElements.length - 1];
          chatBin.style.position = "relative";
          chatBin.scrollTo({
            top: Math.max(0, lastUserEl.offsetTop - 10),
            behavior: "smooth"
          });
        } else {
          chatBin.scrollTop = chatBin.scrollHeight;
        }
      } else {
        chatBin.scrollTop = chatBin.scrollHeight;
      }
    };

    const submitUserMessage = (textVal) => {
      if (!textVal.trim()) return;

      // Add user message
      this.kakashi.addMessage("user", textVal);
      renderChatLogs();

      // Show Kakashi typing placeholder
      const typingBubble = document.createElement("div");
      typingBubble.className = "chat-bubble-row bot-side typing-placeholder";
      typingBubble.innerHTML = `
        <img src="${this.kakashi.botAvatar}" class="chat-avatar">
        <div class="bubble-content-block">
          <div class="bubble-content">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        </div>
      `;
      chatBin.appendChild(typingBubble);
      chatBin.scrollTop = chatBin.scrollHeight;

      // Call generateResponse asynchronously
      (async () => {
        try {
          const response = await this.kakashi.generateResponse(textVal);
          typingBubble.remove();
          
          // Add bot message
          this.kakashi.addMessage("bot", response.text, {
            isQuiz: response.isQuiz || false,
            quizOptions: response.quizOptions || null
          });

          if (response.xpGained) {
            this.addXP(response.xpGained);
          }
        } catch (err) {
          console.error(err);
          typingBubble.remove();
          this.kakashi.addMessage("bot", "Oops! I couldn't reach my AI tutor brain. Make sure the backend is running! 🤕");
        }
        renderChatLogs();
      })();
    };

    // Send Button click
    sendBtn.onclick = () => {
      submitUserMessage(input.value);
      input.value = "";
    };

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        submitUserMessage(input.value);
        input.value = "";
      }
    };

    // Chat Chips prompts
    document.querySelectorAll(".chip-prompt").forEach(btn => {
      btn.onclick = () => {
        submitUserMessage(btn.getAttribute("data-prompt"));
      };
    });

    // Clear history
    document.getElementById("chat-clear-history-btn").onclick = () => {
      this.kakashi.clearHistory();
      renderChatLogs();
      this.showNotification("🧹 Chat History Cleared", "Your conversation logs with Kakashi have been reset.", "info");
    };

    renderChatLogs();
  }

  // BOOKMARK MANAGEMENT
  toggleBookmark(type, itemId, buttonElement) {
    const list = this.state.user.bookmarks[type];
    const index = list.indexOf(itemId);

    if (index === -1) {
      list.push(itemId);
      buttonElement.classList.add("active");
      buttonElement.textContent = buttonElement.textContent.replace('☆', '★');
      this.showNotification("⭐ Bookmark Added", "Item saved to bookmarks library.", "info");
    } else {
      list.splice(index, 1);
      buttonElement.classList.remove("active");
      buttonElement.textContent = buttonElement.textContent.replace('★', '☆');
      this.showNotification("🗑️ Bookmark Removed", "Item removed from bookmarks library.", "info");
    }
    this.saveState();
  }
}