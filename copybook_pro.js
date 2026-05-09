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
            const block = document.createElement('div');
            block.className = 'char-practice-block';

            // 2. 笔顺分解区域
            const stepsDiv = document.createElement('div');
            stepsDiv.className = 'stroke-order-steps';
            block.appendChild(stepsDiv);

            // 3. 练习行：将 13 个列组合起来
            const py = pinyinPro.pinyin(char);
            const practiceRow = document.createElement('div');
            practiceRow.className = 'practice-row';

            for (let i = 0; i < 13; i++) {
                const column = document.createElement('div');
                column.className = 'practice-column';

                // 拼音格
                const pyGrid = document.createElement('div');
                pyGrid.className = 'py-grid' + (i === 0 ? '' : (i < 6 ? ' trace' : ' empty'));
                pyGrid.textContent = py;
                column.appendChild(pyGrid);

                // 汉字格
                const chGrid = document.createElement('div');
                chGrid.className = 'tianzige' + (i === 0 ? '' : (i < 6 ? ' trace' : ' empty'));
                const span = document.createElement('span');
                span.textContent = char;
                chGrid.appendChild(span);
                column.appendChild(chGrid);

                practiceRow.appendChild(column);
            }
            block.appendChild(practiceRow);

            printArea.appendChild(block);

            // 渲染笔顺
            await drawStrokes(char, stepsDiv);
        }
    }

    // 4. 添加页码显示
    addPageNumbers();
}

async function drawStrokes(char, target) {
    try {
        const data = await HanziWriter.loadCharacterData(char);
        const strokes = data.strokes;
        const steps = Math.min(strokes.length, 16);

        for (let i = 0; i < steps; i++) {
            const stepBox = document.createElement('div');
            stepBox.className = 'step-box';
            target.appendChild(stepBox);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 1024 1024');
            svg.setAttribute('width', '28');
            svg.setAttribute('height', '28');
            
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

function addPageNumbers() {
    // 简单的页码方案：在末尾添加页脚提示
    const footer = document.createElement('div');
    footer.className = 'page-footer';
    // 在真正的打印中，我们将使用浏览器的打印功能或固定页脚
    footer.innerHTML = "提示：请在打印设置中勾选“页眉和页脚”以显示系统自动生成的页码。";
    document.body.appendChild(footer);
}

renderProCopybook();
