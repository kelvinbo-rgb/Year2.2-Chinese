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

// Global State for Focus Words & Cloze Testing
let currentLessonIndex = 0;
let currentClozeMode = 'normal'; // 'normal' | 'hide-pinyin' | 'hide-hanzi'
let isMarkingFocusMode = false;

// Sync Modal elements
const syncModal = document.getElementById('sync-modal');
const closeSyncModalBtn = document.getElementById('close-sync-modal');
const btnCloseSync = document.getElementById('btn-close-sync');
const btnCopySyncLink = document.getElementById('btn-copy-sync-link');
const syncQrcodeContainer = document.getElementById('sync-qrcode-container');
const syncSummaryBadge = document.getElementById('sync-summary-badge');

// Story Modal elements
const storyModal = document.getElementById('story-modal');
const closeStoryModalBtn = document.getElementById('close-story-modal');
const btnAiGenStory = document.getElementById('btn-ai-gen-story');
const btnEditStoryText = document.getElementById('btn-edit-story-text');
const btnStoryLead = document.getElementById('btn-story-lead');
const btnStoryStop = document.getElementById('btn-story-stop');
const storyEditorContainer = document.getElementById('story-editor-container');
const storyEditorTextarea = document.getElementById('story-editor-textarea');
const btnCancelEditStory = document.getElementById('btn-cancel-edit-story');
const btnSaveCustomStory = document.getElementById('btn-save-custom-story');
const storyFocusWordsChips = document.getElementById('story-focus-words-chips');
const storyArticleBody = document.getElementById('story-article-body');
let storyClozeMode = 'normal';
let currentStoryText = '';
const storyPlaybackState = {
    sentences: [],
    index: 0,
    isPlaying: false
};

// Pinyin Quiz Modal elements
const pinyinQuizModal = document.getElementById('pinyin-quiz-modal');
const closePinyinQuizBtn = document.getElementById('close-pinyin-quiz');
const pinyinQuizTargetChar = document.getElementById('pinyin-quiz-target-char');
const pinyinQuizOptions = document.getElementById('pinyin-quiz-options');
const btnPinyinQuizReveal = document.getElementById('btn-pinyin-quiz-reveal');

// Selection Popover
const selectionPopover = document.getElementById('selection-popover');
let selectedTextToFocus = '';

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

// ================= Focus Words & Story Persistence =================
function getFocusWords(lessonIndex) {
    try {
        const raw = localStorage.getItem('focus_words_' + lessonIndex);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(w => (w || '').trim()).filter(w => w.length > 0);
            }
        }
    } catch (e) {
        console.error("Error reading focus words:", e);
    }
    return [];
}

function saveFocusWords(lessonIndex, words) {
    try {
        const unique = Array.from(new Set((words || []).map(w => (w || '').trim()).filter(w => w.length > 0)));
        localStorage.setItem('focus_words_' + lessonIndex, JSON.stringify(unique));
    } catch (e) {
        console.error("Error saving focus words:", e);
    }
}

function addFocusWord(lessonIndex, word) {
    const cleanWord = (word || '').trim().replace(/[，。！？!?、；;:：“”‘’（）\s]/g, '');
    if (!cleanWord) return;
    const current = getFocusWords(lessonIndex);
    if (!current.includes(cleanWord)) {
        current.push(cleanWord);
        saveFocusWords(lessonIndex, current);
    }
}

function removeFocusWord(lessonIndex, word) {
    const cleanWord = (word || '').trim();
    const current = getFocusWords(lessonIndex).filter(w => w !== cleanWord);
    saveFocusWords(lessonIndex, current);
}

function toggleFocusWord(lessonIndex, word) {
    const cleanWord = (word || '').trim();
    if (!cleanWord) return;
    const current = getFocusWords(lessonIndex);
    if (current.includes(cleanWord)) {
        removeFocusWord(lessonIndex, cleanWord);
    } else {
        addFocusWord(lessonIndex, cleanWord);
    }
}

function getCustomStory(lessonIndex) {
    return localStorage.getItem('custom_story_' + lessonIndex) || '';
}

function saveCustomStory(lessonIndex, text) {
    localStorage.setItem('custom_story_' + lessonIndex, (text || '').trim());
}

