import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';
import 'package:permission_handler/permission_handler.dart';

enum VoiceState {
  idle,
  wakeListening,
  wakeDetected,
  greeting,
  listeningForQuery,
  queryProcessing,
  speakingAnswer,
  error,
}

class VoiceService {
  static final VoiceService _instance = VoiceService._internal();
  factory VoiceService() => _instance;
  VoiceService._internal();

  final stt.SpeechToText _speech = stt.SpeechToText();
  final FlutterTts _tts = FlutterTts();

  bool _isSpeechInitialized = false;
  bool _isTtsInitialized = false;

  bool get isSpeechInitialized => _isSpeechInitialized;
  bool get isListening => _speech.isListening;

  Future<bool> requestMicPermission() async {
    final status = await Permission.microphone.status;
    if (status.isGranted) return true;
    final res = await Permission.microphone.request();
    return res.isGranted;
  }

  Future<void> openSettings() async {
    await openAppSettings();
  }

  Future<bool> init() async {
    final hasPermission = await requestMicPermission();
    if (!hasPermission) {
      debugPrint('[VOICE_STT] Microphone permission denied');
      return false;
    }

    if (!_isSpeechInitialized) {
      try {
        _isSpeechInitialized = await _speech.initialize(
          onError: (val) => debugPrint('[VOICE_STT] error: $val'),
          onStatus: (val) => debugPrint('[VOICE_STT] status: $val'),
        );
      } catch (e) {
        debugPrint('[VOICE_STT] init error: $e');
        _isSpeechInitialized = false;
      }
    }

    if (!_isTtsInitialized) {
      try {
        await _tts.setLanguage('en-US');
        await _tts.setSpeechRate(0.5);
        await _tts.setVolume(1.0);
        await _tts.setPitch(1.0);
        _isTtsInitialized = true;
      } catch (e) {
        debugPrint('[VOICE_TTS] init error: $e');
      }
    }

    return _isSpeechInitialized;
  }

  Future<void> speak(String text, {VoidCallback? onComplete}) async {
    if (!_isTtsInitialized) await init();
    try {
      if (onComplete != null) {
        _tts.setCompletionHandler(() {
          onComplete();
        });
      }
      await _tts.stop();
      await _tts.speak(text);
    } catch (e) {
      debugPrint('[VOICE_TTS] speak error: $e');
      onComplete?.call();
    }
  }

  Future<void> stopSpeaking() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }

  Future<void> startListening({
    required Function(String words, bool isFinal) onResult,
    required Function(String status) onStatusChange,
    Duration pauseFor = const Duration(seconds: 3),
    Duration listenFor = const Duration(seconds: 30),
  }) async {
    final hasPermission = await requestMicPermission();
    if (!hasPermission) {
      onStatusChange('MIC_ERROR');
      return;
    }

    if (!_isSpeechInitialized) {
      final ok = await init();
      if (!ok) {
        onStatusChange('MIC_ERROR');
        return;
      }
    }

    try {
      await _speech.listen(
        onResult: (result) {
          onResult(result.recognizedWords, result.finalResult);
        },
        listenOptions: stt.SpeechListenOptions(
          listenMode: stt.ListenMode.confirmation,
          cancelOnError: false,
          partialResults: true,
          listenFor: listenFor,
          pauseFor: pauseFor,
        ),
        onSoundLevelChange: (level) {},
      );
    } catch (e) {
      debugPrint('[VOICE_STT] listen error: $e');
      onStatusChange('MIC_ERROR');
    }
  }

  Future<void> stopListening() async {
    try {
      if (_speech.isListening) {
        await _speech.stop();
      }
    } catch (_) {}
  }

  bool matchesWakePhrase(String text) {
    final clean = text.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), '').trim();
    return clean.contains('mirrormind') ||
        clean.contains('mirror mind') ||
        clean.contains('hey mirror') ||
        clean.contains('ok mirror') ||
        clean.contains('hello mirror') ||
        clean.contains('hey nova') ||
        clean.contains('ok nova') ||
        clean.contains('hello nova') ||
        clean.contains('nova');
  }
}
