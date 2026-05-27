import os
import time
import json
from typing import List
from app.schemas.llm import StoryGenerationRequest
from loguru import logger
from app.models.const import StoryType, ImageStyle
from app.schemas.video import VideoGenerateRequest, StoryScene
from app.services.llm import llm_service
from app.services.voice import generate_voice
from app.utils import utils
from moviepy import (
    VideoFileClip,
    ImageClip,
    AudioFileClip,
    TextClip,
    CompositeVideoClip,
    concatenate_videoclips,
    afx,
)
from moviepy.video.tools import subtitles
from moviepy.video.tools.subtitles import SubtitlesClip
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import requests
import random

def wrap_text(text, max_width, font="Arial", fontsize=60):
    # Create ImageFont
    font = ImageFont.truetype(font, fontsize)

    def get_text_size(inner_text):
        inner_text = inner_text.strip()
        left, top, right, bottom = font.getbbox(inner_text)
        return right - left, bottom - top

    width, height = get_text_size(text)
    if width <= max_width:
        return text, height

    # logger.warning(f"wrapping text, max_width: {max_width}, text_width: {width}, text: {text}")

    processed = True

    _wrapped_lines_ = []
    words = text.split(" ")
    _txt_ = ""
    for word in words:
        _before = _txt_
        _txt_ += f"{word} "
        _width, _height = get_text_size(_txt_)
        if _width <= max_width:
            continue
        else:
            if _txt_.strip() == word.strip():
                processed = False
                break
            _wrapped_lines_.append(_before)
            _txt_ = f"{word} "
    _wrapped_lines_.append(_txt_)
    if processed:
        _wrapped_lines_ = [line.strip() for line in _wrapped_lines_]
        result = "\n".join(_wrapped_lines_).strip()
        height = len(_wrapped_lines_) * height
        # logger.warning(f"wrapped text: {result}")
        return result, height

    _wrapped_lines_ = []
    chars = list(text)
    _txt_ = ""
    for word in chars:
        _txt_ += word
        _width, _height = get_text_size(_txt_)
        if _width <= max_width:
            continue
        else:
            _wrapped_lines_.append(_txt_)
            _txt_ = ""
    _wrapped_lines_.append(_txt_)
    result = "\n".join(_wrapped_lines_).strip()
    height = len(_wrapped_lines_) * height
    # logger.warning(f"wrapped text: {result}")
    return result, height

def resize_image_to_target(image_path: str, target_w: int = 1080, target_h: int = 1620):
    """将图片缩放裁剪到目标尺寸，保持比例居中裁剪，避免黑边
    
    Args:
        image_path: 图片文件路径
        target_w: 目标宽度
        target_h: 目标高度
    """
    img = Image.open(image_path)
    img_w, img_h = img.size
    
    # 如果已经是目标尺寸，直接返回
    if img_w == target_w and img_h == target_h:
        return
    
    # 计算缩放比例，取较大值确保覆盖目标区域
    scale = max(target_w / img_w, target_h / img_h)
    new_w = int(img_w * scale)
    new_h = int(img_h * scale)
    
    # 缩放
    img = img.resize((new_w, new_h), Image.LANCZOS)
    
    # 居中裁剪
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    img = img.crop((left, top, left + target_w, top + target_h))
    
    # 保存（转为RGB避免RGBA问题）
    if img.mode == 'RGBA':
        img = img.convert('RGB')
    img.save(image_path)
    logger.info(f"Resized image to {target_w}x{target_h}: {image_path}")