// ================= Offline QR Code Sync Encoding / Decoding =================
function encodeSyncData(data) {
    const jsonStr = JSON.stringify(data);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) binary += String.fromCharCode(utf8Bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSyncData(b64) {
    let base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
}

function checkUrlSync() {
    try {
        const params = new URLSearchParams(window.location.search);
        const syncParam = params.get('sync');
        if (!syncParam) return false;

        const data = decodeSyncData(syncParam);
        if (data && (data.t === 'fs' || data.t === 'focus') && typeof data.l === 'number') {
            const lessonIdx = data.l;
            if (Array.isArray(data.w)) {
                saveFocusWords(lessonIdx, data.w);
            }
            if (typeof data.s === 'string' && data.s.trim().length > 0) {
                saveCustomStory(lessonIdx, data.s);
            }

            // Remove query param from address bar without page reload
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            const lessonTitle = lessonData[lessonIdx]?.title || `第 ${lessonIdx + 1} 课`;
            alert(`🎉 恭喜！重点字词库扫码同步成功！\n\n已成功导入【${lessonTitle}】的 ${data.w?.length || 0} 个重点词与专属小故事。\n现在可以开始学习啦！`);

            currentLessonIndex = lessonIdx;
            renderLessonView(lessonIdx);
            return true;
        }
    } catch (e) {
        console.error("Sync data parse error:", e);
    }
    return false;
}

// Curated 2nd-grade story templates for lessons
const LESSON_STORY_TEMPLATES = {
    0: "春天像一位害羞的小姑娘，迈着轻盈的脚步来到了田野。微风轻轻吹拂，小草悄悄探出头来，树枝上吐出了嫩绿的嫩芽。我们高兴地脱掉厚厚的棉袄，奔向广阔的田野，到处寻找春天的足迹。你看，路边的野花在微风中轻轻点头，阳光温暖地照耀着大家。只要我们用心发现，生活处处都是美好的春天！",
    1: "早春二月，杨柳吐出嫩绿的丝绦，微风轻轻吹拂着水面。放学回来的孩子们奔跑在碧绿的原野上，高高放起彩色的风筝。温暖的春风像一把神奇的剪刀，把大自然打扮得生机勃勃。",
    2: "鼹鼠先生去邮局取了一个大包裹。松鼠太太和刺猬太太都好奇地围了过来。一路上，花籽悄悄洒落在泥土里。到了夏天，门前开满了五颜六色绚丽的花朵，大家心里乐开了花，这是一份多么美好的礼物呀！",
    3: "阳光明媚的天气里，大家手拿铁锹兴高采烈地来到公园里植树。我们在泥土里挖好坑，小心翼翼地把绿色的柏树苗栽进土里。经过辛勤的汗水浇灌，小树苗像战士一样笔直地站立着，为大地增添了一抹生机。",
    4: "清晨的小路旁挂满了晶莹的露珠。小溪哗哗流淌，大娘和孩子们在溪边漫步。遇到有困难的行人，大家热情地伸出援助之手。无论走到哪里，雷锋叔叔那助人为乐的精神都温暖着每一个人的心灵。",
    5: "爸爸拿来一块普通的米糕，微风吹拂着田野。你知道吗？为了制作这块糕点，需要农夫辛勤耕种大米，糖农熬制甘甜的糖浆，还需要包装和运输工人的默默奉献。大家团结合作，才有了香甜可口的千人糕！",
    6: "郊外的小河边绿草如茵，垂柳依依。妹妹走得累了，恋恋不舍地望着远方。爸爸随手拾起一根漂亮的柳树枝，当成一匹出色的神马。妹妹骑着骏马飞快地奔跑回家，欢快的笑声回荡在温馨的小道上。"
};

function generateDynamicStory(lessonIndex, focusWords) {
    let base = LESSON_STORY_TEMPLATES[lessonIndex];
    if (!base) {
        const lesson = lessonData[lessonIndex] || {};
        base = `今天阳光灿烂，大家在快乐地学习《${lesson.title || '本课'}》。大自然就像一本生动的画卷，到处充满着惊喜与智慧。只要我们认真观察生活，勤于动笔，每一天都能收获满满的快乐与知识！`;
    }

    if (focusWords && focusWords.length > 0) {
        const missing = focusWords.filter(w => !base.includes(w));
        if (missing.length > 0) {
            base += `\n小树林里的小动物们也来做客了。大家一起温习了【${missing.join('、')}】这些好词好句，在温暖的微风中开心地朗诵起来！`;
        }
    }
    return base;
}

// Generate 3 clever distractors for 4-choice pinyin quiz
function generatePinyinDistractors(char, correctPinyin) {
    const distractors = new Set();
    const vowelTones = {
        'a': ['ā', 'á', 'ǎ', 'à'],
        'e': ['ē', 'é', 'ě', 'è'],
        'i': ['ī', 'í', 'ǐ', 'ì'],
        'o': ['ō', 'ó', 'ǒ', 'ò'],
        'u': ['ū', 'ú', 'ǔ', 'ù'],
        'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
        'v': ['ǖ', 'ǘ', 'ǚ', 'ǜ']
    };
    const allTonedVowels = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü'
    };

    // 1. Substitute tones of the toned vowel
    for (const [tonedV, baseV] of Object.entries(allTonedVowels)) {
        if (correctPinyin && correctPinyin.includes(tonedV)) {
            const family = vowelTones[baseV];
            if (family) {
                family.forEach(v => {
                    const variant = correctPinyin.replace(tonedV, v);
                    if (variant !== correctPinyin) {
                        distractors.add(variant);
                    }
                });
            }
        }
    }

    // 2. Fallback to other characters' pinyins if needed
    if (distractors.size < 3) {
        const pool = (lessonData[currentLessonIndex]?.chars || "春风柳叶花草天地人").split('');
        for (const c of pool) {
            if (c !== char && window.pinyinPro) {
                const py = window.pinyinPro.pinyin(c);
                if (py && py !== correctPinyin) distractors.add(py);
                if (distractors.size >= 3) break;
            }
        }
    }

    const picked = Array.from(distractors).slice(0, 3);
    const options = [correctPinyin, ...picked].sort(() => Math.random() - 0.5);
    return options;
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

// ================= Focus Words Bank Rendering =================
function renderFocusWordsBank(lessonIndex) {
    const container = document.getElementById('focus-words-chips-container');
    const countEl = document.getElementById('focus-words-count');
    if (!container) return;

    const words = getFocusWords(lessonIndex);
    if (countEl) countEl.textContent = words.length;
    container.innerHTML = '';

    if (words.length === 0) {
        container.innerHTML = `
            <span style="font-size:0.85rem; color:#90A4AE; font-style:italic;">
                暂无重点词。可点击上方【✏️ 圈选生字词】直接点选课文，或点击
            </span>
            <button id="btn-quick-import-chars" class="action-btn-small" style="padding:0.25rem 0.65rem; font-size:0.82rem; background:#E0F2F1; color:#00796B; border:1px solid #80CBC4; border-radius:14px; cursor:pointer; font-weight:600;">
                ⚡ 一键导入本课写字表
            </button>
        `;
        const importBtn = document.getElementById('btn-quick-import-chars');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const chars = (lessonData[lessonIndex].chars || '').split('');
                chars.forEach(c => {
                    if (c) addFocusWord(lessonIndex, c);
                });
                renderLessonView(lessonIndex);
            });
        }
        return;
    }

    words.forEach(word => {
        const chip = document.createElement('span');
        chip.className = 'focus-word-chip';
        chip.innerHTML = `
            <span>${word}</span>
            <span class="chip-del-btn" title="移出重点词" data-word="${word}">&times;</span>
        `;
        chip.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip-del-btn')) {
                e.stopPropagation();
                removeFocusWord(lessonIndex, word);
                renderLessonView(lessonIndex);
            } else {
                speakChinese(word, 0.75);
            }
        });
        container.appendChild(chip);
    });
}

