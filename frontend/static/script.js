/**
 * AI求职助手 - 前端交互逻辑
 */

// ==================== Tab 切换 ====================

document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 切换内容
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// ==================== 文件上传 ====================

const fileUploadArea = document.getElementById('file-upload-area');
const fileInput = document.getElementById('resume-file');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadSuccess = document.getElementById('upload-success');
const fileNameSpan = document.getElementById('file-name');

fileUploadArea.addEventListener('click', () => fileInput.click());

fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.classList.add('dragover');
});

fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.classList.remove('dragover');
});

fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
    ];
    const allowedExts = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExts.includes(ext)) {
        showToast('不支持的文件格式，请上传 PDF、Word 或 TXT 文件', 'error');
        return;
    }

    fileNameSpan.textContent = file.name;
    uploadPlaceholder.classList.add('hidden');
    uploadSuccess.classList.remove('hidden');
}

function removeFile() {
    fileInput.value = '';
    uploadPlaceholder.classList.remove('hidden');
    uploadSuccess.classList.add('hidden');
}

// ==================== API 调用 ====================

async function analyzeJob() {
    const jobDesc = document.getElementById('job-description').value.trim();
    if (!jobDesc) {
        showToast('请先粘贴招聘简章内容', 'error');
        return;
    }

    showLoading();
    disableBtn('btn-analyze-job');

    try {
        const res = await fetch('/api/analyze-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_description: jobDesc })
        });
        const data = await res.json();

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            renderResult('result-job', 'result-job-content', data.result);
        }
    } catch (e) {
        showToast('网络请求失败，请检查后端服务是否启动', 'error');
    } finally {
        hideLoading();
        enableBtn('btn-analyze-job');
    }
}

async function analyzeAchievements() {
    const achievements = document.getElementById('achievements').value.trim();
    if (!achievements) {
        showToast('请先写下你有成就感的事情', 'error');
        return;
    }

    showLoading();
    disableBtn('btn-analyze-achieve');

    try {
        const res = await fetch('/api/analyze-achievements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ achievements: achievements })
        });
        const data = await res.json();

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            renderResult('result-achievement', 'result-achievement-content', data.result);
        }
    } catch (e) {
        showToast('网络请求失败，请检查后端服务是否启动', 'error');
    } finally {
        hideLoading();
        enableBtn('btn-analyze-achieve');
    }
}

async function getResumeAdvice() {
    const jobPosition = document.getElementById('job-position').value.trim();
    const fileInput = document.getElementById('resume-file');

    if (!jobPosition) {
        showToast('请输入目标岗位', 'error');
        return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('请上传简历文件', 'error');
        return;
    }

    showLoading();
    disableBtn('btn-resume-advice');

    try {
        const formData = new FormData();
        formData.append('job_position', jobPosition);
        formData.append('resume', fileInput.files[0]);

        const res = await fetch('/api/resume-advice', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            renderResult('result-resume', 'result-resume-content', data.result);
        }
    } catch (e) {
        showToast('网络请求失败，请检查后端服务是否启动', 'error');
    } finally {
        hideLoading();
        enableBtn('btn-resume-advice');
    }
}

// ==================== 工具函数 ====================

function renderResult(containerId, contentId, markdown) {
    const container = document.getElementById(containerId);
    const content = document.getElementById(contentId);
    content.innerHTML = renderMarkdown(markdown);
    container.classList.remove('hidden');

    // 滚动到结果区域
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * 简易 Markdown 渲染器
 */
function renderMarkdown(text) {
    if (!text) return '';

    // 先处理表格（在转义之前提取）
    let tables = [];
    text = text.replace(/(\|.+\|[\r\n]+\|[-\s|:]+\|[\r\n]+((\|.+\|[\r\n]*)+))/g, (match) => {
        tables.push(match);
        return `__TABLE_${tables.length - 1}__`;
    });

    let html = text
        // 转义 HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // 标题
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        // 粗体
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // 斜体
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // 行内代码
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // 无序列表
        .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
        // 有序列表
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // 引用
        .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
        // 分割线
        .replace(/^---$/gm, '<hr>')
        // 换行
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // 包裹列表项
    html = html.replace(/((?:<li>.*<\/li><br>?)+)/g, '<ul>$1</ul>');
    // 移除列表项后的 <br>
    html = html.replace(/<\/li><br>/g, '</li>');

    // 还原表格
    tables.forEach((table, i) => {
        const rows = table.trim().split('\n').filter(r => r.trim());
        let tableHtml = '<table>';
        rows.forEach((row, ri) => {
            if (ri === 1 && row.match(/^[\s|:-]+$/)) return; // 跳过分隔行
            const cells = row.split('|').filter(c => c.trim() !== '');
            const tag = ri === 0 ? 'th' : 'td';
            tableHtml += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        });
        tableHtml += '</table>';
        html = html.replace(`__TABLE_${i}__`, tableHtml);
    });

    return `<p>${html}</p>`;
}

function copyResult(contentId) {
    const content = document.getElementById(contentId);
    const text = content.innerText || content.textContent;

    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板 ✅', 'success');
    }).catch(() => {
        // fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板 ✅', 'success');
    });
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function disableBtn(id) {
    const btn = document.getElementById(id);
    btn.disabled = true;
}

function enableBtn(id) {
    const btn = document.getElementById(id);
    btn.disabled = false;
}

function showToast(message, type = 'success') {
    // 移除已有的 toast
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 触发动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
