#!/usr/bin/env python3
"""
修复story-flicks后端的依赖问题
解决 ModuleNotFoundError: No module named 'pkg_resources'
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """运行命令并显示结果"""
    print(f"\n🔧 {description}...")
    print(f"命令: {cmd}")
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ 成功")
            if result.stdout:
                print(f"输出: {result.stdout[:200]}...")
        else:
            print(f"❌ 失败 (代码: {result.returncode})")
            if result.stderr:
                print(f"错误: {result.stderr[:500]}")
        return result
    except Exception as e:
        print(f"❌ 异常: {e}")
        return None

def check_environment():
    """检查当前环境"""
    print("🔍 检查Python环境...")
    
    # 检查Python版本
    run_command("python --version", "Python版本")
    
    # 检查pip版本
    run_command("python -m pip --version", "pip版本")
    
    # 检查setuptools
    result = run_command("python -c \"import setuptools; print('setuptools版本:', setuptools.__version__)\"", "检查setuptools")
    
    if result and result.returncode != 0:
        print("⚠️  setuptools有问题，尝试修复...")
        return False
    return True

def fix_pkg_resources():
    """修复pkg_resources问题"""
    print("\n🎯 修复pkg_resources模块问题")
    
    # pkg_resources是setuptools的一部分，需要重新安装或升级
    commands = [
        # 1. 升级pip
        "python -m pip install --upgrade pip",
        
        # 2. 重新安装setuptools
        "python -m pip install --upgrade --force-reinstall setuptools",
        
        # 3. 安装缺少的包
        "python -m pip install packaging wheel",
        
        # 4. 修复imageio-ffmpeg（报错来源）
        "python -m pip install --upgrade imageio-ffmpeg",
        
        # 5. 重新安装moviepy
        "python -m pip install --upgrade moviepy"
    ]
    
    for cmd in commands:
        desc = cmd.split("python -m pip install")[1] if "python -m pip install" in cmd else cmd
        run_command(cmd, f"执行: {desc}")
    
    # 测试修复
    print("\n🔍 测试修复结果...")
    test_result = run_command(
        'python -c "from pkg_resources import resource_filename; print(\'✅ pkg_resources可用\')"',
        "测试pkg_resources"
    )
    
    return test_result and test_result.returncode == 0

def install_requirements():
    """安装requirements.txt中的所有依赖"""
    print("\n📦 安装项目依赖...")
    
    if not os.path.exists("requirements.txt"):
        print("❌ requirements.txt文件不存在")
        return False
    
    # 读取requirements.txt
    with open("requirements.txt", 'r') as f:
        requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    
    print(f"找到 {len(requirements)} 个依赖项")
    
    # 逐个安装（避免一次安装所有导致问题）
    for i, req in enumerate(requirements, 1):
        print(f"\n[{i}/{len(requirements)}] 安装: {req}")
        
        # 跳过可能已经安装或有问题的基础包
        if any(skip in req.lower() for skip in ['setuptools', 'pkg_resources']):
            print("  跳过（基础包）")
            continue
        
        result = run_command(f"python -m pip install {req}", f"安装 {req}")
        
        if result and result.returncode != 0:
            print(f"⚠️  {req} 安装失败，尝试跳过...")
    
    print("\n✅ 依赖安装完成")
    return True

def create_minimal_requirements():
    """创建最小化的requirements.txt（移除有问题的包）"""
    print("\n🛠️ 创建最小化requirements.txt...")
    
    minimal_req = """fastapi==0.115.12
uvicorn==0.34.3
python-multipart==0.0.20
pydantic==2.11.7
pydantic-settings==2.9.1
python-dotenv==1.0.0
openai==1.59.7
dashscope==1.22.0
edge_tts==7.2.8
loguru==0.7.2
numpy==2.2.6
decorator==4.4.2
requests==2.31.0
Pillow==11.2.1
# 暂时移除有问题的包
# moviepy==2.2.1
# imageio-ffmpeg==0.4.9
# 添加兼容版本
imageio[ffmpeg]==2.37.3
setuptools>=80.0.0"""
    
    with open("requirements_minimal.txt", 'w') as f:
        f.write(minimal_req)
    
    print("✅ 已创建 requirements_minimal.txt")
    print("   这个版本移除了有问题的moviepy和imageio-ffmpeg")
    
    return "requirements_minimal.txt"

def test_backend_start():
    """测试后端是否能启动"""
    print("\n🚀 测试后端启动...")
    
    # 先测试导入main.py
    test_import = run_command(
        'python -c "import sys; sys.path.insert(0, \'.\'); from main import app; print(\'✅ 导入成功\')"',
        "测试导入main.py"
    )
    
    if test_import and test_import.returncode == 0:
        print("\n✅ 后端导入测试成功")
        
        # 尝试启动
        print("\n尝试启动后端服务器...")
        print("按 Ctrl+C 停止服务器")
        
        try:
            # 使用subprocess启动，这样可以捕获输出
            import subprocess
            import time
            
            # 启动服务器
            server_process = subprocess.Popen(
                ["python", "-m", "uvicorn", "main:app", "--reload", "--port", "8000"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            
            # 等待几秒看看是否能启动
            time.sleep(5)
            
            if server_process.poll() is None:
                print("✅ 服务器正在运行 (进程ID: {})".format(server_process.pid))
                print("访问: http://localhost:8000")
                print("文档: http://localhost:8000/docs")
                
                # 停止服务器
                server_process.terminate()
                server_process.wait()
                print("🛑 已停止测试服务器")
            else:
                stdout, stderr = server_process.communicate()
                print("❌ 服务器启动失败")
                if stderr:
                    print(f"错误输出:\n{stderr[:500]}")
                    
        except Exception as e:
            print(f"❌ 启动测试失败: {e}")
    else:
        print("❌ 导入测试失败，需要进一步修复")

def main():
    print("🔧 story-flicks 后端依赖修复工具")
    print("="*60)
    print("错误: ModuleNotFoundError: No module named 'pkg_resources'")
    print("="*60)
    
    # 检查环境
    env_ok = check_environment()
    
    print("\n📋 修复选项:")
    print("1. 修复pkg_resources问题（推荐先尝试）")
    print("2. 安装项目依赖 (requirements.txt)")
    print("3. 创建并使用最小化依赖")
    print("4. 测试后���启动")
    print("5. 退出")
    
    choice = input("\n请选择 (1-5): ").strip()
    
    if choice == "1":
        fix_pkg_resources()
    elif choice == "2":
        install_requirements()
    elif choice == "3":
        min_req = create_minimal_requirements()
        print(f"\n使用最小化依赖:")
        print(f"python -m pip install -r {min_req}")
        run_command(f"python -m pip install -r {min_req}", "安装最小化依赖")
    elif choice == "4":
        test_backend_start()
    elif choice == "5":
        print("退出")
    else:
        print("无效选择")
    
    print("\n💡 建议修复顺序:")
    print("1. 先选择选项1修复pkg_resources")
    print("2. 然后选择选项3使用最小化依赖")
    print("3. 最后选择选项4测试启动")
    
    print("\n⚠️  如果仍有问题:")
    print("- 检查Python环境是否正确激活: conda activate story-flicks")
    print("- 尝试完全重新创建环境:")
    print("  conda create -n story-flicks-new python=3.10")
    print("  conda activate story-flicks-new")
    print("  pip install -r requirements.txt")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 退出")