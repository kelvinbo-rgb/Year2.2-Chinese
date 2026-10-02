const lessonData = window.lessonData;

const mainContent = document.getElementById('main-content');
const modal = document.getElementById('char-modal');
const closeCharModalBtn = document.getElementById('close-char-modal');
const btnAnimate = document.getElementById('btn-animate');
const btnQuiz = document.getElementById('btn-quiz');
const btnAudio = document.getElementById('btn-audio');
const btnSpell = document.getElementById('btn-spell');
const characterDisplay = document.getElementById('character-display');
const modalPinyin = document.getElementById('modal-pinyin');
const modalToneBadge = document.getElementById('modal-tone-badge');
const modalPhonicsBox = document.getElementById('modal-phonics-box');
const strokeCountBadge = document.getElementById('stroke-count-badge');
const strokeStepsContainer = document.getElementById('stroke-steps-container');

// Edit Text Modal elements
const editTextModal = document.getElementById('edit-text-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnSaveText = document.getElementById('btn-save-text');
const btnResetText = document.getElementById('btn-reset-text');
const editTextInput = document.getElementById('edit-text-input');
let currentEditingLessonIndex = -1;

const navLearn = document.getElementById('nav-learn');
const navCustom = document.getElementById('nav-custom');
const navQuiz = document.getElementById('nav-quiz');

let writer = null;
let currentCharacter = '';
let currentUtterance = null;
let voicesList = [];

// Clean voice loader
function updateVoices() {
    if ('speechSynthesis' in window) {
        voicesList = window.speechSynthesis.getVoices();
    }
}
updateVoices();
if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoices;
}

// ================= Navigation =================
navLearn.addEventListener('click', () => {
    stopPlayback();
    setActiveNav('learn');
    renderLessonList();
});

navCustom.addEventListener('click', () => {
    stopPlayback();
    setActiveNav('custom');
    renderCustomPracticeView();
});

navQuiz.addEventListener('click', () => {
    stopPlayback();
    setActiveNav('quiz');
    startQuiz();
});

function setActiveNav(tab) {
    [navLearn, navCustom, navQuiz].forEach(btn => btn.classList.remove('active'));
    if (tab === 'learn') navLearn.classList.add('active');
    else if (tab === 'custom') navCustom.classList.add('active');
    else if (tab === 'quiz') navQuiz.classList.add('active');
}

// Fullscreen API toggle
const navFullscreen = document.getElementById('nav-fullscreen');
if (navFullscreen) {
    navFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(() => {});
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    });

    const updateFullscreenBtn = () => {
        const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFull) {
            navFullscreen.innerHTML = '🗗 退出全屏';
            navFullscreen.classList.add('in-fullscreen');
        } else {
            navFullscreen.innerHTML = '⛶ 全屏';
            navFullscreen.classList.remove('in-fullscreen');
        }
    };

    document.addEventListener('fullscreenchange', updateFullscreenBtn);
    document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
}

// ================= Lesson Text Helper (Supports 2024 New Edition Calibration) =================
function getLessonText(lessonIndex) {
    const custom = localStorage.getItem('custom_lesson_text_' + lessonIndex);
    if (custom !== null && custom.trim().length > 0) {
        return custom;
    }
    return lessonData[lessonIndex].text || '';
}

function saveCustomLessonText(lessonIndex, text) {
    localStorage.setItem('custom_lesson_text_' + lessonIndex, text.trim());
}

function resetCustomLessonText(lessonIndex) {
    localStorage.removeItem('custom_lesson_text_' + lessonIndex);
}

