const lessonData = window.lessonData;

const app = document.getElementById('app');
const mainContent = document.getElementById('main-content');
const modal = document.getElementById('char-modal');
const closeBtn = document.querySelector('.close-btn');
const btnAnimate = document.getElementById('btn-animate');
const btnAudio = document.getElementById('btn-audio');
const characterDisplay = document.getElementById('character-display');
const modalPinyin = document.getElementById('modal-pinyin');
const navLearn = document.getElementById('nav-learn');
const navQuiz = document.getElementById('nav-quiz');

let writer = null;
let currentCharacter = '';

// --- Navigation ---

navLearn.addEventListener('click', () => {
    setActiveNav('learn');
    renderLessonList();
});

navQuiz.addEventListener('click', () => {
    setActiveNav('quiz');
    startQuiz();
});

function setActiveNav(tab) {
    if (tab === 'learn') {
        navLearn.classList.add('active');
        navQuiz.classList.remove('active');
    } else {
        navQuiz.classList.add('active');
        navLearn.classList.remove('active');
    }
}

// --- List View ---

function renderLessonList() {
    mainContent.innerHTML = '<div class="lesson-grid" id="lesson-grid"></div>';
    const grid = document.getElementById('lesson-grid');

    lessonData.forEach((lesson, index) => {
        const card = document.createElement('div');
        card.className = 'lesson-card';
        // Extract lesson number usually matching "1", "2", etc.
        const title = lesson.title;
        const chars = lesson.chars.split('').slice(0, 8).join(' '); // Preview up to 8 chars

        card.innerHTML = `
            <div class="lesson-title">${title}</div>
            <div class="preview-chars">
                ${lesson.chars.split('').map(c => `<span class="char-chip">${c}</span>`).join('')}
            </div>
        `;
        card.addEventListener('click', () => renderLessonView(index));
        grid.appendChild(card);
    });
}

// --- Lesson View ---

function renderLessonView(lessonIndex) {
    const lesson = lessonData[lessonIndex];

    // Header with Back Button and Quiz Button
    mainContent.innerHTML = `
        <div class="lesson-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <button class="back-btn" id="back-list" style="margin-bottom:0;">⬅ 返回列表</button>
            <button class="action-btn" id="start-lesson-quiz" style="background:var(--secondary); color:#fff; border:none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-family: 'ZCOOL KuaiLe', cursive;">📝 本课小测验</button>
        </div>
        <h2 style="margin-bottom: 1rem; color: var(--primary); font-family: 'ZCOOL KuaiLe', cursive; text-align: center;">${lesson.title}</h2>
        <div class="char-grid" id="char-grid"></div>
    `;

    document.getElementById('back-list').addEventListener('click', renderLessonList);
    document.getElementById('start-lesson-quiz').addEventListener('click', () => startQuiz(lesson.chars, lessonIndex));

    const charGrid = document.getElementById('char-grid');
    const chars = lesson.chars.split('');

    chars.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.textContent = char;
        card.addEventListener('click', () => openModal(char));
        charGrid.appendChild(card);
    });
}


// --- Modal & Character Logic ---

function openModal(char) {
    currentCharacter = char;
    modal.classList.remove('hidden');

    // Get Pinyin
    // pinyin-pro usage: pinyinPro.pinyin('汉') -> 'hàn'
    const pinyin = window.pinyinPro ? window.pinyinPro.pinyin(char) : 'Unknown';
    modalPinyin.textContent = pinyin;

    // Clear previous writer
    characterDisplay.innerHTML = '';

    // Initialize Hanzi Writer
    // We use a timeout to ensure element is visible before rendering
    setTimeout(() => {
        writer = HanziWriter.create('character-display', char, {
            width: 200,
            height: 200,
            padding: 5,
            showOutline: true,
            strokeAnimationSpeed: 1, // 1x speed
            delayBetweenStrokes: 100, // ms
            radicalColor: '#FF6B6B',
            // Try to load from local 'data/' folder first if offline
            charDataLoader: (char, onComplete) => {
                fetch(`data/${char}.json`)
                    .then(res => res.json())
                    .then(onComplete)
                    .catch(() => {
                        // Fallback to CDN if local fails (e.g. online)
                        console.log('Local data not found, trying CDN...');
                        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`)
                            .then(res => res.json())
                            .then(onComplete);
                    });
            }
        });
        // Auto-animate once on open? Maybe better to let user click.
        // writer.animateCharacter(); 
    }, 100);


    // Auto-play audio on open
    playAudio(char);
}

function closeModal() {
    modal.classList.add('hidden');
    writer = null;
}

closeBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Controls
btnAnimate.addEventListener('click', () => {
    if (writer) {
        writer.animateCharacter();
    }
});

btnAudio.addEventListener('click', () => {
    playAudio(currentCharacter);
});

function playAudio(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8; // Slightly slower for kids
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Your browser does not support text-to-speech.");
    }
}

// --- Quiz Logic ---

// scopeChars: String of characters to test on. If null, use all.
// returnIndex: Index of the lesson to return to, or null for main list.
function startQuiz(scopeChars = null, returnIndex = null) {
    // Generate pool
    let pool = scopeChars;
    if (!pool) {
        // Global pool
        pool = lessonData.map(l => l.chars).join('');
    }

    // Pick a random char from the pool
    const correctChar = pool[Math.floor(Math.random() * pool.length)];
    const correctPinyin = window.pinyinPro.pinyin(correctChar);

    // Generate distractors (3 random other pinyins)
    const options = new Set();
    options.add(correctPinyin);

    // 1. Try to fill from the same pool first
    let attempts = 0;
    while (options.size < 4 && attempts < 20) {
        const randomChar = pool[Math.floor(Math.random() * pool.length)];
        const p = window.pinyinPro.pinyin(randomChar);
        if (p !== correctPinyin) options.add(p);
        attempts++;
    }

    // 2. If pool is too small (e.g. only 2 words in lesson), fill from global
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

    // Add click handlers
    optionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Disable all buttons
            optionBtns.forEach(b => b.disabled = true);

            const val = e.target.dataset.val;
            if (val === correctPinyin) {
                e.target.classList.add('correct');
                feedback.textContent = "🎉 答对了！真棒！";
                feedback.style.color = "#4ECDC4";
                playAudio("答对了");
            } else {
                e.target.classList.add('wrong');
                // Highlight correct one
                optionBtns.forEach(b => {
                    if (b.dataset.val === correctPinyin) b.classList.add('correct');
                });
                feedback.textContent = "❌ 答错了，正确的是 " + correctPinyin;
                feedback.style.color = "#FF6B6B";
                playAudio("答错了");
            }
            nextBtn.style.display = 'inline-block';
        });
    });

    nextBtn.addEventListener('click', () => startQuiz(scopeChars, returnIndex));
}

// Initial Load
renderLessonList();
