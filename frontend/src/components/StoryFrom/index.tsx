import React, { useState, useEffect, useRef } from 'react';
import type { FormProps } from 'antd';
import { Button, Form, Input, Select, message, Space, Radio, Upload, Image } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next'
import { getVoiceList, getLLMProviders, generateVideo, generateStory, uploadImages } from '../../services/index';
import { VOICE_LANGUAGES, VOICE_LANGUAGES_LABELS } from '../../constants';
import { getSelectVoiceList } from '../../utils/index';
import styles from './index.module.css'
import { useVideoStore } from "../../stores/index";
import type { UploadFile } from 'antd';

type ImageMode = 'ai' | 'upload';

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
    global_image_prompt?: string;
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
    const [imageMode, setImageMode] = useState<ImageMode>('ai');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]);
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
                    // 默认选择 liaoning-XiaobeiNeural
                    const liaoningVoice = defaultVoices.find(v => v.includes('liaoning'));
                    const defaultVoice = liaoningVoice || defaultVoices[0];
                    form.setFieldsValue({ voice_name: defaultVoice.replace('-Female', '').replace('-Male', '') });
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

    /** 处理图片模式切换 */
    const handleImageModeChange = (mode: ImageMode) => {
        setImageMode(mode);
        if (mode === 'ai') {
            // 切换到AI模式，清除上传的图片
            setUploadedFiles([]);
            setUploadedPreviews([]);
            setUploadedUrls([]);
        } else {
            // 切换到上传模式，清除全局图片提示词
            form.setFieldsValue({ global_image_prompt: '' });
        }
    };

    /** 处理图片上传 */
    const handleImageUpload = async (fileList: FileList | null) => {
        if (!fileList) return;

        const newFiles: File[] = [];
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (!allowedTypes.includes(file.type)) {
                message.error(`文件 "${file.name}" 格式不支持，仅支持 PNG、JPG、JPEG`);
                return;
            }
            if (file.size > maxSize) {
                message.error(`文件 "${file.name}" 超过10MB大小限制`);
                return;
            }
            newFiles.push(file);
        }

        const totalFiles = [...uploadedFiles, ...newFiles];
        if (totalFiles.length > 10) {
            message.error('最多上传10张图片');
            return;
        }

        // 生成预览
        const newPreviews: string[] = [];
        for (const file of newFiles) {
            const preview = URL.createObjectURL(file);
            newPreviews.push(preview);
        }

        setUploadedFiles(totalFiles);
        setUploadedPreviews([...uploadedPreviews, ...newPreviews]);

        // 上传到后端
        setUploading(true);
        try {
            const res = await uploadImages(totalFiles);
            if (res?.success && res.data?.urls) {
                setUploadedUrls(res.data.urls);
                message.success(`已上传 ${totalFiles.length} 张图片`);
            }
        } catch (err: any) {
            message.error('图片上传失败: ' + (err?.response?.data?.detail || err?.message || '未知错误'));
        } finally {
            setUploading(false);
        }
    };

    /** 删除单张图片 */
    const handleRemoveImage = async (index: number) => {
        const newFiles = uploadedFiles.filter((_, i) => i !== index);
        const newPreviews = uploadedPreviews.filter((_, i) => i !== index);

        // 释放旧的预览URL
        URL.revokeObjectURL(uploadedPreviews[index]);

        setUploadedFiles(newFiles);
        setUploadedPreviews(newPreviews);

        // 重新上传剩余文件
        if (newFiles.length > 0) {
            setUploading(true);
            try {
                const res = await uploadImages(newFiles);
                if (res?.success && res.data?.urls) {
                    setUploadedUrls(res.data.urls);
                }
            } catch (err: any) {
                message.error('图片上传失败');
            } finally {
                setUploading(false);
            }
        } else {
            setUploadedUrls([]);
        }
    };

    /** 点击"生成文本"：调用LLM生成故事，填入故事内容框 */
    const handleGenerateText = async () => {
        try {
            const values = form.getFieldsValue();
            if (!values.story_prompt) {
                message.warning(t('storyForm.textPromptMissMsg'));
                return;
            }

            // 上传模式下，段落数 = 图片数
            let segments = values.segments || 3;
            if (imageMode === 'upload') {
                if (uploadedFiles.length === 0) {
                    message.warning('请先上传图片');
                    return;
                }
                segments = uploadedFiles.length;
            }

            setGeneratingText(true);
            message.loading(t('storyForm.generatingText'), 0);
            const res = await generateStory({
                story_prompt: values.story_prompt,
                segments: segments,
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

        // 上传模式校验
        if (imageMode === 'upload') {
            if (uploadedFiles.length === 0) {
                message.error('请先上传图片');
                return;
            }
            if (uploadedUrls.length === 0) {
                message.error('图片尚未上传完成，请稍候');
                return;
            }
            // 校验段落数 = 图片数
            const scenes = textToScenes(storyContent);
            if (scenes.length !== uploadedUrls.length) {
                message.error(`故事段落数(${scenes.length})与上传图片数(${uploadedUrls.length})不一致，请调整`);
                return;
            }
        }

        const reqData: VideoGenerateReq = {
            text_llm_provider: values.text_llm_provider,
            text_llm_model: values.text_llm_model,
            segments: values.segments,
            language: values.language,
            story_prompt: values.story_prompt,
            voice_name: values.voice_name,
            voice_rate: values.voice_rate || 1,
        };

        if (imageMode === 'ai') {
            reqData.image_llm_provider = values.image_llm_provider;
            reqData.image_llm_model = values.image_llm_model;
            reqData.resolution = values.resolution;
            if (values.global_image_prompt?.trim()) {
                reqData.global_image_prompt = values.global_image_prompt.trim();
            }
        }

        // 解析故事内容为 scenes
        if (storyContent) {
            const scenes = textToScenes(storyContent);
            if (imageMode === 'upload') {
                // 上传模式：将上传的图片URL填入scenes
                reqData.story_scenes = scenes.map((scene, i) => ({
                    ...scene,
                    url: uploadedUrls[i] || '',
                }));
            } else {
                reqData.story_scenes = scenes;
            }
        }

        let seconds = 0;
        message.loading({ content: `视频生成中，请耐心等待。。。(${seconds}秒)`, key: 'videoGen', style: { marginTop: '40vh' } }, 0);
        videoTimerRef.current = setInterval(() => {
            seconds++;
            message.loading({ content: `视频生成中，请耐心等待。。。(${seconds}秒)`, key: 'videoGen', style: { marginTop: '40vh' } }, 0);
        }, 1000);

        generateVideo(reqData).then(res => {
            if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
            message.destroy('videoGen');
            if (res?.success === false) {
                throw new Error(res?.message || 'Generate Video Failed');
            }
            message.success('Generate Video Success');
            if (res?.data?.video_url) {
                setVideoUrl(res.data.video_url);
            }
        }).catch(err => {
            if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
            message.destroy('videoGen');
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

                {/* 图片模式选择 */}
                <Form.Item label="图片模式">
                    <Radio.Group value={imageMode} onChange={(e) => handleImageModeChange(e.target.value)}>
                        <Radio.Button value="ai">AI生成</Radio.Button>
                        <Radio.Button value="upload">上传自定义图片</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                {/* AI生成模式的字段 */}
                {imageMode === 'ai' && (
                    <>
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
                            label="全局图片提示词"
                            name="global_image_prompt"
                            initialValue="图片中人物要求是现代人，男帅女俊"
                        >
                            <Input.TextArea
                                rows={2}
                                maxLength={500}
                                showCount
                                placeholder="可选，如：cartoon style, bright colors, cute characters"
                            />
                        </Form.Item>
                    </>
                )}

                {/* 上传自定义图片模式 */}
                {imageMode === 'upload' && (
                    <Form.Item label={`上传图片 (${uploadedFiles.length}/10)`}>
                        <div className={styles.uploadArea}>
                            <div className={styles.thumbnailList}>
                                {uploadedPreviews.map((preview, index) => (
                                    <div key={index} className={styles.thumbnailItem}>
                                        <Image
                                            src={preview}
                                            width={80}
                                            height={80}
                                            style={{ objectFit: 'cover', borderRadius: 4 }}
                                            preview={true}
                                        />
                                        <div className={styles.thumbnailIndex}>{index + 1}</div>
                                        <Button
                                            type="text"
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            className={styles.deleteBtn}
                                            onClick={() => handleRemoveImage(index)}
                                        />
                                    </div>
                                ))}
                                {uploadedFiles.length < 10 && (
                                    <label className={styles.uploadBtn}>
                                        <PlusOutlined style={{ fontSize: 24, color: '#999' }} />
                                        <span style={{ fontSize: 12, color: '#999', marginTop: 4 }}>上传</span>
                                        <input
                                            type="file"
                                            multiple
                                            accept=".png,.jpg,.jpeg"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleImageUpload(e.target.files)}
                                        />
                                    </label>
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                                支持 PNG、JPG、JPEG，单张不超过10MB，图片顺序即视频中的展示顺序
                            </div>
                        </div>
                    </Form.Item>
                )}

                <Form.Item<FieldType>
                    label={t('storyForm.txtLLMModel')}
                    name="text_llm_model"
                    rules={[{ required: true, message: t('storyForm.txtLLMModelMissMsg') }]}
                >
                    <Input placeholder={t('storyForm.textLLMPlaceholder')} />
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
                    label={t('storyForm.voiceRate')}
                    name="voice_rate"
                    initialValue={0.9}
                >
                    <Select>
                        <Select.Option value={0.6}>0.6x 极慢</Select.Option>
                        <Select.Option value={0.8}>0.8x 慢速</Select.Option>
                        <Select.Option value={0.9}>0.9x 较慢</Select.Option>
                        <Select.Option value={1.0}>1.0x 正常</Select.Option>
                        <Select.Option value={1.1}>1.1x 较快</Select.Option>
                        <Select.Option value={1.2}>1.2x 快速</Select.Option>
                        <Select.Option value={1.5}>1.5x 极快</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item<FieldType>
                    label={t('storyForm.textPrompt')}
                    name="story_prompt"
                    rules={[{ required: true, message: t('storyForm.textPromptMissMsg') }]}
                >
                    <Input.TextArea rows={2} placeholder={t('storyForm.storyPromptPlaceholder')} />
                </Form.Item>

                {/* 故事内容编辑框 */}
                <Form.Item<FieldType>
                    label={t('storyForm.storyContent')}
                    name="story_content"
                >
                    <Input.TextArea
                        rows={8}
                        placeholder={t('storyForm.storyContentPlaceholder')}
                    />
                </Form.Item>

                {/* AI模式下显示段落数，上传模式下自动等于图片数 */}
                {imageMode === 'ai' && (
                    <Form.Item<FieldType>
                        label={t('storyForm.segments')}
                        name="segments"
                        rules={[{ required: true, message: t('storyForm.segmentsMissMsg') }]}
                    >
                        <Input type='number' min={1} max={10} placeholder="3" />
                    </Form.Item>
                )}

                {imageMode === 'upload' && (
                    <Form.Item label={t('storyForm.segments')}>
                        <Input disabled value={uploadedFiles.length || 0} addonAfter="（自动等于图片数）" />
                    </Form.Item>
                )}

                {/* 生成故事 + 生成视频 同一行 */}
                <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                    <Space>
                        <Button type="primary" onClick={handleGenerateText} loading={generatingText}>
                            {t('storyForm.generateStory')}
                        </Button>
                        <Button type="primary" htmlType="submit" loading={uploading}>
                            {t('storyForm.submit')}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
}

export default App;