// ================= Speech Engine (Zero API / Free) =================
function speakChinese(text, rate = 0.8, onEnd = null) {
    if (!('speechSynthesis' in window)) {
        alert("您的浏览器不支持语音朗读功能。建议在 Edge、Chrome 或 Safari 中使用。");
        return;
    }

    window.speechSynthesis.cancel();

    if (!text || !text.trim()) {
        if (onEnd) onEnd();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = rate; // 0.75x ~ 0.85x for children

    // Find best Chinese voice
    if (voicesList.length === 0) updateVoices();
    const zhVoice = voicesList.find(v => v.lang === 'zh-CN' || v.lang.startsWith('zh') || v.lang.includes('cmn'));
    if (zhVoice) {
        utterance.voice = zhVoice;
    }

    utterance.onend = () => {
        currentUtterance = null;
        if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
        console.warn("Speech synthesis notice:", e);
        currentUtterance = null;
        if (onEnd) onEnd();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function stopPlayback() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
    currentPlaybackState.isPlaying = false;
    currentPlaybackState.isEchoWaiting = false;
    if (currentPlaybackState.timerId) {
        clearTimeout(currentPlaybackState.timerId);
        currentPlaybackState.timerId = null;
    }
    clearHighlight();
    updateEchoBannerUI();
}

// ================= Phonics & Spelling Engine =================
const ZHENG_TI_SYLLABLES = new Set([
    'zhi', 'chi', 'shi', 'ri',
    'zi', 'ci', 'si',
    'yi', 'wu', 'yu',
    'ye', 'yue', 'yuan',
    'yin', 'yun', 'ying'
]);

const INITIAL_SOUNDS = {
    'b': { name: '玻', py: 'bō' },
    'p': { name: '坡', py: 'pō' },
    'm': { name: '摸', py: 'mō' },
    'f': { name: '佛', py: 'fó' },
    'd': { name: '得', py: 'dé' },
    't': { name: '特', py: 'tè' },
    'n': { name: '讷', py: 'nè' },
    'l': { name: '勒', py: 'lè' },
    'g': { name: '哥', py: 'gē' },
    'k': { name: '科', py: 'kē' },
    'h': { name: '喝', py: 'hē' },
    'j': { name: '基', py: 'jī' },
    'q': { name: '欺', py: 'qī' },
    'x': { name: '希', py: 'xī' },
    'zh': { name: '知', py: 'zhī' },
    'ch': { name: '吃', py: 'chī' },
    'sh': { name: '诗', py: 'shī' },
    'r': { name: '日', py: 'rì' },
    'z': { name: '资', py: 'zī' },
    'c': { name: '疵', py: 'cī' },
    's': { name: '思', py: 'sī' },
    'y': { name: '衣', py: 'yī' },
    'w': { name: '乌', py: 'wū' }
};

const TONE_NAMES = [
    '轻声',
    '第一声 (阴平 ˉ)',
    '第二声 (阳平 ˊ)',
    '第三声 (上声 ˇ)',
    '第四声 (去声 ˋ)'
];

// Normalize accented pinyin vowels to base latin letters
function removeTone(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'v');
}

// Standard Chinese characters used as guides for finals with tones
// This ensures TTS reads genuine Chinese characters (e.g. '坡——昂——旁'), avoiding Latin 'ang' being mispronounced as 'an'!
const FINAL_GUIDE_CHARS = {
    'a':   { 1: '啊', 2: '啊', 3: '啊', 4: '啊', 0: '啊' },
    'o':   { 1: '喔', 2: '喔', 3: '喔', 4: '喔', 0: '喔' },
    'e':   { 1: '鹅', 2: '鹅', 3: '鹅', 4: '饿', 0: '鹅' },
    'i':   { 1: '衣', 2: '移', 3: '椅', 4: '意', 0: '衣' },
    'u':   { 1: '乌', 2: '无', 3: '五', 4: '物', 0: '乌' },
    'v':   { 1: '迂', 2: '鱼', 3: '雨', 4: '玉', 0: '迂' },
    'ai':  { 1: '哀', 2: '癌', 3: '矮', 4: '爱', 0: '哀' },
    'ei':  { 1: '诶', 2: '诶', 3: '诶', 4: '诶', 0: '诶' },
    'ui':  { 1: '微', 2: '围', 3: '伟', 4: '卫', 0: '微' },
    'ao':  { 1: '熬', 2: '熬', 3: '袄', 4: '傲', 0: '熬' },
    'ou':  { 1: '欧', 2: '欧', 3: '偶', 4: '藕', 0: '欧' },
    'iu':  { 1: '优', 2: '由', 3: '有', 4: '又', 0: '优' },
    'ie':  { 1: '椰', 2: '爷', 3: '也', 4: '页', 0: '椰' },
    've':  { 1: '约', 2: '约', 3: '约', 4: '月', 0: '约' },
    'er':  { 1: '儿', 2: '儿', 3: '耳', 4: '二', 0: '儿' },
    'an':  { 1: '安', 2: '安', 3: '按', 4: '暗', 0: '安' },
    'en':  { 1: '恩', 2: '恩', 3: '恩', 4: '摁', 0: '恩' },
    'in':  { 1: '因', 2: '银', 3: '引', 4: '印', 0: '因' },
    'un':  { 1: '温', 2: '文', 3: '稳', 4: '问', 0: '温' },
    'vn':  { 1: '晕', 2: '云', 3: '允', 4: '运', 0: '晕' },
    'ang': { 1: '肮', 2: '昂', 3: '昂', 4: '盎', 0: '昂' },
    'eng': { 1: '亨', 2: '恒', 3: '恒', 4: '亨', 0: '亨' },
    'ing': { 1: '英', 2: '迎', 3: '影', 4: '硬', 0: '英' },
    'ong': { 1: '轰', 2: '红', 3: '哄', 4: '瓮', 0: '轰' },
    'ia':  { 1: '鸭', 2: '牙', 3: '雅', 4: '亚', 0: '鸭' },
    'ian': { 1: '烟', 2: '言', 3: '眼', 4: '燕', 0: '烟' },
    'iang':{ 1: '央', 2: '羊', 3: '养', 4: '样', 0: '央' },
    'iao': { 1: '腰', 2: '摇', 3: '咬', 4: '要', 0: '腰' },
    'iong':{ 1: '庸', 2: '庸', 3: '勇', 4: '用', 0: '庸' },
    'ua':  { 1: '蛙', 2: '娃', 3: '瓦', 4: '袜', 0: '蛙' },
    'uai': { 1: '歪', 2: '怀', 3: '矮', 4: '外', 0: '歪' },
    'uan': { 1: '弯', 2: '丸', 3: '碗', 4: '万', 0: '弯' },
    'uang':{ 1: '汪', 2: '王', 3: '网', 4: '望', 0: '汪' },
    'uo':  { 1: '窝', 2: '我', 3: '我', 4: '卧', 0: '窝' }
};

function getPhonicsDetails(char) {
    if (!window.pinyinPro) {
        return { pinyin: '', initial: '', final: '', num: 0, isZhengTi: false, spellText: char };
    }
    const list = window.pinyinPro.pinyin(char, { type: 'all' });
    if (!list || !list[0]) {
        return { pinyin: '', initial: '', final: '', num: 0, isZhengTi: false, spellText: char };
    }
    const info = list[0];
    const pyClean = window.pinyinPro.pinyin(char, { toneType: 'none' });
    const isZhengTi = ZHENG_TI_SYLLABLES.has(pyClean);
    const initialName = INITIAL_SOUNDS[info.initial]?.name || info.initial || '';

    // Convert final to authentic Chinese character pronunciation guide
    const cleanFinal = removeTone(info.final);
    const finalGuide = (FINAL_GUIDE_CHARS[cleanFinal] && FINAL_GUIDE_CHARS[cleanFinal][info.num]) || info.final;

    let spellText = '';
    if (isZhengTi) {
        spellText = `${char}，是整体认读音节，不用拼，直接读：${char}！`;
    } else if (info.initial) {
        // e.g. for 旁: '声母 坡，韵母 昂，拼读：坡——昂——旁！'
        spellText = `声母 ${initialName}，韵母 ${finalGuide}，拼读：${initialName}——${finalGuide}——${char}！`;
    } else {
        spellText = `${char}，单韵母直接读：${char}！`;
    }

    return {
        pinyin: info.pinyin,
        initial: info.initial,
        initialName,
        final: info.final,
        finalGuide,
        num: info.num,
        toneName: TONE_NAMES[info.num] || '标准声调',
        isZhengTi,
        spellText
    };
}

// ================= Global Lead-Reading State =================
const currentPlaybackState = {
    sentences: [],
    sentenceIndex: 0,
    isPlaying: false,
    mode: 'echo', // 'echo' (领读-跟读) or 'continuous' (连贯朗读)
    pauseMode: 'manual', // 'manual' (等待孩子点击) or 'auto'
    speed: 0.75, // 0.75x slow speed for kids
    isEchoWaiting: false,
    timerId: null
};

// Keyboard shortcut: Spacebar advances to next sentence during Echo wait
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && currentPlaybackState.isEchoWaiting) {
        e.preventDefault();
        onEchoNextSentence();
    }
});

