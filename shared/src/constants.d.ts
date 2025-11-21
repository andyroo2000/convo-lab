import { LanguageInfo, LanguageCode } from './types.js';
export declare const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageInfo>;
export declare const PROFICIENCY_LEVELS: readonly ["beginner", "intermediate", "advanced", "native"];
export declare const TONE_STYLES: readonly ["casual", "polite", "formal"];
export declare const TTS_VOICES: {
    readonly en: {
        readonly languageCode: "en-US";
        readonly voices: readonly [{
            readonly id: "en-US-Journey-D";
            readonly gender: "male";
            readonly description: "Andrew - Warm and natural";
            readonly edgeName: "AndrewNeural";
        }, {
            readonly id: "en-US-Studio-M";
            readonly gender: "male";
            readonly description: "Brian - Clear and professional";
            readonly edgeName: "BrianNeural";
        }, {
            readonly id: "en-US-Studio-O";
            readonly gender: "male";
            readonly description: "Eric - Deep and authoritative";
            readonly edgeName: "EricNeural";
        }, {
            readonly id: "en-US-Wavenet-B";
            readonly gender: "male";
            readonly description: "Guy - Confident and engaging";
            readonly edgeName: "GuyNeural";
        }, {
            readonly id: "en-US-Neural2-F";
            readonly gender: "female";
            readonly description: "Jenny - Pleasant and approachable";
            readonly edgeName: "JennyNeural";
        }, {
            readonly id: "en-US-Neural2-H";
            readonly gender: "female";
            readonly description: "Aria - Confident and warm";
            readonly edgeName: "AriaNeural";
        }, {
            readonly id: "en-US-Neural2-G";
            readonly gender: "female";
            readonly description: "Sara - Calm and sincere";
            readonly edgeName: "SaraNeural";
        }, {
            readonly id: "en-US-Wavenet-F";
            readonly gender: "female";
            readonly description: "Michelle - Authentic and warm";
            readonly edgeName: "MichelleNeural";
        }];
    };
    readonly ja: {
        readonly languageCode: "ja-JP";
        readonly voices: readonly [{
            readonly id: "ja-JP-Neural2-B";
            readonly gender: "female";
            readonly description: "Nanami - Bright and cheerful";
            readonly edgeName: "NanamiNeural";
        }, {
            readonly id: "ja-JP-Wavenet-D";
            readonly gender: "female";
            readonly description: "Shiori - Calm and clear";
            readonly edgeName: "ShioriNeural";
        }, {
            readonly id: "ja-JP-Wavenet-A";
            readonly gender: "female";
            readonly description: "Mayu - Animated and bright";
            readonly edgeName: "MayuNeural";
        }, {
            readonly id: "ja-JP-Neural2-D";
            readonly gender: "male";
            readonly description: "Masaru - Warm and conversational";
            readonly edgeName: "MasaruMultilingualNeural";
        }, {
            readonly id: "ja-JP-Wavenet-C";
            readonly gender: "male";
            readonly description: "Naoki - Clear and natural";
            readonly edgeName: "NaokiNeural";
        }, {
            readonly id: "ja-JP-Wavenet-B";
            readonly gender: "male";
            readonly description: "Daichi - Steady and reliable";
            readonly edgeName: "DaichiNeural";
        }];
    };
    readonly zh: {
        readonly languageCode: "zh-CN";
        readonly voices: readonly [{
            readonly id: "zh-CN-XiaoxiaoNeural";
            readonly gender: "female";
            readonly description: "Xiaoxiao - Warm and friendly";
            readonly edgeName: "XiaoxiaoNeural";
        }, {
            readonly id: "zh-CN-XiaoyiNeural";
            readonly gender: "female";
            readonly description: "Xiaoyi - Clear and gentle";
            readonly edgeName: "XiaoyiNeural";
        }, {
            readonly id: "zh-CN-XiaoxuanNeural";
            readonly gender: "female";
            readonly description: "Xiaoxuan - Bright and lively";
            readonly edgeName: "XiaoxuanNeural";
        }, {
            readonly id: "zh-CN-YunxiNeural";
            readonly gender: "male";
            readonly description: "Yunxi - Natural and conversational";
            readonly edgeName: "YunxiNeural";
        }, {
            readonly id: "zh-CN-YunyangNeural";
            readonly gender: "male";
            readonly description: "Yunyang - Professional and clear";
            readonly edgeName: "YunyangNeural";
        }, {
            readonly id: "zh-CN-YunjianNeural";
            readonly gender: "male";
            readonly description: "Yunjian - Calm and steady";
            readonly edgeName: "YunjianNeural";
        }];
    };
};
export declare const DEFAULT_NARRATOR_VOICES: {
    readonly en: "en-US-Journey-D";
    readonly ja: "ja-JP-Neural2-B";
    readonly zh: "zh-CN-XiaoxiaoNeural";
};
export declare const AUDIO_SPEEDS: {
    readonly slow: {
        readonly value: 0.7;
        readonly label: "Slow";
        readonly key: "0_7";
    };
    readonly medium: {
        readonly value: 0.85;
        readonly label: "Medium";
        readonly key: "0_85";
    };
    readonly normal: {
        readonly value: 1;
        readonly label: "Normal";
        readonly key: "1_0";
    };
};
export type AudioSpeedKey = 'slow' | 'medium' | 'normal';
//# sourceMappingURL=constants.d.ts.map