// ================= Lesson Detail View =================
function renderLessonView(lessonIndex) {
    stopPlayback();
    currentLessonIndex = lessonIndex;
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

        <!-- Focus Toolbar & Cloze Mode Switcher -->
        <div class="focus-control-bar">
            <div class="focus-control-group">
                <span style="font-size:0.88rem; font-weight:700; color:#37474F;">自测挖空模式：</span>
                <div class="cloze-switcher" id="main-cloze-switcher">
                    <button class="cloze-btn ${currentClozeMode === 'normal' ? 'active' : ''}" data-mode="normal" title="正常阅读，标亮重点词">📖 完整认读</button>
                    <button class="cloze-btn ${currentClozeMode === 'hide-pinyin' ? 'active' : ''}" data-mode="hide-pinyin" title="重点词隐藏拼音，考查读音">🔤 隐拼音·考读音</button>
                    <button class="cloze-btn ${currentClozeMode === 'hide-hanzi' ? 'active' : ''}" data-mode="hide-hanzi" title="重点词隐藏汉字，考查默写">✍️ 隐汉字·考默写</button>
                </div>
            </div>
            <div class="focus-control-group">
                <button class="btn-toggle-mark ${isMarkingFocusMode ? 'active' : ''}" id="btn-toggle-mark-mode">
                    ${isMarkingFocusMode ? '🎯 圈选模式开启中 (点击字词)' : '✏️ 圈选生字词'}
                </button>
                <button class="action-btn-small" id="btn-open-story" style="background:#E0F2F1; color:#00796B; border:1px solid #80CBC4; font-weight:700;">
                    ✨ 串词小故事
                </button>
                <button class="action-btn-small" id="btn-open-sync" style="background:#FFF3E0; color:#E65100; border:1px solid #FFCC80; font-weight:700;">
                    📲 同步给孩子
                </button>
            </div>
        </div>

        <!-- Focus Words Bank Card -->
        <div class="focus-words-bank-card" id="focus-words-bank-card">
            <div class="focus-words-header">
                <div class="focus-words-title">
                    <span>⭐ 本课重点字词库</span>
                    <span style="font-size:0.85rem; color:var(--gray); font-family:'Noto Sans SC';">
                        (已标记 <b id="focus-words-count">0</b> 个词，在挖空自测与小故事中重点考察)
                    </span>
                </div>
                <div class="focus-add-inline">
                    <input type="text" id="input-add-focus-word" class="focus-add-input" placeholder="输入生字或词语" maxlength="10">
                    <button id="btn-add-focus-input" class="btn-add-focus-word">➕添加</button>
                </div>
            </div>
            <div class="focus-words-chips-container" id="focus-words-chips-container"></div>
        </div>

        ${isMarkingFocusMode ? `
        <div class="mark-mode-hint-banner" id="mark-mode-hint-banner">
            <span>💡 <b>圈选模式开启中</b>：直接点击课文中的任意单字，或用鼠标/手指划选词语加入重点！点击右侧按钮可退出圈选。</span>
            <button class="action-btn-small" id="btn-close-mark-mode" style="padding:0.25rem 0.6rem; font-size:0.8rem; background:#FFE0B2; border-color:#FFB74D; color:#E65100; font-weight:700;">完成圈选</button>
        </div>` : ''}

        <!-- Pinyin Article Display -->
        <div class="article-container">
            <div class="article-title-block">
                <h2>${lesson.title}</h2>
            </div>
            <div class="article-pinyin-body ${isMarkingFocusMode ? 'marking-active' : ''}" id="article-body">
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

    // Render Focus Words Bank Chips
    renderFocusWordsBank(lessonIndex);

    // Render Article with Ruby Pinyin & Focus Highlights
    renderArticleBody(document.getElementById('article-body'), text, {
        lessonIndex: lessonIndex,
        clozeMode: currentClozeMode
    });

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

    // Cloze Switcher buttons
    document.querySelectorAll('#main-cloze-switcher .cloze-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentClozeMode = btn.dataset.mode;
            document.querySelectorAll('#main-cloze-switcher .cloze-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderArticleBody(document.getElementById('article-body'), text, {
                lessonIndex: lessonIndex,
                clozeMode: currentClozeMode
            });
        });
    });

    // Toggle Mark Mode button
    document.getElementById('btn-toggle-mark-mode').addEventListener('click', () => {
        isMarkingFocusMode = !isMarkingFocusMode;
        renderLessonView(lessonIndex);
    });

    const closeMarkBtn = document.getElementById('btn-close-mark-mode');
    if (closeMarkBtn) {
        closeMarkBtn.addEventListener('click', () => {
            isMarkingFocusMode = false;
            renderLessonView(lessonIndex);
        });
    }

    // Add Focus Word from Input
    const addInput = document.getElementById('input-add-focus-word');
    const addBtn = document.getElementById('btn-add-focus-input');
    const handleAddWord = () => {
        const val = addInput.value.trim();
        if (val) {
            addFocusWord(lessonIndex, val);
            addInput.value = '';
            renderLessonView(lessonIndex);
        }
    };
    if (addBtn) addBtn.addEventListener('click', handleAddWord);
    if (addInput) {
        addInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddWord();
        });
    }

    // Open Story & Sync Modals
    document.getElementById('btn-open-story').addEventListener('click', () => {
        openStoryModal(lessonIndex);
    });

    document.getElementById('btn-open-sync').addEventListener('click', () => {
        openSyncModal(lessonIndex);
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

function renderArticleBody(container, text, options = {}) {
    if (!container) return;
    if (!text) {
        container.innerHTML = '<p>暂无课文内容</p>';
        return;
    }

    const lessonIndex = options.lessonIndex !== undefined ? options.lessonIndex : currentLessonIndex;
    const clozeMode = options.clozeMode || currentClozeMode || 'normal';
    const focusWords = options.focusWords || getFocusWords(lessonIndex);

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
            sentSpan.innerHTML = `<span class="sentence-play-tag" title="从此句开始朗读">▶</span>` +
                generateRubyHtmlForSentence(sent.trim(), focusWords, clozeMode);

            // 1. Interaction for Masked Pinyin Bubble in 'hide-pinyin' mode
            sentSpan.querySelectorAll('.masked-pinyin-bubble').forEach(rt => {
                rt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const char = rt.dataset.char;
                    const py = rt.dataset.pinyin;
                    openPinyinQuizModal(char, py, () => {
                        rt.textContent = py;
                        rt.classList.add('revealed');
                    });
                });
            });

            // 2. Interaction for Masked Hanzi Box in 'hide-hanzi' mode
            sentSpan.querySelectorAll('.masked-hanzi-box').forEach(box => {
                box.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const char = box.dataset.char;
                    openModal(char, true); // true = auto quiz mode
                });
            });

            // 3. Interaction for Normal Characters
            sentSpan.querySelectorAll('.py-char-span:not(.masked-hanzi-box)').forEach(charSpan => {
                const char = charSpan.dataset.char;
                charSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isMarkingFocusMode) {
                        // In marking mode: clicking a character toggles it in focus words
                        toggleFocusWord(lessonIndex, char);
                        renderLessonView(lessonIndex);
                    } else {
                        // Normal mode: speak and open stroke decomposition
                        speakChinese(char, 0.75);
                        openModal(char, false);
                    }
                });
            });

            // 4. Click sentence (or play tag): Start reading from this sentence onwards!
            sentSpan.addEventListener('click', () => {
                if (isMarkingFocusMode) return;
                currentPlaybackState.isPlaying = true;
                currentPlaybackState.sentenceIndex = sentIndex;
                playCurrentSentence();
            });

            pElem.appendChild(sentSpan);
        });

        container.appendChild(pElem);
    });
}