// ================= Lesson List View =================
function renderLessonList() {
    // Group by unit
    const unitsMap = new Map();
    lessonData.forEach((lesson, index) => {
        const u = lesson.unit || '课文列表';
        if (!unitsMap.has(u)) unitsMap.set(u, []);
        unitsMap.get(u).push({ lesson, index });
    });

    const unitNames = Array.from(unitsMap.keys());
    const pillsHtml = unitNames.map((name, i) => {
        const shortName = name.split(' · ')[0] || name;
        return `<button class="unit-nav-pill" onclick="document.getElementById('unit-sec-${i}')?.scrollIntoView({ behavior: 'smooth' })">${shortName}</button>`;
    }).join('');

    mainContent.innerHTML = `
        <div style="margin-bottom: 1.2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
            <div>
                <h2 style="font-family: 'ZCOOL KuaiLe', cursive; color: var(--primary); font-size: 1.6rem;">📚 部编版二年级(下) 课文与生字表</h2>
                <div style="font-size: 0.85rem; color: #00897B; margin-top: 0.2rem;">✨ 2024 新教材统编版 · 同步八个单元课本顺序</div>
            </div>
            <span style="color: var(--gray); font-size: 0.95rem;">课文原文 · 拼音点读 · 笔顺步进分解</span>
        </div>
        <div class="unit-nav-bar">
            <span class="unit-nav-label">📑 单元直达：</span>
            ${pillsHtml}
        </div>
        <div class="lesson-catalogue-container" id="lesson-catalogue-container"></div>
    `;
    const container = document.getElementById('lesson-catalogue-container');

    let unitIdx = 0;
    unitsMap.forEach((items, unitName) => {
        const unitSection = document.createElement('div');
        unitSection.className = 'unit-section';
        unitSection.id = `unit-sec-${unitIdx++}`;

        const unitHeader = document.createElement('div');
        unitHeader.className = 'unit-header';
        unitHeader.innerHTML = `<span class="unit-title-badge">${unitName}</span>`;
        unitSection.appendChild(unitHeader);

        const grid = document.createElement('div');
        grid.className = 'lesson-grid';

        items.forEach(({ lesson, index }) => {
            const card = document.createElement('div');
            card.className = 'lesson-card';
            const title = lesson.title;
            const text = getLessonText(index);
            const textSnippet = text ? text.replace(/\n+/g, ' ').slice(0, 50) + '...' : '';

            card.innerHTML = `
                <div>
                    <div class="lesson-title">
                        <span>${title}</span>
                        <span style="font-size: 0.85rem; color: var(--secondary); font-weight: normal;">点击进入 ➜</span>
                    </div>
                    <div class="lesson-preview-snippet">${textSnippet}</div>
                </div>
                <div>
                    <div style="font-size: 0.8rem; color: var(--gray); margin-bottom: 0.4rem; font-weight: 500;">本课生字：</div>
                    <div class="preview-chars">
                        ${lesson.chars.split('').map(c => `<span class="char-chip">${c}</span>`).join('')}
                    </div>
                </div>
            `;
            card.addEventListener('click', () => renderLessonView(index));
            grid.appendChild(card);
        });

        unitSection.appendChild(grid);
        container.appendChild(unitSection);
    });
}

