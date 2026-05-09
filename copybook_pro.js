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

            // 2. 笔顺分解区域 (SVG 动态生成)
            const stepsDiv = document.createElement('div');
            stepsDiv.className = 'stroke-order-steps';
            block.appendChild(stepsDiv);

            // 3. 拼音行 (标准四线格)
            const py = pinyinPro.pinyin(char);
            const pyRow = document.createElement('div');
            pyRow.className = 'py-row';
            for (let i = 0; i < 13; i++) {
                const cell = document.createElement('div');
                cell.className = 'py-grid' + (i === 0 ? '' : (i < 6 ? ' trace' : ' empty'));
                cell.textContent = py;
                pyRow.appendChild(cell);
            }
            block.appendChild(pyRow);

            // 4. 汉字行 (米字格)
            const chRow = document.createElement('div');
            chRow.className = 'ch-row';
            for (let i = 0; i < 13; i++) {
                const grid = document.createElement('div');
                grid.className = 'tianzige' + (i === 0 ? '' : (i < 6 ? ' trace' : ' empty'));
                const span = document.createElement('span');
                span.textContent = char;
                grid.appendChild(span);
                chRow.appendChild(grid);
            }
            block.appendChild(chRow);

            printArea.appendChild(block);

            // 核心：调用稳定版笔顺渲染
            await drawStrokes(char, stepsDiv);
        }
    }
}

/**
 * 稳定版笔顺渲染逻辑
 * 直接获取 SVG 路径数据并手动构建笔顺序列
 */
async function drawStrokes(char, target) {
    try {
        // 使用 HanziWriter 提供的静态加载方法获取数据
        const data = await HanziWriter.loadCharacterData(char);
        const strokes = data.strokes;
        
        // 步骤数量限制（适配行宽）
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
            // 翻转 Y 轴并平移以修正汉字数据的倒置坐标
            g.setAttribute('transform', 'scale(1, -1) translate(0, -900)');
            svg.appendChild(g);

            // 1. 渲染全字浅灰底色
            strokes.forEach(pathData => {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', pathData);
                p.setAttribute('fill', '#f5f5f5'); 
                g.appendChild(p);
            });

            // 2. 渲染已完成笔画 (黑色) 与 当前笔画 (红色)
            for (let j = 0; j <= i; j++) {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', strokes[j]);
                if (j === i) {
                    p.setAttribute('fill', '#ff0000'); // 当前笔画标红
                } else {
                    p.setAttribute('fill', '#333333'); // 已完成笔画标黑
                }
                g.appendChild(p);
            }

            stepBox.appendChild(svg);
        }
    } catch (e) {
        console.error("笔顺加载失败:", char, e);
    }
}

// 启动
renderProCopybook();
