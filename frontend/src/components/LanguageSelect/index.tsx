import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './index.module.css';
export default function LanguageSelect() {
    const { t, i18n } = useTranslation();
    const changeLang = (lang: string) => {
        i18n.changeLanguage(lang)
        localStorage.setItem('lang', lang)
    }
    return (
        <div className={styles.languageCon}>
            <div className={styles.changeText}>{t('language.switchText')}</div>
            <Select
                defaultValue={localStorage.getItem('lang') || 'zh'}
                style={{ width: 120 }}
                options={[
                    { value: 'zh', label: '中文' },
                    { value: 'en', label: 'English' },
                ]}
                onChange={changeLang}
            />
        </div>
    );
}