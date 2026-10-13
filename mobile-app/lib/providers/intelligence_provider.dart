import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../core/constants/api.dart';
import '../core/services/api_service.dart';
import '../core/services/voice_service.dart';
import '../core/services/live_voice_websocket_service.dart';
import '../models/intelligence_model.dart';

class IntelligenceProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final VoiceService _voice = VoiceService();
  final LiveVoiceWebSocketService _liveWs = LiveVoiceWebSocketService();

  final List<IntelligenceMessage> _messages = [];
  bool _isQuerying = false;
  String _selectedProvider = 'gemini'; // 'gemini', 'openrouter', or 'ollama'

  int _topK = 5;
  String? _error;

  // ── Hands-Free & Voice State ──
  bool _handsFree = false;
  VoiceState _voiceState = VoiceState.idle;
  String _liveTranscript = '';
  String? _voiceError;

  // ── Live WebSocket & Tool Calling Automation State ──
  bool _useLiveWebSocket = true;
  String? _activeToolName;
  String? _lastActionResult;
  Function(String action, Map<String, dynamic> data)? onUIActionCallback;

  List<IntelligenceMessage> get messages => _messages;
  bool get isQuerying => _isQuerying;
  String get selectedProvider => _selectedProvider;
  int get topK => _topK;
  String? get error => _error;

  bool get handsFree => _handsFree;
  VoiceState get voiceState => _voiceState;
  String get liveTranscript => _liveTranscript;
  String? get voiceError => _voiceError;
  bool get isVoiceListening => _voice.isListening;

  bool get useLiveWebSocket => _useLiveWebSocket;
  bool get isWsConnected => _liveWs.isConnected;
  String? get activeToolName => _activeToolName;
  String? get lastActionResult => _lastActionResult;

  IntelligenceProvider() {
    _setupWsCallbacks();
  }

  void _setupWsCallbacks() {
    _liveWs.onTextChunk = (chunk) {
      if (_messages.isNotEmpty && !_messages.last.isUser) {
        final last = _messages.removeLast();
        _messages.add(IntelligenceMessage(
          id: last.id,
          text: last.text + chunk,
          isUser: false,
          timestamp: last.timestamp,
          provider: 'Gemini Live',
          model: 'gemini-2.5-flash-native-audio-latest',
        ));
      } else {
        _messages.add(IntelligenceMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          text: chunk,
          isUser: false,
          timestamp: DateTime.now(),
          provider: 'Gemini Live',
          model: 'gemini-2.5-flash-native-audio-latest',
        ));
      }
      notifyListeners();
    };

    _liveWs.onToolStart = (toolName, args) {
      _activeToolName = _humanizeToolName(toolName, args);
      _voiceState = VoiceState.queryProcessing;
      notifyListeners();
    };

    _liveWs.onUIAction = (action, data) {
      _activeToolName = null;
      if (action == 'PROJECT_ADDED') {
        _lastActionResult = '✨ Project added to your portfolio!';
      } else if (action == 'INTERNSHIP_ADDED') {
        _lastActionResult = '💼 Internship experience saved!';
      } else if (action == 'PROFILE_UPDATED') {
        _lastActionResult = '🎓 Profile details updated!';
      } else if (action == 'NAVIGATE') {
        _lastActionResult = '🚀 Navigating to ${data['path'] ?? 'screen'}...';
      }
      onUIActionCallback?.call(action, data);
      notifyListeners();
    };

    _liveWs.onTurnComplete = () {
      _activeToolName = null;
      _isQuerying = false;
      if (_handsFree && _messages.isNotEmpty && !_messages.last.isUser) {
        _voiceState = VoiceState.speakingAnswer;
        notifyListeners();
        final clean = _messages.last.text.replaceAll(RegExp(r'[*#_`]'), '');
        _voice.speak(clean, onComplete: () {
          _voiceState = _handsFree ? VoiceState.wakeListening : VoiceState.idle;
          notifyListeners();
        });
      } else {
        _voiceState = VoiceState.idle;
        notifyListeners();
      }
    };

    _liveWs.onInterrupted = () {
      _voice.stopSpeaking();
      _activeToolName = null;
      _voiceState = VoiceState.idle;
      notifyListeners();
    };

    _liveWs.onError = (err) {
      _voiceError = err;
      _activeToolName = null;
      _isQuerying = false;
      notifyListeners();
    };
  }

  String _humanizeToolName(String name, Map<String, dynamic> args) {
    switch (name) {
      case 'add_project':
        final title = args['title'] ?? 'new project';
        return 'Adding project "$title" to portfolio...';
      case 'add_internship':
        final comp = args['company_name'] ?? 'internship';
        return 'Recording experience at $comp...';
      case 'update_profile':
        final f = args['field'] ?? 'profile';
        return 'Updating $f on your academic profile...';
      case 'query_rag_database':
        return 'Searching resume & knowledge base...';
      case 'navigate_ui':
        final dest = args['destination'] ?? 'destination';
        return 'Navigating to $dest...';
      default:
        return 'Executing $name...';
    }
  }

  void toggleLiveWebSocket(bool enabled) {
    _useLiveWebSocket = enabled;
    if (!enabled) {
      _liveWs.disconnect();
    }
    notifyListeners();
  }

  Future<bool> ensureWsConnected() async {
    if (_liveWs.isConnected) return true;
    final token = await _api.getToken();
    if (token == null || token.isEmpty) return false;
    return await _liveWs.connect(token);
  }

  void setProvider(String provider) {
    _selectedProvider = provider;
    notifyListeners();
  }

  void setTopK(int k) {
    _topK = k.clamp(1, 10);
    notifyListeners();
  }

  void clearConversation() {
    _messages.clear();
    _error = null;
    _activeToolName = null;
    _lastActionResult = null;
    notifyListeners();
  }

  // ── Hands Free Toggle ───────────────────────────────────────────────────────
  Future<void> toggleHandsFree(String userName) async {
    _handsFree = !_handsFree;
    _voiceError = null;

    if (_handsFree) {
      final initialized = await _voice.init();
      if (!initialized) {
        _handsFree = false;
        _voiceState = VoiceState.error;
        _voiceError = 'Microphone permission denied or speech recognition unavailable.';
        notifyListeners();
        return;
      }
      if (_useLiveWebSocket) {
        await ensureWsConnected();
      }
      await _startWakeListening(userName);
    } else {
      await stopHandsFree();
    }
    notifyListeners();
  }

  Future<void> stopHandsFree() async {
    _handsFree = false;
    _voiceState = VoiceState.idle;
    _liveTranscript = '';
    await _voice.stopListening();
    await _voice.stopSpeaking();
    notifyListeners();
  }

  Future<void> _startWakeListening(String userName) async {
    if (!_handsFree) return;
    _voiceState = VoiceState.wakeListening;
    _liveTranscript = '';
    notifyListeners();

    await _voice.startListening(
      onResult: (words, isFinal) {
        _liveTranscript = words;
        notifyListeners();

        if (_voice.matchesWakePhrase(words)) {
          _handleWakeDetected(userName);
        }
      },
      onStatusChange: (status) {
        if (status == 'notListening' && _handsFree && _voiceState == VoiceState.wakeListening) {
          _startWakeListening(userName);
        }
      },
      pauseFor: const Duration(seconds: 5),
      listenFor: const Duration(minutes: 5),
    );
  }

  Future<void> _handleWakeDetected(String userName) async {
    await _voice.stopListening();
    _voiceState = VoiceState.wakeDetected;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 300));
    if (!_handsFree) return;

    if (_useLiveWebSocket) {
      final ok = await ensureWsConnected();
      if (ok) {
        _liveWs.sendGreeting();
        _voiceState = VoiceState.listeningForQuery;
        notifyListeners();
        return;
      }
    }

    final firstName = userName.trim().split(' ').first;
    final greeting = 'Hello $firstName. How can I help you?';

    _voiceState = VoiceState.greeting;
    notifyListeners();

    await _voice.speak(
      greeting,
      onComplete: () {
        if (_handsFree) {
          startListeningForUserQuery(userName);
        }
      },
    );
  }

  Future<void> startListeningForUserQuery(String userName) async {
    _voiceState = VoiceState.listeningForQuery;
    _liveTranscript = '';
    notifyListeners();

    await _voice.startListening(
      onResult: (words, isFinal) async {
        _liveTranscript = words;
        notifyListeners();

        if (isFinal && words.trim().isNotEmpty) {
          final query = words.trim();
          await _voice.stopListening();

          if (!_voice.matchesWakePhrase(query)) {
            await askQuestion(query, speakResponse: _handsFree, userName: userName);
          } else if (_handsFree) {
            _startWakeListening(userName);
          }
        }
      },
      onStatusChange: (status) {
        if (status == 'notListening' && _voiceState == VoiceState.listeningForQuery) {
          if (_liveTranscript.trim().isNotEmpty) {
            final query = _liveTranscript.trim();
            if (!_voice.matchesWakePhrase(query)) {
              askQuestion(query, speakResponse: _handsFree, userName: userName);
              return;
            }
          }
          if (_handsFree) {
            _startWakeListening(userName);
          } else {
            _voiceState = VoiceState.idle;
            notifyListeners();
          }
        }
      },
      pauseFor: const Duration(seconds: 2),
      listenFor: const Duration(seconds: 30),
    );
  }

  // Quick single voice query (push to talk)
  Future<void> recordQuickVoiceQuery() async {
    final initialized = await _voice.init();
    if (!initialized) {
      _voiceError = 'Microphone permission needed.';
      notifyListeners();
      return;
    }

    if (_voiceState == VoiceState.listeningForQuery) {
      await _voice.stopListening();
      if (_liveTranscript.trim().isNotEmpty) {
        await askQuestion(_liveTranscript.trim(), speakResponse: true);
      }
      _voiceState = VoiceState.idle;
      notifyListeners();
      return;
    }

    _voiceState = VoiceState.listeningForQuery;
    _liveTranscript = '';
    notifyListeners();

    await _voice.startListening(
      onResult: (words, isFinal) async {
        _liveTranscript = words;
        notifyListeners();

        if (isFinal && words.trim().isNotEmpty) {
          final query = words.trim();
          await _voice.stopListening();
          _voiceState = VoiceState.idle;
          notifyListeners();
          await askQuestion(query, speakResponse: true);
        }
      },
      onStatusChange: (status) {
        if (status == 'notListening' && _voiceState == VoiceState.listeningForQuery) {
          _voiceState = VoiceState.idle;
          notifyListeners();
        }
      },
    );
  }

  Future<void> askQuestion(String question, {bool speakResponse = false, String? userName}) async {
    if (question.trim().isEmpty) return;

    final userMsg = IntelligenceMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: question.trim(),
      isUser: true,
      timestamp: DateTime.now(),
    );

    _messages.add(userMsg);
    _isQuerying = true;
    _voiceState = VoiceState.queryProcessing;
    _error = null;
    notifyListeners();

    // ── Live WebSocket Path (Nova Real-Time Agent with Automation Tools) ──
    if (_useLiveWebSocket) {
      final connected = await ensureWsConnected();
      if (connected) {
        _liveWs.sendText(question.trim());
        return;
      }
    }

    // ── REST HTTP Fallback ──
    try {
      final res = await _api.post(
        ApiConstants.intelligenceAsk,
        data: {
          'question': question.trim(),
          'top_k': _topK,
          'provider': _selectedProvider,
        },
      );

      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        final parsed = IntelligenceResponse.fromJson(res.data as Map<String, dynamic>);
        final aiMsg = IntelligenceMessage(
          id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
          text: parsed.answer,
          isUser: false,
          timestamp: DateTime.now(),
          sources: parsed.sources,
          provider: parsed.provider,
          model: parsed.model,
        );
        _messages.add(aiMsg);

        if (speakResponse) {
          _voiceState = VoiceState.speakingAnswer;
          notifyListeners();
          final cleanSpeech = parsed.answer.replaceAll(RegExp(r'[*#_`]'), '');
          await _voice.speak(
            cleanSpeech,
            onComplete: () {
              if (_handsFree && userName != null) {
                _startWakeListening(userName);
              } else {
                _voiceState = VoiceState.idle;
                notifyListeners();
              }
            },
          );
        } else {
          _voiceState = VoiceState.idle;
        }
      } else {
        throw Exception('Unexpected response format from server');
      }
    } on DioException catch (e) {
      String errMsg = 'Failed to generate answer.';
      if (e.response?.data is Map) {
        final data = e.response!.data as Map;
        errMsg = data['detail'] is Map ? (data['detail']['detail'] ?? data['detail']['error'] ?? errMsg) : (data['detail'] ?? errMsg);
      } else if (e.message != null) {
        errMsg = e.message!;
      }

      final errorMsg = IntelligenceMessage(
        id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
        text: '⚠️ $errMsg',
        isUser: false,
        timestamp: DateTime.now(),
        isError: true,
      );
      _messages.add(errorMsg);
      _error = errMsg;
      _voiceState = VoiceState.idle;
    } catch (e) {
      final errorMsg = IntelligenceMessage(
        id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
        text: '⚠️ Unexpected error: $e',
        isUser: false,
        timestamp: DateTime.now(),
        isError: true,
      );
      _messages.add(errorMsg);
      _error = e.toString();
      _voiceState = VoiceState.idle;
    } finally {
      _isQuerying = false;
      notifyListeners();
    }
  }

  Future<void> speakMessage(String text) async {
    final cleanSpeech = text.replaceAll(RegExp(r'[*#_`]'), '');
    await _voice.speak(cleanSpeech);
  }

  Future<void> stopSpeaking() async {
    await _voice.stopSpeaking();
  }

  Future<void> openAppSettings() async {
    await _voice.openSettings();
  }

  @override
  void dispose() {
    _liveWs.disconnect();
    super.dispose();
  }
}
