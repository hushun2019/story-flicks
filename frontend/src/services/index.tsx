import { request } from "../utils/request";

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