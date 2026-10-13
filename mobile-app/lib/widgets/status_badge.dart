import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  final String text;
  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.text,
    this.backgroundColor = AppTheme.lavender,
    this.textColor = AppTheme.textPrimary,
    this.icon,
  });

  factory StatusBadge.processing(String status) {
    switch (status.toLowerCase()) {
      case 'processed':
        return const StatusBadge(
          text: 'Processed',
          backgroundColor: AppTheme.mint,
          icon: Icons.check_circle_outline,
        );
      case 'processing':
        return const StatusBadge(
          text: 'Processing…',
          backgroundColor: AppTheme.peach,
          icon: Icons.sync,
        );
      case 'failed':
        return const StatusBadge(
          text: 'Failed',
          backgroundColor: AppTheme.softRed,
          icon: Icons.error_outline,
        );
      default:
        return const StatusBadge(
          text: 'Uploaded',
          backgroundColor: AppTheme.skyBlue,
          icon: Icons.cloud_upload_outlined,
        );
    }
  }

  factory StatusBadge.embedding(String? status) {
    switch (status?.toLowerCase()) {
      case 'embedded':
        return const StatusBadge(
          text: 'Indexed in FAISS',
          backgroundColor: AppTheme.mint,
          icon: Icons.bolt,
        );
      case 'embedding':
        return const StatusBadge(
          text: 'Embedding…',
          backgroundColor: AppTheme.lavender,
          icon: Icons.hourglass_top,
        );
      case 'failed':
        return const StatusBadge(
          text: 'Embed Failed',
          backgroundColor: AppTheme.softRed,
          icon: Icons.warning_amber,
        );
      default:
        return const StatusBadge(
          text: 'Not Indexed',
          backgroundColor: Color(0xFFE0E0E0),
          icon: Icons.remove_circle_outline,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderBlack, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}
