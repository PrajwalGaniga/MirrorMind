import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class NeoCard extends StatelessWidget {
  final Widget child;
  final Color backgroundColor;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double borderWidth;
  final double borderRadius;
  final Color? borderColor;
  final List<BoxShadow>? customShadow;

  const NeoCard({
    super.key,
    required this.child,
    this.backgroundColor = AppTheme.cardWhite,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.borderWidth = 1.0,
    this.borderRadius = 20,
    this.borderColor,
    this.customShadow,
  });

  @override
  Widget build(BuildContext context) {
    final borderCol = borderColor ?? AppTheme.borderLight;
    final cardContent = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: borderCol, width: borderWidth),
        boxShadow: customShadow ?? AppTheme.cardShadow,
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(borderRadius),
          child: cardContent,
        ),
      );
    }

    return cardContent;
  }
}
