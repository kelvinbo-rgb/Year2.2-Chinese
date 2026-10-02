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

            const strokeRow = document.createElement('div');
            strokeRow.className = 'stroke-order-row';
            masterBox.appendChild(strokeRow);

            const practiceContainer = document.createElement('div');
            practiceContainer.className = 'practice-container';
            masterBox.appendChild(practiceContainer);
            
            const py = pinyinPro.pinyin(char);
            for (let i = 0; i < 13; i++) {
                const column = document.createElement('div');
                column.className = 'practice-column';

                const pyBox = document.createElement('div');
                // 检测长拼音
                if (py.length > 4) {
                    pyBox.classList.add('long-pinyin');
                }

                const pySpan = document.createElement('span');
                pySpan.textContent = py;
                pyBox.appendChild(pySpan);

                if (i === 0) {
                    pyBox.classList.add('py-box');
                } else if (i < 6) {
                    pyBox.classList.add('py-box', 'trace');
                } else {
                    pyBox.classList.add('py-box', 'empty');
                    pySpan.style.visibility = 'hidden';
                }
                column.appendChild(pyBox);

                const chBox = document.createElement('div');
                const span = document.createElement('span');
                span.textContent = char;
                if (i === 0) {
                    chBox.className = 'ch-box';
                } else if (i < 6) {
                    chBox.className = 'ch-box trace';
                } else {
                    chBox.className = 'ch-box empty';
                    span.style.visibility = 'hidden';
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
    // 优先尝试从本地加载，失败后再尝试 CDN
    const charDataUrl = `./data/${char}.json`;
    const cdnUrl = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`;
    const altCdnUrl = `https://unpkg.com/hanzi-writer-data@2.0/${char}.json`;

    async function fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Fetch failed');
        return await response.json();
    }

    try {
        let data;
        try {
            data = await fetchData(charDataUrl);
        } catch (e) {
            try {
                data = await fetchData(cdnUrl);
            } catch (e2) {
                data = await fetchData(altCdnUrl);
            }
        }

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
            // HanziWriter 坐标系修正：Y 轴翻转，平移补偿
            g.setAttribute('transform', 'scale(1, -1) translate(0, -900)');
            svg.appendChild(g);

            // 背景底色 (所有笔画)
            strokes.forEach(pathData => {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', pathData);
                p.setAttribute('fill', 'var(--trace-gray)'); 
                g.appendChild(p);
            });

            // 笔顺进度 (当前笔画为红色，已完成笔画为黑色)
            for (let j = 0; j <= i; j++) {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', strokes[j]);
                p.setAttribute('fill', j === i ? 'var(--stroke-red)' : 'var(--char-black)'); 
                g.appendChild(p);
            }
            stepBox.appendChild(svg);
        }
    } catch (e) {
        console.error("笔顺渲染失败:", char, e);
    }
}

renderProCopybook();
