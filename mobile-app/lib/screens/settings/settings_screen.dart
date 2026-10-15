import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/neo_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SettingsProvider>().fetchApiKey();
    });
  }

  void _showRegenerateDialog() {
    final pwdCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppTheme.borderLight, width: 1.0),
        ),
        backgroundColor: AppTheme.cardWhite,
        title: Text('Regenerate API Key', style: AppTheme.heading2(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Regenerating will revoke your existing VS Code extension key. Please confirm your account password:',
              style: AppTheme.body(context),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: pwdCtrl,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Account Password',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppTheme.borderLight, width: 1.0),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textCaption)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              minimumSize: const Size(100, 40),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              final pwd = pwdCtrl.text.trim();
              if (pwd.isEmpty) return;
              Navigator.pop(ctx);
              await context.read<SettingsProvider>().regenerateApiKey(pwd);
            },
            child: const Text('Regenerate'),
          ),
        ],
      ),
    );
  }

  void _copyToClipboard(String text, String message) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFF2E7D32),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<SettingsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings & API Keys'),
      ),
      body: RefreshIndicator(
        onRefresh: () => settings.fetchApiKey(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildAccountCard(auth),
            const SizedBox(height: 16),
            _buildApiKeyCard(settings),
            const SizedBox(height: 24),
            _buildLogoutButton(auth),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountCard(AuthProvider auth) {
    final user = auth.user;
    return NeoCard(
      backgroundColor: AppTheme.cardWhite,
      borderColor: AppTheme.borderLight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
                ),
                child: const Icon(Icons.person_rounded, size: 24, color: AppTheme.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.name ?? 'User Profile', style: AppTheme.cardTitle(context)),
                    Text(user?.email ?? '', style: AppTheme.caption(context)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildApiKeyCard(SettingsProvider settings) {
    final keyData = settings.apiKey;
    final hasKey = keyData != null && keyData.exists;

    return NeoCard(
      backgroundColor: AppTheme.cardWhite,
      borderColor: AppTheme.borderLight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
                ),
                child: const Icon(Icons.key_rounded, size: 22, color: AppTheme.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('VS Code Extension Key', style: AppTheme.cardTitle(context)),
                    Text(
                      'Authenticate your MirrorMind IDE extension to capture live code diagnostics.',
                      style: AppTheme.caption(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (settings.newRawKey != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.emeraldBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.25), width: 1.0),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '⚠️ Copy your new API Key now. You will not be able to see it again!',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.emeraldText),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          settings.newRawKey!,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_rounded, size: 20, color: AppTheme.emeraldText),
                        onPressed: () => _copyToClipboard(settings.newRawKey!, 'API Key copied to clipboard!'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (hasKey) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.canvas,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderLight, width: 1.0),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text('Status: ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.emeraldBg,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.25), width: 1),
                        ),
                        child: const Text('ACTIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.emeraldText)),
                      ),
                    ],
                  ),
                  if (keyData.keyPrefix != null) ...[
                    const SizedBox(height: 4),
                    Text('Key Prefix: ${keyData.keyPrefix}', style: const TextStyle(fontSize: 12, color: AppTheme.textBody)),
                  ],
                  if (keyData.createdAt != null) ...[
                    const SizedBox(height: 2),
                    Text('Created: ${keyData.createdAt}', style: const TextStyle(fontSize: 11, color: AppTheme.textCaption)),
                  ],
                  if (keyData.lastUsedAt != null) ...[
                    const SizedBox(height: 2),
                    Text('Last used: ${keyData.lastUsedAt}', style: const TextStyle(fontSize: 11, color: AppTheme.textCaption)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      minimumSize: const Size(0, 42),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _showRegenerateDialog,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Regenerate Key'),
                  ),
                ),
              ],
            ),
          ] else ...[
            Text('No active API key found for your account.', style: AppTheme.caption(context)),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: settings.isLoading ? null : () => settings.generateApiKey(),
              icon: const Icon(Icons.add_rounded),
              label: Text(settings.isLoading ? 'Generating…' : 'Generate Extension API Key'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLogoutButton(AuthProvider auth) {
    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppTheme.roseBg,
        foregroundColor: AppTheme.roseText,
        elevation: 0,
        side: BorderSide(color: AppTheme.rose.withValues(alpha: 0.25), width: 1.0),
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      onPressed: () => auth.logout(),
      icon: const Icon(Icons.logout_rounded),
      label: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}
