import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/student_provider.dart';
import '../../core/services/cloudinary_service.dart';
import 'edit_profile_screen.dart';
import '../settings/settings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardWhite,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text('Are you sure you want to sign out of MirrorMind?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textCaption)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.rose,
              foregroundColor: Colors.white,
              minimumSize: const Size(90, 40),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              auth.logout();
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final student = context.watch<StudentProvider>().student;

    return Scaffold(
      backgroundColor: AppTheme.canvas,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Student Profile', style: AppTheme.heading2(context)),
                      const SizedBox(height: 2),
                      Text('Your verified digital twin data', style: AppTheme.caption(context)),
                    ],
                  ),
                  GestureDetector(
                    onTap: () => _confirmLogout(context, auth),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.roseBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.rose.withValues(alpha: 0.2), width: 1.0),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.logout_rounded, size: 16, color: AppTheme.rose),
                          SizedBox(width: 6),
                          Text(
                            'Logout',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.rose,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Portfolio hero card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.cardWhite,
                  borderRadius: AppTheme.cardRadius,
                  border: Border.all(color: AppTheme.borderLight, width: 1.0),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: Row(
                  children: [
                    _AvatarEditor(avatarUrl: auth.user?.avatarUrl),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  auth.user?.name ?? 'Student',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    color: AppTheme.textPrimary,
                                    letterSpacing: -0.3,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(Icons.verified_rounded, size: 16, color: AppTheme.primary),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            auth.user?.email ?? '',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textCaption),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (student != null) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${student.branch} • ${student.collegeTier}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.primary,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              if (student != null) ...[
                const SizedBox(height: 16),
                _infoCard(context, student.careerInterest, student.semester, student.backlogCount, student.cgpa),
                const SizedBox(height: 16),
                _skillsCard(context, student.skills, student.certifications),
              ],

              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                      ),
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text('Edit Profile'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(54, 50),
                      padding: EdgeInsets.zero,
                    ),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    ),
                    child: const Icon(Icons.settings_outlined, color: AppTheme.textPrimary, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoCard(BuildContext context, String interest, int sem, int backlogs, double cgpa) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          _infoRow('Career Target', interest, Icons.track_changes_rounded, AppTheme.primary),
          const Divider(height: 22, color: Color(0xFFF1F5F9)),
          _infoRow('Current Term', 'Semester $sem', Icons.calendar_today_rounded, AppTheme.emerald),
          const Divider(height: 22, color: Color(0xFFF1F5F9)),
          _infoRow('Current CGPA', cgpa.toStringAsFixed(2), Icons.grade_rounded, AppTheme.amber),
          const Divider(height: 22, color: Color(0xFFF1F5F9)),
          _infoRow(
            'Active Backlogs',
            backlogs == 0 ? 'Clear (0)' : '$backlogs Backlogs',
            Icons.warning_amber_rounded,
            backlogs == 0 ? AppTheme.emerald : AppTheme.rose,
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, IconData icon, Color iconColor) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: iconColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppTheme.textBody),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppTheme.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _skillsCard(BuildContext context, List<String> skills, List<String> certs) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Profile Skills',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
              ),
              Text('${skills.length} listed', style: const TextStyle(fontSize: 11, color: AppTheme.textCaption)),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: skills.map((s) => _skillChip(s)).toList(),
          ),
          if (certs.isNotEmpty) ...[
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Certifications',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                ),
                Text('${certs.length} verified', style: const TextStyle(fontSize: 11, color: AppTheme.textCaption)),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: certs.map((c) => _certChip(c)).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _skillChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.primaryLight,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppTheme.primary,
        ),
      ),
    );
  }

  Widget _certChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.emeraldBg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.2), width: 1.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.verified_outlined, size: 12, color: AppTheme.emerald),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.emeraldText,
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarEditor extends StatefulWidget {
  final String? avatarUrl;
  const _AvatarEditor({this.avatarUrl});

  @override
  State<_AvatarEditor> createState() => _AvatarEditorState();
}

class _AvatarEditorState extends State<_AvatarEditor> {
  bool _uploading = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;

    setState(() => _uploading = true);
    final url = await CloudinaryService()
        .uploadFile(File(file.path), CloudinaryFolder.avatars);
    setState(() => _uploading = false);

    if (url != null && mounted) {
      context.read<AuthProvider>().updateAvatar(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _uploading ? null : _pick,
      child: Stack(
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderLight, width: 1.5),
              boxShadow: AppTheme.cardShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: _uploading
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(AppTheme.primary)))
                  : widget.avatarUrl != null
                      ? CachedNetworkImage(
                          imageUrl: widget.avatarUrl!,
                          fit: BoxFit.cover,
                        )
                      : const Center(
                          child: Icon(Icons.person_rounded, size: 32, color: AppTheme.primary),
                        ),
            ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: AppTheme.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              child: const Icon(Icons.camera_alt_rounded, size: 11, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