// ================= Lesson Detail View =================
function renderLessonView(lessonIndex) {
    stopPlayback();
    const lesson = lessonData[lessonIndex];
    const text = getLessonText(lessonIndex);

    // Split text into sentences for lead reading
    const sentences = extractSentences(text);
    currentPlaybackState.sentences = sentences;
    currentPlaybackState.sentenceIndex = 0;

    mainContent.innerHTML = `
        <div class="lesson-detail-header">
            <button class="back-btn" id="back-list">⬅ 返回课程列表</button>
            <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                <button class="action-btn-small" id="btn-open-edit-text" style="background:#FFF; border:1px solid #B0BEC5; font-weight:600; padding:0.45rem 1rem;">✏️ 校对本课原文</button>
                <button class="action-btn" id="start-lesson-quiz" style="background:var(--secondary); color:#fff;">📝 本课小测验</button>
            </div>
        </div>

        <!-- Lead-Reading Controls -->
        <div class="player-toolbar">
            <div class="player-controls-row">
                <button class="control-btn control-btn-lead" id="btn-start-lead">
                    <span>🗣️ 开始领读 (跟读模式)</span>
                </button>
                <button class="control-btn control-btn-play" id="btn-start-continuous">
                    <span>▶️ 连贯朗读整篇</span>
                </button>
                <button class="control-btn control-btn-stop" id="btn-stop-reading">
                    <span>⏹️ 停止</span>
                </button>
                <button class="control-btn control-btn-pause" id="btn-replay-sentence" title="重听当前句子">
                    <span>🔁 重读此句</span>
                </button>
            </div>

            <div class="player-settings-row">
                <div class="setting-item">
                    <span>跟读停顿方式：</span>
                    <select class="setting-select" id="select-pause-mode">
                        <option value="manual" selected>🔘 等待孩子手动点下一句 (推荐)</option>
                        <option value="auto-3">⏱️ 自动停顿 3 秒</option>
                        <option value="auto-5">⏱️ 自动停顿 5 秒</option>
                        <option value="auto-8">⏱️ 自动停顿 8 秒</option>
                    </select>
                </div>
                <div class="setting-item">
                    <span>领读语速：</span>
                    <select class="setting-select" id="select-speed">
                        <option value="0.75" selected>🐢 慢速 0.75x (跟读推荐)</option>
                        <option value="0.85">标准 0.85x</option>
                        <option value="1.0">原速 1.0x</option>
                    </select>
                </div>
                <span style="font-size: 0.85rem; color: #00796B; font-weight:500;">💡 点击任意句子可从该句开始领读；点击汉字可查看笔顺分解</span>
            </div>
        </div>

        <!-- Echo Prompt Banner (Visible when waiting for child) -->
        <div class="echo-banner" id="echo-banner" style="display: none;">
            <div class="echo-info">
                <span class="echo-icon">🎙️</span>
                <div>
                    <div class="echo-title">轮到小朋友跟读啦！</div>
                    <div class="echo-subtitle">跟着大声朗读，读完后点击绿色按钮继续（或按键盘空格键）</div>
                </div>
            </div>
            <div class="echo-actions">
                <button class="btn-echo-replay" id="btn-banner-replay">🔁 没听清，重听一遍</button>
                <button class="btn-echo-next" id="btn-banner-next">我读完啦，下一句 ➡</button>
            </div>
        </div>

        <!-- Pinyin Article Display -->
        <div class="article-container">
            <div class="article-title-block">
                <h2>${lesson.title}</h2>
            </div>
            <div class="article-pinyin-body" id="article-body">
                <!-- Injected Pinyin HTML -->
            </div>
        </div>

        <!-- Writing Chars Grid Section -->
        <div class="lesson-chars-section">
            <div class="section-header-title">
                <span>✍️ 本课写字表生字（点击查看笔顺分解与拼读）</span>
                <span style="font-size: 0.9rem; color: var(--gray); font-family: 'Noto Sans SC';">共 ${lesson.chars.length} 个生字</span>
            </div>
            <div class="char-grid" id="char-grid"></div>
        </div>
    `;

    // Render Article with Ruby Pinyin
    renderArticleBody(document.getElementById('article-body'), text);

    // Render Lesson Chars Grid
    const charGrid = document.getElementById('char-grid');
    lesson.chars.split('').forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';
        const py = window.pinyinPro ? window.pinyinPro.pinyin(char) : '';
        card.innerHTML = `
            <div class="char-card-char">${char}</div>
            <div class="char-card-pinyin">${py}</div>
        `;
        card.addEventListener('click', () => openModal(char));
        charGrid.appendChild(card);
    });

    // Navigation & Quiz event listeners
    document.getElementById('back-list').addEventListener('click', () => {
        stopPlayback();
        renderLessonList();
    });
    document.getElementById('start-lesson-quiz').addEventListener('click', () => {
        stopPlayback();
        startQuiz(lesson.chars, lessonIndex);
    });

    // Edit text button
    document.getElementById('btn-open-edit-text').addEventListener('click', () => {
        currentEditingLessonIndex = lessonIndex;
        editTextInput.value = getLessonText(lessonIndex);
        editTextModal.classList.remove('hidden');
    });

    // Playback control event listeners
    document.getElementById('btn-start-lead').addEventListener('click', () => {
        startLeadReading('echo');
    });

    document.getElementById('btn-start-continuous').addEventListener('click', () => {
        startLeadReading('continuous');
    });

    document.getElementById('btn-stop-reading').addEventListener('click', stopPlayback);

    document.getElementById('btn-replay-sentence').addEventListener('click', () => {
        replayCurrentSentence();
    });

    document.getElementById('select-pause-mode').addEventListener('change', (e) => {
        currentPlaybackState.pauseMode = e.target.value;
    });

    document.getElementById('select-speed').addEventListener('change', (e) => {
        currentPlaybackState.speed = parseFloat(e.target.value);
    });

    document.getElementById('btn-banner-next').addEventListener('click', onEchoNextSentence);
    document.getElementById('btn-banner-replay').addEventListener('click', replayCurrentSentence);
}

// Edit text modal actions
if (closeEditModalBtn) closeEditModalBtn.onclick = () => editTextModal.classList.add('hidden');
if (btnCancelEdit) btnCancelEdit.onclick = () => editTextModal.classList.add('hidden');
if (btnResetText) {
    btnResetText.onclick = () => {
        if (confirm("确定恢复本课为预设的默认课文吗？")) {
            resetCustomLessonText(currentEditingLessonIndex);
            editTextModal.classList.add('hidden');
            renderLessonView(currentEditingLessonIndex);
        }
    };
}
if (btnSaveText) {
    btnSaveText.onclick = () => {
        const updated = editTextInput.value.trim();
        if (updated) {
            saveCustomLessonText(currentEditingLessonIndex, updated);
            editTextModal.classList.add('hidden');
            renderLessonView(currentEditingLessonIndex);
        }
    };
}

// ================= Sentence Extraction & Pinyin Body Rendering =================
function extractSentences(text) {
    if (!text) return [];
    const rawLines = text.split('\n');
    const sentences = [];
    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const parts = trimmed.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [trimmed];
        parts.forEach(p => {
            if (p.trim()) sentences.push(p.trim());
        });
    });
    return sentences;
}