function generateRubyHtmlForSentence(sentence, focusWords = [], clozeMode = 'normal') {
    // Filter non-empty words and sort descending by length to match longest phrase first
    const sortedWords = (focusWords || [])
        .map(w => (w || '').trim())
        .filter(w => w.length > 0)
        .sort((a, b) => b.length - a.length);

    // Segment sentence
    const segments = [];
    let i = 0;
    while (i < sentence.length) {
        let matched = null;
        for (const w of sortedWords) {
            if (sentence.startsWith(w, i)) {
                matched = w;
                break;
            }
        }
        if (matched) {
            segments.push({ text: matched, isFocus: true });
            i += matched.length;
        } else {
            segments.push({ text: sentence[i], isFocus: false });
            i++;
        }
    }

    let html = '';
    segments.forEach(seg => {
        if (seg.isFocus) {
            for (let c = 0; c < seg.text.length; c++) {
                const char = seg.text[c];
                if (/[\u4e00-\u9fa5]/.test(char)) {
                    const py = window.pinyinPro ? window.pinyinPro.pinyin(char) : '';
                    if (clozeMode === 'hide-pinyin') {
                        html += `<ruby class="focus-ruby"><span class="py-char-span is-focus-word" data-char="${char}">${char}</span><rt class="masked-pinyin-bubble" data-char="${char}" data-pinyin="${py}" data-word="${seg.text}" title="点击答题或揭晓读音">?</rt></ruby>`;
                    } else if (clozeMode === 'hide-hanzi') {
                        html += `<ruby class="focus-ruby"><span class="py-char-span masked-hanzi-box" data-char="${char}" data-pinyin="${py}" data-word="${seg.text}" title="点击手写或揭晓汉字">🔲</span><rt class="revealed-pinyin">${py}</rt></ruby>`;
                    } else {
                        html += `<ruby class="focus-ruby"><span class="py-char-span is-focus-word" data-char="${char}" data-word="${seg.text}" title="重点字词">${char}</span><rt>${py}</rt></ruby>`;
                    }
                } else {
                    html += `<span class="punct-span">${char}</span>`;
                }
            }
        } else {
            const char = seg.text;
            if (/[\u4e00-\u9fa5]/.test(char)) {
                const py = window.pinyinPro ? window.pinyinPro.pinyin(char) : '';
                html += `<ruby><span class="py-char-span" data-char="${char}">${char}</span><rt>${py}</rt></ruby>`;
            } else {
                html += `<span class="punct-span">${char}</span>`;
            }
        }
    });

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
function openModal(char, autoQuiz = false) {
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

            if (autoQuiz) {
                // Interactive quiz writing mode for cloze practice
                writer.quiz({
                    onComplete: (summary) => {
                        speakChinese("写得太棒啦！", 0.9);
                        document.querySelectorAll(`.masked-hanzi-box[data-char="${char}"]`).forEach(box => {
                            box.textContent = char;
                            box.classList.add('revealed');
                        });
                    }
                });
            } else {
                writer.animateCharacter();
            }
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
    if (e.target === syncModal) syncModal.classList.add('hidden');
    if (e.target === storyModal) {
        stopStoryPlayback();
        storyModal.classList.add('hidden');
    }
    if (e.target === pinyinQuizModal) pinyinQuizModal.classList.add('hidden');
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

// ================= Pinyin 4-Choice Quiz Modal Logic =================
function openPinyinQuizModal(char, correctPinyin, onRevealed) {
    if (!pinyinQuizModal) return;
    pinyinQuizTargetChar.textContent = char;
    pinyinQuizModal.classList.remove('hidden');

    const options = generatePinyinDistractors(char, correctPinyin);
    pinyinQuizOptions.innerHTML = options.map(opt => `
        <button class="pinyin-quiz-opt" data-val="${opt}">${opt}</button>
    `).join('');

    const optBtns = pinyinQuizOptions.querySelectorAll('.pinyin-quiz-opt');
    optBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            optBtns.forEach(b => b.disabled = true);
            const val = btn.dataset.val;
            if (val === correctPinyin) {
                btn.classList.add('correct');
                speakChinese("答对了，真棒！" + char + "，" + correctPinyin, 0.85);
                if (onRevealed) onRevealed();
                setTimeout(() => {
                    pinyinQuizModal.classList.add('hidden');
                }, 1100);
            } else {
                btn.classList.add('wrong');
                optBtns.forEach(b => {
                    if (b.dataset.val === correctPinyin) b.classList.add('correct');
                });
                speakChinese("再想想哦，这个字读 " + correctPinyin, 0.85);
                if (onRevealed) onRevealed();
                setTimeout(() => {
                    pinyinQuizModal.classList.add('hidden');
                }, 1600);
            }
        });
    });

    if (btnPinyinQuizReveal) {
        btnPinyinQuizReveal.onclick = () => {
            optBtns.forEach(b => {
                b.disabled = true;
                if (b.dataset.val === correctPinyin) b.classList.add('correct');
            });
            speakChinese(char + "，读作 " + correctPinyin, 0.8);
            if (onRevealed) onRevealed();
            setTimeout(() => {
                pinyinQuizModal.classList.add('hidden');
            }, 1200);
        };
    }
}

