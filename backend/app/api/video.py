from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from loguru import logger
from app.services.video import generate_video, create_video_with_scenes, generate_voice
from app.schemas.video import VideoGenerateRequest, VideoGenerateResponse, StoryScene
import os
import json
import time
from typing import List
from app.utils.utils import extract_id, task_dir

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    """上传图片，返回可访问的URL列表"""
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="最多上传10张图片")
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="至少上传1张图片")

    # 创建上传目录
    upload_id = str(int(time.time() * 1000))
    upload_dir = task_dir(f"uploads/{upload_id}")
    os.makedirs(upload_dir, exist_ok=True)

    urls = []
    for i, file in enumerate(files):
        # 校验文件扩展名
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"文件 '{file.filename}' 格式不支持，仅支持 PNG、JPG、JPEG"
            )

        # 读取文件内容并校验大小
        content = await file.read()
        if len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件 '{file.filename}' 超过10MB大小限制"
            )

        # 保存文件
        filename = f"{i + 1}{ext}"
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(content)

        # 生成可访问的URL
        url = f"http://127.0.0.1:8000/tasks/uploads/{upload_id}/{filename}"
        urls.append(url)

    return {"success": True, "data": {"urls": urls, "upload_id": upload_id}}

@router.post("/generate")
async def generate_video_endpoint(
    request: VideoGenerateRequest
):
    """生成视频"""
    try:
        video_file = await generate_video(request)
        task_id = extract_id(video_file)
        # 转换为相对路径
        video_url = "http://127.0.0.1:8000/tasks/" + task_id + "/video.mp4"
        return VideoGenerateResponse(
            success=True,
            data={"video_url": video_url}
        )
    except Exception as e:
        logger.error(f"Failed to generate video: {str(e)}")
        return VideoGenerateResponse(
            success=False,
            message=str(e)
        )


