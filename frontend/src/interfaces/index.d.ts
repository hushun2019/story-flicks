
interface VoiceListRes {
    voices: string[];
}

interface LLMProvidersRes {
    textLLMProviders: string[];
    imageLLMProviders: string[];
    defaults: {
        text_llm_model: string;
        image_llm_model: string;
        resolution: string;
    };
}

interface StorySegment {
    text: string;
    image_prompt: string;
    url?: string;
}

interface StoryGenerationReq {
    story_prompt: string;
    segments: number;
    language: Language;
    text_llm_provider?: string;
    text_llm_model?: string;
    image_llm_provider?: string;
    image_llm_model?: string;
    resolution?: string;
    global_image_prompt?: string;
}

interface StoryGenerationRes {
    segments: StorySegment[];
}

interface VideoGenerateReq {
    text_llm_provider?: string;
    image_llm_provider?: string;
    text_llm_model?: string;
    image_llm_model?: string;
    image_mode?: 'ai' | 'upload';
    test_mode?: boolean;
    task_id?: string;
    segments: number;
    language?: Language;
    story_prompt?: string;
    story_scenes?: StorySegment[];
    image_style?: string;
    voice_name: string;
    voice_rate: number;
    resolution?: string;
    global_image_prompt?: string;
}

type Language = "zh-CN" | "zh-TW" |  "en-US" | "ja-JP" | "ko-KR";

interface VideoGenerateRes {
    success: boolean;
    data?: {
        video_url: string;
    };
    message: string | null;
}

interface ImageUploadRes {
    success: boolean;
    data?: {
        urls: string[];
        upload_id: string;
    };
}