function renderArticleBody(container, text) {
    if (!text) {
        container.innerHTML = '<p>暂无课文内容</p>';
        return;
    }

    container.innerHTML = '';
    const paragraphs = text.split('\n');
    let sentenceGlobalIndex = 0;

    paragraphs.forEach(para => {
        const trimmed = para.trim();
        if (!trimmed) return;

        const pElem = document.createElement('div');
        pElem.className = 'article-paragraph';

        const sentenceParts = trimmed.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [trimmed];
        sentenceParts.forEach(sent => {
            if (!sent.trim()) return;
            const sentIndex = sentenceGlobalIndex++;
            const sentSpan = document.createElement('span');
            sentSpan.className = 'article-sentence';
            sentSpan.dataset.sentenceIndex = sentIndex;
            sentSpan.dataset.text = sent.trim();
            sentSpan.title = "点击从此句开始朗读";

            // Generate characters with Ruby & prepend a play badge
            sentSpan.innerHTML = `<span class="sentence-play-tag" title="从此句开始朗读">▶</span>` + generateRubyHtmlForSentence(sent.trim());

            // Add click-to-read and inspect character
            sentSpan.querySelectorAll('.py-char-span').forEach(charSpan => {
                const char = charSpan.dataset.char;
                charSpan.addEventListener('click', (e) => {
                    e.stopPropagation(); // Don't trigger sentence playback!
                    speakChinese(char, 0.75);
                    openModal(char);
                });
            });

            // Click sentence (or play tag): Start reading from this sentence onwards!
            sentSpan.addEventListener('click', () => {
                currentPlaybackState.isPlaying = true;
                currentPlaybackState.sentenceIndex = sentIndex;
                playCurrentSentence();
            });

            pElem.appendChild(sentSpan);
        });

        container.appendChild(pElem);
    });
}

function generateRubyHtmlForSentence(sentence) {
    let html = '';
    for (let i = 0; i < sentence.length; i++) {
        const char = sentence[i];
        if (/[\u4e00-\u9fa5]/.test(char)) {
            const py = window.pinyinPro ? window.pinyinPro.pinyin(char) : '';
            html += `<ruby><span class="py-char-span" data-char="${char}">${char}</span><rt>${py}</rt></ruby>`;
        } else {
            html += `<span class="punct-span">${char}</span>`;
        }
    }
    return html;
}

// ================= Lead-Reading Logic =================
function startLeadReading(mode = 'echo') {
    stopPlayback();
    currentPlaybackState.isPlaying = true;
    currentPlaybackState.mode = mode;
    currentPlaybackState.sentenceIndex = 0;
    playCurrentSentence();
}

function playCurrentSentence() {
    if (!currentPlaybackState.isPlaying) return;

    if (currentPlaybackState.sentenceIndex >= currentPlaybackState.sentences.length) {
        // Finished whole text!
        stopPlayback();
        alert("🎉 太棒啦！本篇课文朗读跟读完成！小朋友真有毅力！");
        return;
    }

    const index = currentPlaybackState.sentenceIndex;
    const sentenceText = currentPlaybackState.sentences[index];

    // Highlight sentence in text
    highlightSentence(index);
    currentPlaybackState.isEchoWaiting = false;
    updateEchoBannerUI();

    // Speak sentence
    speakChinese(sentenceText, currentPlaybackState.speed, () => {
        // Speech ended
        if (!currentPlaybackState.isPlaying) return;

        if (currentPlaybackState.mode === 'echo') {
            // Echo mode: wait for child
            currentPlaybackState.isEchoWaiting = true;
            updateEchoBannerUI();

            if (currentPlaybackState.pauseMode.startsWith('auto-')) {
                const secs = parseInt(currentPlaybackState.pauseMode.replace('auto-', '')) || 5;
                currentPlaybackState.timerId = setTimeout(() => {
                    onEchoNextSentence();
                }, secs * 1000);
            }
        } else {
            // Continuous mode: brief pause then proceed
            currentPlaybackState.timerId = setTimeout(() => {
                currentPlaybackState.sentenceIndex++;
                playCurrentSentence();
            }, 600);
        }
    });
}

function onEchoNextSentence() {
    if (currentPlaybackState.timerId) {
        clearTimeout(currentPlaybackState.timerId);
        currentPlaybackState.timerId = null;
    }
    currentPlaybackState.isEchoWaiting = false;
    updateEchoBannerUI();

    currentPlaybackState.sentenceIndex++;
    playCurrentSentence();
}

function replayCurrentSentence() {
    if (currentPlaybackState.timerId) {
        clearTimeout(currentPlaybackState.timerId);
        currentPlaybackState.timerId = null;
    }
    currentPlaybackState.isEchoWaiting = false;
    updateEchoBannerUI();
    playCurrentSentence();
}

