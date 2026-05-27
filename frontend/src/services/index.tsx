import { request } from "../utils/request";
import axios from 'axios';

export async function getVoiceList(data: {area: string[]}): Promise<VoiceListRes> {
    return request<VoiceListRes>({
        url: "/api/voice/voices",
        method: "post",
        data,
    });
}

export async function getLLMProviders(): Promise<LLMProvidersRes> {
    return request<LLMProvidersRes>({
        url: "/api/llm/providers",
        method: "get",
    });
}

export async function generateStory(data: StoryGenerationReq): Promise<StoryGenerationRes> {
    return request<StoryGenerationRes>({
        url: "/api/llm/story",
        method: "post",
        data,
    });
}

export async function generateVideo(data: VideoGenerateReq): Promise<VideoGenerateRes> {
    return request<VideoGenerateRes>({
        url: "/api/video/generate",
        method: "post",
        data,
    });
}

export async function uploadImages(files: File[]): Promise<ImageUploadRes> {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append('files', file);
    });
    const response = await axios.post('http://127.0.0.1:8000/api/video/upload-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}
