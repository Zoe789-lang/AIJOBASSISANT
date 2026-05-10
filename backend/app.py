"""
Job Assistant - AI求职助手 后端服务
基于 Flask + DeepSeek API
"""

import os
import re
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
from PyPDF2 import PdfReader
import docx

# 加载环境变量
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')

app = Flask(
    __name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)
app.config['UPLOAD_FOLDER'] = UPLOAD_DIR
CORS(app)

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ==================== 加载 Skill 文件 ====================

SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'skills')

def load_skill(skill_filename):
    """从 skills 目录加载 Skill 文件内容"""
    filepath = os.path.join(SKILLS_DIR, skill_filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        print(f"  ✅ 已加载 Skill: {skill_filename}")
        return content
    else:
        print(f"  ⚠️ 未找到 Skill 文件: {skill_filename}，使用默认提示词")
        return None

# 启动时加载各功能的 Skill
SKILL_JOB_ANALYSIS = load_skill('招聘简章分析-SKILL.md')
SKILL_ACHIEVEMENT = load_skill('个人成就分析-SKILL.md')
SKILL_RESUME = load_skill('简历投递建议-SKILL.md')


def call_deepseek(system_prompt, user_content):
    """调用 DeepSeek API"""
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"❌ AI 分析出错：{str(e)}"


def extract_text_from_file(filepath):
    """从上传的文件中提取文本内容"""
    ext = filepath.lower().split('.')[-1]
    text = ""

    if ext == 'pdf':
        try:
            reader = PdfReader(filepath)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e:
            return None, f"PDF 解析失败：{str(e)}"
    elif ext in ('docx', 'doc'):
        try:
            doc = docx.Document(filepath)
            for para in doc.paragraphs:
                text += para.text + "\n"
        except Exception as e:
            return None, f"Word 文档解析失败：{str(e)}"
    elif ext == 'txt':
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception as e:
            return None, f"文本文件读取失败：{str(e)}"
    else:
        return None, "不支持的文件格式，请上传 PDF、Word 或 TXT 文件"

    return text.strip(), None


# ==================== 页面路由 ====================

@app.route('/')
def index():
    return render_template('index.html')


# ==================== API 路由 ====================

@app.route('/api/analyze-job', methods=['POST'])
def analyze_job():
    """功能一：分析招聘简章"""
    data = request.get_json()
    job_desc = data.get('job_description', '').strip()

    if not job_desc:
        return jsonify({'error': '请输入招聘简章内容'}), 400

    # 使用 SKILL.md 作为系统提示词，如果文件不存在则使用默认提示词
    if SKILL_JOB_ANALYSIS:
        system_prompt = SKILL_JOB_ANALYSIS
    else:
        system_prompt = "你是一位资深职业规划顾问。请分析以下招聘简章，给出详细的岗位解读和求职建议。"

    result = call_deepseek(system_prompt, f"请分析以下招聘简章：\n\n{job_desc}")
    return jsonify({'result': result})


@app.route('/api/analyze-achievements', methods=['POST'])
def analyze_achievements():
    """功能二：分析个人成就"""
    data = request.get_json()
    achievements = data.get('achievements', '').strip()

    if not achievements:
        return jsonify({'error': '请输入你的成就事件'}), 400

    # 使用 SKILL.md 作为系统提示词，如果文件不存在则使用默认提示词
    if SKILL_ACHIEVEMENT:
        system_prompt = SKILL_ACHIEVEMENT
    else:
        system_prompt = "你是一位资深职业规划师。请分析用户分享的成就事件，识别其高频工作任务和核心技能，给出职业方向建议。"

    result = call_deepseek(system_prompt, f"以下是我觉得有成就感的十件事情：\n\n{achievements}")
    return jsonify({'result': result})


@app.route('/api/resume-advice', methods=['POST'])
def resume_advice():
    """功能三：简历投递建议"""
    job_position = request.form.get('job_position', '').strip()
    resume_file = request.files.get('resume')

    if not job_position:
        return jsonify({'error': '请输入目标岗位'}), 400
    if not resume_file:
        return jsonify({'error': '请上传简历文件'}), 400

    # 保存并解析简历
    filename = resume_file.filename
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    resume_file.save(filepath)

    resume_text, error = extract_text_from_file(filepath)
    if error:
        return jsonify({'error': error}), 400

    if not resume_text or len(resume_text) < 20:
        return jsonify({'error': '简历内容太少，请检查文件是否正确'}), 400

    system_prompt = """你是一位资深的简历优化专家和求职顾问。请根据用户上传的简历内容和目标岗位，给出专业的投递建议，按以下结构返回：

## 📋 简历整体评估
（对简历的整体质量进行评分和评价，满分 100 分）

## ✅ 简历亮点
（列出简历中 3-5 个突出的亮点）

## ⚠️ 需要改进的地方
（列出 3-5 个需要优化的问题，并给出具体修改建议）

## 🎯 针对该岗位的匹配度分析
（分析简历与目标岗位的匹配程度，指出匹配和不匹配的地方）

## 📝 具体修改建议
（给出 3-5 条可以直接操作的简历修改建议）

## 💼 面试准备建议
（基于简历和岗位，给出 2-3 条面试准备建议）

请用 Markdown 格式输出，语言专业、鼓励、有建设性。"""

    result = call_deepseek(
        system_prompt,
        f"目标岗位：{job_position}\n\n我的简历内容如下：\n\n{resume_text}"
    )
    return jsonify({'result': result})


# ==================== 启动 ====================

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 AI求职助手 启动中...")
    print("📍 访问地址: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