if (closePinyinQuizBtn) {
    closePinyinQuizBtn.onclick = () => pinyinQuizModal.classList.add('hidden');
}

// ================= Focus Words Mini Story Modal Logic =================
function openStoryModal(lessonIndex) {
    if (!storyModal) return;
    storyModal.classList.remove('hidden');
    stopPlayback();
    stopStoryPlayback();

    const words = getFocusWords(lessonIndex);
    if (storyFocusWordsChips) {
        storyFocusWordsChips.innerHTML = words.length > 0 ?
            words.map(w => `<span class="focus-word-chip" style="font-size:0.85rem; padding:0.2rem 0.5rem;">${w}</span>`).join(' ') :
            '<span style="color:#90A4AE; font-size:0.85rem;">(本课暂未圈选生词，可点击【自由创编】直接撰写小故事)</span>';
    }

    currentStoryText = getCustomStory(lessonIndex);
    if (!currentStoryText) {
        currentStoryText = generateDynamicStory(lessonIndex, words);
    }

    storyClozeMode = 'normal';
    updateStoryClozeButtons();
    renderStoryContent(lessonIndex);
}

function updateStoryClozeButtons() {
    ['normal', 'hide-pinyin', 'hide-hanzi'].forEach(mode => {
        const btn = document.getElementById(`story-mode-${mode}`);
        if (btn) {
            btn.classList.toggle('active', storyClozeMode === mode);
        }
    });
}