function highlightSentence(index) {
    clearHighlight();
    const target = document.querySelector(`.article-sentence[data-sentence-index="${index}"]`);
    if (target) {
        target.classList.add('active-sentence');
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function clearHighlight() {
    document.querySelectorAll('.article-sentence.active-sentence').forEach(el => {
        el.classList.remove('active-sentence');
    });
}

function updateEchoBannerUI() {
    const banner = document.getElementById('echo-banner');
    if (!banner) return;
    if (currentPlaybackState.isPlaying && currentPlaybackState.isEchoWaiting) {
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

// ================= Free Practice & Voice View =================
function renderCustomPracticeView() {
    mainContent.innerHTML = `
        <div class="custom-practice-container">
            <h2 style="font-family: 'ZCOOL KuaiLe', cursive; color: var(--primary); font-size: 1.6rem; margin-bottom: 0.5rem;">✍️ 随练与语音输入小助手</h2>
            <p style="color: var(--gray); font-size: 0.95rem; margin-bottom: 1.2rem;">
                输入任何字词、句子或课文，或者让孩子点击麦克风语音输入，即可生成拼音、拼读示范与笔顺分解。
            </p>

            <div class="custom-input-box">
                <textarea id="custom-text-input" class="custom-textarea" placeholder="在此输入文字，或点击下方麦克风让孩子直接说话（例如：春天来了、开满鲜花的小路）..."></textarea>
                
                <div class="custom-actions-row">
                    <button class="voice-mic-btn" id="btn-voice-input">
                        <span id="mic-icon">🎤</span>
                        <span id="mic-label">孩子语音输入</span>
                    </button>
                    <button class="control-btn control-btn-lead" id="btn-analyze-custom">
                        <span>🚀 开始分析与朗读</span>
                    </button>
                    <button class="action-btn-small" id="btn-clear-custom" style="padding:0.6rem 1rem;">
                        🧹 清空
                    </button>
                </div>

                <div class="voice-tablet-tip">
                    💡 <b>平板/手机小贴士</b>：如果点击上方麦克风一直提示倾听但无反应，可以直接点击输入框，调出平板软键盘自带的【麦克风/语音键 🎙️】（如华为/讯飞/搜狗输入法），本地识别极快且无需额外配置！
                </div>

                <div class="quick-sample-tags">
                    <span>快捷示例：</span>
                    <span class="sample-tag" data-val="春天来了！春天像个害羞的小姑娘。">找春天</span>
                    <span class="sample-tag" data-val="碧玉妆成一树高，万条垂下绿丝绦。">咏柳</span>
                    <span class="sample-tag" data-val="通往松鼠太太家的路上开满了鲜花。">开满鲜花的小路</span>
                    <span class="sample-tag" data-val="春风吹又生">春风吹又生</span>
                </div>
            </div>

            <!-- Custom Result Section -->
            <div id="custom-result-area" style="display: none; margin-top: 2rem;">
                <!-- Result Toolbar -->
                <div class="player-toolbar">
                    <div class="player-controls-row">
                        <button class="control-btn control-btn-lead" id="custom-btn-lead">
                            <span>🗣️ 开始领读 (跟读)</span>
                        </button>
                        <button class="control-btn control-btn-play" id="custom-btn-play">
                            <span>▶️ 连贯朗读</span>
                        </button>
                        <button class="control-btn control-btn-stop" id="custom-btn-stop">
                            <span>⏹️ 停止</span>
                        </button>
                    </div>
                </div>

                <!-- Echo Banner -->
                <div class="echo-banner" id="echo-banner" style="display: none;">
                    <div class="echo-info">
                        <span class="echo-icon">🎙️</span>
                        <div>
                            <div class="echo-title">轮到小朋友跟读啦！</div>
                            <div class="echo-subtitle">读完后点击绿色按钮继续（或按空格键）</div>
                        </div>
                    </div>
                    <div class="echo-actions">
                        <button class="btn-echo-replay" id="btn-banner-replay">🔁 重听</button>
                        <button class="btn-echo-next" id="btn-banner-next">我读完啦，下一句 ➡</button>
                    </div>
                </div>

                <!-- Pinyin Text Display -->
                <div class="article-container">
                    <div class="article-title-block">
                        <h2>拼音认读与点读</h2>
                    </div>
                    <div class="article-pinyin-body" id="custom-article-body"></div>
                </div>

                <!-- Chars Grid -->
                <div class="lesson-chars-section">
                    <div class="section-header-title">
                        <span>✍️ 包含的汉字（点击查看笔顺分解与拼读教学）</span>
                    </div>
                    <div class="char-grid" id="custom-char-grid"></div>
                </div>
            </div>
        </div>
    `;

    const inputArea = document.getElementById('custom-text-input');
    const voiceBtn = document.getElementById('btn-voice-input');
    const micLabel = document.getElementById('mic-label');
    const micIcon = document.getElementById('mic-icon');
    const analyzeBtn = document.getElementById('btn-analyze-custom');
    const clearBtn = document.getElementById('btn-clear-custom');

    // Speech Recognition setup (Robust for tablets & mobiles)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;
    let recognitionWatchdog = null;

    function resetVoiceBtn() {
        if (recognitionWatchdog) {
            clearTimeout(recognitionWatchdog);
            recognitionWatchdog = null;
        }
        isListening = false;
        if (voiceBtn) {
            voiceBtn.classList.remove('listening');
            micLabel.textContent = "孩子语音输入";
            micIcon.textContent = "🎤";
        }
    }

    if (SpeechRecognition) {
        try {
            recognition = new SpeechRecognition();
            recognition.lang = 'zh-CN';
            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = () => {
                isListening = true;
                voiceBtn.classList.add('listening');
                micLabel.textContent = "正在倾听，点击可停止...";
                micIcon.textContent = "🔴";

                // Safety Watchdog: 8 seconds timeout
                if (recognitionWatchdog) clearTimeout(recognitionWatchdog);
                recognitionWatchdog = setTimeout(() => {
                    if (isListening) {
                        try { recognition.abort(); } catch(e){}
                        resetVoiceBtn();
                        alert("⏱️ 语音监听超时（未收到结果）。\n\n💡 推荐技巧：直接点击输入框，使用平板输入法自带的【麦克风语音键 🎙️】说话，识别极快极准！");
                    }
                }, 8000);
            };

            recognition.onresult = (event) => {
                if (recognitionWatchdog) {
                    clearTimeout(recognitionWatchdog);
                    recognitionWatchdog = null;
                }
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        transcript += event.results[i][0].transcript;
                    }
                }
                if (!transcript && event.results[0] && event.results[0][0]) {
                    transcript = event.results[0][0].transcript;
                }
                if (transcript) {
                    inputArea.value = (inputArea.value + ' ' + transcript).trim();
                    resetVoiceBtn();
                    triggerCustomAnalysis();
                }
            };

            recognition.onerror = (e) => {
                console.warn("Speech recognition error:", e);
                resetVoiceBtn();
                let hint = "";
                if (e.error === 'network') {
                    hint = "⚠️ 网页语音无法联网连接（平板系统因未集成谷歌语音服务通常无法通过网页直接听写）。\n\n💡 解决办法：直接点击上方输入框，使用平板键盘自带的【麦克风语音键 🎙️】（如华为/讯飞/搜狗输入法），本地识别极快！";
                } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    hint = "⚠️ 麦克风权限未开启，请在平板浏览器或系统设置中允许使用麦克风。";
                } else if (e.error === 'no-speech') {
                    hint = "未听到说话声，请靠近麦克风再试一次。";
                }
                if (hint) alert(hint);
            };

            recognition.onend = () => {
                resetVoiceBtn();
            };
        } catch(err) {
            console.warn("Speech recognition init failed:", err);
            recognition = null;
        }
    }

    voiceBtn.addEventListener('click', () => {
        if (!SpeechRecognition || !recognition) {
            alert("您的平板浏览器暂不支持网页直接录音听写。\n\n💡 建议：直接点击输入框，使用平板键盘自带的【麦克风语音键 🎙️】说话输入！");
            return;
        }
        if (isListening) {
            try { recognition.abort(); } catch(e){}
            resetVoiceBtn();
        } else {
            try {
                recognition.start();
            } catch (err) {
                console.error("Recognition start failed:", err);
                resetVoiceBtn();
            }
        }
    });

    // Sample tags click
    document.querySelectorAll('.sample-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            inputArea.value = tag.dataset.val;
            triggerCustomAnalysis();
        });
    });

    clearBtn.addEventListener('click', () => {
        inputArea.value = '';
        stopPlayback();
        document.getElementById('custom-result-area').style.display = 'none';
    });

    analyzeBtn.addEventListener('click', triggerCustomAnalysis);

    function triggerCustomAnalysis() {
        const text = inputArea.value.trim();
        if (!text) {
            alert("请先输入或说出字词句子！");
            return;
        }

        stopPlayback();
        const resultArea = document.getElementById('custom-result-area');
        resultArea.style.display = 'block';

        const sentences = extractSentences(text);
        currentPlaybackState.sentences = sentences;
        currentPlaybackState.sentenceIndex = 0;

        renderArticleBody(document.getElementById('custom-article-body'), text);

        // Unique Chinese characters
        const uniqueChars = Array.from(new Set(text.match(/[\u4e00-\u9fa5]/g) || []));
        const charGrid = document.getElementById('custom-char-grid');
        charGrid.innerHTML = '';

        uniqueChars.forEach(char => {
            const card = document.createElement('div');
            card.className = 'char-card';
            const py = window.pinyinPro ? window.pinyinPro.pinyin(char) : '';
            card.innerHTML = `
                <div class="char-card-char">${char}</div>
                <div class="char-card-pinyin">${py}</div>
            `;
            card.addEventListener('click', () => openModal(char));
            charGrid.appendChild(card);
        });

        // Result toolbar handlers
        document.getElementById('custom-btn-lead').onclick = () => startLeadReading('echo');
        document.getElementById('custom-btn-play').onclick = () => startLeadReading('continuous');
        document.getElementById('custom-btn-stop').onclick = stopPlayback;

        const bannerNext = document.getElementById('btn-banner-next');
        const bannerReplay = document.getElementById('btn-banner-replay');
        if (bannerNext) bannerNext.onclick = onEchoNextSentence;
        if (bannerReplay) bannerReplay.onclick = replayCurrentSentence;

        resultArea.scrollIntoView({ behavior: 'smooth' });
    }
}