async def create_video_with_scenes(task_dir: str, scenes: List[StoryScene], voice_name: str, voice_rate: float, test_mode: bool = False) -> str:
    """创建带有场景的视频

    Args:
        task_dir (str): 任务目录
        scenes (List[StoryScene]): 场景列表
        voice_name (str): 语音名称
        voice_rate (float): 语音速率
        test_mode (bool): 是否为测试模式，如果是则使用已有的图片、音频、字幕文件
    """
    clips = []
    for i, scene in enumerate(scenes, 1):
        try:
            # 获取文件路径
            image_file = os.path.join(task_dir, f"{i}.png")
            
            # 统一缩放图片到目标尺寸，避免黑边
            if os.path.exists(image_file):
                resize_image_to_target(image_file, 1080, 1620)
            audio_file = os.path.join(task_dir, f"{i}.mp3")
            subtitle_file = os.path.join(task_dir, f"{i}.srt")

            # 测试模式下检查文件是否存在
            if test_mode:
                if not (os.path.exists(image_file) and os.path.exists(audio_file) and os.path.exists(subtitle_file)):
                    logger.warning(f"Test mode: Required files not found for scene {i}")
                    raise FileNotFoundError("Required files not found")
            else:
                # 正式模式下生成所需文件
                logger.info(f"Processing scene {i}")
                audio_file, subtitle_file = await generate_voice(
                    scene.text,
                    voice_name,
                    voice_rate,
                    audio_file,
                    subtitle_file
                )
            
            # 获取字幕的总时长
            subs = subtitles.file_to_subtitles(subtitle_file, encoding="utf-8")
            subtitle_duration = max([tb for ((ta, tb), txt) in subs])
                    
            # 创建图片剪辑
            image_clip = ImageClip(image_file)
            origin_image_w, origin_image_h = image_clip.size  # 获取放大后的图片尺寸
            image_scale = 1.2
            image_clip = image_clip.resized((origin_image_w*image_scale,origin_image_h*image_scale))
            image_w, image_h = image_clip.size  # 获取放大后的图片尺寸
            # 确保图片视频时长至少和字幕一样长
            image_clip = image_clip.with_duration(subtitle_duration)

            width_diff = origin_image_w * (image_scale-1)
            def debug_position(t):
                # print(f"当前时间 t = {t}", subtitle_duration, width_diff, width_diff/subtitle_duration*t)  # 输出当前时间
                return (-width_diff/subtitle_duration*t, 'center')
            image_clip = image_clip.with_position(debug_position)
            # 创建音频剪辑
            audio_clip = AudioFileClip(audio_file)
            image_clip = image_clip.with_audio(audio_clip)
            # 使用系统字体
            font_path = os.path.join(utils.resource_dir(), "fonts", "STHeitiLight.ttc")
            if not os.path.exists(font_path):
                logger.warning("Font file not found, using default font")
                raise FileNotFoundError("Font file not found: " + font_path)
            else:
                logger.info(f"Using font: {font_path}")
            
            print(f"Using font: {font_path}")
            # 添加字幕
            if os.path.exists(subtitle_file):
                logger.info(f"Loading subtitle file: {subtitle_file}")
                try:
                    def make_textclip(text):
                        return TextClip(
                            text=text,
                            font=font_path,
                            font_size=60,
                        )
                    def create_text_clip(subtitle_item):
                        phrase = subtitle_item[1]
                        max_width = (origin_image_w * 0.9)
                        wrapped_txt, txt_height = wrap_text(
                            phrase, max_width=max_width, font=font_path, fontsize=60
                        )
                        _clip = TextClip(
                            text=wrapped_txt,
                            font=font_path,
                            font_size=60,
                            color="white",
                            stroke_color="black",
                            stroke_width=2,
                        )
                        duration = subtitle_item[0][1] - subtitle_item[0][0]
                        _clip = _clip.with_start(subtitle_item[0][0])
                        _clip = _clip.with_end(subtitle_item[0][1])
                        _clip = _clip.with_duration(duration)
                        _clip = _clip.with_position(("center", origin_image_h * 0.95 - _clip.h - 50))
                        return _clip
                    
                    sub = SubtitlesClip(subtitle_file, encoding="utf-8", make_textclip=make_textclip)

                    text_clips = []
                    for item in sub.subtitles:
                        clip = create_text_clip(subtitle_item=item)
                        text_clips.append(clip)

                    video_clip = CompositeVideoClip([image_clip, *text_clips], (origin_image_w, origin_image_h))
                    clips.append(video_clip)
                    logger.info(f"Added subtitles for scene {i}")
                except Exception as e:
                    logger.error(f"Failed to add subtitles for scene {i}: {str(e)}")
                    clips.append(image_clip)
            else:
                logger.warning(f"Subtitle file not found: {subtitle_file}")
                clips.append(image_clip)
        except Exception as e:
            logger.error(f"Failed to process scene {i}: {str(e)}")
            raise e
    
    if not clips:
        raise ValueError("No valid clips to combine")

    # 合并所有片段
    logger.info("Merging all clips")
    final_clip = concatenate_videoclips(clips)
    video_file = os.path.join(task_dir, "video.mp4")
    logger.info(f"Writing video to {video_file}")
    final_clip.write_videofile(video_file, fps=24, codec='libx264', audio_codec='aac')
    
    return video_file