function renderStoryContent(lessonIndex) {
    if (!storyArticleBody) return;
    const words = getFocusWords(lessonIndex);

    renderArticleBody(storyArticleBody, currentStoryText, {
        lessonIndex: lessonIndex,
        clozeMode: storyClozeMode,
        focusWords: words
    });
}

function startStoryLead() {
    stopStoryPlayback();
    const sentences = extractSentences(currentStoryText);
    if (sentences.length === 0) return;

    storyPlaybackState.sentences = sentences;
    storyPlaybackState.index = 0;
    storyPlaybackState.isPlaying = true;

    playNextStorySentence();
}

function playNextStorySentence() {
    if (!storyPlaybackState.isPlaying) return;
    if (storyPlaybackState.index >= storyPlaybackState.sentences.length) {
        stopStoryPlayback();
        speakChinese("小故事读完啦，真棒！", 0.9);
        return;
    }

    const idx = storyPlaybackState.index;
    const sent = storyPlaybackState.sentences[idx];

    // Highlight sentence in story
    if (storyArticleBody) {
        storyArticleBody.querySelectorAll('.article-sentence').forEach(el => {
            el.classList.toggle('active-sentence', parseInt(el.dataset.sentenceIndex) === idx);
        });
    }

    speakChinese(sent, 0.8, () => {
        if (!storyPlaybackState.isPlaying) return;
        setTimeout(() => {
            storyPlaybackState.index++;
            playNextStorySentence();
        }, 500);
    });
}