// ================= Character & Phonics & Stroke Order Modal (Compact, No Scrollbar) =================
function openModal(char) {
    currentCharacter = char;
    modal.classList.remove('hidden');

    // 1. Phonics & Pinyin Engine
    const phonics = getPhonicsDetails(char);
    modalPinyin.textContent = phonics.pinyin || '—';
    modalToneBadge.textContent = phonics.toneName;

    if (phonics.isZhengTi) {
        modalPhonicsBox.innerHTML = `
            <span style="color:#E67700; font-weight:700;">🌟 整体认读音节：不用拼，直接读 [ ${char} ]！</span>
        `;
    } else if (phonics.initial) {
        modalPhonicsBox.innerHTML = `
            <div class="phonics-part">
                <span class="phonics-label">声母:</span>
                <span class="phonics-val">${phonics.initial}</span>
                <span style="font-size:0.8rem; color:#888;">(${phonics.initialName})</span>
            </div>
            <span class="phonics-equal">+</span>
            <div class="phonics-part">
                <span class="phonics-label">韵母:</span>
                <span class="phonics-val">${phonics.final}</span>
                <span style="font-size:0.8rem; color:#888;">(${phonics.finalGuide})</span>
            </div>
            <span class="phonics-equal">➔</span>
            <div class="phonics-part">
                <span class="phonics-label">拼读:</span>
                <span class="phonics-val">${phonics.pinyin}</span>
            </div>
        `;
    } else {
        modalPhonicsBox.innerHTML = `
            <div class="phonics-part">
                <span class="phonics-label">单韵母:</span>
                <span class="phonics-val">${phonics.final || char}</span>
                <span style="font-size:0.8rem; color:#888;">(直接读音)</span>
            </div>
        `;
    }

    // Audio Buttons Handlers
    btnAudio.onclick = () => {
        speakChinese(char, 0.75);
    };

    btnSpell.onclick = () => {
        speakChinese(phonics.spellText, 0.75);
    };

    // 2. Hanzi Writer Interactive Canvas (Compact 140x140)
    characterDisplay.innerHTML = '';
    writer = null;

    setTimeout(() => {
        try {
            const displayEl = document.getElementById('character-display');
            const targetSize = (displayEl && displayEl.clientWidth) ? displayEl.clientWidth : 210;
            writer = HanziWriter.create('character-display', char, {
                width: targetSize,
                height: targetSize,
                padding: Math.round(targetSize * 0.035),
                showOutline: true,
                strokeAnimationSpeed: 1,
                delayBetweenStrokes: 120,
                radicalColor: '#FF6B6B',
                charDataLoader: (targetChar, onComplete) => {
                    fetch(`data/${targetChar}.json`)
                        .then(res => {
                            if (!res.ok) throw new Error('Local char json not found');
                            return res.json();
                        })
                        .then(onComplete)
                        .catch(() => {
                            fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${targetChar}.json`)
                                .then(res => res.json())
                                .then(onComplete)
                                .catch(() => {
                                    fetch(`https://unpkg.com/hanzi-writer-data@2.0/${targetChar}.json`)
                                        .then(res => res.json())
                                        .then(onComplete);
                                });
                        });
                }
            });
            writer.animateCharacter();
        } catch (e) {
            console.error("HanziWriter initialization error:", e);
        }
    }, 80);

    // 3. Static Step-by-Step Stroke Decomposition Strip (Compact for copying on paper!)
    renderStrokeSequence(char);

    // Speak character once on open
    speakChinese(char, 0.75);
}

function closeModal() {
    modal.classList.add('hidden');
    writer = null;
}