async def generate_video(request: VideoGenerateRequest):
    """生成视频

    Args:
        request (VideoGenerateRequest): 视频生成请求
    """
    try:
        # 测试模式下，从 story.json 中读取请求参数
        if request.test_mode:
            task_id = request.task_id or str(int(time.time()))
            task_dir = utils.task_dir(task_id)
            if not os.path.exists(task_dir):
                raise ValueError(f"Task directory not found: {task_dir}")
            # 从 story.json 中读取数据
            story_file = os.path.join(task_dir, "story.json")
            if not os.path.exists(story_file):
                raise ValueError(f"Story file not found: {story_file}")
            
            with open(story_file, "r", encoding="utf-8") as f:
                story_data = json.load(f)
                print("story_data", story_data)
            
            request = VideoGenerateRequest(**story_data)
            request.test_mode = True
            scenes = [StoryScene(**scene) for scene in story_data.get("scenes", [])]
        else:
            if request.story_scenes:
                # 用户已提供故事场景，跳过LLM故事生成，只生成图片
                scenes = request.story_scenes
                for scene in scenes:
                    if not scene.url:
                        try:
                            image_url = llm_service.generate_image(
                                prompt=scene.image_prompt,
                                resolution=request.resolution,
                                image_llm_provider=request.image_llm_provider,
                                image_llm_model=request.image_llm_model,
                                global_image_prompt=request.global_image_prompt,
                            )
                            scene.url = image_url
                        except Exception as e:
                            logger.error(f"Failed to generate image: {e}")
                            scene.url = None
                story_list = [scene.model_dump() for scene in scenes]
            else:
                req = StoryGenerationRequest(
                    resolution=request.resolution,
                    story_prompt=request.story_prompt,
                    language=request.language,
                    segments=request.segments,
                    text_llm_provider=request.text_llm_provider,
                    text_llm_model=request.text_llm_model,
                    image_llm_provider=request.image_llm_provider,
                    image_llm_model=request.image_llm_model,
                    global_image_prompt=request.global_image_prompt,
                )
                story_list = await llm_service.generate_story_with_images(request=req)
                scenes = [StoryScene(text=scene["text"], image_prompt=scene["image_prompt"], url=scene["url"]) for scene in story_list]
            
            # 保存 story.json
            story_data = request.model_dump()
            story_data["scenes"] = [scene.model_dump() for scene in scenes]
            task_id = str(int(time.time()))
            task_dir = utils.task_dir(task_id)
            os.makedirs(task_dir, exist_ok=True)
            story_file = os.path.join(task_dir, "story.json")
            for i, scene in enumerate(story_list, 1):
                if scene.get("url"):
                    image_path = os.path.join(task_dir, f"{i}.png")
                    try:
                        image_url = scene["url"]
                        # 本地上传的图片直接复制文件，避免自请求死锁
                        if "/tasks/uploads/" in image_url:
                            # 从URL中提取相对路径，直接从磁盘复制
                            import shutil
                            # URL格式: http://127.0.0.1:8000/tasks/uploads/{upload_id}/{filename}
                            url_path = image_url.split("/tasks/")[1]  # uploads/{upload_id}/{filename}
                            source_path = os.path.join(utils.task_dir(), url_path)
                            if os.path.exists(source_path):
                                shutil.copy2(source_path, image_path)
                                logger.info(f"Copied local image {i} to {image_path}")
                            else:
                                logger.error(f"Local image not found: {source_path}")
                        else:
                            response = requests.get(image_url, timeout=30)
                            if response.status_code == 200:
                                with open(image_path, "wb") as f:
                                    f.write(response.content)
                                logger.info(f"Downloaded image {i} to {image_path}")
                            else:
                                logger.error(f"Failed to download image {i}: HTTP {response.status_code}")
                    except Exception as e:
                        logger.error(f"Failed to download image {i}: {e}")
                else:
                    logger.error(f"Scene {i} has no image URL, image generation may have failed")

            # 校验所有图片是否下载成功
            missing_images = []
            for i in range(1, len(story_list) + 1):
                image_path = os.path.join(task_dir, f"{i}.png")
                if not os.path.exists(image_path):
                    missing_images.append(i)
            if missing_images:
                raise ValueError(f"Image files missing for scenes: {missing_images}. Please check image generation logs.")

            with open(story_file, "w", encoding="utf-8") as f:
                json.dump(story_data, f, ensure_ascii=False, indent=2)
        # return ""
        # 生成视频
        return await create_video_with_scenes(task_dir, scenes, request.voice_name, request.voice_rate, request.test_mode)
    except Exception as e:
        logger.error(f"Failed to generate video: {e}")
        raise e