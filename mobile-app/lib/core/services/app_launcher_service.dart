import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

class AppLaunchResult {
  final bool success;
  final String appName;
  final String spokenReply;
  final String displayText;

  AppLaunchResult({
    required this.success,
    required this.appName,
    required this.spokenReply,
    required this.displayText,
  });
}

class AppLauncherService {
  static final AppLauncherService _instance = AppLauncherService._internal();
  factory AppLauncherService() => _instance;
  AppLauncherService._internal();

  /// Regex pattern to detect "turn on [app]", "open [app]", "launch [app]", "start [app]"
  static final RegExp appLaunchPattern = RegExp(
    r'\b(?:turn\s+on|open|launch|start|switch\s+to)\s+(?:my\s+)?(instagram|insta|whatsapp|wa|whats\s*app|youtube|yt|linkedin|github|spotify|twitter|x|camera|mail|gmail|maps|google\s+maps|browser|chrome|google)\b',
    caseSensitive: false,
  );

  /// Checks if an input string contains an app launch command.
  bool matches(String text) {
    return appLaunchPattern.hasMatch(text);
  }

  /// Extracts the target app name from text, if any.
  String? extractAppName(String text) {
    final match = appLaunchPattern.firstMatch(text);
    if (match != null && match.groupCount >= 1) {
      final raw = match.group(1)?.toLowerCase().replaceAll(RegExp(r'\s+'), '') ?? '';
      if (raw == 'insta' || raw == 'instagram') return 'instagram';
      if (raw == 'whatsapp' || raw == 'wa') return 'whatsapp';
      if (raw == 'youtube' || raw == 'yt') return 'youtube';
      if (raw == 'linkedin') return 'linkedin';
      if (raw == 'github') return 'github';
      if (raw == 'spotify') return 'spotify';
      if (raw == 'twitter' || raw == 'x') return 'twitter';
      if (raw == 'camera') return 'camera';
      if (raw == 'mail' || raw == 'gmail') return 'mail';
      if (raw == 'maps' || raw == 'googlemaps') return 'maps';
      if (raw == 'browser' || raw == 'chrome' || raw == 'google') return 'browser';
      return raw;
    }
    return null;
  }

  /// Launches the requested external application.
  Future<AppLaunchResult> launchByIntent(String input) async {
    final target = extractAppName(input);
    if (target == null) {
      return AppLaunchResult(
        success: false,
        appName: 'Unknown',
        spokenReply: "I couldn't identify which app you'd like to open.",
        displayText: "App launch intent not recognized.",
      );
    }

    return await launchApp(target);
  }

  /// Launches specific app by identifier.
  Future<AppLaunchResult> launchApp(String target) async {
    debugPrint('[APP_LAUNCHER] Attempting to open target: $target');

    switch (target.toLowerCase()) {
      case 'instagram':
        return await _launchAppWithFallbacks(
          appName: 'Instagram',
          schemes: [
            Uri.parse('instagram://app'),
            Uri.parse('instagram://camera'),
          ],
          webFallback: Uri.parse('https://www.instagram.com'),
        );

      case 'whatsapp':
        return await _launchAppWithFallbacks(
          appName: 'WhatsApp',
          schemes: [
            Uri.parse('whatsapp://send'),
            Uri.parse('whatsapp://app'),
          ],
          webFallback: Uri.parse('https://web.whatsapp.com'),
        );

      case 'youtube':
        return await _launchAppWithFallbacks(
          appName: 'YouTube',
          schemes: [
            Uri.parse('vnd.youtube://'),
            Uri.parse('youtube://'),
          ],
          webFallback: Uri.parse('https://www.youtube.com'),
        );

      case 'linkedin':
        return await _launchAppWithFallbacks(
          appName: 'LinkedIn',
          schemes: [
            Uri.parse('linkedin://'),
            Uri.parse('linkedin://profile'),
          ],
          webFallback: Uri.parse('https://www.linkedin.com'),
        );

      case 'github':
        return await _launchAppWithFallbacks(
          appName: 'GitHub',
          schemes: [
            Uri.parse('github://'),
          ],
          webFallback: Uri.parse('https://github.com'),
        );

      case 'spotify':
        return await _launchAppWithFallbacks(
          appName: 'Spotify',
          schemes: [
            Uri.parse('spotify://'),
          ],
          webFallback: Uri.parse('https://open.spotify.com'),
        );

      case 'twitter':
        return await _launchAppWithFallbacks(
          appName: 'X (Twitter)',
          schemes: [
            Uri.parse('twitter://'),
          ],
          webFallback: Uri.parse('https://x.com'),
        );

      case 'mail':
        return await _launchAppWithFallbacks(
          appName: 'Mail',
          schemes: [
            Uri.parse('mailto:'),
          ],
          webFallback: Uri.parse('https://mail.google.com'),
        );

      case 'maps':
        return await _launchAppWithFallbacks(
          appName: 'Google Maps',
          schemes: [
            Uri.parse('geo:0,0?q='),
          ],
          webFallback: Uri.parse('https://maps.google.com'),
        );

      case 'browser':
        final googleUri = Uri.parse('https://www.google.com');
        final launched = await launchUrl(googleUri, mode: LaunchMode.externalApplication);
        return AppLaunchResult(
          success: launched,
          appName: 'Browser',
          spokenReply: launched ? "Opening browser for you." : "Could not open browser.",
          displayText: launched ? "🌐 Opened Browser" : "Failed to open browser",
        );

      case 'camera':
        // Try launching camera or tell user
        return AppLaunchResult(
          success: true,
          appName: 'Camera',
          spokenReply: "Please tap the camera button on your device to snap a photo.",
          displayText: "📸 Camera triggered",
        );

      default:
        return AppLaunchResult(
          success: false,
          appName: target,
          spokenReply: "I couldn't find an application handler for $target.",
          displayText: "Unsupported app target: $target",
        );
    }
  }

  Future<AppLaunchResult> _launchAppWithFallbacks({
    required String appName,
    required List<Uri> schemes,
    required Uri webFallback,
  }) async {
    for (final scheme in schemes) {
      try {
        if (await canLaunchUrl(scheme)) {
          final launched = await launchUrl(scheme, mode: LaunchMode.externalNonBrowserApplication);
          if (launched) {
            return AppLaunchResult(
              success: true,
              appName: appName,
              spokenReply: "Opening $appName for you.",
              displayText: "🚀 Launched $appName",
            );
          }
        }
      } catch (e) {
        debugPrint('[APP_LAUNCHER] Scheme $scheme error: $e');
      }
    }

    // Try launch directly without canLaunchUrl check (some newer Android OS versions require this)
    for (final scheme in schemes) {
      try {
        final launched = await launchUrl(scheme, mode: LaunchMode.externalApplication);
        if (launched) {
          return AppLaunchResult(
            success: true,
            appName: appName,
            spokenReply: "Opening $appName for you.",
            displayText: "🚀 Launched $appName",
          );
        }
      } catch (_) {}
    }

    // Fallback to web URL
    try {
      final launched = await launchUrl(webFallback, mode: LaunchMode.externalApplication);
      if (launched) {
        return AppLaunchResult(
          success: true,
          appName: appName,
          spokenReply: "Opening $appName in your browser.",
          displayText: "🌐 Opened $appName (Web)",
        );
      }
    } catch (e) {
      debugPrint('[APP_LAUNCHER] Web fallback failed: $e');
    }

    return AppLaunchResult(
      success: false,
      appName: appName,
      spokenReply: "I was unable to open $appName on this device.",
      displayText: "Could not open $appName",
    );
  }
}