if (closeCharModalBtn) closeCharModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
    if (e.target === editTextModal) editTextModal.classList.add('hidden');
});

btnAnimate.addEventListener('click', () => {
    if (writer) {
        writer.hideCharacter();
        writer.animateCharacter();
    }
});

btnQuiz.addEventListener('click', () => {
    if (writer) writer.quiz();
});

// Render Step-by-step SVG strokes for paper copybook reference
async function renderStrokeSequence(char) {
    strokeStepsContainer.innerHTML = '<span style="color:#90A4AE; font-size:0.85rem;">生成笔顺分解中...</span>';
    strokeCountBadge.textContent = '计算笔画中...';

    async function fetchCharJson(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        return await res.json();
    }

    let data = null;
    try {
        data = await fetchCharJson(`data/${char}.json`);
    } catch (e1) {
        try {
            data = await fetchCharJson(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`);
        } catch (e2) {
            try {
                data = await fetchCharJson(`https://unpkg.com/hanzi-writer-data@2.0/${char}.json`);
            } catch (e3) {
                console.warn("Could not load stroke data for", char);
            }
        }
    }

    if (!data || !data.strokes) {
        strokeStepsContainer.innerHTML = '<span style="color:#90A4AE; font-size:0.85rem;">(暂无此字分步分解图)</span>';
        strokeCountBadge.textContent = '共 1 字';
        return;
    }

    const strokes = data.strokes;
    const totalStrokes = strokes.length;
    strokeCountBadge.textContent = `共 ${totalStrokes} 画`;
    strokeStepsContainer.innerHTML = '';

    for (let i = 0; i < totalStrokes; i++) {
        const stepCard = document.createElement('div');
        stepCard.className = 'step-card';

        const stepBox = document.createElement('div');
        stepBox.className = 'step-box';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 1024 1024');
        svg.setAttribute('width', '46');
        svg.setAttribute('height', '46');

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'scale(1, -1) translate(0, -900)');
        svg.appendChild(g);

        // Gray outline for all strokes
        strokes.forEach(pathData => {
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', pathData);
            p.setAttribute('fill', 'var(--trace-gray)');
            g.appendChild(p);
        });

        // Completed strokes in black, current stroke in red
        for (let j = 0; j <= i; j++) {
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', strokes[j]);
            p.setAttribute('fill', j === i ? 'var(--stroke-red)' : 'var(--char-black)');
            g.appendChild(p);
        }

        stepBox.appendChild(svg);
        stepCard.appendChild(stepBox);

        const stepNum = document.createElement('span');
        stepNum.className = 'step-num';
        stepNum.textContent = `${i + 1}`;
        stepCard.appendChild(stepNum);

        strokeStepsContainer.appendChild(stepCard);
    }
}

// ================= Quiz Logic =================
function startQuiz(scopeChars = null, returnIndex = null) {
    stopPlayback();
    let pool = scopeChars;
    if (!pool) {
        pool = lessonData.map(l => l.chars).join('');
    }

    const correctChar = pool[Math.floor(Math.random() * pool.length)];
    const correctPinyin = window.pinyinPro ? window.pinyinPro.pinyin(correctChar) : '';

    const options = new Set();
    options.add(correctPinyin);

    let attempts = 0;
    while (options.size < 4 && attempts < 20) {
        const randomChar = pool[Math.floor(Math.random() * pool.length)];
        const p = window.pinyinPro.pinyin(randomChar);
        if (p !== correctPinyin) options.add(p);
        attempts++;
    }

    if (options.size < 4) {
        const globalChars = lessonData.map(l => l.chars).join('');
        attempts = 0;
        while (options.size < 4 && attempts < 50) {
            const randomChar = globalChars[Math.floor(Math.random() * globalChars.length)];
            const p = window.pinyinPro.pinyin(randomChar);
            if (p !== correctPinyin) options.add(p);
            attempts++;
        }
    }

    const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
    renderQuizQuestion(correctChar, correctPinyin, shuffledOptions, scopeChars, returnIndex);
}

function renderQuizQuestion(char, correctPinyin, options, scopeChars, returnIndex) {
    mainContent.innerHTML = `
        <div class="quiz-container">
            <div style="text-align:left; margin-bottom:1rem;">
                <button class="back-btn" id="exit-quiz" style="margin:0;">⬅ 退出测验</button>
            </div>
            <h3>这个字的拼音是什么？</h3>
            <div class="quiz-question">${char}</div>
            <div class="quiz-options" id="quiz-options">
                ${options.map(opt => `<button class="quiz-option" data-val="${opt}">${opt}</button>`).join('')}
            </div>
            <div id="quiz-feedback"></div>
            <button class="btn-next" id="btn-next" style="display:none">下一个 ➡</button>
        </div>
    `;

    document.getElementById('exit-quiz').addEventListener('click', () => {
        if (returnIndex !== null) {
            renderLessonView(returnIndex);
        } else {
            renderLessonList();
            setActiveNav('learn');
        }
    });

    const optionBtns = document.querySelectorAll('.quiz-option');
    const feedback = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('btn-next');

    optionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            optionBtns.forEach(b => b.disabled = true);
            const val = e.target.dataset.val;
            if (val === correctPinyin) {
                e.target.classList.add('correct');
                feedback.textContent = "🎉 答对了！真棒！";
                feedback.style.color = "#4ECDC4";
                speakChinese("答对了，真棒！", 0.9);
            } else {
                e.target.classList.add('wrong');
                optionBtns.forEach(b => {
                    if (b.dataset.val === correctPinyin) b.classList.add('correct');
                });
                feedback.textContent = "❌ 答错了，正确的是 " + correctPinyin;
                feedback.style.color = "#FF6B6B";
                speakChinese("答错了，这个字读 " + correctPinyin, 0.9);
            }
            nextBtn.style.display = 'inline-block';
        });
    });

    nextBtn.addEventListener('click', () => startQuiz(scopeChars, returnIndex));
}

// ================= Initial Load =================
renderLessonList();
