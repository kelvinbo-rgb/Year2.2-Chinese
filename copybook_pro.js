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

            // 创建大盒子
            const masterBox = document.createElement('div');
            masterBox.className = 'master-box';
            entry.appendChild(masterBox);

            // 2. 笔顺分解行 (放入大盒子顶部)
            const strokeRow = document.createElement('div');
            strokeRow.className = 'stroke-order-row';
            masterBox.appendChild(strokeRow);

            // 3. 练习区域 (放入大盒子主体)
            const practiceContainer = document.createElement('div');
            practiceContainer.className = 'practice-container';
            masterBox.appendChild(practiceContainer);
            
            const py = pinyinPro.pinyin(char);
            for (let i = 0; i < 13; i++) {
                const column = document.createElement('div');
                column.className = 'practice-column';

                const pyBox = document.createElement('div');
                pyBox.className = 'py-box' + (i === 0 ? '' : (i < 6 ? ' trace' : ' empty'));
                pyBox.textContent = py;
                column.appendChild(pyBox);

                const chBox = document.createElement('div');
                chBox.className = 'ch-box' + (i === 0 ? '' : (i < 6 ? ' trace' : ' empty'));
                const span = document.createElement('span');
                span.textContent = char;
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
        const steps = Math.min(strokes.length, 24); // 增加上限以适配较多笔画

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
