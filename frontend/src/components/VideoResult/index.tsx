import { useRef } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useVideoStore } from "../../stores/index";
import styles from './index.module.css'

export default function VideoResult() {
    const { videoUrl, setVideoUrl } = useVideoStore();
    const videoRef = useRef<HTMLVideoElement>(null);

    if (!videoUrl) {
        return null;
    }

    return (
        <div className={styles.videoContainer} key={videoUrl}>
            <Button
                icon={<ReloadOutlined />}
                onClick={() => setVideoUrl('')}
                className={styles.clearBtn}
            >
                清除预览
            </Button>
            <video ref={videoRef} controls className={styles.videoEl}>
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    )
}