function stopStoryPlayback() {
    storyPlaybackState.isPlaying = false;
    storyPlaybackState.index = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (storyArticleBody) {
        storyArticleBody.querySelectorAll('.article-sentence.active-sentence').forEach(el => {
            el.classList.remove('active-sentence');
        });
    }
}

// Story Cloze mode buttons
['normal', 'hide-pinyin', 'hide-hanzi'].forEach(mode => {
    const btn = document.getElementById(`story-mode-${mode}`);
    if (btn) {
        btn.onclick = () => {
            storyClozeMode = mode;
            updateStoryClozeButtons();
            renderStoryContent(currentLessonIndex);
        };
    }
});

if (btnStoryLead) btnStoryLead.onclick = startStoryLead;
if (btnStoryStop) btnStoryStop.onclick = stopStoryPlayback;

if (btnAiGenStory) {
    btnAiGenStory.onclick = () => {
        const words = getFocusWords(currentLessonIndex);
        currentStoryText = generateDynamicStory(currentLessonIndex, words);
        saveCustomStory(currentLessonIndex, currentStoryText);
        if (storyEditorContainer) storyEditorContainer.style.display = 'none';
        renderStoryContent(currentLessonIndex);
    };
}

if (btnEditStoryText) {
    btnEditStoryText.onclick = () => {
        if (storyEditorContainer) {
            storyEditorContainer.style.display = 'block';
            storyEditorTextarea.value = currentStoryText;
            storyEditorTextarea.focus();
        }
    };
}

if (btnCancelEditStory) {
    btnCancelEditStory.onclick = () => {
        if (storyEditorContainer) storyEditorContainer.style.display = 'none';
    };
}

if (btnSaveCustomStory) {
    btnSaveCustomStory.onclick = () => {
        const updated = (storyEditorTextarea.value || '').trim();
        if (updated) {
            currentStoryText = updated;
            saveCustomStory(currentLessonIndex, updated);
            if (storyEditorContainer) storyEditorContainer.style.display = 'none';
            renderStoryContent(currentLessonIndex);
        }
    };
}

