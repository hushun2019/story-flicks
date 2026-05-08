import React, { useState, useEffect } from 'react';
import type { FormProps } from 'antd';
import { Button, Form, Input, Select, message, Space } from 'antd';
import { useTranslation } from 'react-i18next'
import { getVoiceList, getLLMProviders, generateVideo, generateStory } from '../../services/index';
import { VOICE_LANGUAGES, VOICE_LANGUAGES_LABELS } from '../../constants';
import { getSelectVoiceList } from '../../utils/index';
import styles from './index.module.css'
import { useVideoStore } from "../../stores/index";

type FieldType = {
    text_llm_provider?: string;
    image_llm_provider?: string;
    text_llm_model?: string;
    image_llm_model?: string;
    resolution?: string;
    segments: number;
    language?: Language;
    story_prompt?: string;
    story_content?: string;
    voice_name: string;
    voice_rate: number;
};

/**
 * 将故事场景数组转为文本（每行一个场景：text|image_prompt）
 */
function scenesToText(segments: StorySegment[]): string {
    return segments.map(s => `${s.text}|${s.image_prompt}`).join('\n');
}

/**
 * 将文本解析为故事场景数组
 */
function textToScenes(text: string): StorySegment[] {
    return text.split('\n').filter(line => line.trim()).map(line => {
        const idx = line.indexOf('|');
        if (idx === -1) {
            return { text: line.trim(), image_prompt: line.trim() };
        }
        return {
            text: line.substring(0, idx).trim(),
            image_prompt: line.substring(idx + 1).trim(),
        };
    });
}

