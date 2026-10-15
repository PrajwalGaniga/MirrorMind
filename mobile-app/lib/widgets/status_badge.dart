import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  final String text;
  final Color backgroundColor;
  final Color textColor;
  final Color? borderColor;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.text,
    this.backgroundColor = AppTheme.lavender,
    this.textColor = AppTheme.primary,
    this.borderColor,
    this.icon,
  });

  factory StatusBadge.processing(String status) {
    switch (status.toLowerCase()) {
      case 'processed':
        return const StatusBadge(
          text: 'Processed',
          backgroundColor: AppTheme.emeraldBg,
          textColor: AppTheme.emeraldText,
          borderColor: Color(0xFFA7F3D0),
          icon: Icons.check_circle_rounded,
        );
      case 'processing':
        return const StatusBadge(
          text: 'Processing…',
          backgroundColor: AppTheme.amberBg,
          textColor: AppTheme.amberText,
          borderColor: Color(0xFFFDE68A),
          icon: Icons.sync_rounded,
        );
      case 'failed':
        return const StatusBadge(
          text: 'Failed',
          backgroundColor: AppTheme.roseBg,
          textColor: AppTheme.roseText,
          borderColor: Color(0xFFFECACA),
          icon: Icons.error_outline_rounded,
        );
      default:
        return const StatusBadge(
          text: 'Uploaded',
          backgroundColor: AppTheme.skyBg,
          textColor: AppTheme.skyText,
          borderColor: Color(0xFFBAE6FD),
          icon: Icons.cloud_upload_outlined,
        );
    }
  }

  factory StatusBadge.embedding(String? status) {
    switch (status?.toLowerCase()) {
      case 'embedded':
        return const StatusBadge(
          text: 'Indexed in FAISS',
          backgroundColor: AppTheme.emeraldBg,
          textColor: AppTheme.emeraldText,
          borderColor: Color(0xFFA7F3D0),
          icon: Icons.bolt_rounded,
        );
      case 'embedding':
        return const StatusBadge(
          text: 'Embedding…',
          backgroundColor: AppTheme.purpleBg,
          textColor: AppTheme.purpleText,
          borderColor: Color(0xFFDDD6FE),
          icon: Icons.hourglass_top_rounded,
        );
      case 'failed':
        return const StatusBadge(
          text: 'Embed Failed',
          backgroundColor: AppTheme.roseBg,
          textColor: AppTheme.roseText,
          borderColor: Color(0xFFFECACA),
          icon: Icons.warning_amber_rounded,
        );
      default:
        return const StatusBadge(
          text: 'Not Indexed',
          backgroundColor: Color(0xFFF1F5F9),
          textColor: Color(0xFF64748B),
          borderColor: Color(0xFFE2E8F0),
          icon: Icons.remove_circle_outline_rounded,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final borderCol = borderColor ?? textColor.withValues(alpha: 0.2);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderCol, width: 1.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: textColor,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
  }
}