if (closeStoryModalBtn) {
    closeStoryModalBtn.onclick = () => {
        stopStoryPlayback();
        storyModal.classList.add('hidden');
    };
}

// ================= QR Code Sync Modal Logic =================
function openSyncModal(lessonIndex) {
    if (!syncModal) return;
    syncModal.classList.remove('hidden');

    const words = getFocusWords(lessonIndex);
    const story = getCustomStory(lessonIndex);
    const lesson = lessonData[lessonIndex];

    const payload = {
        t: 'fs',
        v: 1,
        l: lessonIndex,
        w: words,
        s: story
    };

    const b64 = encodeSyncData(payload);
    const syncUrl = `${window.location.origin}${window.location.pathname}?sync=${b64}`;

    if (syncQrcodeContainer) {
        syncQrcodeContainer.innerHTML = '';
        if (window.QRCode) {
            new QRCode(syncQrcodeContainer, {
                text: syncUrl,
                width: 200,
                height: 200,
                colorDark: "#263238",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }

    if (syncSummaryBadge) {
        syncSummaryBadge.textContent = `第 ${lessonIndex + 1} 课《${lesson.title}》· 已选 ${words.length} 个重点词`;
    }

    if (btnCopySyncLink) {
        btnCopySyncLink.onclick = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(syncUrl).then(() => {
                    btnCopySyncLink.textContent = "✅ 已复制同步链接！";
                    setTimeout(() => { btnCopySyncLink.textContent = "📋 复制同步链接"; }, 2000);
                }).catch(() => fallbackCopy(syncUrl));
            } else {
                fallbackCopy(syncUrl);
            }
        };
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        if (btnCopySyncLink) {
            btnCopySyncLink.textContent = "✅ 已复制同步链接！";
            setTimeout(() => { btnCopySyncLink.textContent = "📋 复制同步链接"; }, 2000);
        }
    } catch(e) {
        alert("请手动复制链接：\n" + text);
    }
    document.body.removeChild(ta);
}

if (closeSyncModalBtn) closeSyncModalBtn.onclick = () => syncModal.classList.add('hidden');
if (btnCloseSync) btnCloseSync.onclick = () => syncModal.classList.add('hidden');

// ================= Floating Text Selection Handler (划选词语加入重点) =================
function setupTextSelectionHandler() {
    function handleSelection() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
            if (selectionPopover) selectionPopover.style.display = 'none';
            return;
        }

        const selectedStr = sel.toString().trim();
        // Only trigger if text contains at least one Chinese character and <= 8 chars
        if (!/[\u4e00-\u9fa5]/.test(selectedStr) || selectedStr.length > 8) {
            if (selectionPopover) selectionPopover.style.display = 'none';
            return;
        }

        const range = sel.getRangeAt(0);
        const articleBody = document.getElementById('article-body');
        if (!articleBody || !articleBody.contains(range.commonAncestorContainer)) {
            if (selectionPopover) selectionPopover.style.display = 'none';
            return;
        }

        selectedTextToFocus = selectedStr;
        const rect = range.getBoundingClientRect();
        if (selectionPopover) {
            selectionPopover.innerHTML = `➕ 加入重点: <b>${selectedStr}</b>`;
            selectionPopover.style.display = 'flex';
            selectionPopover.style.left = `${Math.max(10, rect.left + window.scrollX + (rect.width / 2) - 60)}px`;
            selectionPopover.style.top = `${rect.top + window.scrollY - 38}px`;
        }
    }

    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', () => setTimeout(handleSelection, 120));

    if (selectionPopover) {
        selectionPopover.addEventListener('mousedown', (e) => {
            e.preventDefault(); // prevent clearing selection
        });
        selectionPopover.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedTextToFocus && currentLessonIndex >= 0) {
                addFocusWord(currentLessonIndex, selectedTextToFocus);
                window.getSelection()?.removeAllRanges();
                selectionPopover.style.display = 'none';
                renderLessonView(currentLessonIndex);
            }
        });
    }
}

// ================= Initial Load & URL Sync Check =================
setupTextSelectionHandler();
const hasSynced = checkUrlSync();
if (!hasSynced) {
    renderLessonList();
}
