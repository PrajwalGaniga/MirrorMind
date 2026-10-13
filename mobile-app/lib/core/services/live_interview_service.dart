import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../constants/api.dart';

enum InterviewWsState {
  disconnected,
  connecting,
  connected,
  active,
  evaluating,
  error,
}

class InterviewTranscriptEntry {
  final String role; // 'assistant' or 'user'
  final String text;
  final bool isFinal;
  final DateTime timestamp;

  InterviewTranscriptEntry({
    required this.role,
    required this.text,
    required this.isFinal,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
}

class LiveInterviewService {
  static final LiveInterviewService _instance = LiveInterviewService._internal();
  factory LiveInterviewService() => _instance;
  LiveInterviewService._internal();

  WebSocket? _ws;
  InterviewWsState _state = InterviewWsState.disconnected;
  StreamSubscription? _sub;

  // Callbacks
  Function(InterviewWsState state)? onStateChange;
  Function(InterviewTranscriptEntry entry)? onTranscript;
  Function()? onInterrupted;
  Function(Map<String, dynamic> metrics)? onMetrics;
  Function(String error)? onError;
  Function(List<int> bytes)? onAudioBytes;

  InterviewWsState get state => _state;
  bool get isConnected => _state == InterviewWsState.connected || _state == InterviewWsState.active;

  void _setState(InterviewWsState s) {
    _state = s;
    onStateChange?.call(s);
  }

  Future<bool> connect({required String token, String role = 'Full Stack Developer'}) async {
    if (isConnected) return true;

    _setState(InterviewWsState.connecting);
    final encodedRole = Uri.encodeComponent(role);
    final wsUrl = '${ApiConstants.liveInterviewWs}?token=$token&role=$encodedRole';
    debugPrint('[INTERVIEW_WS] Connecting to $wsUrl');

    try {
      _ws = await WebSocket.connect(wsUrl).timeout(const Duration(seconds: 12));
      _setState(InterviewWsState.connected);
      debugPrint('[INTERVIEW_WS] Connected successfully.');

      _sub = _ws!.listen(
        (data) {
          _handleIncoming(data);
        },
        onError: (err) {
          debugPrint('[INTERVIEW_WS] Error: $err');
          _setState(InterviewWsState.error);
          onError?.call(err.toString());
          disconnect();
        },
        onDone: () {
          debugPrint('[INTERVIEW_WS] Disconnected.');
          _setState(InterviewWsState.disconnected);
          disconnect();
        },
        cancelOnError: true,
      );

      // Trigger start interview greeting
      startInterview();
      return true;
    } catch (e) {
      debugPrint('[INTERVIEW_WS] Connection failed: $e');
      _setState(InterviewWsState.error);
      onError?.call('Could not connect to Live Interview Server: $e');
      return false;
    }
  }

  void _handleIncoming(dynamic data) {
    if (data is String) {
      try {
        final Map<String, dynamic> json = jsonDecode(data);
        final type = json['type'] as String?;

        if (type == 'TRANSCRIPT') {
          final role = json['role'] as String? ?? 'assistant';
          final text = json['text'] as String? ?? '';
          final isFinal = json['isFinal'] as bool? ?? false;
          if (text.isNotEmpty) {
            onTranscript?.call(InterviewTranscriptEntry(
              role: role,
              text: text,
              isFinal: isFinal,
            ));
          }
        } else if (type == 'INTERRUPTED') {
          onInterrupted?.call();
        } else if (type == 'METRICS') {
          onMetrics?.call(json);
        } else if (type == 'ERROR') {
          onError?.call(json['message'] as String? ?? 'Interview server error');
        }
      } catch (e) {
        debugPrint('[INTERVIEW_WS] Error parsing json: $e');
      }
    } else if (data is List<int>) {
      onAudioBytes?.call(data);
    }
  }

  void startInterview() {
    if (_ws == null) return;
    _ws?.add(jsonEncode({'type': 'START_INTERVIEW'}));
    _setState(InterviewWsState.active);
  }

  void sendActivityStart() {
    if (!isConnected) return;
    _ws?.add(jsonEncode({'type': 'ACTIVITY_START'}));
  }

  void sendActivityEnd() {
    if (!isConnected) return;
    _ws?.add(jsonEncode({'type': 'ACTIVITY_END'}));
  }

  void sendCandidateText(String text) {
    if (!isConnected) return;
    sendActivityStart();
    _ws?.add(jsonEncode({'type': 'CANDIDATE_TEXT', 'text': text}));
    sendActivityEnd();
  }

  Future<void> disconnect() async {
    try {
      await _sub?.cancel();
      _sub = null;
      await _ws?.close();
      _ws = null;
    } catch (_) {}
    _setState(InterviewWsState.disconnected);
  }
}
