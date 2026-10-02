const lessonData = window.lessonData;

const mainContent = document.getElementById('main-content');
const modal = document.getElementById('char-modal');
const closeBtn = document.querySelector('.close-btn');
const btnAnimate = document.getElementById('btn-animate');
const btnQuiz = document.getElementById('btn-quiz');
const btnRestart = document.getElementById('btn-restart');
const btnAudio = document.getElementById('btn-audio');
const btnSpell = document.getElementById('btn-spell');
const characterDisplay = document.getElementById('character-display');
const modalPinyin = document.getElementById('modal-pinyin');
const modalToneBadge = document.getElementById('modal-tone-badge');
const modalPhonicsBox = document.getElementById('modal-phonics-box');
const strokeCountBadge = document.getElementById('stroke-count-badge');
const strokeStepsContainer = document.getElementById('stroke-steps-container');

const navLearn = document.getElementById('nav-learn');
const navCustom = document.getElementById('nav-custom');
const navQuiz = document.getElementById('nav-quiz');

let writer = null;
let currentCharacter = '';
let currentUtterance = null;
let voicesList = [];

// Load voices cleanly
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

    let spellText = '';
    if (isZhengTi) {
        spellText = `${char}，是整体认读音节，不用拼，直接读：${char}！`;
    } else if (info.initial) {
        spellText = `声母 ${initialName}，韵母 ${info.final}，拼读：${initialName}——${info.final}——${char}！`;
    } else {
        spellText = `${char}，单韵母直接读：${char}！`;
    }

    return {
        pinyin: info.pinyin,
        initial: info.initial,
        initialName,
        final: info.final,
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
    mainContent.innerHTML = `
        <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
            <h2 style="font-family: 'ZCOOL KuaiLe', cursive; color: var(--primary); font-size: 1.6rem;">📚 部编版二年级(下) 课文与生字表</h2>
            <span style="color: var(--gray); font-size: 0.95rem;">点击课文卡片，进入课文领读、点读与写字表笔顺分解</span>
        </div>
        <div class="lesson-grid" id="lesson-grid"></div>
    `;
    const grid = document.getElementById('lesson-grid');

    lessonData.forEach((lesson, index) => {
        const card = document.createElement('div');
        card.className = 'lesson-card';
        const title = lesson.title;
        const textSnippet = lesson.text ? lesson.text.replace(/\n+/g, ' ').slice(0, 50) + '...' : '';

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
}

// ================= Lesson Detail View =================
function renderLessonView(lessonIndex) {
    stopPlayback();
    const lesson = lessonData[lessonIndex];

    // Split text into sentences for lead reading
    const sentences = extractSentences(lesson.text || '');
    currentPlaybackState.sentences = sentences;
    currentPlaybackState.sentenceIndex = 0;

    mainContent.innerHTML = `
        <div class="lesson-detail-header">
            <button class="back-btn" id="back-list">⬅ 返回课程列表</button>
            <div style="display: flex; gap: 0.6rem;">
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
                <span style="font-size: 0.85rem; color: #78909C;">💡 点击课文中任意汉字可点读发音及查看笔顺分解</span>
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
    renderArticleBody(document.getElementById('article-body'), lesson.text);

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

    // Event listeners
    document.getElementById('back-list').addEventListener('click', () => {
        stopPlayback();
        renderLessonList();
    });
    document.getElementById('start-lesson-quiz').addEventListener('click', () => {
        stopPlayback();
        startQuiz(lesson.chars, lessonIndex);
    });

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

// ================= Sentence Extraction & Pinyin Body Rendering =================
function extractSentences(text) {
    if (!text) return [];
    // Split by punctuation and linebreaks, keep sentences natural
    const rawLines = text.split('\n');
    const sentences = [];
    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        // Match sentence segments
        const parts = trimmed.match(/[^。！？!?；;]+[。！？!?；;]?/g);
        if (parts && parts.length > 0) {
            parts.forEach(p => {
                if (p.trim()) sentences.push(p.trim());
            });
        } else {
            sentences.push(trimmed);
        }
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

            // Generate characters with Ruby
            sentSpan.innerHTML = generateRubyHtmlForSentence(sent);

            // Add click-to-read and inspect character
            sentSpan.querySelectorAll('.py-char-span').forEach(charSpan => {
                const char = charSpan.dataset.char;
                charSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    speakChinese(char, 0.75);
                    openModal(char);
                });
            });

            // Click sentence to jump reading to this sentence
            sentSpan.addEventListener('click', () => {
                currentPlaybackState.sentenceIndex = sentIndex;
                highlightSentence(sentIndex);
                const sText = currentPlaybackState.sentences[sentIndex] || sent;
                speakChinese(sText, currentPlaybackState.speed);
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

    // Speech Recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            voiceBtn.classList.add('listening');
            micLabel.textContent = "正在倾听，请说话...";
            micIcon.textContent = "🔴";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                inputArea.value = (inputArea.value + ' ' + transcript).trim();
                triggerCustomAnalysis();
            }
        };

        recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e);
            resetVoiceBtn();
        };

        recognition.onend = () => {
            resetVoiceBtn();
        };
    }

    function resetVoiceBtn() {
        isListening = false;
        voiceBtn.classList.remove('listening');
        micLabel.textContent = "孩子语音输入";
        micIcon.textContent = "🎤";
    }

    voiceBtn.addEventListener('click', () => {
        if (!SpeechRecognition) {
            alert("您的浏览器暂不支持麦克风语音听写。请直接在输入框打字或粘贴内容~");
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (err) {
                console.error("Recognition start failed:", err);
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

// ================= Character & Phonics & Stroke Order Modal =================
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
                <span style="font-size:0.85rem; color:#888;">(${phonics.initialName})</span>
            </div>
            <span class="phonics-equal">+</span>
            <div class="phonics-part">
                <span class="phonics-label">韵母:</span>
                <span class="phonics-val">${phonics.final}</span>
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
                <span style="font-size:0.85rem; color:#888;">(直接读音)</span>
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

    // 2. Hanzi Writer Interactive Canvas
    characterDisplay.innerHTML = '';
    writer = null;

    setTimeout(() => {
        try {
            writer = HanziWriter.create('character-display', char, {
                width: 200,
                height: 200,
                padding: 5,
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

    // 3. Static Step-by-Step Stroke Decomposition Strip (For copying on paper!)
    renderStrokeSequence(char);

    // Speak character once on open
    speakChinese(char, 0.75);
}

function closeModal() {
    modal.classList.add('hidden');
    writer = null;
}

closeBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

btnAnimate.addEventListener('click', () => {
    if (writer) writer.animateCharacter();
});

btnQuiz.addEventListener('click', () => {
    if (writer) writer.quiz();
});

btnRestart.addEventListener('click', () => {
    if (writer) {
        writer.hideCharacter();
        writer.animateCharacter();
    }
});

// Render Step-by-step SVG strokes for paper copybook reference
async function renderStrokeSequence(char) {
    strokeStepsContainer.innerHTML = '<span style="color:#90A4AE; font-size:0.9rem;">正在生成笔顺分解...</span>';
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
        strokeStepsContainer.innerHTML = '<span style="color:#90A4AE; font-size:0.9rem;">(暂无此字分步分解图)</span>';
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
        svg.setAttribute('width', '44');
        svg.setAttribute('height', '44');

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
        stepNum.textContent = `第${i + 1}画`;
        stepCard.appendChild(stepNum);

        strokeStepsContainer.appendChild(stepCard);
    }
}

// ================= Quiz Logic (Preserved) =================
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