const App: React.FC = () => {
    const { setVideoUrl } = useVideoStore();
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [allVoiceList, setAllVoiceList] = useState<string[]>([]);
    const [nowVoiceList, setNowVoiceList] = useState<string[]>([]);
    const [llmProviders, setLLMProviders] = useState<LLMProvidersRes>({ textLLMProviders: [], imageLLMProviders: [], defaults: { text_llm_model: '', image_llm_model: '', resolution: '1080*1620' } });
    const [generatingText, setGeneratingText] = useState(false);
    const DEFAULT_LANGUAGE = 'zh-CN';

    useEffect(() => {
        getLLMProviders().then(res => {
            setLLMProviders(res);
        }).catch(err => console.log(err));

        getVoiceList({ area: VOICE_LANGUAGES }).then(res => {
            if (res?.voices?.length > 0) {
                setAllVoiceList(res.voices);
                const defaultVoices = getSelectVoiceList(DEFAULT_LANGUAGE, res.voices);
                setNowVoiceList(defaultVoices);
                if (defaultVoices.length > 0) {
                    form.setFieldsValue({ voice_name: defaultVoices[0].replace('-Female', '').replace('-Male', '') });
                }
            }
        }).catch(err => console.log(err));
    }, []);

    useEffect(() => {
        form.setFieldsValue({
            text_llm_provider: llmProviders.textLLMProviders?.[0],
            image_llm_provider: llmProviders.imageLLMProviders?.[0],
            text_llm_model: llmProviders.defaults?.text_llm_model,
            image_llm_model: llmProviders.defaults?.image_llm_model,
            resolution: llmProviders.defaults?.resolution || '1080*1620',
            language: DEFAULT_LANGUAGE,
            segments: 3,
        });
    }, [llmProviders]);

    /** 点击"生成文本"：调用LLM生成故事，填入故事内容框 */
    const handleGenerateText = async () => {
        try {
            const values = form.getFieldsValue();
            if (!values.story_prompt) {
                message.warning(t('storyForm.textPromptMissMsg'));
                return;
            }
            setGeneratingText(true);
            message.loading(t('storyForm.generatingText'), 0);
            const res = await generateStory({
                story_prompt: values.story_prompt,
                segments: values.segments || 5,
                language: values.language || DEFAULT_LANGUAGE,
                text_llm_provider: values.text_llm_provider,
                text_llm_model: values.text_llm_model,
            });
            message.destroy();
            if (res?.segments?.length > 0) {
                form.setFieldsValue({ story_content: scenesToText(res.segments) });
                message.success('OK');
            }
        } catch (err: any) {
            message.destroy();
            message.error(err?.message || 'Failed');
        } finally {
            setGeneratingText(false);
        }
    };

    /** 点击"生成视频" */
    const onFinish: FormProps<FieldType>['onFinish'] = (values) => {
        const storyContent = values.story_content?.trim();

        // 故事内容为空时提示
        if (!storyContent) {
            message.warning(t('storyForm.storyContentMissMsg'));
            return;
        }

        const reqData: VideoGenerateReq = {
            text_llm_provider: values.text_llm_provider,
            image_llm_provider: values.image_llm_provider,
            text_llm_model: values.text_llm_model,
            image_llm_model: values.image_llm_model,
            resolution: values.resolution,
            segments: values.segments,
            language: values.language,
            story_prompt: values.story_prompt,
            voice_name: values.voice_name,
            voice_rate: values.voice_rate || 1,
        };

        // 如果用户填了故事内容，解析为 scenes 传给后端
        if (storyContent) {
            reqData.story_scenes = textToScenes(storyContent);
        }

        message.loading('Generating Video, please wait...', 0);
        generateVideo(reqData).then(res => {
            message.destroy();
            if (res?.success === false) {
                throw new Error(res?.message || 'Generate Video Failed');
            }
            message.success('Generate Video Success');
            if (res?.data?.video_url) {
                setVideoUrl(res.data.video_url);
            }
        }).catch(err => {
            message.destroy();
            message.error('Generate Video Failed: ' + (err?.message || JSON.stringify(err)), 10);
        });
    };

    const onFinishFailed: FormProps<FieldType>['onFinishFailed'] = (errorInfo) => {
        console.log('Failed:', errorInfo);
    };

    return (
        <div className={styles.formDiv}>
            <Form
                form={form}
                name="basic"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                style={{ minWidth: 600, justifyContent: 'flex-start' }}
                initialValues={{ remember: true }}
                onFinish={onFinish}
                onFinishFailed={onFinishFailed}
                autoComplete="off"
            >
                <Form.Item<FieldType>
                    label={t('storyForm.txtLLMProvider')}
                    name="text_llm_provider"
                    rules={[{ required: true, message: t('storyForm.txtLLMProviderMissMsg') }]}
                >
                    <Select>
                        {llmProviders.textLLMProviders.map((provider) => (
                            <Select.Option key={provider} value={provider}>{provider}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.imgLLMProvider')}
                    name="image_llm_provider"
                    rules={[{ required: true, message: t('storyForm.imgLLMProviderMissMsg') }]}
                >
                    <Select>
                        {llmProviders.imageLLMProviders.map((provider) => (
                            <Select.Option key={provider} value={provider}>{provider}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.txtLLMModel')}
                    name="text_llm_model"
                    rules={[{ required: true, message: t('storyForm.txtLLMModelMissMsg') }]}
                >
                    <Input placeholder={t('storyForm.textLLMPlaceholder')} />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.imgLLMModel')}
                    name="image_llm_model"
                    rules={[{ required: true, message: t('storyForm.imgLLMModelMissMsg') }]}
                >
                    <Input placeholder={t('storyForm.imageLLMPlaceholder')} />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.resolution')}
                    name="resolution"
                    rules={[{ required: true, message: t('storyForm.resolutionMissMsg') }]}
                >
                    <Input placeholder={t('storyForm.resolutionPlaceholder')} />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.videoLanguage')}
                    name="language"
                    rules={[{ required: true, message: t('storyForm.videoLanguageMissMsg') }]}
                >
                    <Select
                        onChange={(value) => {
                            const voiceList = getSelectVoiceList(value, allVoiceList);
                            setNowVoiceList(voiceList);
                            if (voiceList.length > 0) {
                                form.setFieldsValue({ voice_name: voiceList[0].replace('-Female', '').replace('-Male', '') });
                            }
                        }}
                    >
                        {VOICE_LANGUAGES_LABELS.map((language) => (
                            <Select.Option key={language.value} value={language.value}>{language.label}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.voiceName')}
                    name="voice_name"
                    rules={[{ required: true, message: t('storyForm.voiceNameMissMsg') }]}
                >
                    <Select>
                        {nowVoiceList.map((voice) => (
                            <Select.Option key={voice} value={voice.replace('-Female', '').replace('-Male', '')}>{voice}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.textPrompt')}
                    name="story_prompt"
                    rules={[{ required: true, message: t('storyForm.textPromptMissMsg') }]}
                >
                    <Input.TextArea rows={2} placeholder={t('storyForm.storyPromptPlaceholder')} />
                </Form.Item>

                {/* 故事内容编辑框 - 紧跟故事主题 */}
                <Form.Item<FieldType>
                    label={t('storyForm.storyContent')}
                    name="story_content"
                >
                    <Input.TextArea
                        rows={8}
                        placeholder={t('storyForm.storyContentPlaceholder')}
                    />
                </Form.Item>

                <Form.Item<FieldType>
                    label={t('storyForm.segments')}
                    name="segments"
                    rules={[{ required: true, message: t('storyForm.segmentsMissMsg') }]}
                >
                    <Input type='number' min={1} max={10} placeholder="5" />
                </Form.Item>

                {/* 生成故事 + 生成视频 同一行 */}
                <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                    <Space>
                        <Button type="primary" onClick={handleGenerateText} loading={generatingText}>
                            {t('storyForm.generateStory')}
                        </Button>
                        <Button type="primary" htmlType="submit">
                            {t('storyForm.submit')}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
}

export default App;
