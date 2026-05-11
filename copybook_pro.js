const lessonData = window.lessonData;
const printArea = document.getElementById('print-area');

async function renderProCopybook() {
    for (const lesson of lessonData) {
        // 1. 课程标题
        const header = document.createElement('h2');
        header.className = 'lesson-header';
        header.textContent = lesson.title;
        printArea.appendChild(header);

        const chars = lesson.chars.split('');
        for (const char of chars) {
            const entry = document.createElement('div');
            entry.className = 'char-entry';

            const masterBox = document.createElement('div');
            masterBox.className = 'master-box';
            entry.appendChild(masterBox);

            // 2. 笔顺分解行
            const strokeRow = document.createElement('div');
            strokeRow.className = 'stroke-order-row';
            masterBox.appendChild(strokeRow);

            // 3. 练习区域
            const practiceContainer = document.createElement('div');
            practiceContainer.className = 'practice-container';
            masterBox.appendChild(practiceContainer);
            
            const py = pinyinPro.pinyin(char);
            for (let i = 0; i < 13; i++) {
                const column = document.createElement('div');
                column.className = 'practice-column';

                const pyBox = document.createElement('div');
                // 拼音逻辑：1个黑，5个灰(trace)，其余空白(empty)
                if (i === 0) {
                    pyBox.className = 'py-box';
                    pyBox.textContent = py;
                } else if (i < 6) {
                    pyBox.className = 'py-box trace';
                    pyBox.textContent = py;
                } else {
                    pyBox.className = 'py-box empty';
                    pyBox.textContent = ''; // 空白格不填充文字
                }
                column.appendChild(pyBox);

                const chBox = document.createElement('div');
                // 汉字逻辑：1个黑，5个灰(trace)，其余空白(empty)
                const span = document.createElement('span');
                span.textContent = char;
                if (i === 0) {
                    chBox.className = 'ch-box';
                } else if (i < 6) {
                    chBox.className = 'ch-box trace';
                } else {
                    chBox.className = 'ch-box empty';
                    span.style.visibility = 'hidden'; // 空白格隐藏汉字
                }
                chBox.appendChild(span);
                column.appendChild(chBox);

                practiceContainer.appendChild(column);
            }
            
            printArea.appendChild(entry);

            // 渲染笔顺
            await drawStrokes(char, strokeRow);
        }
    }
}

async function drawStrokes(char, target) {
    try {
        const data = await HanziWriter.loadCharacterData(char);
        const strokes = data.strokes;
        const steps = Math.min(strokes.length, 24);

        for (let i = 0; i < steps; i++) {
            const stepBox = document.createElement('div');
            stepBox.className = 'step-box';
            target.appendChild(stepBox);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 1024 1024');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', 'scale(1, -1) translate(0, -900)');
            svg.appendChild(g);

            strokes.forEach(pathData => {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', pathData);
                p.setAttribute('fill', '#f5f5f5'); 
                g.appendChild(p);
            });

            for (let j = 0; j <= i; j++) {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', strokes[j]);
                p.setAttribute('fill', j === i ? '#ff0000' : '#333333'); 
                g.appendChild(p);
            }
            stepBox.appendChild(svg);
        }
    } catch (e) {
        console.error("笔顺加载失败:", char, e);
    }
}

renderProCopybook();
