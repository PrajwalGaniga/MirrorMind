import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../constants/api.dart';

enum LiveWsState {
  disconnected,
  connecting,
  connected,
  error,
}

class LiveVoiceWebSocketService {
  static final LiveVoiceWebSocketService _instance = LiveVoiceWebSocketService._internal();
  factory LiveVoiceWebSocketService() => _instance;
  LiveVoiceWebSocketService._internal();

  WebSocket? _ws;
  LiveWsState _state = LiveWsState.disconnected;
  StreamSubscription? _sub;

  // Callbacks
  Function(LiveWsState state)? onStateChange;
  Function(String chunk)? onTextChunk;
  Function()? onTurnComplete;
  Function(String toolName, Map<String, dynamic> args)? onToolStart;
  Function(String action, Map<String, dynamic> data)? onUIAction;
  Function()? onInterrupted;
  Function(String error)? onError;
  Function(List<int> bytes)? onAudioBytes;

  LiveWsState get state => _state;
  bool get isConnected => _state == LiveWsState.connected && _ws != null;

  void _setState(LiveWsState s) {
    _state = s;
    onStateChange?.call(s);
  }

  Future<bool> connect(String token) async {
    if (_state == LiveWsState.connected && _ws != null) return true;

    _setState(LiveWsState.connecting);
    final wsUrl = '${ApiConstants.voiceLiveWs}?token=$token';
    debugPrint('[LIVE_WS] Connecting to $wsUrl');

    try {
      _ws = await WebSocket.connect(wsUrl).timeout(const Duration(seconds: 12));
      _setState(LiveWsState.connected);
      debugPrint('[LIVE_WS] Connected successfully.');

      _sub = _ws!.listen(
        (data) {
          _handleIncoming(data);
        },
        onError: (err) {
          debugPrint('[LIVE_WS] Stream error: $err');
          _setState(LiveWsState.error);
          onError?.call(err.toString());
          disconnect();
        },
        onDone: () {
          debugPrint('[LIVE_WS] Stream closed.');
          _setState(LiveWsState.disconnected);
          disconnect();
        },
        cancelOnError: true,
      );

      return true;
    } catch (e) {
      debugPrint('[LIVE_WS] Connection failed: $e');
      _setState(LiveWsState.error);
      onError?.call('Could not connect to Nova Live Voice Server: $e');
      return false;
    }
  }

  void _handleIncoming(dynamic data) {
    if (data is String) {
      try {
        final Map<String, dynamic> json = jsonDecode(data);
        final type = json['type'] as String?;

        if (type == 'TEXT_CHUNK') {
          final text = json['text'] as String? ?? '';
          if (text.isNotEmpty) onTextChunk?.call(text);
        } else if (type == 'TURN_COMPLETE') {
          onTurnComplete?.call();
        } else if (type == 'TOOL_START') {
          final tool = json['name'] as String? ?? '';
          final args = (json['args'] as Map<String, dynamic>?) ?? {};
          onToolStart?.call(tool, args);
        } else if (type == 'UI_ACTION') {
          final action = json['action'] as String? ?? '';
          onUIAction?.call(action, json);
        } else if (type == 'INTERRUPTED') {
          onInterrupted?.call();
        } else if (type == 'ERROR') {
          final msg = json['message'] as String? ?? 'Server error';
          onError?.call(msg);
        }
      } catch (e) {
        debugPrint('[LIVE_WS] Error parsing json: $e');
      }
    } else if (data is List<int>) {
      onAudioBytes?.call(data);
    }
  }

  void sendText(String text) {
    if (!isConnected) return;
    final payload = jsonEncode({
      'type': 'TEXT_INPUT',
      'text': text,
    });
    try {
      _ws?.add(payload);
      debugPrint('[LIVE_WS] Sent TEXT_INPUT: $text');
    } catch (e) {
      debugPrint('[LIVE_WS] Error sending text: $e');
    }
  }

  void sendGreeting() {
    if (!isConnected) return;
    final payload = jsonEncode({'type': 'START_GREETING'});
    try {
      _ws?.add(payload);
      debugPrint('[LIVE_WS] Sent START_GREETING');
    } catch (e) {
      debugPrint('[LIVE_WS] Error sending greeting: $e');
    }
  }

  void sendPing() {
    if (!isConnected) return;
    final payload = jsonEncode({'type': 'PING'});
    try {
      _ws?.add(payload);
    } catch (_) {}
  }

  Future<void> disconnect() async {
    try {
      await _sub?.cancel();
      _sub = null;
      await _ws?.close();
      _ws = null;
    } catch (_) {}
    _setState(LiveWsState.disconnected);
  }
}
