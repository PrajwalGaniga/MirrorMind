import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class NeoCard extends StatelessWidget {
  final Widget child;
  final Color backgroundColor;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double borderWidth;
  final double borderRadius;

  const NeoCard({
    super.key,
    required this.child,
    this.backgroundColor = AppTheme.cardWhite,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.borderWidth = 3,
    this.borderRadius = 20,
  });

  @override
  Widget build(BuildContext context) {
    final cardContent = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppTheme.borderBlack, width: borderWidth),
        boxShadow: AppTheme.cardShadow,
      ),
      child: child,
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: cardContent,
      );
    }

    return cardContent;
  }
}
